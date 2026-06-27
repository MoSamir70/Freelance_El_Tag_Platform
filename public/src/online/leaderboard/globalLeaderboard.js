// src/online/leaderboard/globalLeaderboard.js
// لوحة الصدارة العالمية (أفضل الطلاب حسب النقاط من جميع المعلمين)

import { db, collection, query, orderBy, limit, getDocs, where, getCountFromServer } from '../../firebase/init.js';

/**
 * الحصول على ترتيب الطلاب على مستوى المنصة (جميع المعلمين)
 * @param {number} limitCount - عدد النتائج المطلوبة (افتراضي 20)
 * @returns {Promise<Array<{id: string, name: string, score: number, grade: string, img: string, teacherId: string}>>}
 */
export async function getGlobalLeaderboard(limitCount = 20) {
  try {
    const q = query(collection(db, 'students'), orderBy('score', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[GlobalLeaderboard] Error:', error);
    return [];
  }
}

/**
 * الحصول على إجمالي عدد الطلاب المسجلين في المنصة
 * @returns {Promise<number>}
 */
export async function getTotalStudentsCount() {
  try {
    const snapshot = await getCountFromServer(collection(db, 'students'));
    return snapshot.data().count;
  } catch (error) {
    console.error('[GlobalLeaderboard] Count error:', error);
    return 0;
  }
}

/**
 * الحصول على مرتبة طالب معين على المستوى العالمي
 * @param {string} studentId 
 * @returns {Promise<number>} - المرتبة (تبدأ من 1)
 */
export async function getStudentGlobalRank(studentId) {
  try {
    const student = await getDoc(doc(db, 'students', studentId));
    if (!student.exists()) return -1;
    const studentScore = student.data().score || 0;
    
    // عدد الطلاب الذين لديهم نقاط أكبر من هذا الطالب
    const q = query(collection(db, 'students'), where('score', '>', studentScore));
    const snapshot = await getDocs(q);
    return snapshot.size + 1;
  } catch (error) {
    console.error('[GlobalLeaderboard] Rank error:', error);
    return -1;
  }
}