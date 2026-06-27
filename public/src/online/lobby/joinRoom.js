// src/online/lobby/joinRoom.js
// الانضمام إلى غرفة كـ لاعب أو مشاهد
// ✅ الإصدار النهائي الموحد:
// - المطور: دخول كامل بدون قيود
// - المعلم الفضي: يمكنه الانضمام كلاعب (لا حدود للانضمام، فقط للإنشاء)
// - المعلم الذهبي: يمكنه الانضمام كلاعب أو مشاهد
// - الطالب التابع لمعلم فضي: يسمح بالانضمام مع احترام الحد الشهري للمعلم (10 غرف)
// - الطالب التابع لمعلم ذهبي: يسمح بالانضمام دون قيود
// - الطالب التابع لمعلم مجاني: ممنوع تماماً
// - المشاهدة (spectator): فقط للمعلم الذهبي/المطور أو الطالب التابع لمعلم ذهبي

import { updateDocumentWithRetry, getDocumentOnce } from '../core/firestoreSync.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

/**
 * انضمام مستخدم إلى غرفة
 * @param {string} roomId - معرف الغرفة
 * @param {string} pin - رمز الدخول (إذا كانت خاصة)
 * @param {string} role - 'player' أو 'spectator'
 * @returns {Promise<{success: boolean, message?: string, roomData?: object}>}
 */
export async function joinRoom(roomId, pin, role = 'player') {
  // 1. جلب بيانات الغرفة الحالية
  const room = await getDocumentOnce(`activeRooms/${roomId}`);
  if (!room) {
    showFloatingNotification('الغرفة غير موجودة', 'error');
    return { success: false, message: 'Room not found' };
  }

  // 2. التحقق من أن الغرفة لا تزال في حالة انتظار (waiting) للمشتركين الجدد
  if (room.status !== 'waiting' && role === 'player') {
    showFloatingNotification('السباق بدأ بالفعل، لا يمكن الانضمام كلاعب الآن', 'error');
    return { success: false, message: 'Race already started' };
  }

  // 3. التحقق من رمز الدخول للغرف الخاصة
  if (room.isPrivate && room.accessCode !== pin) {
    showFloatingNotification('رمز الدخول غير صحيح', 'error');
    return { success: false, message: 'Invalid PIN' };
  }

  // 4. جلب بيانات المستخدم الحالي
  const user = await getCurrentUserInfo();
  if (!user) {
    showFloatingNotification('يجب تسجيل الدخول أولاً', 'error');
    return { success: false, message: 'Not logged in' };
  }

  // 5. كشف المطور (صلاحية كاملة)
  const isDeveloper = sessionStorage.getItem('is_developer') === 'true' || user.plan === 'developer';
  
  // إذا كان المطور، نسمح بالانضمام فوراً دون أي قيود
  if (isDeveloper) {
    console.log('[joinRoom] Developer joining, bypassing all checks');
    if (role === 'player') {
      return await performJoinAsPlayer(room, roomId, user);
    } else if (role === 'spectator') {
      return await performJoinAsSpectator(room, roomId, user);
    }
    return { success: false, message: 'Invalid role' };
  }

  // 6. التحقق من صلاحية الانضمام بناءً على الدور
  if (role === 'player') {
    // التحقق من سعة الغرفة
    if (room.players.length >= room.maxPlayers) {
      showFloatingNotification('الغرفة ممتلئة', 'error');
      return { success: false, message: 'Room is full' };
    }

    // إذا كان المستخدم معلماً
    if (user.isTeacher) {
      const teacherPlan = user.plan || sessionStorage.getItem('teacher_plan') || 'free';
      // المعلم المجاني لا يمكنه الانضمام إلى أي غرفة (لأنه لا يملك صلاحية اللعب الأونلاين)
      if (teacherPlan === 'free') {
        showFloatingNotification('الباقة المجانية لا تسمح بالمشاركة في المباريات الأونلاين. يرجى الترقية.', 'error');
        return { success: false, message: 'Free plan cannot join online games' };
      }
      // المعلم الفضي والذهبي مسموح لهما بالانضمام
      console.log('[joinRoom] Teacher joining with plan:', teacherPlan);
      return await performJoinAsPlayer(room, roomId, user);
    } 
    else {
      // الطالب: التحقق من صلاحية الانضمام بناءً على خطة معلمه
      let teacherPlan = sessionStorage.getItem('student_teacher_plan') || user.teacherPlan || 'free';
      console.log('[joinRoom] Student teacher plan:', teacherPlan);
      
      // استخدام canStudentJoin للتحقق (يتضمن فحص الخطة المجانية والحد الشهري للفضي)
      const { canStudentJoin } = await import('../../services/subscriptionGuard.js');
      const joinCheck = await canStudentJoin(user.id, teacherPlan);
      
      if (!joinCheck.allowed) {
        showFloatingNotification(joinCheck.message, 'error');
        return { success: false, message: joinCheck.message };
      }
      
      // نجاح التحقق: نسمح بالانضمام
      return await performJoinAsPlayer(room, roomId, user);
    }
  } 
  else if (role === 'spectator') {
    // التحقق من صلاحية المشاهدة
    let canWatch = false;
    
    if (user.isTeacher) {
      const teacherPlan = user.plan || sessionStorage.getItem('teacher_plan') || 'free';
      // المعلم: يحتاج إلى خطة ذهبية أو مطور (المطور تم استبعاده أعلاه لكن احتياطاً)
      canWatch = (teacherPlan === 'gold');
    } else {
      // الطالب: يحتاج إلى أن يكون معلمه ذهبياً
      const teacherPlan = sessionStorage.getItem('student_teacher_plan') || user.teacherPlan || 'free';
      canWatch = (teacherPlan === 'gold');
    }
    
    if (!canWatch) {
      showFloatingNotification('مشاهدة السباقات متاحة فقط للمعلمين والطلاب في الباقة الذهبية', 'error');
      return { success: false, message: 'Spectating requires gold plan' };
    }
    
    return await performJoinAsSpectator(room, roomId, user);
  }

  return { success: false, message: 'Invalid role' };
}

// دالة مساعدة لإضافة لاعب
async function performJoinAsPlayer(room, roomId, user) {
  const newPlayer = {
    id: user.id,
    name: user.name,
    img: user.img || '',
    isReady: false,
    score: 0,
    pos: 0
  };
  const updatedPlayers = [...room.players, newPlayer];
  const result = await updateDocumentWithRetry(`activeRooms/${roomId}`, { players: updatedPlayers });
  if (!result.success) {
    showFloatingNotification('فشل في الانضمام، حاول مرة أخرى', 'error');
    return { success: false, message: 'Failed to join' };
  }

  showFloatingNotification(`✅ انضممت كـ لاعب إلى غرفة ${room.name || 'الغرفة'}`, 'success');
  return { success: true, roomData: { ...room, players: updatedPlayers } };
}

// دالة مساعدة لإضافة مشاهد
async function performJoinAsSpectator(room, roomId, user) {
  const newSpectator = {
    id: user.id,
    name: user.name,
    img: user.img || ''
  };
  const updatedSpectators = [...(room.spectators || []), newSpectator];
  const result = await updateDocumentWithRetry(`activeRooms/${roomId}`, { spectators: updatedSpectators });
  if (!result.success) {
    showFloatingNotification('فشل في الانضمام كمشاهد', 'error');
    return { success: false, message: 'Failed to join as spectator' };
  }

  showFloatingNotification(`👁️ انضممت كمشاهد إلى غرفة ${room.name || 'الغرفة'}`, 'success');
  return { success: true, roomData: { ...room, spectators: updatedSpectators } };
}