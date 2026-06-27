// src/online/race/raceListeners.js
// مستمع عام للسباق لتحديث واجهة المستخدم (مركز، مؤقت، سؤال)
// الإصدار النهائي مع ضمانات:
// - تحديث السؤال الحالي لكل المشاركين (لاعبين ومشاهدين)
// - تحديث قائمة اللاعبين ومراكزهم
// - تحديث الوقت المتبقي بشكل حي
// - التعامل مع انتهاء السباق وإعلان الفائز
// - دعم كلا النوعين: لاعب عادي ومشاهد

import { subscribeToDocument } from '../core/firestoreSync.js';

let raceUnsubscribe = null;
let currentRaceId = null;

/**
 * بدء الاستماع إلى سباق معين
 * @param {string} sessionId - معرف جلسة السباق
 * @param {object} callbacks - دوال الاستدعاء
 * @param {Function} callbacks.onQuestionUpdate - (question) => {} عند تغير السؤال
 * @param {Function} callbacks.onPlayersUpdate - (players, activeEntityId) => {} عند تغير اللاعبين أو المراكز
 * @param {Function} callbacks.onTimerUpdate - (timeLeft) => {} عند تغير الوقت المتبقي (كل ثانية)
 * @param {Function} callbacks.onTurnUpdate - (activeEntityId, activePlayerName) => {} عند تغير الدور
 * @param {Function} callbacks.onRaceEnded - (winnerId, winnerName) => {} عند انتهاء السباق
 * @param {Function} callbacks.onRaceDeleted - () => {} عند حذف السباق
 * @returns {Promise<Function>} دالة لإلغاء الاشتراك
 */
export async function listenToRace(sessionId, callbacks) {
  // تنظيف أي استماع سابق
  if (raceUnsubscribe) {
    raceUnsubscribe();
    raceUnsubscribe = null;
  }
  currentRaceId = sessionId;

  let lastTimerValue = -1;
  let timerInterval = null;

  // دالة لإيقاف المؤقت
  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };

  // دالة لبدء المؤقت
  const startTimer = (race) => {
    stopTimer();
    if (!race || race.status !== 'playing') return;
    if (!race.questionStartTime || !race.timePerQuestion) return;

    timerInterval = setInterval(() => {
      const startTime = race.questionStartTime?.toDate?.() || race.questionStartTime;
      if (!startTime) return;
      const elapsed = (Date.now() - startTime.getTime()) / 1000;
      const timeLeft = Math.max(0, race.timePerQuestion - elapsed);
      if (Math.abs(timeLeft - lastTimerValue) >= 0.5 || timeLeft === 0) {
        lastTimerValue = timeLeft;
        if (callbacks.onTimerUpdate) callbacks.onTimerUpdate(timeLeft);
      }
      if (timeLeft <= 0 && timerInterval) {
        // الوقت انتهى، يمكن إيقاف المؤقت مؤقتاً حتى السؤال التالي
        stopTimer();
      }
    }, 200); // تحديث كل 200 مللي للسلاسة
  };

  // الاشتراك في مستند السباق
  raceUnsubscribe = subscribeToDocument('activeRaces', sessionId, (race) => {
    if (!race) {
      // السباق غير موجود (تم حذفه)
      stopTimer();
      if (callbacks.onRaceDeleted) callbacks.onRaceDeleted();
      return;
    }

    // التحقق من انتهاء السباق
    if (race.status === 'finished') {
      stopTimer();
      if (callbacks.onRaceEnded) {
        callbacks.onRaceEnded(race.winnerId, race.winnerName);
      }
      return;
    }

    // تحديث السؤال الحالي
    if (race.currentQuestion && callbacks.onQuestionUpdate) {
      callbacks.onQuestionUpdate(race.currentQuestion);
    }

    // تحديث قائمة اللاعبين والمراكز
    if (race.players && callbacks.onPlayersUpdate) {
      callbacks.onPlayersUpdate(race.players, race.activeEntityId);
    }

    // تحديث الدور (اللاعب النشط)
    if (callbacks.onTurnUpdate && race.activeEntityId) {
      const activePlayer = race.players?.find(p => p.id === race.activeEntityId);
      callbacks.onTurnUpdate(race.activeEntityId, activePlayer?.name || '');
    }

    // بدء أو تحديث المؤقت
    if (race.status === 'playing') {
      if (race.questionStartTime && race.timePerQuestion) {
        startTimer(race);
      }
    } else {
      stopTimer();
    }
  });

  // إرجاع دالة لإلغاء الاشتراك وإيقاف المؤقت
  return () => {
    stopTimer();
    if (raceUnsubscribe) {
      raceUnsubscribe();
      raceUnsubscribe = null;
    }
    currentRaceId = null;
  };
}

/**
 * إيقاف الاستماع الحالي (إذا كان نشطاً)
 */
export function stopListeningToRace() {
  if (raceUnsubscribe) {
    raceUnsubscribe();
    raceUnsubscribe = null;
  }
  currentRaceId = null;
}

/**
 * الحصول على معرف السباق الحالي المستمع إليه
 * @returns {string|null}
 */
export function getCurrentRaceId() {
  return currentRaceId;
}