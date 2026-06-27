// src/online/leaderboard/classLeaderboard.js
// لوحة صدارة طلاب صف معين (لمعلم محدد)

import { db, collection, query, where, orderBy, limit, getDocs } from '../../firebase/init.js';

/**
 * الحصول على ترتيب طلاب صف معين تابع لمعلم معين
 * @param {string} teacherId - معرف المعلم
 * @param {string} grade - اسم الصف (مثل "الصف الأول الابتدائي")
 * @param {number} limitCount - عدد النتائج (افتراضي 50)
 * @returns {Promise<Array<{id: string, name: string, score: number, grade: string, img: string}>>}
 */
export async function getClassLeaderboard(teacherId, grade, limitCount = 50) {
  if (!teacherId || !grade) return [];
  try {
    const q = query(collection(db, 'students'), where('teacherId', '==', teacherId), where('grade', '==', grade), orderBy('score', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[ClassLeaderboard] Error:', error);
    return [];
  }
}

/**
 * الحصول على مرتبة طالب ضمن صفه
 * @param {string} studentId 
 * @returns {Promise<{rank: number, grade: string, teacherId: string}>}
 */
export async function getStudentClassRank(studentId) {
  try {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) return { rank: -1, grade: null, teacherId: null };
    const { grade, teacherId, score = 0 } = studentSnap.data();
    if (!grade || !teacherId) return { rank: -1, grade, teacherId };
    
    const q = query(collection(db, 'students'), where('teacherId', '==', teacherId), where('grade', '==', grade), where('score', '>', score));
    const snapshot = await getDocs(q);
    return { rank: snapshot.size + 1, grade, teacherId };
  } catch (error) {
    console.error('[ClassLeaderboard] Rank error:', error);
    return { rank: -1, grade: null, teacherId: null };
  }
}