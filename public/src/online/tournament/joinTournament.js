// src/online/tournament/joinTournament.js
// انضمام طالب إلى بطولة مع التحقق من خطة معلمه (مجاني ممنوع، فضي/ذهبي مسموح)

import { db, doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from '../../firebase/init.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

/**
 * انضمام طالب إلى بطولة
 * @param {string} tournamentId 
 * @param {string} accessCode - رمز الدخول (إذا كانت البطولة خاصة)
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function joinTournament(tournamentId, accessCode = null) {
  const user = await getCurrentUserInfo();
  if (!user || user.isTeacher) {
    showFloatingNotification('تسجيل الدخول مطلوب للمشاركة في البطولات', 'error');
    return { success: false, message: 'Not logged in as student' };
  }

  // ✅ التحقق من خطة معلم الطالب (من sessionStorage)
  const teacherPlan = sessionStorage.getItem('student_teacher_plan') || 'free';
  if (teacherPlan === 'free') {
    showFloatingNotification('معلمك مشترك في الباقة المجانية، لا يمكنك المشاركة في البطولات.', 'error');
    return { success: false, message: 'Teacher plan not allowed' };
  }
  // الفضي والذهبي والمطور مسموح لهم (المطور يعامل كذهبي)

  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const tournamentSnap = await getDoc(tournamentRef);
  if (!tournamentSnap.exists()) {
    showFloatingNotification('البطولة غير موجودة', 'error');
    return { success: false, message: 'Tournament not found' };
  }

  const tournament = tournamentSnap.data();

  // التحقق من رمز الدخول للبطولات الخاصة
  if (tournament.accessCode && tournament.accessCode !== accessCode) {
    showFloatingNotification('رمز الدخول غير صحيح', 'error');
    return { success: false, message: 'Invalid access code' };
  }

  // التحقق من حالة البطولة
  if (tournament.status !== 'waiting') {
    showFloatingNotification('البطولة قد بدأت بالفعل أو انتهت', 'error');
    return { success: false, message: 'Tournament already started' };
  }

  // التحقق من عدم تجاوز الحد الأقصى
  if (tournament.players.length >= tournament.maxPlayers) {
    showFloatingNotification('البطولة ممتلئة', 'error');
    return { success: false, message: 'Tournament is full' };
  }

  // التحقق من أن الطالب لم يسجل بالفعل
  if (tournament.players.some(p => p.id === user.id)) {
    showFloatingNotification('أنت مسجل بالفعل في هذه البطولة', 'warning');
    return { success: false, message: 'Already joined' };
  }

  // إضافة الطالب
  const newPlayer = {
    id: user.id,
    name: user.name,
    img: user.img || '',
    score: 0,
    wins: 0
  };

  await updateDoc(tournamentRef, {
    players: arrayUnion(newPlayer)
  });

  showFloatingNotification(`تم تسجيلك في البطولة "${tournament.name}"`, 'success');
  return { success: true, message: 'Joined successfully' };
}

/**
 * مغادرة بطولة (قبل البدء)
 * @param {string} tournamentId 
 */
export async function leaveTournament(tournamentId) {
  const user = await getCurrentUserInfo();
  if (!user) return { success: false };

  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const tournamentSnap = await getDoc(tournamentRef);
  if (!tournamentSnap.exists()) return { success: false, message: 'Not found' };
  
  const tournament = tournamentSnap.data();
  if (tournament.status !== 'waiting') {
    return { success: false, message: 'Cannot leave after start' };
  }

  const updatedPlayers = tournament.players.filter(p => p.id !== user.id);
  await updateDoc(tournamentRef, { players: updatedPlayers });
  showFloatingNotification('تم مغادرة البطولة', 'info');
  return { success: true };
}