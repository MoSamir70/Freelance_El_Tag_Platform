// src/core/raceEngine/lifecycle.js
// دوال دورة حياة السباق: بدء السباق والخروج الفوري
// [FIX] استخدام RaceSessionManager بدلاً من window.raceData
// [FIX] إزالة الاعتماد على raceReconnect.js (لمنع الأخطاء)
// [FIX] تحسين تنظيف المؤقتات ومنع تسرب الذاكرة

import { raceSettings } from '../raceSettings.js';
import { RaceSessionManager } from '../raceSession.js';
import { DEFAULT_IMG } from '../../constants.js';
import { loadQuestionsFromIndexedDB } from '../../db/indexeddb.js';
import { getStudents, canCreateOnlineGame, incrementOnlineGameCount, refreshTeacherPlanIfExpired } from '../../services/dataService.js';
import { RaceEvents } from '../raceEvents.js';
import { showFloatingNotification } from '../../utils.js';
import { startCountdown, clearAllRaceTimeouts } from '../raceUI.js';
import { startTurn } from './turn.js';
import { winGame } from './win.js';
import { db, doc, setDoc, deleteDoc, serverTimestamp } from '../../firebase/init.js';
import { registerAllModes } from '../modes/index.js';

let __modesRegistered = false;

/**
 * إنشاء وثيقة سباق في Firestore (للغرف الأونلاين والبطولات)
 */
export async function createRaceSession({
    sessionId,
    players,
    teams = [],
    isTeam = false,
    goal,
    timePerQuestion,
    gameMode,
    grade,
    subject,
    onlineRoomPin = null,
    tournamentId = null,
    matchId = null
}) {
    const playersForFirestore = players.map(p => ({
        id: p.id,
        name: p.name,
        img: p.img || DEFAULT_IMG,
        pos: 0,
        score: 0,
        grade: p.grade || grade,
        teacherId: p.teacherId || null
    }));

    const teamsForFirestore = isTeam ? teams.map(t => ({
        id: t.id,
        name: t.name,
        members: t.members.map(m => ({
            id: m.id,
            name: m.name,
            img: m.img || DEFAULT_IMG,
            score: 0,
            grade: m.grade || grade
        })),
        pos: 0,
        currentMemberIndex: 0,
        score: 0
    })) : [];

    const raceDoc = {
        sessionId,
        players: playersForFirestore,
        teams: teamsForFirestore,
        isTeam,
        goal,
        timePerQuestion,
        gameMode,
        grade,
        subject,
        status: 'waiting',
        currentQuestion: null,
        questionStartTime: null,
        pendingAnswer: null,
        winnerId: null,
        winnerName: null,
        createdAt: serverTimestamp(),
        startedAt: null,
        finishedAt: null,
        ...(onlineRoomPin && { onlineRoomPin }),
        ...(tournamentId && { tournamentId }),
        ...(matchId && { matchId })
    };

    try {
        await setDoc(doc(db, 'activeRaces', sessionId), raceDoc);
        console.log(`[Race] تم إنشاء وثيقة سباق في activeRaces: ${sessionId}`);
        return sessionId;
    } catch (error) {
        console.error('[Race] فشل إنشاء وثيقة السباق:', error);
        throw error;
    }
}

// ===================== بدء السباق =====================

export async function startRaceWithSettings(sessionId) {
    if (!__modesRegistered) {
        registerAllModes();
        __modesRegistered = true;
    }

    RaceEvents.clearIntervals();
    clearAllRaceTimeouts(sessionId);
    RaceSessionManager.releaseLock(sessionId);
    
    const turnOverlay = document.getElementById('turn-overlay');
    if (turnOverlay) { turnOverlay.classList.add('hidden'); turnOverlay.classList.remove('flex'); }
    const countdownOverlay = document.getElementById('countdown-overlay');
    if (countdownOverlay) countdownOverlay.style.display = 'none';
    const betOverlay = document.getElementById('bet-overlay');
    if (betOverlay) betOverlay.style.display = 'none';
    document.body.classList.remove('racing');

    let session = RaceSessionManager.getSession(sessionId);
    if (!session) {
        sessionId = RaceSessionManager.create();
        session = RaceSessionManager.getSession(sessionId);
        RaceSessionManager.setActive(sessionId);
    }
    const raceData = session.raceData;

    // التحقق من صلاحية المباراة الأونلاين حسب الاشتراك
    const isOnline = raceData.onlineMode === true || raceSettings.isOnline === true;
    if (isOnline) {
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        if (teacherCode) {
            await refreshTeacherPlanIfExpired(teacherCode);
            const canStart = await canCreateOnlineGame(teacherCode);
            if (!canStart.allowed) {
                RaceEvents.notify(canStart.message, 'error');
                if (typeof window.showPage === 'function') window.showPage('home');
                return;
            }
            raceData._pendingOnlineIncrement = true;
        }
    }

    // قراءة إعدادات الأوضاع الخاصة
    let memoryTime = 3;
    let minedChance = (typeof window.__selectedMinedChance === 'number') ? window.__selectedMinedChance : 30;
    let betMax = 3;
    const memoryTimeInput = document.getElementById('mode-memory-time');
    if (memoryTimeInput) {
        let val = parseInt(memoryTimeInput.value);
        if (!isNaN(val) && val > 0) memoryTime = val;
    }
    const betMaxInput = document.getElementById('mode-bet-max');
    if (betMaxInput) {
        let val = parseInt(betMaxInput.value);
        if (!isNaN(val) && val > 0) betMax = val;
    }
    raceSettings.modeSettings = { memoryTime, minedChance, betMax };
    if (raceSettings.gameMode === 'solo_bet') {
        raceSettings.modeSettings.betMax = 2;
    }

    // تحميل الأسئلة
    let questions = [];
    try {
        if (raceSettings.mergeMode && raceSettings.mergedMaterials && raceSettings.mergedMaterials.length > 0) {
            if (!raceSettings.grade) {
                RaceEvents.notify('يرجى تحديد الصف أولاً', 'error');
                if (typeof window.showPage === 'function') window.showPage('game-settings-page');
                return;
            }
            if (raceSettings.accumulative) {
                for (let material of raceSettings.mergedMaterials) {
                    let gradeQuestions = await loadQuestionsFromIndexedDB(raceSettings.grade);
                    let filtered = gradeQuestions.filter(q => q.subject === material);
                    questions.push(...filtered);
                }
            } else {
                if (raceSettings.selectedLessonsWithMaterial && raceSettings.selectedLessonsWithMaterial.length) {
                    for (let item of raceSettings.selectedLessonsWithMaterial) {
                        let gradeQuestions = await loadQuestionsFromIndexedDB(raceSettings.grade);
                        let filtered = gradeQuestions.filter(q => q.subject === item.material && q.lesson === item.lesson);
                        questions.push(...filtered);
                    }
                } else {
                    RaceEvents.notify('❌ لا توجد أسئلة مطابقة للدروس المدمجة', 'error');
                    if (typeof window.showPage === 'function') window.showPage('game-settings-page');
                    return;
                }
            }
            if (questions.length === 0) {
                RaceEvents.notify('❌ لا توجد أسئلة مطابقة للدروس المدمجة', 'error');
                if (typeof window.showPage === 'function') window.showPage('game-settings-page');
                return;
            }
            raceSettings.subject = null;
            raceSettings.accumulative = false;
        } else {
            if (!raceSettings.grade || !raceSettings.subject) {
                RaceEvents.notify('يرجى تحديد الصف والمادة أولاً', 'error');
                if (typeof window.showPage === 'function') window.showPage('game-settings-page');
                return;
            }
            questions = await loadQuestionsFromIndexedDB(raceSettings.grade);
            questions = questions.filter(q => q.subject === raceSettings.subject);
            if (!raceSettings.accumulative && raceSettings.lessons.length > 0) {
                questions = questions.filter(q => raceSettings.lessons.includes(q.lesson));
            }
            if (questions.length === 0) {
                RaceEvents.notify('لا توجد أسئلة مطابقة للاختيارات. تأكد من رفع أسئلة للصف والمادة المحددين.', 'error');
                if (typeof window.showPage === 'function') window.showPage('game-settings-page');
                return;
            }
        }
    } catch (err) {
        console.error('Error loading questions:', err);
        RaceEvents.notify('حدث خطأ أثناء تحميل الأسئلة: ' + err.message, 'error');
        if (typeof window.showPage === 'function') window.showPage('game-settings-page');
        return;
    }

    // خلط الأسئلة
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    session.activeGame = questions;
    session.globalUsedIds.clear();
    session.usedQuestionsPerPlayer = {};
    raceData.goal = raceSettings.goal;
    raceData.questionNumber = 0;
    raceData.timeLimit = raceSettings.timer;
    raceData.gameMode = raceSettings.gameMode;

    // إعداد اللاعبين أو الفرق (نفس الكود الأصلي، لم يتغير)
    if (raceSettings.isTeam) {
        raceData.teams = raceSettings.teams.map(team => ({ ...team, pos: 0, currentMemberIndex: 0 }));
        raceData.isTeam = true;
        raceData.players = [];
        raceData.turn = 0;
        raceData.activeEntityId = raceData.teams[0]?.id;
        session.usedQuestionsPerPlayer = {};
        session.globalUsedIds.clear();
        raceData.teams.forEach(team => team.members.forEach(member => {
            session.usedQuestionsPerPlayer[member.id] = new Set();
        }));
        const membersPerTeam = raceData.teams.map(team => [...team.members]);
        const maxMembers = Math.max(...membersPerTeam.map(arr => arr.length));
        const allPlayers = [];
        for (let i = 0; i < maxMembers; i++) {
            for (let t = 0; t < raceData.teams.length; t++) {
                const member = membersPerTeam[t][i];
                if (member) {
                    allPlayers.push({
                        id: member.id,
                        name: member.name,
                        img: member.img,
                        teamId: raceData.teams[t].id,
                        score: member.score || 0
                    });
                }
            }
        }
        raceData.allPlayers = allPlayers;
        raceData.activePlayerIndex = 0;
        raceData.sessionStats = {};
        raceData.allPlayers.forEach(p => {
            raceData.sessionStats[p.id] = { correct: 0, wrong: 0, scoreGained: 0 };
        });
    } else {
        let selectedStudents = [];
        if (raceSettings.players && raceSettings.players.length > 0) {
            selectedStudents = raceSettings.players.map(p => ({
                ...p,
                pos: 0,
                combo: 0,
                id: String(p.id)
            }));
        } else {
            const allStudents = await getStudents();
            const playerIds = raceSettings.studentIds || [];
            for (const id of playerIds) {
                let student = allStudents.find(s => String(s.id) === String(id) && !s.isTeacher);
                if (!student) {
                    student = {
                        id: String(id),
                        name: `لاعب ${id}`,
                        img: DEFAULT_IMG,
                        score: 0,
                        grade: raceSettings.grade || 'غير محدد',
                        teacherId: 'local'
                    };
                }
                selectedStudents.push(student);
            }
        }
        
        if (selectedStudents.length === 0) {
            RaceEvents.notify('لم يتم اختيار أي طالب', 'error');
            return;
        }
        
        raceData.players = selectedStudents.map(s => ({ ...s, pos: 0, combo: 0 }));
        raceData.isTeam = false;
        raceData.turn = 0;
        raceData.activeEntityId = raceData.players[0]?.id;
        session.usedQuestionsPerPlayer = {};
        session.globalUsedIds.clear();
        raceData.players.forEach(p => {
            session.usedQuestionsPerPlayer[p.id] = new Set();
            if (raceData.gameMode === 'solo_survival') {
                raceData.survivalLives[p.id] = 3;
            }
            if (raceData.gameMode === 'solo_quizrush') {
                raceData.quizrushStreak[p.id] = 0;
            }
        });
        raceData.sessionStats = {};
        raceData.players.forEach(p => {
            raceData.sessionStats[p.id] = { correct: 0, wrong: 0, scoreGained: 0 };
        });

        if (raceData.gameMode === 'solo_surprise') {
            raceData.surpriseMode = true;
            raceData.consecutiveCorrect = {};
            raceData.surpriseCardsUsed = {};
            raceData.processingSurprise = false;
            raceData.savedTimeLeft = 0;
            raceData.currentSurpriseCard = null;
            raceData._gameEnded = false;
            raceData.players.forEach(p => {
                raceData.consecutiveCorrect[p.id] = 0;
                raceData.surpriseCardsUsed[p.id] = 0;
            });
        }

        if (raceData.gameMode === 'solo_marathon') {
            raceData.players.forEach(p => {
                p.marathonQuestionsAnswered = 0;
                p.marathonTotalQuestions = raceData.goal;
            });
            raceData.allMarathonPlayers = [...raceData.players];
        }
    }

    // إنشاء كائن الوضع الحالي
    const { createMode } = await import('../modes/index.js');
    const currentModeInstance = createMode(raceData.gameMode, raceData, sessionId);
    raceData.currentMode = currentModeInstance;

    if (currentModeInstance) {
        const extraProps = currentModeInstance.onRaceStart();
        Object.assign(raceData, extraProps);
    }

    if (raceData.gameMode === 'solo_survival') {
        setTimeout(() => {
            const sessionNow = RaceSessionManager.getSession(sessionId);
            if (sessionNow && !sessionNow.raceData._gameEnded) {
                RaceEvents.renderTracks(sessionId);
                raceData.players.forEach(p => {
                    RaceEvents.updateSingleLane(sessionId, String(p.id));
                });
            }
        }, 50);
    }

    RaceSessionManager.updateSession(sessionId, { 
        raceData, 
        activeGame: session.activeGame, 
        usedQuestionsPerPlayer: session.usedQuestionsPerPlayer, 
        globalUsedIds: session.globalUsedIds 
    });

    // إنشاء وثيقة في activeRaces للغرف الأونلاين والبطولات (مع تجنب الأخطاء)
    const shouldCreateFirestoreDoc = isOnline || raceData.onlineRoom || raceData.tournamentId || raceSettings.onlineRoomPin;
    if (shouldCreateFirestoreDoc) {
        try {
            await createRaceSession({
                sessionId,
                players: raceData.players,
                teams: raceData.teams,
                isTeam: raceData.isTeam,
                goal: raceData.goal,
                timePerQuestion: raceData.timeLimit,
                gameMode: raceData.gameMode,
                grade: raceData.grade || raceSettings.grade,
                subject: raceData.subject || raceSettings.subject,
                onlineRoomPin: raceData.onlineRoom || raceSettings.onlineRoomPin,
                tournamentId: raceData.tournamentId || raceSettings.tournamentId,
                matchId: raceData.matchId || raceSettings.matchId
            });
            console.log(`[startRace] تم إنشاء وثيقة activeRaces للسباق ${sessionId}`);
            
            // إرسال ping دوري بسيط (بدون raceReconnect)
            const pingInterval = setInterval(async () => {
                const currentSession = RaceSessionManager.getSession(sessionId);
                if (currentSession?.raceData?.status === 'playing' && !currentSession.raceData._gameEnded) {
                    try {
                        await setDoc(doc(db, 'activeRaces', sessionId), { lastPing: serverTimestamp() }, { merge: true });
                    } catch(e) { /* ignore */ }
                } else {
                    clearInterval(pingInterval);
                }
            }, 10000);
            raceData._pingInterval = pingInterval;
            
        } catch (err) {
            console.error('[startRace] فشل إنشاء activeRaces، لكن سنكمل السباق محلياً:', err);
        }
    }

    // إظهار واجهة السباق
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.add('hidden');
    const raceUI = document.getElementById('race-interface');
    if (raceUI) {
        raceUI.classList.remove('hidden');
        raceUI.style.display = 'flex';
    }
    const timerText = document.getElementById('timer-text');
    if (timerText) timerText.classList.add('timer-fire');
    RaceEvents.clearIntervals();
    RaceSessionManager.releaseLock(sessionId);
    document.body.classList.add('racing');
    
    RaceEvents.renderTracks(sessionId);
    await startCountdown(sessionId);
    startTurn(sessionId);
    
    if (isOnline && raceData._pendingOnlineIncrement) {
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        if (teacherCode) {
            await incrementOnlineGameCount(teacherCode);
            delete raceData._pendingOnlineIncrement;
        }
    }
}

// ===================== الخروج الفوري =====================
export function exitRaceImmediate(sessionId) {
    console.log('[exitRaceImmediate] بدء عملية الخروج من الجلسة:', sessionId);
    
    const countdownOverlay = document.getElementById('countdown-overlay');
    if (countdownOverlay && countdownOverlay.style.display !== 'none') {
        countdownOverlay.style.display = 'none';
        if (window.countdownInterval) clearInterval(window.countdownInterval);
        if (window.countdownTimeout) clearTimeout(window.countdownTimeout);
        window.countdownInterval = null;
        window.countdownTimeout = null;
    }
    
    const turnOverlay = document.getElementById('turn-overlay');
    if (turnOverlay) {
        turnOverlay.classList.add('hidden');
        turnOverlay.classList.remove('flex');
    }
    
    if (window._pendingNextPlayerTimeout) {
        clearTimeout(window._pendingNextPlayerTimeout);
        window._pendingNextPlayerTimeout = null;
    }
    
    const betOverlay = document.getElementById('bet-overlay');
    if (betOverlay) betOverlay.style.display = 'none';
    if (window.betOverlayTimeout) clearTimeout(window.betOverlayTimeout);
    if (window.betOverlayInterval) clearInterval(window.betOverlayInterval);
    window.betOverlayTimeout = null;
    window.betOverlayInterval = null;
    
    const surpriseOverlay = document.getElementById('surprise-target-overlay');
    if (surpriseOverlay) surpriseOverlay.remove();
    
    const session = RaceSessionManager.getSession(sessionId);
    if (session && session.raceData) {
        session.raceData._gameEnded = true;
        if (session.raceData._timerRaf) cancelAnimationFrame(session.raceData._timerRaf);
        if (session.raceData.timerInterval) clearInterval(session.raceData.timerInterval);
        if (session.raceData.timerTimeout) clearTimeout(session.raceData.timerTimeout);
        if (session.raceData.memoryTimeout) clearTimeout(session.raceData.memoryTimeout);
        if (session.raceData._pingInterval) clearInterval(session.raceData._pingInterval);
        session.raceData._timerRaf = null;
        session.raceData.timerInterval = null;
        session.raceData.timerTimeout = null;
        session.raceData.memoryTimeout = null;
        session.raceData._pingInterval = null;
        
        delete window.__currentLoseAmount;
        delete window.__currentBetAmount;
    }
    
    RaceSessionManager.releaseLock(sessionId);
    clearAllRaceTimeouts(sessionId);
    RaceEvents.clearIntervals();
    
    (async () => {
        try {
            await deleteDoc(doc(db, 'activeRaces', sessionId));
            console.log(`[exitRaceImmediate] تم حذف activeRaces للسباق ${sessionId}`);
        } catch (err) {
            console.warn('[exitRaceImmediate] فشل حذف activeRaces:', err);
        }
    })();
    
    const raceUI = document.getElementById('race-interface');
    if (raceUI) {
        raceUI.classList.add('hidden');
        raceUI.style.display = 'none';
    }
    
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.remove('hidden');
    document.body.classList.remove('racing');
    
    if (sessionId === RaceSessionManager.activeId) RaceSessionManager.setActive(null);
    RaceSessionManager.destroy(sessionId);
    
    if (typeof window.restoreNavAfterRoom === 'function') window.restoreNavAfterRoom();
    if (typeof window.showPage === 'function') {
        window.showPage('home');
    } else if (!window.location.pathname.includes('arena.html')) {
        window.location.href = 'arena.html';
    }
    
    if (typeof updateUIAfterScoreChange === 'function') updateUIAfterScoreChange();
    
    console.log('[exitRaceImmediate] تم الخروج بنجاح:', sessionId);
}