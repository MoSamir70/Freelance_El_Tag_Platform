// src/online/leaderboard/teacherLeaderboard.js
// لوحة صدارة طلاب معلم معين (جميع صفوفه)

import { db, collection, query, where, orderBy, limit, getDocs, getDoc, doc } from '../../firebase/init.js';

/**
 * الحصول على ترتيب طلاب معلم معين حسب النقاط
 * @param {string} teacherId - معرف المعلم (الكود أو UID)
 * @param {number} limitCount - عدد النتائج (افتراضي 50)
 * @returns {Promise<Array<{id: string, name: string, score: number, grade: string, img: string}>>}
 */
export async function getTeacherLeaderboard(teacherId, limitCount = 50) {
  if (!teacherId) return [];
  try {
    const q = query(collection(db, 'students'), where('teacherId', '==', teacherId), orderBy('score', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[TeacherLeaderboard] Error:', error);
    return [];
  }
}

/**
 * الحصول على مرتبة طالب ضمن طلاب معلمه
 * @param {string} studentId 
 * @returns {Promise<number>} - المرتبة (1 = أعلى)
 */
export async function getStudentTeacherRank(studentId) {
  try {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) return -1;
    const teacherId = studentSnap.data().teacherId;
    if (!teacherId) return -1;
    
    const studentScore = studentSnap.data().score || 0;
    const q = query(collection(db, 'students'), where('teacherId', '==', teacherId), where('score', '>', studentScore));
    const snapshot = await getDocs(q);
    return snapshot.size + 1;
  } catch (error) {
    console.error('[TeacherLeaderboard] Rank error:', error);
    return -1;
  }
}