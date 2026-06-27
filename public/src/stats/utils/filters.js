// src/stats/utils/filters.js
// دوال التصفية (زمنية، مدرسية، صفية)

/**
 * تصفية المباريات حسب النطاق الزمني
 * @param {Array} history - تاريخ المباريات
 * @param {string} period - 'day', 'week', 'month', 'year', 'all'
 * @returns {Array}
 */
export function filterHistoryByPeriod(history, period) {
  if (!history || !history.length) return [];
  if (period === 'all') return history;
  
  const now = Date.now();
  let startTime;
  switch (period) {
    case 'day':
      startTime = now - 24 * 60 * 60 * 1000;
      break;
    case 'week':
      startTime = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case 'month':
      startTime = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case 'year':
      startTime = now - 365 * 24 * 60 * 60 * 1000;
      break;
    default:
      return history;
  }
  return history.filter(game => game.timestamp >= startTime);
}

/**
 * تصفية الطلاب حسب الصف
 * @param {Array} students
 * @param {string} grade
 * @returns {Array}
 */
export function filterStudentsByGrade(students, grade) {
  if (!students || !students.length) return [];
  if (grade === 'all' || !grade) return students.filter(s => !s.isTeacher);
  return students.filter(s => !s.isTeacher && s.grade === grade);
}

/**
 * تصفية الطلاب حسب النطاق النقطي
 * @param {Array} students
 * @param {number} minScore - الحد الأدنى
 * @param {number} maxScore - الحد الأقصى
 * @returns {Array}
 */
export function filterStudentsByScore(students, minScore = 0, maxScore = Infinity) {
  if (!students || !students.length) return [];
  return students.filter(s => !s.isTeacher && (s.score || 0) >= minScore && (s.score || 0) <= maxScore);
}

/**
 * تصفية الطلاب حسب البحث النصي (الاسم أو المعرف)
 * @param {Array} students
 * @param {string} searchTerm
 * @returns {Array}
 */
export function filterStudentsBySearch(students, searchTerm) {
  if (!students || !students.length) return [];
  if (!searchTerm) return students.filter(s => !s.isTeacher);
  const term = searchTerm.toLowerCase();
  return students.filter(s => 
    !s.isTeacher && (s.name?.toLowerCase().includes(term) || String(s.id).toLowerCase().includes(term))
  );
}

/**
 * تصفية الأسئلة حسب الصف والمادة والدرس
 * @param {Array} questions
 * @param {Object} filters - { grade, subject, lesson, difficulty }
 * @returns {Array}
 */
export function filterQuestions(questions, filters = {}) {
  if (!questions || !questions.length) return [];
  let filtered = [...questions];
  
  if (filters.grade && filters.grade !== 'all') {
    filtered = filtered.filter(q => q.grade === filters.grade);
  }
  if (filters.subject && filters.subject !== 'all') {
    filtered = filtered.filter(q => q.subject === filters.subject);
  }
  if (filters.lesson && filters.lesson !== 'all') {
    filtered = filtered.filter(q => q.lesson === filters.lesson);
  }
  if (filters.difficulty && filters.difficulty !== 'all') {
    filtered = filtered.filter(q => q.difficulty === filters.difficulty);
  }
  return filtered;
}

/**
 * الحصول على خيارات الفلتر من البيانات (للمواد والدروس)
 * @param {Array} questions
 * @returns {Object} - { subjects: Set, lessons: Set, grades: Set }
 */
export function getFilterOptions(questions) {
  const subjects = new Set();
  const lessons = new Set();
  const grades = new Set();
  
  questions.forEach(q => {
    if (q.subject) subjects.add(q.subject);
    if (q.lesson) lessons.add(q.lesson);
    if (q.grade) grades.add(q.grade);
  });
  
  return {
    subjects: Array.from(subjects).sort(),
    lessons: Array.from(lessons).sort(),
    grades: Array.from(grades).sort()
  };
}