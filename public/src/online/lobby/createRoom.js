// src/online/lobby/createRoom.js
// دالة إنشاء غرفة جديدة مع تطبيق الحد الشهري حسب الخطة
// تم تعديل الاستيرادات لتستخدم نظام الاشتراك الجديد

import { createDocumentWithRetry, updateDocumentWithRetry } from '../core/firestoreSync.js';
import { createRoomObject, validateRoom } from '../core/raceState.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { checkTeacherAccess, getTeacherMonthlyUsage, incrementMonthlyRoomCount } from '../../services/subscription/index.js';

export async function createRoom(roomSettings) {
  const user = await getCurrentUserInfo();
  if (!user || !user.isTeacher) {
    showFloatingNotification('يجب تسجيل الدخول كمعلم لإنشاء غرفة', 'error');
    return { success: false, error: 'Not a teacher' };
  }

  const teacherCode = user.code || user.id;
  
  const access = await checkTeacherAccess(teacherCode);
  if (!access.allowed) {
    showFloatingNotification(access.message, 'error');
    return { success: false, error: access.message };
  }

  const teacherPlan = access.plan;
  
  if (teacherPlan === 'free') {
    showFloatingNotification('الباقة المجانية لا تسمح بإنشاء غرف أونلاين. يرجى الترقية إلى الباقة الفضية أو الذهبية.', 'error');
    return { success: false, error: 'Free plan cannot create rooms' };
  }
  
  if (teacherPlan === 'silver') {
    const usage = await getTeacherMonthlyUsage(teacherCode);
    const maxAllowed = 10;
    const used = usage.roomsUsed || 0;
    
    if (used >= maxAllowed) {
      showFloatingNotification(`⚠️ لقد استنفذت الحد الشهري المسموح به (${maxAllowed} غرفة). ترقية إلى الباقة الذهبية لإنشاء غرف غير محدودة.`, 'error');
      return { success: false, error: 'Monthly room limit reached for silver plan' };
    }
    
    if (used >= maxAllowed - 2) {
      showFloatingNotification(`تنبيه: تبقى لك ${maxAllowed - used} غرفة هذا الشهر (الحد الأقصى ${maxAllowed})`, 'warning', 4000);
    }
  }
  
  let pin = null;
  if (roomSettings.isPrivate) {
    pin = roomSettings.pin && roomSettings.pin.trim() ? roomSettings.pin.trim() : generateRoomPin();
  }

  const tempRoomId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const raceSettingsBackup = {
    grade: roomSettings.grade,
    subject: roomSettings.subject,
    mergedMaterials: roomSettings.mergedMaterials || [roomSettings.subject],
    selectedLessonsWithMaterial: roomSettings.selectedLessonsWithMaterial || [],
    accumulative: roomSettings.accumulative || false,
    goal: roomSettings.goal,
    timer: roomSettings.timePerQuestion,
    gameMode: roomSettings.gameMode,
    gameSystem: roomSettings.gameSystem,
    isTrainingMode: roomSettings.isTrainingMode || false,
    difficulty: roomSettings.difficulty || 'متوسط',
    raceQuestions: roomSettings.raceQuestions || [],
    currentQuestionIndex: 0
  };

  const roomData = createRoomObject({
    roomId: tempRoomId,
    hostId: user.id,
    hostName: user.name,
    teacherId: teacherCode,
    grade: roomSettings.grade,
    subject: roomSettings.subject,
    gameMode: roomSettings.gameMode,
    gameSystem: roomSettings.gameSystem,
    isPrivate: roomSettings.isPrivate || false,
    pin,
    maxPlayers: roomSettings.maxPlayers || 8,
    goal: roomSettings.goal,
    timePerQuestion: roomSettings.timePerQuestion,
    raceSettingsBackup
  });

  const validation = validateRoom(roomData);
  if (!validation.valid) {
    showFloatingNotification(validation.error, 'error');
    return { success: false, error: validation.error };
  }

  const result = await createDocumentWithRetry('activeRooms', roomData);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const realRoomId = result.id;
  try {
    await updateDocumentWithRetry(`activeRooms/${realRoomId}`, { actualRoomId: realRoomId, roomId: realRoomId });
  } catch (updateError) {
    console.warn('[createRoom] تحديث الحقول الإضافية فشل، لكن الغرفة تم إنشاؤها بنجاح:', updateError);
  }

  if (teacherPlan !== 'developer' && teacherPlan !== 'free') {
    await incrementMonthlyRoomCount(teacherCode);
  }

  showFloatingNotification(`تم إنشاء الغرفة بنجاح! رمز الدخول: ${pin || 'عامة'}`, 'success');
  return { success: true, roomId: realRoomId, pin };
}

function generateRoomPin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}