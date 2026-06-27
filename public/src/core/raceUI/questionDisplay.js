// src/core/raceUI/questionDisplay.js
// عرض السؤال الحالي للمستخدم (اللاعب النشط) مع خيارات الإجابة
// [FIX] إصلاح وضع الذاكرة: إلغاء المؤقت عند الإجابة، وإعادة ظهور السؤال
// [FIX] إصلاح الأسئلة الملغومة: تأثير بصري وإعادة تعيين الحالة
// [FIX] إصلاح خلط الخيارات: تطبيق موحد ومنع التداخل
// [FIX] استخدام RaceSessionManager بدلاً من window.raceData
// [FIX] تحسين معالجة الأخطاء

import { RaceSessionManager } from '../raceSession.js';
import { RaceEvents } from '../raceEvents.js';
import { getAdaptiveQuestion } from '../raceQuestions.js';
import { raceSettings } from '../raceSettings.js';
import { showBetOverlay } from './betOverlay.js';
import { updateTimerUI, resetTimerBar } from './timer.js';
import { handleAnswer } from '../raceEngine.js';

// ===================== عرض السؤال =====================
export async function showQuestion(sessionId) {
    if (!RaceSessionManager.acquireLock(sessionId)) {
        setTimeout(() => showQuestion(sessionId), 100);
        return;
    }

    let session = RaceSessionManager.getSession(sessionId);
    if (!session) {
        RaceSessionManager.releaseLock(sessionId);
        return;
    }
    let raceData = session.raceData;
    
    // إذا كانت اللعبة انتهت، لا تفعل شيئاً
    if (raceData._gameEnded) {
        RaceSessionManager.releaseLock(sessionId);
        return;
    }
    
    raceData.questionNumber = (raceData.questionNumber || 0) + 1;
    delete raceData._currentCorrectVisualIndex;
    
    // إعادة تعيين شريط التقدم
    resetTimerBar();
    
    // تحديد الكيان الحالي (لاعب أو فريق)
    let currentEntity = null;
    let currentMember = null;
    
    if (raceData.isTeam) {
        if (raceData.gameMode === 'team_relay') {
            currentEntity = raceData.teams.find(t => String(t.id) === String(raceData.activeEntityId) || `team_${t.id}` === String(raceData.activeEntityId));
            if (!currentEntity) {
                RaceSessionManager.releaseLock(sessionId);
                return;
            }
            currentEntity.currentMemberIndex = (currentEntity.currentMemberIndex || 0) % currentEntity.members.length;
            const memberIndex = currentEntity.currentMemberIndex;
            currentMember = currentEntity.members[memberIndex];
        } else {
            if (!raceData.allPlayers || raceData.allPlayers.length === 0) {
                RaceSessionManager.releaseLock(sessionId);
                return;
            }
            if (raceData.activePlayerIndex >= raceData.allPlayers.length) raceData.activePlayerIndex = 0;
            currentMember = raceData.allPlayers[raceData.activePlayerIndex];
            currentEntity = raceData.teams.find(t => t.id === currentMember.teamId);
            if (!currentEntity) {
                RaceSessionManager.releaseLock(sessionId);
                return;
            }
            raceData.activeEntityId = `team_${currentEntity.id}`;
        }
    } else {
        currentEntity = raceData.players.find(p => String(p.id) === String(raceData.activeEntityId));
        if (!currentEntity) {
            RaceSessionManager.releaseLock(sessionId);
            if (typeof window.nextPlayer === 'function') window.nextPlayer(sessionId);
            return;
        }
        currentMember = currentEntity;
    }

    RaceEvents.lockAnswers();
    
    // ========== وضع الرهان ==========
    let betAmount = 0;
    if (raceData.gameMode === 'solo_bet') {
        RaceEvents.clearIntervals();
        const betResult = await showBetOverlay(sessionId, currentEntity, raceData.goal);
        betAmount = betResult.winAmount;
        window.__currentLoseAmount = betResult.loseAmount;
    }
    
    // ========== الأسئلة الملغومة (فردي وجماعي) ==========
    let isMinedQuestion = false;
    if (raceData.gameMode === 'team_mined' && raceData.minedQuestionsRemaining > 0 && raceData.minedQuestionCooldown === 0) {
        if (Math.random() < 0.3) {
            isMinedQuestion = true;
            raceData.minedQuestionActive = true;
            raceData.minedQuestionsRemaining--;
        }
        raceData.minedQuestionCooldown = 2;
    } else if (raceData.gameMode === 'team_mined' && raceData.minedQuestionCooldown > 0) {
        raceData.minedQuestionCooldown--;
    }
    
    if (raceData.gameMode === 'solo_mined' && !raceData.isTeam) {
        if (raceData.soloMinedCooldown > 0) {
            raceData.soloMinedCooldown--;
            raceData.soloMinedActive = false;
        } else {
            const minedChance = (raceSettings.modeSettings && raceSettings.modeSettings.minedChance) ? raceSettings.modeSettings.minedChance : 20;
            if (Math.random() * 100 < minedChance) {
                isMinedQuestion = true;
                raceData.soloMinedActive = true;
                raceData.soloMinedCooldown = Math.floor(Math.random() * 2) + 2;
            } else {
                raceData.soloMinedActive = false;
            }
        }
    }

    // تحديث وقت السؤال (لوضع السرعة)
    let availableQuestions = session.activeGame;
    raceData.timeLeft = raceData.timeLimit;
    if (raceData.gameMode === 'solo_speedrun' && !raceData.isTeam) {
        let progressPercent = (currentEntity.pos / raceData.goal) * 100;
        raceData.timeLeft = Math.max(5, raceData.timeLimit - Math.floor(progressPercent / 20) * raceData.speedrunTimePenalty);
    }
    updateTimerUI(sessionId);
    
    if (!availableQuestions.length) {
        if (typeof window.exitRaceImmediate === 'function') window.exitRaceImmediate(sessionId);
        RaceSessionManager.releaseLock(sessionId);
        return;
    }
    
    // اختيار سؤال تكيفي
    let playerUsedIds = session.usedQuestionsPerPlayer[currentMember.id] || new Set();
    session.usedQuestionsPerPlayer[currentMember.id] = playerUsedIds;
    let progressPercent = (currentEntity.pos / raceData.goal) * 100;
    
    if (raceData.questionNumber >= 5) {
        raceData.forceHardMode = true;
    } else {
        raceData.forceHardMode = false;
    }
    
    let selectedQ = getAdaptiveQuestion(sessionId, currentMember, availableQuestions, session.globalUsedIds, playerUsedIds, progressPercent);
    if (!selectedQ) {
        console.log('selectedQ is null, using first available question');
        playerUsedIds.clear();
        session.globalUsedIds.clear();
        selectedQ = getAdaptiveQuestion(sessionId, currentMember, availableQuestions, session.globalUsedIds, playerUsedIds, progressPercent);
        if (!selectedQ) selectedQ = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    }
    
    playerUsedIds.add(selectedQ.uniqueId);
    session.globalUsedIds.add(selectedQ.uniqueId);
    session.currentSelectedQuestion = selectedQ;
    
    const questionText = document.getElementById('question-text-display');
    if (questionText) {
        questionText.style.opacity = '1';
        questionText.style.visibility = 'visible';
        questionText.style.display = '';
        
        if (isMinedQuestion) {
            questionText.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; gap:12px;"><span style="font-size:2rem; filter:drop-shadow(0 0 6px #ff6600);">💣</span> <span>${selectedQ.q}</span></div>`;
            questionText.style.background = 'rgba(255, 80, 0, 0.08)';
            questionText.style.border = '1px solid rgba(255, 100, 0, 0.5)';
            questionText.style.boxShadow = '0 0 20px rgba(255, 80, 0, 0.2)';
        } else {
            questionText.innerHTML = selectedQ.q;
            questionText.style.background = '';
            questionText.style.border = '';
            questionText.style.boxShadow = '';
        }
    }
    
    // خيارات الإجابة
    let optsDiv = document.getElementById('q-area-opts');
    if (!optsDiv) {
        RaceSessionManager.releaseLock(sessionId);
        return;
    }
    optsDiv.innerHTML = '';
    let optionsWithIndex = selectedQ.o.map((txt, i) => ({ txt, originalIndex: i }));
    
    // خلط الخيارات (مرتين للتباعد)
    for (let i = optionsWithIndex.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
    }
    for (let i = optionsWithIndex.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
    }
    
    // تأثيرات بطاقات المفاجآت
    if (currentMember._shuffleOptions) {
        for (let i = optionsWithIndex.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
        }
        delete currentMember._shuffleOptions;
    }
    
    const isBlur = currentMember._blurOptions;
    if (isBlur) delete currentMember._blurOptions;
    const isHide = currentMember._hideOptions;
    if (isHide) delete currentMember._hideOptions;
    
    let newCorrectIndex = -1;
    for (let idx = 0; idx < optionsWithIndex.length; idx++) {
        if (optionsWithIndex[idx].originalIndex === selectedQ.a) {
            newCorrectIndex = idx;
            break;
        }
    }
    
    optionsWithIndex.forEach((item, idx) => {
        let btn = document.createElement('button');
        const numberLabel = `${idx+1}- `;
        let displayText = item.txt;
        if (isBlur) displayText = '???';
        if (isHide) displayText = '?????';
        btn.innerText = numberLabel + displayText;
        btn.className = "option-btn";
        btn.onclick = () => handleAnswer(sessionId, idx === newCorrectIndex, btn, selectedQ.cat, betAmount, currentEntity, currentMember, isMinedQuestion);
        optsDiv.appendChild(btn);
    });
    raceData._currentCorrectVisualIndex = newCorrectIndex;
    RaceEvents.unlockAnswers();
    
    // ========== وضع الذاكرة (محسن) ==========
 // ========== وضع الذاكرة (محسن) ==========
if (raceData.gameMode === 'solo_memory') {
    let memoryDuration = (raceSettings.modeSettings && raceSettings.modeSettings.memoryTime) ? raceSettings.modeSettings.memoryTime : 3;
    memoryDuration = Math.max(1.5, memoryDuration) * 1000;
    
    console.log(`[Memory] بدء وضع الذاكرة. مدة العرض: ${memoryDuration/1000} ثانية`);
    
    // إلغاء أي مؤقت سابق
    if (raceData.memoryTimeout) {
        clearTimeout(raceData.memoryTimeout);
    }
    
    // نبدأ المؤقت الأول: إخفاء السؤال بعد المدة
    raceData.memoryTimeout = setTimeout(() => {
        console.log('[Memory] انتهت مدة العرض - جاري إخفاء السؤال');
        const currentSession = RaceSessionManager.getSession(sessionId);
        if (!currentSession) return;
        if (currentSession.raceData._gameEnded) return;
        
        const textEl = document.getElementById('question-text-display');
        if (textEl) {
            if (textEl.style.opacity !== '0') {
                textEl.style.opacity = '0';
                textEl.style.visibility = 'hidden';
                textEl.style.display = 'none';
                console.log('[Memory] تم إخفاء السؤال بنجاح');
            }
        }
        
        // ✅ بعد إخفاء السؤال، نبدأ مؤقت الإجابة الحقيقي
        // ولكن نتحقق أولاً من أن اللعبة لم تنته
        if (!currentSession.raceData._gameEnded) {
            console.log('[Memory] بدء مؤقت الإجابة بعد الإخفاء');
            RaceEvents.startTimer(sessionId, currentMember);
        }
        
        raceData.memoryTimeout = null;
    }, memoryDuration);
    
    // ✅ لا نبدأ المؤقت فوراً، بل نتركه يبدأ بعد الإخفاء
    // ولكن نحتاج لتخزين المؤقت حتى لا يبدأ مرتين
    // نضع مؤقتاً وهمياً لمنع بدء المؤقت من RaceEvents.startTimer لاحقاً؟ لا، نحن لا نستدعيها الآن.
    // بدلاً من ذلك، نستخدم متغيراً يشير إلى أن المؤقت لم يبدأ بعد
    raceData._memoryTimerStarted = false;
}
   // بدء المؤقت - إلا في وضع الذاكرة حيث يبدأ بعد الإخفاء
if (raceData.gameMode !== 'solo_memory') {
    RaceEvents.startTimer(sessionId, currentMember);
}
    // تحديث الجلسة
    RaceSessionManager.updateSession(sessionId, {
        raceData,
        usedQuestionsPerPlayer: session.usedQuestionsPerPlayer,
        globalUsedIds: session.globalUsedIds,
        currentSelectedQuestion: session.currentSelectedQuestion
    });
    
    RaceSessionManager.releaseLock(sessionId);
}
function showBigFeedback(isCorrect) {
    // إزالة أي علامة موجودة مسبقاً
    const existing = document.querySelector('.big-feedback');
    if (existing) existing.remove();
    
    // إنشاء العنصر
    const div = document.createElement('div');
    div.className = 'big-feedback ' + (isCorrect ? 'correct' : 'wrong');
    div.textContent = isCorrect ? '✓' : '✗';
    document.body.appendChild(div);
    
    // إزالة العنصر بعد انتهاء الحركة تلقائياً (باستخدام setTimeout)
    setTimeout(() => {
        if (div && div.parentNode) div.remove();
    }, 800);
}

// استخدم هذه الدالة عند معالجة الإجابة
// مثلاً: if (isAnswerCorrect) showBigFeedback(true); else showBigFeedback(false);