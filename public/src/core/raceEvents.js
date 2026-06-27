// src/core/raceEvents.js
// واجهة وسيطة بين منطق السباق (raceEngine) وواجهة المستخدم (UI)
// الهدف: فصل الاعتماديات لتسهيل التطوير ودعم الأونلاين لاحقاً
// [FIX] تم تعديل clearIntervals و updateTimerUI لاستخدام RaceSessionManager بدلاً من window.raceData

import { 
    lockAnswerButtons, 
    unlockAnswerButtons, 
    showFloatingNotification, 
    playCorrect, 
    playWrong, 
    playWin,
    clearAllRaceIntervals as clearRaceIntervalsUtil
} from '../utils.js';

import { 
    renderTracks, 
    startTimerForCurrentQuestion, 
    clearAllRaceTimeouts as clearRaceTimeoutsUI,
    updateTimerUI as updateTimerUIFunc,
    updateSingleLane
} from './raceUI.js';

import { RaceSessionManager } from './raceSession.js';

// ===================== كائن RaceEvents =====================
export const RaceEvents = {
    // قفل أزرار الإجابة ومنع أي إدخال
    lockAnswers: () => {
        lockAnswerButtons();
    },
    
    // فتح أزرار الإجابة
    unlockAnswers: () => {
        unlockAnswerButtons();
    },
    
 // داخل كائن RaceEvents
notify: (message, type = 'info', duration = null) => {
    // تعيين مدة أطول للإشعارات العاجلة
    const finalDuration = (type === 'urgent') ? 5000 : (duration || 3000);
    let finalType = type === 'urgent' ? 'warning' : (type === 'success' ? 'success' : (type === 'error' ? 'error' : 'info'));
    showFloatingNotification(message, finalType, finalDuration);
},
    
    // تشغيل صوت الإجابة الصحيحة
    playCorrect: () => {
        playCorrect();
    },
    
    // تشغيل صوت الإجابة الخاطئة
    playWrong: () => {
        playWrong();
    },
    
    // تشغيل صوت الفوز
    playWin: () => {
        playWin();
    },
    
    // إعادة رسم المضامير (كاملة)
    renderTracks: (sessionId) => {
        renderTracks(sessionId);
    },
    
    // تحديث مضمار واحد فقط (بدون إعادة رسم كامل)
    updateSingleLane: (sessionId, entityId) => {
        updateSingleLane(sessionId, entityId);
    },
    
    // بدء مؤقت السؤال الحالي
    startTimer: (sessionId, currentMember = null) => {
        startTimerForCurrentQuestion(sessionId, currentMember);
    },
    
    // تنظيف جميع المؤقتات الخاصة بالسباق (من raceUI)
    clearTimeouts: (sessionId) => {
        clearRaceTimeoutsUI(sessionId);
    },
    
    // ✅ [FIX] تنظيف جميع المؤقتات العامة (بدون استخدام window.raceData)
    clearIntervals: () => {
        const raceData = RaceSessionManager.getActiveRaceData();
        if (raceData) {
            if (raceData.timerInterval) {
                clearInterval(raceData.timerInterval);
                raceData.timerInterval = null;
            }
            if (raceData.timerTimeout) {
                clearTimeout(raceData.timerTimeout);
                raceData.timerTimeout = null;
            }
            if (raceData._timerRaf) {
                cancelAnimationFrame(raceData._timerRaf);
                raceData._timerRaf = null;
            }
            if (raceData._timerDeadline) {
                raceData._timerDeadline = null;
            }
            if (raceData._timerStart) {
                raceData._timerStart = null;
            }
        }
        // أيضاً ننظف المؤقتات العامة القديمة احتياطياً
        clearRaceIntervalsUtil();
    },
    
    // ✅ [FIX] تحديث واجهة المؤقت باستخدام sessionId
    updateTimer: (sessionId) => {
        const session = RaceSessionManager.getSession(sessionId);
        if (session && session.raceData) {
            updateTimerUIFunc(session.raceData);
        }
    }
};

// ===================== تصدير الدوال بشكل فردي للتوافق القديم =====================
export const lockAnswers = RaceEvents.lockAnswers;
export const unlockAnswers = RaceEvents.unlockAnswers;
export const notify = RaceEvents.notify;
export const playCorrectSound = RaceEvents.playCorrect;
export const playWrongSound = RaceEvents.playWrong;
export const playWinSound = RaceEvents.playWin;
export const renderTracksUI = RaceEvents.renderTracks;
export const updateSingleLaneUI = RaceEvents.updateSingleLane;
export const startTimerUI = RaceEvents.startTimer;
export const clearTimeoutsUI = RaceEvents.clearTimeouts;
export const clearIntervalsUI = RaceEvents.clearIntervals;
export const updateTimerUI = RaceEvents.updateTimer;