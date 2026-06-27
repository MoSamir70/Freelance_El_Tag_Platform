// src/stats/analytics/comparison.js
// توجيه إلى نظام الإحصائيات الجديد

export function showComparisonModal() {
    window.location.href = 'stats-preview.html?tab=reports';
}

export function renderComparison(studentId1, studentId2) {
    console.warn('تم نقل ميزة المقارنة إلى الصفحة الجديدة');
    window.location.href = 'stats-preview.html?tab=reports';
}