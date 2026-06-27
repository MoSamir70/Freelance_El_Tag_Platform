// src/online/leaderboard/leaderboardUtils.js
// دوال مساعدة لعرض لوحة الصدارة (تنسيق، ترتيب، إلخ)

/**
 * تنسيق اسم الطالب للعرض (قص إذا كان طويلاً)
 * @param {string} name 
 * @param {number} maxLength 
 * @returns {string}
 */
export function formatStudentName(name, maxLength = 20) {
  if (!name) return 'طالب';
  return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
}

/**
 * الحصول على رمز المركز (🥇, 🥈, 🥉) حسب المرتبة
 * @param {number} rank 
 * @returns {string}
 */
export function getRankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}`;
}

/**
 * تجميع الطلاب حسب الصف (لإحصائيات سريعة)
 * @param {Array} students 
 * @returns {Object} - { gradeName: { count, averageScore, topStudent } }
 */
export function groupStudentsByGrade(students) {
  const groups = {};
  students.forEach(student => {
    const grade = student.grade || 'بدون صف';
    if (!groups[grade]) {
      groups[grade] = { count: 0, totalScore: 0, topStudent: null, topScore: -1 };
    }
    groups[grade].count++;
    groups[grade].totalScore += student.score || 0;
    if ((student.score || 0) > groups[grade].topScore) {
      groups[grade].topScore = student.score || 0;
      groups[grade].topStudent = student;
    }
  });
  // حساب المتوسط
  for (const grade in groups) {
    groups[grade].averageScore = groups[grade].count ? Math.round(groups[grade].totalScore / groups[grade].count) : 0;
  }
  return groups;
}