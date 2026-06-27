// src/online/race/hostController.js
// المضيف: يستمع للتغييرات، يعالج الإجابات، يدير الوقت، ينتقل للاعب التالي، ينشر الأسئلة
// الإصدار النهائي مع ضمانات:
// - نشر السؤال الأول فور بدء السباق
// - معالجة انتهاء الوقت (timeout) وتسجيل إجابة خاطئة تلقائياً
// - منع معالجة الإجابة أكثر من مرة
// - الانتقال إلى اللاعب التالي ونشر سؤال جديد
// - فحص صلاحية وضع اللعب حسب خطة المضيف

import { updateDocumentWithRetry, getDocumentOnce, subscribeToDocument } from '../core/firestoreSync.js';
import { RACE_STATUS } from '../constants/raceConfig.js';
import { processAnswer } from './answerHandler.js';
import { getNextEntityId } from './turnManager.js';
import { publishNextQuestion } from './questionPublisher.js';
import { checkAndHandleWin } from './winHandler.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { isModeAllowed, getUserPlan } from '../../services/subscriptionGuard.js';

let activeHostInterval = null;
let currentRaceId = null;
let raceUnsubscribe = null;

export async function startHostController(sessionId, raceData = null) {
  // تنظيف أي جلسة سابقة
  if (activeHostInterval) {
    clearInterval(activeHostInterval);
    activeHostInterval = null;
  }
  if (raceUnsubscribe) {
    raceUnsubscribe();
    raceUnsubscribe = null;
  }
  currentRaceId = sessionId;

  let race = raceData || await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race) {
    console.error('[HostController] Race not found');
    return;
  }

  const user = await getCurrentUserInfo();
  if (user.id !== race.hostId) {
    console.warn('[HostController] Not the host, ignoring');
    return;
  }

  // ✅ التحقق من أن وضع اللعب مسموح لخطة المضيف
  const hostPlan = await getUserPlan(user.id, true);
  const gameMode = race.gameMode || 'solo';
  if (!isModeAllowed(gameMode, hostPlan)) {
    console.warn(`[HostController] Host plan ${hostPlan} does not allow mode ${gameMode}`);
    showFloatingNotification('❌ هذا الوضع غير مسموح في خطتك الحالية.', 'error');
    await updateDocumentWithRetry(`activeRaces/${sessionId}`, { status: RACE_STATUS.FINISHED });
    return;
  }

  // إذا كانت الغرفة لا تزال في حالة WAITING، نبدأ السباق وننشر السؤال الأول
  if (race.status === RACE_STATUS.WAITING) {
    await updateDocumentWithRetry(`activeRaces/${sessionId}`, {
      status: RACE_STATUS.PLAYING,
      startedAt: new Date(),
      questionStartTime: new Date()
    });
    // نشر السؤال الأول
    const published = await publishNextQuestion(sessionId);
    if (!published) {
      showFloatingNotification('فشل نشر السؤال الأول، تأكد من وجود أسئلة', 'error');
      await updateDocumentWithRetry(`activeRaces/${sessionId}`, { status: RACE_STATUS.FINISHED });
      return;
    }
  }

  // الاشتراك في تحديثات السباق (للتأكد من استمرار الصلاحية)
  raceUnsubscribe = subscribeToDocument('activeRaces', sessionId, (newRace) => {
    if (!newRace || newRace.hostId !== user.id || newRace.status !== RACE_STATUS.PLAYING) {
      if (activeHostInterval) clearInterval(activeHostInterval);
      if (raceUnsubscribe) raceUnsubscribe();
    }
  });

  // بدء الحلقة الزمنية لإدارة الوقت والإجابات
  activeHostInterval = setInterval(async () => {
    const currentRace = await getDocumentOnce(`activeRaces/${sessionId}`);
    if (!currentRace || currentRace.status !== RACE_STATUS.PLAYING) {
      if (activeHostInterval) clearInterval(activeHostInterval);
      return;
    }

    // 1. معالجة الإجابة المعلقة (إن وجدت)
    if (currentRace.pendingAnswer && !currentRace.pendingAnswer.processed) {
      const { success, winner, updatedRace } = await processAnswer(sessionId, currentRace.pendingAnswer);
      if (success) {
        // تحديث حالة السباق بعد الإجابة
        await updateDocumentWithRetry(`activeRaces/${sessionId}`, {
          players: updatedRace.players,
          teams: updatedRace.teams,
          pendingAnswer: { ...currentRace.pendingAnswer, processed: true },
          ...(updatedRace.winnerId && { winnerId: updatedRace.winnerId, winnerName: updatedRace.winnerName })
        });
        
        // إذا هناك فائز، ننهي السباق
        if (winner) {
          await checkAndHandleWin(sessionId, winner);
          return;
        }
        
        // تحديد اللاعب/الفريق التالي
        const nextEntityId = getNextEntityId(updatedRace);
        await updateDocumentWithRetry(`activeRaces/${sessionId}`, {
          activeEntityId: nextEntityId,
          questionStartTime: new Date()
        });
        
        // نشر السؤال التالي للاعب الجديد
        await publishNextQuestion(sessionId);
      }
    }

    // 2. التحقق من انتهاء الوقت (timeout)
    const now = Date.now();
    const questionStart = currentRace.questionStartTime?.toDate?.() || currentRace.questionStartTime;
    if (questionStart && (now - questionStart.getTime()) > (currentRace.timePerQuestion * 1000)) {
      const currentPlayer = currentRace.players.find(p => p.id === currentRace.activeEntityId);
      if (currentPlayer) {
        // إنشاء إجابة خاطئة تلقائياً (انتهاء الوقت)
        const wrongAnswer = {
          playerId: currentPlayer.id,
          selectedIndex: -1,
          isCorrect: false,
          timestamp: new Date(),
          processed: false
        };
        const { success, winner, updatedRace } = await processAnswer(sessionId, wrongAnswer, true);
        if (success) {
          await updateDocumentWithRetry(`activeRaces/${sessionId}`, {
            players: updatedRace.players,
            pendingAnswer: { ...wrongAnswer, processed: true },
            questionStartTime: new Date()
          });
          
          if (winner) {
            await checkAndHandleWin(sessionId, winner);
            return;
          }
          
          const nextEntityId = getNextEntityId(updatedRace);
          await updateDocumentWithRetry(`activeRaces/${sessionId}`, { activeEntityId: nextEntityId });
          await publishNextQuestion(sessionId);
        }
      } else {
        // إذا لم يتم العثور على اللاعب الحالي، نمر إلى التالي
        const nextEntityId = getNextEntityId(currentRace);
        await updateDocumentWithRetry(`activeRaces/${sessionId}`, {
          activeEntityId: nextEntityId,
          questionStartTime: new Date()
        });
        await publishNextQuestion(sessionId);
      }
    }
  }, 1000); // فحص كل ثانية
}

export function stopHostController() {
  if (activeHostInterval) {
    clearInterval(activeHostInterval);
    activeHostInterval = null;
  }
  if (raceUnsubscribe) {
    raceUnsubscribe();
    raceUnsubscribe = null;
  }
  currentRaceId = null;
}