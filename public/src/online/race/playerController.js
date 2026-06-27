// src/online/race/playerController.js
// اللاعب العادي: عرض السؤال، تمكين أزرار الإجابة فقط عند دوره، إرسال الإجابة
// ✅ تم إصلاح خطأ استيراد playCorrect/playWrong من notifications.js
// ✅ تم تعطيل المؤثرات الصوتية مؤقتًا لحين إضافة الدوال المناسبة

import { updateDocumentWithRetry, getDocumentOnce, subscribeToDocument } from '../core/firestoreSync.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
// تم تعطيل playCorrect و playWrong مؤقتًا حتى يتم توفيرهما
// import { playCorrect, playWrong } from '../../utils/helpers/notifications.js';

let currentRaceSubscription = null;
let currentRaceId = null;
let lastSubmittedQuestionIndex = -1; // لمنع إرسال إجابات متكررة لنفس السؤال

/**
 * بدء التحكم للاعب في سباق معين
 * @param {string} sessionId 
 * @param {Function} onQuestionUpdate - تستقبل السؤال الحالي (object)
 * @param {Function} onTurnChange - تستقبل { isMyTurn, activePlayerName, timeLeft }
 * @param {Function} onPlayersUpdate - (اختياري) تستقبل قائمة اللاعبين
 * @param {Function} onRaceEnd - (اختياري) تستقبل { winnerId, winnerName }
 * @returns {Promise<Function>} دالة لإلغاء الاشتراك
 */
export async function startPlayerController(sessionId, onQuestionUpdate, onTurnChange, onPlayersUpdate, onRaceEnd) {
  const user = await getCurrentUserInfo();
  if (!user) {
    console.error('[PlayerController] No user logged in');
    return () => {};
  }

  // تنظيف أي اشتراك سابق
  if (currentRaceSubscription) {
    currentRaceSubscription();
    currentRaceSubscription = null;
  }
  currentRaceId = sessionId;
  lastSubmittedQuestionIndex = -1;

  // الاشتراك في تحديثات السباق
  currentRaceSubscription = subscribeToDocument('activeRaces', sessionId, async (race) => {
    if (!race) {
      // السباق غير موجود (تم حذفه أو انتهى)
      if (onRaceEnd) onRaceEnd({ winnerId: null, winnerName: null, reason: 'race_not_found' });
      return;
    }

    // إذا انتهى السباق
    if (race.status === 'finished') {
      if (onRaceEnd) onRaceEnd({ winnerId: race.winnerId, winnerName: race.winnerName, reason: 'finished' });
      return;
    }

    // تحديث السؤال الحالي
    if (race.currentQuestion) {
      onQuestionUpdate(race.currentQuestion);
    }

    // تحديث قائمة اللاعبين (اختياري)
    if (onPlayersUpdate && race.players) {
      onPlayersUpdate(race.players);
    }

    // تحديد ما إذا كان دور اللاعب الحالي
    const isMyTurn = (race.activeEntityId === user.id);
    const activePlayer = race.players?.find(p => p.id === race.activeEntityId);
    const activePlayerName = activePlayer?.name || '';

    // حساب الوقت المتبقي (إذا كان دوره)
    let timeLeft = null;
    if (isMyTurn && race.questionStartTime && race.timePerQuestion) {
      const startTime = race.questionStartTime.toDate?.() || race.questionStartTime;
      const elapsed = (Date.now() - startTime.getTime()) / 1000;
      timeLeft = Math.max(0, race.timePerQuestion - elapsed);
    }

    onTurnChange({ isMyTurn, activePlayerName, timeLeft });
  });

  // إرجاع دالة التنظيف
  return () => {
    if (currentRaceSubscription) {
      currentRaceSubscription();
      currentRaceSubscription = null;
    }
    currentRaceId = null;
  };
}

/**
 * إرسال إجابة من اللاعب
 * @param {string} sessionId 
 * @param {number} selectedIndex - 0-based
 * @param {boolean} isCorrect - يتم حسابه محلياً أو من قبل الخادم
 * @returns {Promise<boolean>}
 */
export async function submitAnswer(sessionId, selectedIndex, isCorrect) {
  const user = await getCurrentUserInfo();
  if (!user) {
    showFloatingNotification('يجب تسجيل الدخول', 'error');
    return false;
  }

  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race) {
    showFloatingNotification('السباق غير موجود', 'error');
    return false;
  }

  // التأكد من أن السباق لا يزال قيد اللعب
  if (race.status !== 'playing') {
    showFloatingNotification('السباق انتهى بالفعل', 'warning');
    return false;
  }

  // التأكد من أن دور اللاعب
  if (race.activeEntityId !== user.id) {
    showFloatingNotification('❌ ليس دورك الآن! انتظر دورك', 'warning');
    return false;
  }

  // التأكد من عدم وجود إجابة معلقة
  if (race.pendingAnswer && !race.pendingAnswer.processed) {
    showFloatingNotification('تم الإجابة بالفعل، انتظر...', 'warning');
    return false;
  }

  // التحقق من أن السؤال الحالي لم يتم الإجابة عليه من قبل هذا اللاعب (منع التكرار)
  const currentQuestionIndex = race.currentQuestionIndex || 0;
  if (lastSubmittedQuestionIndex === currentQuestionIndex) {
    console.warn('[PlayerController] Duplicate answer attempt for same question');
    showFloatingNotification('تم إرسال الإجابة مسبقاً', 'warning');
    return false;
  }

  // إرسال الإجابة إلى Firestore
  const pendingAnswer = {
    playerId: user.id,
    selectedIndex: selectedIndex,
    isCorrect: isCorrect,
    timestamp: new Date(),
    processed: false
  };

  const result = await updateDocumentWithRetry(`activeRaces/${sessionId}`, { pendingAnswer });
  
  if (result.success) {
    lastSubmittedQuestionIndex = currentQuestionIndex;
    if (isCorrect) {
      // playCorrect(); // معطل مؤقتًا
      showFloatingNotification('✅ إجابة صحيحة! + نقاط', 'success', 1500);
    } else {
      // playWrong(); // معطل مؤقتًا
      showFloatingNotification('❌ إجابة خاطئة! - خطوة', 'error', 1500);
    }
    return true;
  } else {
    showFloatingNotification('فشل إرسال الإجابة، حاول مرة أخرى', 'error');
    return false;
  }
}

/**
 * إلغاء الاشتراك يدوياً (إذا لزم الأمر)
 */
export function stopPlayerController() {
  if (currentRaceSubscription) {
    currentRaceSubscription();
    currentRaceSubscription = null;
  }
  currentRaceId = null;
  lastSubmittedQuestionIndex = -1;
}

/**
 * الحصول على السؤال الحالي مباشرة (للاستخدام الفوري)
 * @param {string} sessionId 
 * @returns {Promise<object|null>}
 */
export async function getCurrentQuestion(sessionId) {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  return race?.currentQuestion || null;
}