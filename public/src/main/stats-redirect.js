// دوال التوجيه إلى stats-preview.html
export function renderAdvancedStatsRedirect() {
    const container = document.getElementById('teacher-stats');
    if (!container) return;
    container.innerHTML = `
        <div class="glass-panel p-8 text-center">
            <div class="text-5xl mb-4">📊</div>
            <h3 class="text-2xl font-bold text-yellow-400 mb-3">نظام الإحصائيات المتقدم</h3>
            <p class="text-gray-400 mb-4">تم تحديث نظام الإحصائيات ليعمل بشكل أسرع وأكثر دقة.</p>
            <button id="openStatsBtn" class="action-btn bg-purple-600">🚀 فتح لوحة التحليلات</button>
        </div>
    `;
    const btn = document.getElementById('openStatsBtn');
    if (btn) btn.addEventListener('click', () => window.location.href = 'stats-preview.html');
}

export function updateStudentSearchListRedirect() {
    console.log('[Stats] Student search list is handled in stats-preview.html');
}

export function exportGradeReportRedirect() {
    window.location.href = 'stats-preview.html?tab=reports';
}

export function exportComparisonPDFRedirect() {
    window.location.href = 'stats-preview.html?tab=reports';
}