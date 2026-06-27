// src/online/race/sessionManager.js
// إنشاء جلسة سباق جديدة من الغرفة، والتحويل إلى حالة playing
// ✅ تم تعديل فحص صلاحية خطة المضيف: الذهبي والمطور يسمح لهم بكل الأوضاع

import { createDocumentWithRetry, updateDocumentWithRetry, getDocumentOnce } from '../core/firestoreSync.js';
import { createRaceObject, validateRace } from '../core/raceState.js';
import { RACE_STATUS, ROOM_STATUS } from '../constants/raceConfig.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { incrementTeacherRoomCount } from '../../services/dataService.js';
import { getUserPlan, getAllowedModes } from '../../services/subscriptionGuard.js';

/**
 * بدء سباق من غرفة موجودة
 * @param {string} roomId 
 * @param {string} mode - 'player' أو 'spectator' (يُستخدم لتحديد دور المضيف في السباق)
 * @returns {Promise<{success: boolean, sessionId?: string, error?: string}>}
 */
export async function startRaceFromRoom(roomId, mode = 'player') {
  console.log('[startRaceFromRoom] Starting race for room:', roomId);

  // 1. جلب بيانات الغرفة
  const room = await getDocumentOnce(`activeRooms/${roomId}`);
  if (!room) {
    showFloatingNotification('الغرفة غير موجودة', 'error');
    return { success: false, error: 'Room not found' };
  }
  if (room.status !== ROOM_STATUS.WAITING) {
    showFloatingNotification('السباق قد بدأ بالفعل', 'error');
    return { success: false, error: 'Race already started' };
  }

  // 2. التحقق من أن المستخدم الحالي هو المضيف
  const user = await getCurrentUserInfo();
  if (!user || user.id !== room.hostId) {
    showFloatingNotification('فقط مضيف الغرفة يمكنه بدء السباق', 'error');
    return { success: false, error: 'Not host' };
  }

  // 3. التحقق من وجود لاعبين كاف (على الأقل 2)
  if (!room.players || room.players.length < 2) {
    showFloatingNotification('يجب وجود لاعبين على الأقل لبدء السباق', 'error');
    return { success: false, error: 'Not enough players' };
  }

  // 4. التحقق من وجود أسئلة في backup
  if (!room.raceSettingsBackup?.raceQuestions?.length) {
    showFloatingNotification('لا توجد أسئلة في هذه الغرفة، يرجى التأكد من رفع الأسئلة', 'error');
    return { success: false, error: 'No questions' };
  }

  // 5. التحقق من صلاحية خطة المضيف لبدء هذا النوع من السباق
  const teacherPlan = await getUserPlan(user.id, true);
  console.log('[startRaceFromRoom] Teacher plan:', teacherPlan);
  const gameMode = room.gameMode || room.raceSettingsBackup?.gameMode || 'normal';
  console.log('[startRaceFromRoom] Game mode:', gameMode);

  // ✅ الحل: الذهبي والمطور يسمح لهم بجميع الأوضاع دون فحص
  const isGoldOrDev = (teacherPlan === 'gold' || teacherPlan === 'developer');
  
  if (!isGoldOrDev) {
    const allowedModes = getAllowedModes(teacherPlan);
    if (!allowedModes.includes(gameMode)) {
      let upgradeMsg = '';
      if (teacherPlan === 'free') {
        upgradeMsg = 'الباقة المجانية تسمح فقط بالأوضاع الفردية (solo). قم بالترقية للفضية أو الذهبية.';
      } else if (teacherPlan === 'silver') {
        upgradeMsg = 'الباقة الفضية تسمح بالأوضاع الفردية والجماعية (solo, team). هذا الوضع غير مسموح. قم بالترقية للذهبية.';
      } else {
        upgradeMsg = 'هذا الوضع غير متاح في خطتك الحالية.';
      }
      showFloatingNotification(`❌ لا يمكن بدء هذا السباق. ${upgradeMsg}`, 'error');
      return { success: false, error: 'Game mode not allowed for this plan' };
    }
    
    // تحقق إضافي: أوضاع متقدمة (battle, tournament) تتطلب ذهبي
    if (teacherPlan === 'silver' && (gameMode === 'battle' || gameMode === 'tournament')) {
      showFloatingNotification('❌ أوضاع القتال (battle) والبطولات (tournament) متاحة فقط للمعلمين الذهبيين والمطورين.', 'error');
      return { success: false, error: 'Advanced modes require gold plan' };
    }
  } else {
    console.log('[startRaceFromRoom] Gold/Developer plan: allowing all game modes');
  }

  // 6. إنشاء جلسة سباق جديدة
  const sessionId = `race_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const raceData = createRaceObject(room, sessionId, user.id, mode);
  
  // التحقق من صحة كائن السباق
  const validation = validateRace(raceData);
  if (!validation.valid) {
    showFloatingNotification(validation.error, 'error');
    return { success: false, error: validation.error };
  }

  // 7. كتابة مستند السباق في activeRaces
  const result = await createDocumentWithRetry('activeRaces', raceData);
  if (!result.success) {
    console.error('[SessionManager] Failed to create race document:', result.error);
    showFloatingNotification('فشل إنشاء جلسة السباق', 'error');
    return { success: false, error: result.error };
  }

  const realSessionId = result.id;
  console.log(`[SessionManager] Race session created: ${realSessionId}`);

  // 8. تحديث حالة الغرفة إلى playing وربط sessionId
  await updateDocumentWithRetry(`activeRooms/${roomId}`, {
    status: ROOM_STATUS.PLAYING,
    startedAt: new Date(),
    sessionId: realSessionId
  });

  // 9. تحديث عداد المباريات للمعلم (للفضي فقط)
  await incrementTeacherRoomCount(room.teacherId);

  // 10. تفعيل hostController لهذه الجلسة (هام جداً!)
  try {
    const { startHostController } = await import('./hostController.js');
    await startHostController(realSessionId, raceData);
    console.log('[SessionManager] Host controller started successfully');
  } catch (err) {
    console.error('[SessionManager] Failed to start host controller:', err);
    // نستمر على أي حال، قد يبدأ hostController بالاستماع من تلقاء نفسه
  }

  showFloatingNotification('تم بدء السباق! جاري تحويل المشاركين...', 'success');
  return { success: true, sessionId: realSessionId };
}

/**
 * استعادة جلسة سباق موجودة (لإعادة الاتصال)
 * @param {string} sessionId 
 * @returns {Promise<{success: boolean, race?: object}>}
 */
export async function resumeRaceSession(sessionId) {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race) {
    return { success: false, error: 'Race not found' };
  }
  
  if (race.status === RACE_STATUS.PLAYING) {
    // إعادة تشغيل hostController إذا كان المستخدم هو المضيف
    const user = await getCurrentUserInfo();
    if (user && user.id === race.hostId) {
      const { startHostController } = await import('./hostController.js');
      await startHostController(sessionId, race);
    }
  }
  
  return { success: true, race };
}