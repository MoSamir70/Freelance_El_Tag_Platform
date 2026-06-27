// src/online/race/questionPublisher.js
// اختيار السؤال التالي من قائمة raceQuestions ونشره في Firestore
// الإصدار النهائي مع ضمانات:
// - التحقق من وجود أسئلة قبل النشر
// - نشر السؤال في الحقل currentQuestion الذي يراقبه اللاعبون
// - تحديث currentQuestionIndex و questionStartTime
// - إنهاء السباق إذا انتهت جميع الأسئلة

import { updateDocumentWithRetry, getDocumentOnce } from '../core/firestoreSync.js';
import { RACE_STATUS } from '../constants/raceConfig.js';

/**
 * نشر السؤال التالي في السباق
 * @param {string} sessionId 
 * @returns {Promise<boolean>} - نجاح أو فشل النشر
 */
export async function publishNextQuestion(sessionId) {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race) {
    console.error('[QuestionPublisher] Race not found:', sessionId);
    return false;
  }
  
  // التأكد من أن السباق لا يزال في حالة PLAYING
  if (race.status !== RACE_STATUS.PLAYING) {
    console.warn('[QuestionPublisher] Race is not playing, skipping publish');
    return false;
  }
  
  const { raceQuestions, currentQuestionIndex, goal, players, activeEntityId } = race;
  
  // التحقق من وجود أسئلة
  if (!raceQuestions || raceQuestions.length === 0) {
    console.error('[QuestionPublisher] No questions available for race:', sessionId);
    // إنهاء السباق لعدم وجود أسئلة
    await updateDocumentWithRetry(`activeRaces/${sessionId}`, { 
      status: RACE_STATUS.FINISHED,
      finishedAt: new Date(),
      winnerId: null,
      winnerName: 'لا يوجد فائز (لا توجد أسئلة)'
    });
    return false;
  }
  
  const nextIndex = currentQuestionIndex || 0;
  
  // إذا انتهت جميع الأسئلة، ننهي السباق
  if (nextIndex >= raceQuestions.length) {
    console.log('[QuestionPublisher] No more questions, ending race');
    await updateDocumentWithRetry(`activeRaces/${sessionId}`, { 
      status: RACE_STATUS.FINISHED,
      finishedAt: new Date()
    });
    return false;
  }
  
  // جلب السؤال التالي
  const nextQuestion = raceQuestions[nextIndex];
  if (!nextQuestion || !nextQuestion.text) {
    console.error('[QuestionPublisher] Invalid question at index', nextIndex);
    // تخطي هذا السؤال التالف
    const updateData = {
      currentQuestionIndex: nextIndex + 1,
      questionStartTime: new Date()
    };
    await updateDocumentWithRetry(`activeRaces/${sessionId}`, updateData);
    // محاولة نشر السؤال التالي بعد تخطي التالف
    return await publishNextQuestion(sessionId);
  }
  
  // إضافة رقم السؤال للإطار (اختياري)
  const questionWithMeta = {
    ...nextQuestion,
    questionNumber: nextIndex + 1,
    totalQuestions: raceQuestions.length
  };
  
  // نشر السؤال في مستند السباق
  const updateData = {
    currentQuestion: questionWithMeta,
    currentQuestionIndex: nextIndex + 1,
    questionStartTime: new Date()
  };
  
  const result = await updateDocumentWithRetry(`activeRaces/${sessionId}`, updateData);
  
  if (result.success) {
    console.log(`[QuestionPublisher] Published question ${nextIndex + 1}/${raceQuestions.length} for player ${activeEntityId || 'unknown'}`);
    
    // التحقق من أن السؤال قد تم نشره بالفعل (اختياري: إعادة قراءة للتأكيد)
    const updatedRace = await getDocumentOnce(`activeRaces/${sessionId}`);
    if (updatedRace && updatedRace.currentQuestion) {
      console.log('[QuestionPublisher] Question confirmed in Firestore');
    } else {
      console.warn('[QuestionPublisher] Question may not have been saved correctly');
    }
    
    return true;
  }
  
  console.error('[QuestionPublisher] Failed to publish question:', result.error);
  return false;
}

/**
 * الحصول على السؤال الحالي من السباق (للاستخدام المباشر)
 * @param {string} sessionId 
 * @returns {Promise<object|null>}
 */
export async function getCurrentQuestion(sessionId) {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  return race?.currentQuestion || null;
}

/**
 * التحقق مما إذا كان السؤال الحالي قد انتهى وقته (للاستخدام في المضيف)
 * @param {string} sessionId 
 * @returns {Promise<boolean>}
 */
export async function isQuestionTimedOut(sessionId) {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race || !race.questionStartTime) return false;
  
  const startTime = race.questionStartTime.toDate?.() || race.questionStartTime;
  const elapsed = (Date.now() - startTime.getTime()) / 1000;
  return elapsed > (race.timePerQuestion || 12);
}