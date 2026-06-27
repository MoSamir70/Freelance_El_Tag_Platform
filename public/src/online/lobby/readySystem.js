// src/online/lobby/readySystem.js
// نظام الجاهزية - الإصدار المعدل لاستخدام خطة المعلم بشكل صحيح

import { updateDocumentWithRetry, getDocumentOnce } from '../core/firestoreSync.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { getTeacherSubscription } from '../../services/dataService.js';

/**
 * التحقق من صلاحية اللاعب للمشاركة في المباريات الأونلاين
 * @param {string} userId 
 * @param {boolean} isStudent 
 * @returns {Promise<boolean>}
 */
async function checkCanPlayOnline(userId, isStudent) {
  if (!isStudent) {
    // معلم: نتحقق من خطته
    const teacherPlan = sessionStorage.getItem('teacher_plan') || 'free';
    if (teacherPlan === 'free') {
      return false;
    }
    return true;
  } else {
    // طالب: نحتاج إلى خطة معلمه
    let teacherPlan = sessionStorage.getItem('student_teacher_plan');
    if (!teacherPlan) {
      // محاولة جلب خطة المعلم من Firestore
      try {
        const user = await getCurrentUserInfo();
        if (user && user.teacherId) {
          const sub = await getTeacherSubscription(user.teacherId);
          teacherPlan = sub?.plan || 'free';
          sessionStorage.setItem('student_teacher_plan', teacherPlan);
        } else {
          teacherPlan = 'free';
        }
      } catch (err) {
        console.error('[readySystem] Failed to fetch teacher plan:', err);
        teacherPlan = 'free';
      }
    }
    if (teacherPlan === 'free') {
      return false;
    }
    return true;
  }
}

export async function setPlayerReady(roomId, isReady) {
  const user = await getCurrentUserInfo();
  if (!user) {
    showFloatingNotification('يجب تسجيل الدخول', 'error');
    return { success: false };
  }

  // ✅ التحقق من صلاحية اللاعب باستخدام الدالة الجديدة
  const allowed = await checkCanPlayOnline(user.id, !user.isTeacher);
  if (!allowed) {
    let message = '';
    if (!user.isTeacher) {
      message = '❌ معلمك مشترك في الباقة المجانية، لا يمكنه المشاركة في المباريات الأونلاين. يرجى التواصل معه لترقية الاشتراك.';
    } else {
      message = '❌ الباقة المجانية لا تسمح بالمشاركة في المباريات الأونلاين. قم بترقية اشتراكك للاستفادة من هذه الميزة.';
    }
    showFloatingNotification(message, 'error');
    return { success: false };
  }

  const room = await getDocumentOnce(`activeRooms/${roomId}`);
  if (!room) {
    showFloatingNotification('الغرفة غير موجودة', 'error');
    return { success: false };
  }

  const playerIndex = room.players.findIndex(p => p.id === user.id);
  if (playerIndex === -1) {
    showFloatingNotification('أنت لست في هذه الغرفة', 'error');
    return { success: false };
  }

  const updatedPlayers = [...room.players];
  updatedPlayers[playerIndex].isReady = isReady;

  const result = await updateDocumentWithRetry(`activeRooms/${roomId}`, { players: updatedPlayers });
  if (result.success) {
    showFloatingNotification(isReady ? '✅ أنت جاهز!' : '⏸️ تم إلغاء الجاهزية', 'info');
    return { success: true };
  }
  showFloatingNotification('فشل تحديث حالة الجاهزية، حاول مرة أخرى', 'error');
  return { success: false };
}

export function areAllPlayersReady(room) {
  if (!room.players || room.players.length < 2) return false;
  const nonHostPlayers = room.players.filter(p => p.id !== room.hostId);
  if (nonHostPlayers.length === 0) return true;
  return nonHostPlayers.every(p => p.isReady === true);
}

export function getNotReadyPlayers(room) {
  const nonHostPlayers = room.players.filter(p => p.id !== room.hostId);
  return nonHostPlayers.filter(p => !p.isReady).map(p => p.name);
}