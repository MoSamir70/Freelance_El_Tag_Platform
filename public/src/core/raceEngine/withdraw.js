// src/core/raceEngine/withdraw.js
// [FIX] تحسين معالجة الانسحاب وإلغاء المؤقتات بشكل كامل
// [FIX] إضافة التحقق من وجود العناصر قبل التعديل
// [FIX] استخدام RaceSessionManager بدلاً من window.raceData
// [FIX] تحديث activeEntityId بعد الانسحاب
// [FIX] تحسين نافذة تأكيد الانسحاب وإعادة تشغيل المؤقت عند الإلغاء

import { RaceSessionManager } from '../raceSession.js';
import { RaceEvents } from '../raceEvents.js';
import { updateSingleLane, clearAllRaceTimeouts, startTimerFromValue } from '../raceUI.js';
import { getStudentById, updateStudent, updateStudentStats } from '../../services/dataService.js';
import { DEFAULT_IMG } from '../../constants.js';
import { escapeHtml, showFloatingNotification } from '../../utils.js';
import { nextPlayer } from './turn.js';
import { exitRaceImmediate } from './lifecycle.js';

const Swal = window.Swal;

async function updateStatsWithdraw(studentId, points, deductHeart = false) {
    let stats = await getStudentStats(studentId);
    if (!stats) {
        stats = {
            totalAnswers: 0,
            correctAnswers: 0,
            speedAvg: 0,
            categoryStats: {},
            correctByCategory: {},
            difficultyStats: {},
            withdrawCount: 0
        };
    }
    stats.withdrawCount = (stats.withdrawCount || 0) + 1;
    await updateStudentStats(studentId, { withdrawCount: stats.withdrawCount });
    
    if (points !== 0) {
        const student = await getStudentById(studentId);
        if (student) {
            const newScore = Math.max(0, (student.score || 0) + points);
            await updateStudent(studentId, { score: newScore });
        }
    }
    
    if (deductHeart) {
        const session = RaceSessionManager.getActive();
        if (session && session.raceData && session.raceData.gameMode === 'solo_survival') {
            const raceData = session.raceData;
            const currentLives = raceData.survivalLives[studentId] ?? 3;
            const newLives = Math.max(0, currentLives - 1);
            raceData.survivalLives[studentId] = newLives;
            if (newLives === 0) {
                raceData.players = raceData.players.filter(p => String(p.id) !== String(studentId));
                if (raceData.players.length === 0) exitRaceImmediate(session.id);
                else RaceEvents.renderTracks(session.id);
            } else {
                showFloatingNotification(`💔 خصم قلب إضافي! المتبقي: ${newLives}`, 'urgent');
            }
        }
    }
}

function getValidSession(sessionId) {
    if (sessionId) {
        const session = RaceSessionManager.getSession(sessionId);
        if (session) return session;
    }
    const active = RaceSessionManager.getActive();
    if (active) return active;
    const sessions = RaceSessionManager.sessions;
    if (sessions.size > 0) return sessions.values().next().value;
    return null;
}

export async function withdrawEntity(sessionId, id, isTeam) {
    console.log('[Withdraw] Called with:', { sessionId, id, isTeam, typeOfId: typeof id });
    
    const session = getValidSession(sessionId);
    if (!session) {
        console.error('[Withdraw] No session found');
        showFloatingNotification('لا توجد جلسة سباق نشطة', 'error');
        return;
    }
    
    const actualSessionId = session.id;
    let raceData = session.raceData;
    
    if (raceData._gameEnded) {
        showFloatingNotification('اللعبة انتهت بالفعل', 'info');
        return;
    }
    
    // البحث عن الكيان
    let entity = null;
    let entityName = '';
    let entityImg = '';
    let actualIsTeam = isTeam;
    let rawId = id;
    
    if (typeof id === 'string' && id.startsWith('team_')) {
        actualIsTeam = true;
        rawId = id.replace('team_', '');
    }
    
    if (actualIsTeam) {
        const teamId = parseInt(rawId);
        entity = raceData.teams.find(t => t.id === teamId || String(t.id) === String(rawId));
        if (entity) {
            entityName = entity.name;
            entityImg = entity.members[0]?.img || DEFAULT_IMG;
        }
    } else {
        const playerIdStr = String(rawId);
        entity = raceData.players.find(p => String(p.id) === playerIdStr);
        if (!entity) {
            const numericId = parseInt(rawId);
            if (!isNaN(numericId)) {
                entity = raceData.players.find(p => p.id === numericId || String(p.id) === String(numericId));
            }
        }
        if (!entity && raceData.allPlayers) {
            entity = raceData.allPlayers.find(p => String(p.id) === playerIdStr);
        }
        if (entity) {
            entityName = entity.name;
            entityImg = entity.img || DEFAULT_IMG;
        }
    }
    
    if (!entity) {
        console.error('[Withdraw] Entity not found');
        showFloatingNotification('لم يتم العثور على اللاعب أو الفريق', 'error');
        return;
    }
    
    // التحقق من أن الكيان النشط هو نفسه
    const activeId = String(raceData.activeEntityId);
    const requesterId = actualIsTeam ? `team_${entity.id}` : String(entity.id);
    
    if (activeId !== requesterId) {
        Swal.fire({
            title: '⏳ ليس دورك',
            text: actualIsTeam ? 'لا يمكن للفريق الانسحاب الآن لأنه ليس دوره.' : 'لا يمكنك الانسحاب الآن، انتظر حتى يحين دورك.',
            icon: 'info',
            confirmButtonText: 'حسنًا',
            background: '#0f172a',
            color: '#fff'
        });
        return;
    }
    
    // حفظ الوقت المتبقي الحالي
    const savedTimeLeft = raceData.timeLeft;
    console.log('[Withdraw] Saving timeLeft before confirmation:', savedTimeLeft);
    
    // إيقاف المؤقتات وإخفاء السؤال
    RaceEvents.clearIntervals();
    RaceSessionManager.releaseLock(actualSessionId);
    RaceEvents.lockAnswers();
    if (raceData.memoryTimeout) {
        clearTimeout(raceData.memoryTimeout);
        raceData.memoryTimeout = null;
    }
    raceData._withdrawing = true;
    
    const qText = document.getElementById('question-text-display');
    const timerDiv = document.getElementById('timer-text');
    const barDiv = document.getElementById('timer-bar');
    const raceInterface = document.getElementById('race-interface');
    const originalZIndex = raceInterface ? raceInterface.style.zIndex : '';
    if (raceInterface) raceInterface.style.zIndex = '1000';
    
    if (qText) { qText.style.opacity = '0'; qText.style.visibility = 'hidden'; }
    if (timerDiv) timerDiv.style.opacity = '0';
    if (barDiv) barDiv.style.opacity = '0';
    
    let currentMemberForResume = null;
    if (!raceData.isTeam) {
        currentMemberForResume = raceData.players.find(p => String(p.id) === String(raceData.activeEntityId));
    } else if (raceData.allPlayers && raceData.allPlayers.length > 0) {
        currentMemberForResume = raceData.allPlayers[raceData.activePlayerIndex];
    }
    
    const isSurvivalMode = (raceData.gameMode === 'solo_survival' && !actualIsTeam);
    const PENALTY_POINTS = 50;
    
    const result = await Swal.fire({
        title: '⚠️ تأكيد الانسحاب',
        html: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
            <div style="display: flex; justify-content: center; width: 100%;">
                <img src="${entityImg}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid #facc15; object-fit: cover; box-shadow: 0 0 20px rgba(250,204,21,0.5); margin: 0 auto 1rem auto;">
            </div>
            <p style="font-size: 1.3rem; font-weight: bold; margin-bottom: 0.5rem; color: #fff;">${escapeHtml(entityName)}</p>
            <p style="color: #aaa; margin-bottom: 1rem;">هل أنت متأكد من الانسحاب؟</p>
            <div style="background: rgba(239, 68, 68, 0.2); border-radius: 20px; padding: 0.8rem; margin: 1rem 0; width: 100%;">
                <span style="font-size: 1.2rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">⚠️ <strong style="color: #ef4444;">سيتم خصم ${PENALTY_POINTS} نقطة${isSurvivalMode ? ' + قلب إضافي ❤️' : ''}</strong> ⚠️</span>
            </div>
            <p style="font-size: 0.9rem; color: #aaa;">لا يمكنك التراجع بعد تأكيد الانسحاب.</p>
        </div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، انسحب',
        cancelButtonText: 'إلغاء',
        background: 'rgba(15,25,45,0.95)',
        backdrop: 'rgba(0,0,0,0.7)',
        color: '#fff',
        iconColor: '#facc15',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        customClass: {
            popup: 'withdraw-popup',
            title: 'withdraw-title',
            confirmButton: 'withdraw-confirm-btn',
            cancelButton: 'withdraw-cancel-btn'
        },
        buttonsStyling: false,
        allowOutsideClick: false
    });
    
    // إعادة ظهور العناصر
    if (qText) { qText.style.opacity = ''; qText.style.visibility = ''; }
    if (timerDiv) timerDiv.style.opacity = '';
    if (barDiv) barDiv.style.opacity = '';
    if (raceInterface) raceInterface.style.zIndex = originalZIndex;
    raceData._withdrawing = false;
    
    if (result.isConfirmed) {
        // تم تأكيد الانسحاب
        if (actualIsTeam) {
            const teamId = entity.id;
            for (const member of entity.members) {
                const student = await getStudentById(member.id);
                if (student) {
                    await updateStudent(member.id, { score: Math.max(0, student.score - PENALTY_POINTS) });
                    await updateStatsWithdraw(member.id, -PENALTY_POINTS, false);
                }
            }
            const teacherCode = sessionStorage.getItem('peak_teacher_code');
            if (teacherCode && window.syncAllToFirebase) window.syncAllToFirebase(teacherCode);
            raceData.teams = raceData.teams.filter(t => t.id !== teamId);
            if (raceData.teams.length === 0) {
                exitRaceImmediate(actualSessionId);
                RaceEvents.notify('انسحب آخر فريق. انتهى السباق.', 'info');
                return;
            }
            RaceEvents.renderTracks(actualSessionId);
        } else {
            const playerId = entity.id;
            const student = await getStudentById(playerId);
            if (student) {
                await updateStudent(playerId, { score: Math.max(0, student.score - PENALTY_POINTS) });
                await updateStatsWithdraw(playerId, -PENALTY_POINTS, isSurvivalMode);
            }
            if (isSurvivalMode && raceData.survivalLives[playerId] === 0) {
                RaceEvents.renderTracks(actualSessionId);
            } else {
                raceData.players = raceData.players.filter(p => String(p.id) !== String(playerId));
            }
            if (raceData.players.length === 0) {
                exitRaceImmediate(actualSessionId);
                RaceEvents.notify('انسحب آخر لاعب. انتهى السباق.', 'info');
                return;
            }
            RaceEvents.renderTracks(actualSessionId);
        }
        
        // تحديث الكيان النشط إذا لزم الأمر
        const currentEntities = raceData.isTeam ? raceData.teams : raceData.players;
        const stillActive = currentEntities.find(e => {
            const eId = raceData.isTeam ? `team_${e.id}` : String(e.id);
            return eId === String(raceData.activeEntityId);
        });
        if (!stillActive && currentEntities.length > 0) {
            raceData.activeEntityId = raceData.isTeam ? `team_${currentEntities[0].id}` : currentEntities[0].id;
            raceData.turn = 0;
            updateSingleLane(actualSessionId, String(raceData.activeEntityId));
        }
        
        RaceEvents.notify(`❌ ${entityName} انسحب${isSurvivalMode ? ' وفقد قلبًا إضافيًا' : ''} وتم خصم ${PENALTY_POINTS} نقطة`, 'info');
        RaceEvents.clearIntervals();
        RaceSessionManager.releaseLock(actualSessionId);
        nextPlayer(actualSessionId);
    } else {
        // ❌ إلغاء الانسحاب: استعادة الوقت المتبقي وإعادة تشغيل المؤقت من نفس القيمة
        console.log('[Withdraw] Cancelled, restoring timeLeft to:', savedTimeLeft);
        const restoredTime = Math.min(raceData.timeLimit, Math.max(0, savedTimeLeft));
        raceData.timeLeft = restoredTime;
        raceData._timerStart = performance.now();
        raceData._timerDeadline = raceData._timerStart + (restoredTime * 1000);
        if (raceData._timerRaf) {
            cancelAnimationFrame(raceData._timerRaf);
            raceData._timerRaf = null;
        }
        startTimerFromValue(actualSessionId, restoredTime, currentMemberForResume);
        RaceEvents.unlockAnswers();
        if (typeof window.updateTimerUI === 'function') {
            window.updateTimerUI(actualSessionId);
        }
    }
}