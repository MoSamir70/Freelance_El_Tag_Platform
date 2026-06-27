// src/stats/analytics/export.js
// توجيه إلى نظام الإحصائيات الجديد

export async function exportGradeReport(grade, options) {
    window.location.href = 'stats-preview.html?tab=reports';
}

export async function exportComparisonPDF(studentId1, studentId2) {
    window.location.href = 'stats-preview.html?tab=reports';
}

export async function _resetAllData() {
    const result = await Swal.fire({
        title: 'تصفير الإحصائيات',
        text: 'سيتم مسح جميع بيانات الإحصائيات والمباريات. هل أنت متأكد؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم',
        cancelButtonText: 'إلغاء'
    });
    if (result.isConfirmed) {
        // يمكن هنا استدعاء دالة من StatsManager لتصفير البيانات
        window.location.reload();
    }
}