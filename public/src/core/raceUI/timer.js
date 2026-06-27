// src/core/raceUI/timer.js
// دوال المؤقت: بدء المؤقت للسؤال الحالي، معالجة انتهاء الوقت، وتحديث واجهة المؤقت
// [FIX] استيراد nextPlayer مباشرة بدلاً من الاعتماد على window.nextPlayer
// [FIX] استخدام RaceSessionManager بدلاً من window.raceData
// [FIX] تحسين clearAllRaceTimeouts لضمان إلغاء كل المؤقتات
// [FIX] إضافة resetTimerBar لإعادة تعيين شريط التقدم إلى الحالة الافتراضية
// [FIX] استدعاء onTimeOut للوضع الحالي عند انتهاء الوقت
// [FIX] إصلاح الماراثون: منع الانتقال للاعب التالي عند انتهاء الوقت

import { RaceSessionManager } from '../raceSession.js';
import { lockAnswerButtons, updateTimerUI as utilsUpdateTimerUI, showFloatingNotification, clearAllRaceIntervals } from '../../utils.js';
import { updateStats } from '../../students/studentStats.js';
import { nextPlayer } from '../raceEngine.js';
import { showQuestion } from './questionDisplay.js';
import { RaceEvents } from '../raceEvents.js';

export function updateTimerUI(sessionId) {
    const session = RaceSessionManager.getSession(sessionId);
    if (!session) return;
    const raceData = session.raceData;
    
    utilsUpdateTimerUI(raceData);
    
    const timerBar = document.getElementById('timer-bar');
    if (timerBar && raceData.timeLimit > 0) {
        const percent = Math.max(0, (raceData.timeLeft / raceData.timeLimit) * 100);
        timerBar.style.width = `${percent}%`;
        
        if (percent > 60) {
            timerBar.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
            timerBar.style.animation = 'none';
        } else if (percent > 30) {
            timerBar.style.background = 'linear-gradient(90deg, #eab308, #facc15)';
            timerBar.style.animation = 'none';
        } else if (percent > 0) {
            timerBar.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
            timerBar.style.animation = 'timerPulse 0.8s infinite';
        } else {
            timerBar.style.animation = 'none';
        }
    }
}

export function resetTimerBar() {
    const timerBar = document.getElementById('timer-bar');
    if (timerBar) {
        timerBar.style.width = '100%';
        timerBar.style.animation = 'none';
        timerBar.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
    }
    const timerElem = document.getElementById('timer-text');
    if (timerElem) {
        const activeSession = RaceSessionManager.getActive();
        if (activeSession && activeSession.raceData) {
            timerElem.innerText = Math.ceil(activeSession.raceData.timeLimit);
        }
    }
}

// بدء المؤقت من قيمة زمنية محددة
export function startTimerFromValue(sessionId, timeLeftValue, currentMember = null) {
    clearAllRaceTimeouts(sessionId);
    
    const session = RaceSessionManager.getSession(sessionId);
    if (!session) return;
    let raceData = session.raceData;
    
    raceData.timeLeft = Math.min(raceData.timeLimit, Math.max(0, timeLeftValue));
    
    if (currentMember) {
        if (currentMember._timeReduction) {
            raceData.timeLeft = Math.max(2, raceData.timeLeft - currentMember._timeReduction);
            delete currentMember._timeReduction;
        }
        if (currentMember._extraTime) {
            raceData.timeLeft += currentMember._extraTime;
            delete currentMember._extraTime;
        }
    }
    
    if (raceData.timeLeft <= 0) raceData.timeLeft = raceData.timeLimit;
    raceData._timerStart = performance.now();
    raceData._timerDeadline = raceData._timerStart + (raceData.timeLeft * 1000);
    updateTimerUI(sessionId);

    function tick(now) {
        const currentSession = RaceSessionManager.getSession(sessionId);
        if (!currentSession || !currentSession.raceData._timerDeadline) return;
        currentSession.raceData.timeLeft = Math.max(0, (currentSession.raceData._timerDeadline - now) / 1000);
        updateTimerUI(sessionId);
        if (currentSession.raceData.timeLeft <= 0.05) {
            currentSession.raceData._timerRaf = null;
            currentSession.raceData._timerDeadline = null;
            handleTimeUp(sessionId);
            return;
        }
        currentSession.raceData._timerRaf = requestAnimationFrame(tick);
    }
    raceData._timerRaf = requestAnimationFrame(tick);
}

// بدء المؤقت الطبيعي
export function startTimerForCurrentQuestion(sessionId, currentMember = null) {
    const session = RaceSessionManager.getSession(sessionId);
    if (!session) return;
    startTimerFromValue(sessionId, session.raceData.timeLimit, currentMember);
}

// معالجة انتهاء الوقت


export async function handleTimeUp(sessionId) {
    const session = RaceSessionManager.getSession(sessionId);
    if (!session || session.raceData._gameEnded) {
        console.log('handleTimeUp: اللعبة انتهت، تجاهل');
        return;
    }
    let raceData = session.raceData;
    
    // إلغاء مؤقت الذاكرة إذا كان موجوداً
    if (raceData.memoryTimeout) {
        clearTimeout(raceData.memoryTimeout);
        raceData.memoryTimeout = null;
    }
    
    // في وضع الذاكرة، لا نعيد إظهار السؤال
    if (raceData.gameMode !== 'solo_memory') {
        const qText = document.getElementById('question-text-display');
        if (qText) {
            qText.style.opacity = '1';
            qText.style.visibility = 'visible';
            qText.style.display = '';
            if (!qText.innerText.trim() && session.currentSelectedQuestion) {
                qText.innerText = session.currentSelectedQuestion.q;
            }
        }
    }
    
    lockAnswerButtons();
    
    let currentEntity = raceData.isTeam 
        ? raceData.teams.find(t => String(t.id) === String(raceData.activeEntityId) || `team_${t.id}` === String(raceData.activeEntityId)) 
        : raceData.players.find(p => String(p.id) === String(raceData.activeEntityId));
    
    let currentMember = null;
    if (currentEntity) {
        if (raceData.isTeam) {
            if (raceData.gameMode === 'team_relay' && currentEntity.currentMemberIndex !== undefined) {
                currentMember = currentEntity.members[currentEntity.currentMemberIndex];
            } else if (raceData.allPlayers && raceData.allPlayers.length > 0 && raceData.activePlayerIndex !== undefined) {
                currentMember = raceData.allPlayers[raceData.activePlayerIndex];
            } else {
                currentMember = currentEntity.members[0];
            }
        } else {
            currentMember = currentEntity;
        }
    }
    
    // عقوبة سباق السرعة (انتهاء الوقت بدون إجابة)
    if (raceData.gameMode === 'solo_speedrun' && !raceData.isTeam && currentMember) {
        const penalty = raceData.speedrunTimePenalty || 3;
        currentMember._timeReduction = (currentMember._timeReduction || 0) + penalty;
        RaceEvents.notify(`⏱️ عقوبة السرعة: سيتم خصم ${penalty} ثانية من السؤال القادم`, 'urgent', 1500);
    }
    
    // استدعاء onTimeOut للوضع الحالي
    if (raceData.currentMode && typeof raceData.currentMode.onTimeOut === 'function') {
        raceData.currentMode.onTimeOut(currentEntity, currentMember);
    } else {
        // سلوك افتراضي: تراجع خطوة واحدة
        if (currentEntity) {
            currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
        }
        showFloatingNotification(`⏰ انتهى الوقت! تراجع خطوة`, 'urgent');
    }
    
    // ========== إصلاح الماراثون: منع الانتقال للاعب التالي عند انتهاء الوقت ==========
    if (raceData.gameMode === 'solo_marathon' && !raceData.isTeam) {
        // في الماراثون، انتهاء الوقت لا يُحتسب كإجابة خاطئة
        // لا نزيد عداد الأسئلة، ولا نغير الدور، نعرض سؤالاً جديداً لنفس اللاعب
        RaceSessionManager.releaseLock(sessionId);
        showFloatingNotification('⌛ انتهى الوقت! لن يتم احتساب هذه المحاولة.', 'warning', 1500);
        setTimeout(() => {
            // استيراد showQuestion ديناميكياً لتجنب dependency circular
            import('./questionDisplay.js').then(({ showQuestion }) => {
                showQuestion(sessionId);
            });
        }, 1500);
        return;
    }
    // ========== نهاية إصلاح الماراثون ==========
    
    RaceSessionManager.releaseLock(sessionId);
    setTimeout(() => {
        nextPlayer(sessionId);
    }, 1500);
}

export function clearAllRaceTimeouts(sessionId) {
    const session = RaceSessionManager.getSession(sessionId);
    if (!session) return;
    const raceData = session.raceData;
    
    if (raceData.timerInterval) {
        clearInterval(raceData.timerInterval);
        raceData.timerInterval = null;
    }
    if (raceData.timerTimeout) {
        clearTimeout(raceData.timerTimeout);
        raceData.timerTimeout = null;
    }
    
    if (raceData.memoryTimeout) {
        clearTimeout(raceData.memoryTimeout);
        raceData.memoryTimeout = null;
    }
    
    if (raceData._timerRaf) {
        cancelAnimationFrame(raceData._timerRaf);
        raceData._timerRaf = null;
    }
    raceData._timerDeadline = null;
    raceData._timerStart = null;
    
    // إعادة تعيين شريط التقدم إلى وضعه الطبيعي
    const timerBar = document.getElementById('timer-bar');
    if (timerBar) {
        timerBar.style.width = '100%';
        timerBar.style.animation = 'none';
        timerBar.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
    }
    
    // تنظيف مؤقتات الرهان العامة (إذا كانت موجودة)
    if (window.betOverlayTimeout) {
        clearTimeout(window.betOverlayTimeout);
        window.betOverlayTimeout = null;
    }
    if (window.betOverlayInterval) {
        clearInterval(window.betOverlayInterval);
        window.betOverlayInterval = null;
    }
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }
    if (window.countdownTimeout) {
        clearTimeout(window.countdownTimeout);
        window.countdownTimeout = null;
    }
}