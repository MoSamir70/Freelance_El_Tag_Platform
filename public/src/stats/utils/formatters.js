// src/stats/utils/formatters.js
// دوال تنسيق الأرقام والتواريخ والعملات

/**
 * تنسيق رقم مع فواصل آلاف
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString('ar-EG');
}

/**
 * تنسيق نسبة مئوية
 * @param {number} value - القيمة (0-100)
 * @param {number} decimals - عدد الخانات العشرية
 * @returns {string}
 */
export function formatPercent(value, decimals = 0) {
  if (value === undefined || value === null) return '0%';
  return value.toFixed(decimals) + '%';
}

/**
 * تنسيق التاريخ
 * @param {number|Date|string} date - الطابع الزمني أو كائن التاريخ
 * @param {string} format - 'date', 'time', 'datetime', 'relative'
 * @returns {string}
 */
export function formatDate(date, format = 'datetime') {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  switch (format) {
    case 'date':
      return d.toLocaleDateString('ar-EG');
    case 'time':
      return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    case 'relative':
      return getRelativeTime(d);
    case 'datetime':
    default:
      return `${d.toLocaleDateString('ar-EG')} ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
  }
}

/**
 * الحصول على النص النسبي (منذ X دقيقة، منذ X يوم، إلخ)
 * @param {Date} date
 * @returns {string}
 */
function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHour < 24) return `منذ ${diffHour} ساعة`;
  if (diffDay < 7) return `منذ ${diffDay} يوم`;
  if (diffDay < 30) return `منذ ${Math.floor(diffDay / 7)} أسبوع`;
  if (diffDay < 365) return `منذ ${Math.floor(diffDay / 30)} شهر`;
  return `منذ ${Math.floor(diffDay / 365)} سنة`;
}

/**
 * تنسيق المدة بالثواني إلى نص مقروء
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0 ثانية';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) return `${mins} دقيقة ${secs} ثانية`;
  return `${secs} ثانية`;
}

/**
 * تنسيق اسم الطالب (العائلة + الاسم الأول)
 * @param {Object} student
 * @returns {string}
 */
export function formatStudentName(student) {
  if (!student) return '—';
  return student.name || 'طالب';
}

/**
 * تنسيق النقاط مع رمز النجمة
 * @param {number} score
 * @returns {string}
 */
export function formatScore(score) {
  if (score === undefined || score === null) return '⭐ 0';
  return `⭐ ${score.toLocaleString('ar-EG')}`;
}