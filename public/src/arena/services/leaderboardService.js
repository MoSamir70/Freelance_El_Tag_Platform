// src/arena/services/leaderboardService.js
// جلب بيانات الصدارة من Firestore مع حساب الإحصائيات

import { db, collection, getDocs, query, orderBy, limit, where } from '../../firebase/init.js';
import { getStudentStats } from '../../services/dataService.js';

/**
 * جلب قائمة الطلاب مع إحصائيات إضافية (نقاط، فوز، دقة)
 * @param {string} type - 'global', 'teacher', 'grade'
 * @param {string|null} teacherId - معرف المعلم (لـ 'teacher')
 * @param {string|null} grade - الصف (لـ 'grade')
 * @param {number} limitCount - عدد النتائج
 * @returns {Promise<Array>}
 */
export async function fetchLeaderboard(type, teacherId = null, grade = null, limitCount = 100) {
    let q;
    if (type === 'global') {
        q = query(collection(db, 'students'), orderBy('score', 'desc'), limit(limitCount));
    } else if (type === 'teacher' && teacherId) {
        q = query(collection(db, 'students'), where('teacherId', '==', teacherId), orderBy('score', 'desc'), limit(limitCount));
    } else if (type === 'grade' && grade) {
        q = query(collection(db, 'students'), where('grade', '==', grade), orderBy('score', 'desc'), limit(limitCount));
    } else {
        return [];
    }

    const snapshot = await getDocs(q);
    const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // إضافة إحصائيات إضافية لكل طالب (الفوز، الدقة)
    const studentsWithStats = await Promise.all(students.map(async (student) => {
        const stats = await getStudentStats(student.id);
        const wins = stats?.wins || 0;
        const correct = stats?.correctAnswers || 0;
        const total = stats?.totalAnswers || 0;
        const accuracy = total > 0 ? (correct / total) * 100 : 0;
        return {
            ...student,
            wins,
            correct,
            total,
            accuracy,
            score: student.score || 0
        };
    }));

    // ترتيب حسب المقياس المطلوب (سنقوم بالترتيب في الواجهة حسب الفلتر)
    return studentsWithStats;
}

/**
 * ترتيب القائمة حسب نوع الترتيب (نقاط، فوز، دقة)
 * @param {Array} students
 * @param {string} sortBy - 'score', 'wins', 'accuracy'
 */
export function sortLeaderboard(students, sortBy = 'score') {
    return [...students].sort((a, b) => {
        if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
        if (sortBy === 'wins') return (b.wins || 0) - (a.wins || 0);
        if (sortBy === 'accuracy') return (b.accuracy || 0) - (a.accuracy || 0);
        return 0;
    });
}export async function getStudentGlobalRank(studentId) {
    const students = await fetchLeaderboard('global', null, null, 1000);
    const index = students.findIndex(s => s.id === studentId);
    return index + 1;
}