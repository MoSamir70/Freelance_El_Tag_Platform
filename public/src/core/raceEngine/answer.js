// src/core/raceEngine/answer.js
// معالجة إجابة اللاعب (handleAnswer) – نسخة منقحة
// [FIX] إزالة throttle للتحديثات لمنع فقدان البيانات
// [FIX] إصلاح الماراثون: منح مكافآت الترتيب (50،30،15،5) مثل winGame
// [FIX] توحيد عرض النتائج وإظهار المكافآت
import { RaceSessionManager } from '../raceSession.js';
import { RaceEvents } from '../raceEvents.js';
import { updateSingleLane, clearAllRaceTimeouts } from '../raceUI.js';
import { showQuestion } from '../raceUI/questionDisplay.js';
import { getStudentById, updateStudent, getStudentStats, updateStudentStats, addGameHistory } from '../../services/dataService.js';
import { dbLight, save, updateUIAfterScoreChange } from '../../db/localstorage.js';
import { getRandomWinnerMessage, playWin as playWinSound, showFloatingNotification, escapeHtml } from '../../utils.js';
import { winGame } from './win.js';
import { nextPlayer } from './turn.js';
import { updateTimerUI } from '../raceUI/timer.js';
import { showChoiceOverlay } from '../raceUI/surpriseChoiceOverlay.js';
const Swal = window.Swal;

// ========== تم إزالة throttle بالكامل ==========
// سيتم استدعاء updateStats مباشرة في كل مرة

async function updateStatsInternal(studentId, correct, points, timeSpent, category, lesson, isWithdraw = false, currentQuestion = null) {
    let stats = await getStudentStats(studentId);
    if (!stats) {
        stats = {
            totalAnswers: 0,
            correctAnswers: 0,
            speedAvg: 0,
            categoryStats: {},
            correctByCategory: {},
            lessonStats: {},
            correctByLesson: {},
            difficultyStats: {},
            withdrawCount: 0
        };
    }

    if (isWithdraw) {
        stats.withdrawCount = (stats.withdrawCount || 0) + 1;
        await updateStudentStats(studentId, { withdrawCount: stats.withdrawCount });
    } else {
        const totalAnswers = (stats.totalAnswers || 0) + 1;
        const correctAnswers = (stats.correctAnswers || 0) + (correct ? 1 : 0);
        let speedAvg = stats.speedAvg || 0;
        if (timeSpent && timeSpent > 0) {
            speedAvg = ((stats.speedAvg || 0) * (stats.totalAnswers || 0) + timeSpent) / totalAnswers;
        }
        const updates = { totalAnswers, correctAnswers, speedAvg };
        
        if (category) {
            const categoryStats = { ...(stats.categoryStats || {}) };
            categoryStats[category] = (categoryStats[category] || 0) + 1;
            updates.categoryStats = categoryStats;
            const correctByCategory = { ...(stats.correctByCategory || {}) };
            if (correct) correctByCategory[category] = (correctByCategory[category] || 0) + 1;
            updates.correctByCategory = correctByCategory;
        }
        
        if (lesson) {
            const lessonStats = { ...(stats.lessonStats || {}) };
            lessonStats[lesson] = (lessonStats[lesson] || 0) + 1;
            updates.lessonStats = lessonStats;
            const correctByLesson = { ...(stats.correctByLesson || {}) };
            if (correct) correctByLesson[lesson] = (correctByLesson[lesson] || 0) + 1;
            updates.correctByLesson = correctByLesson;
        }
        
        let difficulty = currentQuestion?.difficulty;
        if (!difficulty) {
            const activeSession = RaceSessionManager.getActive();
            if (activeSession && activeSession.currentSelectedQuestion?.difficulty) {
                difficulty = activeSession.currentSelectedQuestion.difficulty;
            }
        }
        
        if (difficulty) {
            const difficultyStats = { ...(stats.difficultyStats || {}) };
            if (!difficultyStats[difficulty]) difficultyStats[difficulty] = { total: 0, correct: 0 };
            difficultyStats[difficulty].total++;
            if (correct) difficultyStats[difficulty].correct++;
            updates.difficultyStats = difficultyStats;
        }
        
        await updateStudentStats(studentId, updates);
    }

    if (points !== 0) {
        const student = await getStudentById(studentId);
        if (student) {
            const newScore = Math.max(0, (student.score || 0) + points);
            await updateStudent(studentId, { score: newScore });
            const activeSession = RaceSessionManager.getActive();
            if (activeSession && activeSession.raceData) {
                const raceData = activeSession.raceData;
                let entity = raceData.isTeam 
                    ? raceData.teams.find(t => t.members.some(m => String(m.id) === studentId))
                    : raceData.players.find(p => String(p.id) === studentId);
                if (entity) {
                    if (!raceData.isTeam) entity.score = newScore;
                    else {
                        const member = entity.members.find(m => String(m.id) === studentId);
                        if (member) member.score = newScore;
                    }
                }
            }
        }
    }
}

export function updateStats(studentId, correct, points, timeSpent, category, isWithdraw = false, currentQuestion = null) {
    const lesson = currentQuestion?.lesson || null;
    // استدعاء مباشر بدون throttle
    updateStatsInternal(studentId, correct, points, timeSpent, category, lesson, isWithdraw, currentQuestion).catch(err => console.error('updateStats error:', err));
}

function burstConfetti() {
    if (typeof canvasConfetti === 'function') {
        canvasConfetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.6 },
            startVelocity: 15,
            colors: ['#facc15', '#22c55e', '#3b82f6']
        });
    }
}

function shakeScreen() {
    document.body.classList.add('shake-screen');
    setTimeout(() => document.body.classList.remove('shake-screen'), 400);
}

export async function handleAnswer(sessionId, isCorrect, btn, category, betAmount, currentEntity, currentMember, isMinedQuestion) {
    if (window._isHandlingAnswer) return;
    
    const session = RaceSessionManager.getSession(sessionId);
    if (!session || session.raceData._gameEnded) {
        console.log('handleAnswer: الجلسة غير موجودة أو اللعبة انتهت، تجاهل');
        return;
    }
    
    let raceData = session.raceData;
    const isTraining = raceData.isTrainingMode === true;

    // ✅ منع الإجابة إذا لم يكن هذا اللاعب هو صاحب الدور الحالي
    let currentTurnOwnerId = null;
    if (raceData.isTeam) {
        if (raceData.gameMode === 'team_relay') {
            const activeTeam = raceData.teams.find(t => t.id === raceData.activeEntityId);
            if (activeTeam && activeTeam.members[activeTeam.currentMemberIndex]) {
                currentTurnOwnerId = activeTeam.members[activeTeam.currentMemberIndex].id;
            }
        } else {
            currentTurnOwnerId = raceData.activeEntityId;
        }
    } else {
        currentTurnOwnerId = raceData.activeEntityId;
    }
    const currentUserId = currentMember?.id || currentEntity?.id;
    if (currentTurnOwnerId && currentUserId && String(currentTurnOwnerId) !== String(currentUserId)) {
        console.warn(`منع الإجابة: ${currentUserId} ليس صاحب الدور (${currentTurnOwnerId})`);
        RaceEvents.notify('⛔ ليس دورك الآن! انتظر حتى يحين دورك.', 'error', 1500);
        if (btn) {
            btn.classList.add('wrong-ans');
            setTimeout(() => btn.classList.remove('wrong-ans'), 500);
        }
        window._isHandlingAnswer = false;
        return;
    }

    window._isHandlingAnswer = true;
    
    if (raceData.memoryTimeout) {
        clearTimeout(raceData.memoryTimeout);
        raceData.memoryTimeout = null;
        const qText = document.getElementById('question-text-display');
        if (qText) {
            qText.style.opacity = '1';
            qText.style.visibility = 'visible';
            qText.style.display = '';
        }
    }
    
    RaceEvents.lockAnswers();
    RaceEvents.clearTimeouts(sessionId);
    
    const qText = document.getElementById('question-text-display');
    if (qText) {
        qText.style.opacity = '1';
        qText.style.visibility = 'visible';
        qText.style.display = '';
    }
    
    let timeSpent = raceData._timerStart ? Math.min(raceData.timeLimit, (performance.now() - raceData._timerStart) / 1000) : (raceData.timeLimit - raceData.timeLeft);
    let stepsChange = 1, pointsChange = 1;
    
    let finalIsCorrect = isCorrect;
    if (!raceData.isTeam && currentMember) {
        if (currentMember._forcedWrong && currentMember._forcedWrong > 0) {
            finalIsCorrect = false;
            currentMember._forcedWrong--;
            RaceEvents.notify(`😵 فشل تلقائي بسبب لعنة! (متبقي ${currentMember._forcedWrong})`, 'urgent', 1200);
        }
        else if (currentMember._forcedWrongNext) {
            finalIsCorrect = false;
            currentMember._forcedWrongNext = false;
            RaceEvents.notify(`😖 أجبرت على الإجابة الخطأ!`, 'urgent', 1200);
        }
        else if (currentMember._currentAutoWrong) {
            finalIsCorrect = false;
            currentMember._currentAutoWrong = false;
            RaceEvents.notify(`⚡ صاعقة: إجابتك اعتبرت خاطئة!`, 'urgent', 1200);
        }
        if (currentMember._invertAnswer) {
            finalIsCorrect = !finalIsCorrect;
            delete currentMember._invertAnswer;
            RaceEvents.notify(`🔄 سراب: الإجابة الصحيحة أصبحت خاطئة والعكس!`, 'info', 1500);
        }
        if (currentMember._doublePointsNext && finalIsCorrect) {
            pointsChange *= 2;
            delete currentMember._doublePointsNext;
            RaceEvents.notify(`✨ نقاط مضاعفة! ✨`, 'success', 1000);
        }
        if (currentMember._poisonRemaining > 0 && finalIsCorrect) {
            pointsChange = Math.max(1, pointsChange - 1);
            currentMember._poisonRemaining--;
            RaceEvents.notify(`☠️ السم يضعف نقاطك! متبقي ${currentMember._poisonRemaining}`, 'urgent', 1000);
        }
        if (currentMember._delayedLoss && !finalIsCorrect) {
            const loss = currentMember._delayedLoss.amount || 3;
            currentEntity.pos = Math.max(0, currentEntity.pos - loss);
            delete currentMember._delayedLoss;
            RaceEvents.notify(`💣 تأخرت الخسارة! ${loss} خطوة الآن.`, 'urgent', 1500);
        }
    }

    let modeResult = null;
    if (raceData.currentMode) {
        modeResult = raceData.currentMode.processAnswer({
            isCorrect: finalIsCorrect,
            currentEntity,
            currentMember,
            timeSpent,
            betAmount,
            isMinedQuestion,
            sessionId: sessionId,
            raceData: raceData
        });
    }
    
    if (modeResult) {
        stepsChange = modeResult.stepsDelta;
        pointsChange = modeResult.pointsDelta;
    } else {
        stepsChange = finalIsCorrect ? 1 : -1;
        pointsChange = finalIsCorrect ? 1 : -1;
    }

    if (!raceData.sessionStats) raceData.sessionStats = {};
    if (!raceData.sessionStats[currentMember.id]) {
        raceData.sessionStats[currentMember.id] = { correct: 0, wrong: 0, scoreGained: 0 };
    }
    if (finalIsCorrect) {
        raceData.sessionStats[currentMember.id].correct++;
        raceData.sessionStats[currentMember.id].scoreGained += pointsChange;
    } else {
        raceData.sessionStats[currentMember.id].wrong++;
        raceData.sessionStats[currentMember.id].scoreGained += pointsChange;
    }
    
    if (finalIsCorrect) {
        RaceEvents.playCorrect();
        btn.classList.add('correct-ans');
        burstConfetti();
        if (raceData.gameMode !== 'solo_marathon') {
            currentEntity.pos += stepsChange;
        }
        if (!isTraining) {
            if (raceData.isTeam && currentMember) {
                currentEntity.members.forEach(member => {
                    updateStats(member.id, true, pointsChange, timeSpent, category, false, session.currentSelectedQuestion);
                });
            } else {
                updateStats(currentMember.id, true, pointsChange, timeSpent, category, false, session.currentSelectedQuestion);
                currentMember.score = (currentMember.score || 0) + pointsChange;
            }
        } else {
            if (!raceData.isTeam) {
                currentMember.score = (currentMember.score || 0) + pointsChange;
            }
            RaceEvents.notify(`🥋 تدريب: إجابة صحيحة (+${pointsChange})`, 'info', 1000);
        }
        updateSingleLane(sessionId, String(currentEntity.id));
        if (!raceData.isTeam && currentEntity) currentEntity.combo = (currentEntity.combo || 0) + 1;
        if (currentEntity.pos >= raceData.goal && raceData.gameMode !== 'solo_marathon') {
            winGame(sessionId, currentEntity, currentMember);
            
            RaceSessionManager.releaseLock(sessionId);
            window._isHandlingAnswer = false;
            return;
        }
        
        // معالجة بطاقات المفاجآت (بدون تغيير)
        if (raceData.surpriseMode && !raceData.processingSurprise && !raceData._withdrawing && raceData.gameMode === 'solo_surprise') {
            const playerId = currentMember.id;
            if (!raceData.consecutiveCorrect[playerId]) raceData.consecutiveCorrect[playerId] = 0;
            raceData.consecutiveCorrect[playerId]++;

            if (raceData.consecutiveCorrect[playerId] >= 2 && (raceData.surpriseCardsUsed[playerId] || 0) < 3) {
                raceData.consecutiveCorrect[playerId] = 0;
                raceData.surpriseCardsUsed[playerId] = (raceData.surpriseCardsUsed[playerId] || 0) + 1;

                RaceEvents.clearIntervals();
                raceData.savedTimeLeft = raceData.timeLeft;
                raceData.processingSurprise = true;

                const { getRandomCardPair } = await import('../surpriseCards.js');
                const { harmfulCard, selfCard } = getRandomCardPair(playerId, raceData);

                const { showChoiceOverlay } = await import('../raceUI/surpriseChoiceOverlay.js');
                const chosenCard = await showChoiceOverlay(sessionId, harmfulCard, selfCard, raceData, playerId);

                if (chosenCard) {
                    if (chosenCard.type === 'self') {
                        const { applySelfEffect } = await import('../surpriseCards.js');
                        await applySelfEffect(chosenCard.card, raceData, playerId, false, sessionId);
                        RaceEvents.notify(`🎲 بطاقة مفاجأة: ${chosenCard.card.name} – ${chosenCard.card.desc}`, 'success', 6000);
                    } else {
                        const opponents = raceData.players.filter(p => p.id !== playerId);
                        if (opponents.length > 0) {
                            const { showTargetSelectionOverlay } = await import('../raceUI/surpriseOverlay.js');
                            const selectedTarget = await showTargetSelectionOverlay(sessionId, chosenCard.card, opponents, raceData);
                            if (selectedTarget) {
                                if (selectedTarget._shieldRemaining > 0) {
                                    selectedTarget._shieldRemaining--;
                                    RaceEvents.notify(`🛡️ ${selectedTarget.name} محمي بالدرع! لم يتأثر.`, 'info', 2000);
                                } else {
                                    const { applyHarmfulEffect } = await import('../surpriseCards.js');
                                    await applyHarmfulEffect(chosenCard.card, raceData, playerId, selectedTarget.id, false, sessionId);
                                    RaceEvents.notify(`⚠️ استخدمت ${chosenCard.card.name} على ${selectedTarget.name}!`, 'urgent', 5000);
                                    updateSingleLane(sessionId, String(selectedTarget.id));
                                }
                            } else {
                                RaceEvents.notify(`⌛ انتهى وقت بطاقة ${chosenCard.card.name}، لم يتم استخدامها`, 'info', 2000);
                            }
                        } else {
                            RaceEvents.notify(`⚠️ لا يوجد منافسون لاستخدام ${chosenCard.card.name}`, 'info', 1500);
                        }
                    }
                } else {
                    RaceEvents.notify(`⌛ لم تختر أي بطاقة، انتهت الفرصة.`, 'info', 2000);
                }

                raceData.processingSurprise = false;
                if (!raceData._gameEnded) {
                    if (raceData.savedTimeLeft > 0) {
                        raceData.timeLeft = raceData.savedTimeLeft;
                    } else {
                        raceData.timeLeft = raceData.timeLimit;
                    }
                    RaceEvents.startTimer(sessionId, null);
                }
            }
        }
    } else {
        RaceEvents.playWrong();
        if (raceData.surpriseMode && raceData.gameMode === 'solo_surprise') {
            if (currentMember && raceData.consecutiveCorrect) {
                raceData.consecutiveCorrect[currentMember.id] = 0;
            }
        }
        
        btn.classList.add('wrong-ans');
        shakeScreen();
        if (raceData._currentCorrectVisualIndex !== undefined) {
            let correctBtn = document.getElementById('q-area-opts').children[raceData._currentCorrectVisualIndex];
            if (correctBtn) correctBtn.classList.add('correct-ans');
        }
        if (!raceData.isTeam && currentEntity) currentEntity.combo = 0;
        if (raceData.gameMode !== 'solo_marathon') {
            currentEntity.pos = Math.max(0, currentEntity.pos + stepsChange);
        }
        if (raceData.gameMode === 'solo_speedrun' && !finalIsCorrect && raceData.speedrunTimePenalty) {
            const penalty = raceData.speedrunTimePenalty;
            raceData.timeLeft = Math.max(1, raceData.timeLeft - penalty);
            if (typeof updateTimerUI === 'function') updateTimerUI(sessionId);
            RaceEvents.notify(`⏱️ عقوبة السرعة: -${penalty} ثانية من هذا السؤال`, 'urgent', 1200);
        }
        if (!isTraining) {
            if (raceData.isTeam && currentMember) {
                currentEntity.members.forEach(member => {
                    updateStats(member.id, false, pointsChange, timeSpent, category, false, session.currentSelectedQuestion);
                });
            } else {
                updateStats(currentMember.id, false, pointsChange, timeSpent, category, false, session.currentSelectedQuestion);
                currentMember.score = Math.max(0, (currentMember.score || 0) + pointsChange);
            }
        } else {
            if (!raceData.isTeam) {
                currentMember.score = Math.max(0, (currentMember.score || 0) + pointsChange);
            }
            RaceEvents.notify(`🥋 تدريب: إجابة خاطئة (${pointsChange})`, 'info', 1000);
        }
        updateSingleLane(sessionId, String(currentEntity.id));
    }
    
    // معالجة الماراثون
    if (raceData.gameMode === 'solo_marathon' && !raceData.isTeam && currentMember) {
        if (currentMember.marathonQuestionsAnswered === undefined) {
            currentMember.marathonQuestionsAnswered = (currentMember.marathonQuestionsAnswered || 0) + 1;
        }
        
        const totalNeeded = currentMember.marathonTotalQuestions || raceData.goal;
        const allFinished = raceData.players.every(p => 
            (p.marathonQuestionsAnswered || 0) >= (p.marathonTotalQuestions || raceData.goal)
        );
        
        if (allFinished) {
            RaceEvents.clearIntervals();
            clearAllRaceTimeouts(sessionId);
            await finishMarathon(sessionId, raceData.players);
            RaceSessionManager.releaseLock(sessionId);
            window._isHandlingAnswer = false;
            return;
        }
        
        const currentFinished = currentMember.marathonQuestionsAnswered >= totalNeeded;
        if (!currentFinished) {
            RaceSessionManager.releaseLock(sessionId);
            window._isHandlingAnswer = false;
            setTimeout(() => showQuestion(sessionId), 1500);
            return;
        } else {
            RaceSessionManager.releaseLock(sessionId);
            window._isHandlingAnswer = false;
            setTimeout(() => nextPlayer(sessionId), 2000);
            return;
        }
    }
    
    // باقي الحالات (غير الماراثون)
    RaceSessionManager.releaseLock(sessionId);
    window._isHandlingAnswer = false;
    setTimeout(() => nextPlayer(sessionId), 2000);
}

// ========== دالة إنهاء الماراثون مع مكافآت الترتيب ==========
async function finishMarathon(sessionId, allPlayers) {
    RaceEvents.clearIntervals();
    clearAllRaceTimeouts(sessionId);
    RaceSessionManager.releaseLock(sessionId);

    const raceUI = document.getElementById('race-interface');
    if (raceUI) {
        raceUI.classList.add('hidden');
        raceUI.style.display = 'none';
    }
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.remove('hidden');
    document.body.classList.remove('racing');

    const session = RaceSessionManager.getSession(sessionId);
    const raceData = session.raceData;
    const sessionStats = raceData.sessionStats || {};
    const isTraining = raceData.isTrainingMode === true;

    // تجميع بيانات كل لاعب مع إحصائياته
    const enriched = allPlayers.map(p => {
        const stats = sessionStats[p.id] || { correct: 0, wrong: 0, scoreGained: 0 };
        const totalQ = stats.correct + stats.wrong;
        const accuracy = totalQ > 0 ? Math.round((stats.correct / totalQ) * 100) : 0;
        const marathonPoints = stats.scoreGained;
        return {
            ...p,
            correct: stats.correct,
            wrong: stats.wrong,
            scoreGained: marathonPoints,
            accuracy,
            marathonFinishedAt: p.marathonFinishedAt || 0
        };
    });

    // ترتيب اللاعبين حسب النقاط المكتسبة أثناء الماراثون (مع كسر التعادل بالدقة ثم الوقت)
    const sorted = [...enriched].sort((a, b) => {
        if (b.scoreGained !== a.scoreGained) return b.scoreGained - a.scoreGained;
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        if (b.correct !== a.correct) return b.correct - a.correct;
        return a.marathonFinishedAt - b.marathonFinishedAt;
    });

    // مكافآت الترتيب (مثل win.js)
    const rewards = [50, 30, 15];
    
    // تحديث نقاط الطلاب في قاعدة البيانات وإضافة المكافآت
    if (!isTraining) {
        for (let i = 0; i < sorted.length; i++) {
            const player = sorted[i];
            let bonus = 5; // افتراضي للجميع
            if (i === 0) bonus = 50;
            else if (i === 1) bonus = 30;
            else if (i === 2) bonus = 15;
            
            const newTotalPoints = player.scoreGained + bonus;
            // تحديث نقاط الطالب في Firestore / localStorage
            const student = await getStudentById(player.id);
            if (student) {
                await updateStudent(player.id, { score: (student.score || 0) + bonus });
            }
            // تخزين النقاط النهائية لكل لاعب للعرض
            player.finalPoints = newTotalPoints;
            player.bonus = bonus;
        }
    } else {
        // في وضع التدريب، لا مكافآت
        sorted.forEach(p => {
            p.finalPoints = p.scoreGained;
            p.bonus = 0;
        });
    }

    const winner = sorted[0];
    if (!winner) return;

    const msg = getRandomWinnerMessage();

    // بناء جدول النتائج
    let rowsHtml = '';
    for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        const isWinner = i === 0;
        const displayPoints = p.finalPoints;
        const bonusText = (!isTraining && p.bonus > 0) ? `(+${p.bonus} مكافأة)` : '';
        rowsHtml += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); background: ${isWinner ? 'rgba(250,204,21,0.1)' : 'transparent'};">
                <td style="padding: 0.8rem 0.5rem; font-weight:900; color: ${isWinner ? '#facc15' : '#cbd5e1'}; text-align:center;">#${i+1}‹
                <td style="padding: 0.6rem 0.5rem; display:flex; align-items:center; gap:0.8rem; justify-content:center;">
                    <img src="${p.img || DEFAULT_IMG}" style="width:40px; height:40px; border-radius:50%; border:2px solid ${isWinner ? '#facc15' : '#64748b'}; object-fit:cover;">
                    <span style="font-weight:600; color:white;">${escapeHtml(p.name)}</span>
                </td>
                <td style="padding: 0.8rem 0.5rem; font-weight:900; color:#facc15; text-align:center;">⭐ ${displayPoints} ${bonusText}</td>
                <td style="padding: 0.8rem 0.5rem; color:#10b981; text-align:center;">✅ ${p.correct}</td>
                <td style="padding: 0.8rem 0.5rem; color:#ef4444; text-align:center;">❌ ${p.wrong}</td>
                <td style="padding: 0.8rem 0.5rem; font-weight:bold; color:#e2e8f0; text-align:center;">${p.accuracy}%‹
            </tr>`;
    }

    Swal.fire({
        title: isTraining ? '🥋 وضع التدريب' : '🏆 نهاية الماراثون',
        html: `
            <div style="direction:rtl; font-family:'Cairo',sans-serif; color:white; max-width:850px; margin:0 auto; padding:0.5rem;">
                <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border:2px solid #facc15; border-radius:48px; padding:1.8rem; text-align:center; margin-bottom:2rem; box-shadow:0 0 50px rgba(250,204,21,0.3);">
                    <div style="display:flex; justify-content:center; margin-bottom:1rem;">
                        <img src="${winner.img || DEFAULT_IMG}" style="width:140px; height:140px; border-radius:50%; border:4px solid #facc15; object-fit:cover; box-shadow:0 0 35px gold;">
                    </div>
                    <div style="font-size:2rem; font-weight:900; color:#facc15; text-shadow:0 0 15px gold; margin-bottom:0.5rem;">
                        ${escapeHtml(winner.name)}
                    </div>
                    <div style="font-size:1.1rem; color:#e2e8f0; margin-bottom:0.8rem;">${msg}</div>
                    ${!isTraining ? `
                    <div style="background:rgba(0,0,0,0.5); border-radius:60px; padding:0.5rem 1.5rem; display:inline-block; margin-top:0.5rem;">
                        <span style="color:#facc15; font-weight:bold;">🏅 نقاط الماراثون: ${winner.scoreGained} + مكافأة ${winner.bonus} = ${winner.finalPoints}</span>
                    </div>
                    ` : '<div style="background:rgba(0,0,0,0.5); border-radius:60px; padding:0.5rem 1.5rem; display:inline-block; margin-top:0.5rem;"><span style="color:#facc15;">🥋 هذا سباق تدريبي – النتائج غير محسوبة</span></div>'}
                </div>
                <div style="background: rgba(0,0,0,0.4); backdrop-filter: blur(12px); border-radius:32px; padding:0.8rem; border:1px solid rgba(250,204,21,0.2);">
                    <div style="text-align:center; color:#facc15; font-weight:bold; font-size:1.2rem; margin-bottom:1rem;">🏆 جدول الترتيب النهائي 🏆</div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem; text-align:center;">
                            <thead>
                                <tr style="color:#facc15; font-weight:bold; border-bottom:2px solid rgba(250,204,21,0.3);">
                                    <th style="padding:0.8rem 0.3rem;">الترتيب</th>
                                    <th style="padding:0.8rem 0.3rem;">اللاعب</th>
                                    <th style="padding:0.8rem 0.3rem;">النقاط النهائية</th>
                                    <th style="padding:0.8rem 0.3rem;">✅</th>
                                    <th style="padding:0.8rem 0.3rem;">❌</th>
                                    <th style="padding:0.8rem 0.3rem;">الدقة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style="text-align:center; margin-top:1.8rem;">
                    <button id="marathon-done-btn" style="background:#facc15; color:#000; border:none; border-radius:60px; padding:0.8rem 2.5rem; font-weight:bold; font-size:1.1rem; cursor:pointer; box-shadow:0 4px 0 #b45309; transition:0.2s;">
                        🏅 العودة إلى المنصة
                    </button>
                </div>
            </div>`,
        showConfirmButton: false,
        showCancelButton: false,
        background: 'rgba(8,12,25,0.98)',
        backdrop: 'rgba(0,0,0,0.85)',
        width: '850px',
        padding: '1rem',
        customClass: {
            popup: '!rounded-[3rem] !border-2 !border-yellow-500/50 !shadow-[0_0_80px_rgba(250,204,21,0.2)]'
        },
        didOpen: () => {
            const btn = document.getElementById('marathon-done-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    Swal.close();
                    if (typeof window.showPage === 'function') {
                        window.showPage('home');
                    } else {
                        window.location.href = 'platform.html';
                    }
                });
            }
        }
    });
    
    // بعد انتهاء الماراثون، تحديث واجهة النقاط إذا لزم الأمر
    if (typeof updateUIAfterScoreChange === 'function') {
        updateUIAfterScoreChange();
    }
}   