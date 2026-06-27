// src/admin/modern/simulate.js
// محاكاة حساب معلم – مع دعم صلاحيات المساعدين

import { getTeachersList } from '../../firebase/auth.js';
import { escapeHtml, showNotification, buildTeacherCardInnerHtml, hasPermission, applyUIPermissions } from './utils.js';
import { ADMIN_SECRET_KEY } from '../../config.js';

export async function renderSimulateTeacher() {
    if (!hasPermission('simulate', 'view')) {
        document.getElementById('simulatePane').innerHTML = `
            <div class="glass-card p-5 text-center">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <h3 class="text-xl font-bold text-red-400">غير مصرح</h3>
                <p class="text-gray-400">ليس لديك صلاحية لمحاكاة المعلمين.</p>
            </div>`;
        return;
    }
    const container = document.getElementById('simulatePane');
    if (!container) return;
    const rawTeachers = await getTeachersList();
    const enrichedTeachers = rawTeachers.map(teacher => processTeacherStatusData(teacher));
    window._originalTeachersForSimulate = enrichedTeachers;
    container.innerHTML = buildSimulatePanelUi(enrichedTeachers, enrichedTeachers.length);
    bindSimulatePanelEvents();
    if (window.applySimulateFilters) window.applySimulateFilters();
    applyUIPermissions();
}

export function processTeacherStatusData(teacher) {
    const today = new Date();
    const plan = teacher.plan || 'free';
    const expiryDate = teacher.expiryDate ? new Date(teacher.expiryDate) : null;
    const createdAt = teacher.createdAt ? new Date(teacher.createdAt) : null;
    let daysLeft = null;
    let status = 'active';
    let isNew = false;
    if (expiryDate && !isNaN(expiryDate.getTime())) {
        daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) status = 'expired';
        else if (daysLeft <= 7) status = 'near_expiry';
    }
    if (createdAt && !isNaN(createdAt.getTime())) {
        const daysSinceCreation = Math.ceil((today - createdAt) / (1000 * 60 * 60 * 24));
        if (daysSinceCreation <= 7) isNew = true;
    }
    return { ...teacher, plan, daysLeft, status, isNew };
}

export function filterTeachersArray(teachers, plan, status) {
    let result = teachers;
    if (plan !== 'all') result = result.filter(t => t.plan === plan);
    if (status !== 'all') {
        const statusFilters = {
            new: t => t.isNew,
            expired: t => t.status === 'expired',
            near_expiry: t => t.status === 'near_expiry',
            active: t => t.status === 'active' && !t.isNew
        };
        if (statusFilters[status]) result = result.filter(statusFilters[status]);
    }
    return result;
}

function buildSimulatePanelUi(allTeachers, totalCount) {
    const filterHtml = `
        <div class="flex flex-wrap gap-3 mb-5 items-end">
            <div class="flex-1 min-w-[180px]"><label class="text-sm text-gray-300 block mb-1">🔍 بحث (الاسم أو الكود)</label><input type="text" id="simulateSearchInput" class="filter-input w-full" placeholder="اكتب الاسم أو الكود..."></div>
            <div><label class="text-sm text-gray-300 block mb-1">الخطة</label><select id="simulateFilterPlan" class="filter-select"><option value="all">جميع الخطط</option><option value="free">مجاني</option><option value="silver">فضي</option><option value="gold">ذهبي</option><option value="coupon">كوبون</option></select></div>
            <div><label class="text-sm text-gray-300 block mb-1">الحالة</label><select id="simulateFilterStatus" class="filter-select"><option value="all">الكل</option><option value="active">نشط</option><option value="suspended">معلق</option><option value="expired">منتهي الاشتراك</option></select></div>
            <div><button id="resetSimulateFiltersBtn" class="btn-secondary text-sm px-3 py-2">إعادة تعيين</button></div>
        </div>
        <div class="text-sm text-gray-400 mb-3 text-left" id="simulateFilterStats">المعلمون: <span id="simulateFilteredCount">0</span> من ${totalCount}</div>
    `;
    const cardsContainer = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="simulateTeachersList"></div>`;
    return `
        <div class="glass-card p-5" dir="rtl">
            <h3 class="text-2xl font-bold text-yellow-400 mb-4 flex items-center gap-2"><i class="fas fa-user-secret"></i> <span>محاكاة حساب معلم</span></h3>
            <p class="text-gray-300 mb-4 text-sm leading-relaxed">اختر معلماً من القائمة لتفتح المنصة بالكامل من منظوره الشخصي (تصفح طلابه، ترتيبه، وبنك أسئلته الخاص).</p>
            ${filterHtml}
            ${cardsContainer}
            <div class="mt-5 text-center text-xs text-gray-500 bg-black/20 p-3 rounded-lg border border-white/5">⚠️ ملاحظة أمنية: المحاكاة تقوم بفتح نافذة منفصلة كلياً بنظام جلسة مؤقتة (Session)، ولن تؤثر على بيانات حسابك الإداري الحالي.</div>
        </div>
    `;
}

function bindSimulatePanelEvents() {
    const filterPlanSelect = document.getElementById('simulateFilterPlan');
    const filterStatusSelect = document.getElementById('simulateFilterStatus');
    const searchInput = document.getElementById('simulateSearchInput');
    const resetBtn = document.getElementById('resetSimulateFiltersBtn');

    const applyFilters = () => {
        if (!window._originalTeachersForSimulate) return;
        let filtered = [...window._originalTeachersForSimulate];
        const filterPlan = filterPlanSelect.value;
        const filterStatus = filterStatusSelect.value;
        const searchTerm = searchInput.value.toLowerCase();
        if (filterPlan !== 'all') {
            if (filterPlan === 'coupon') filtered = filtered.filter(t => t.createdByCoupon === true);
            else filtered = filtered.filter(t => t.plan === filterPlan);
        }
        if (filterStatus !== 'all') filtered = filtered.filter(t => t.status === filterStatus);
        if (searchTerm) filtered = filtered.filter(t => t.name.toLowerCase().includes(searchTerm) || (t.code || t.id).toLowerCase().includes(searchTerm));
        const countSpan = document.getElementById('simulateFilteredCount');
        if (countSpan) countSpan.innerText = filtered.length;
        const container = document.getElementById('simulateTeachersList');
        if (!container) return;
        if (filtered.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">لا يوجد معلمون مطابقون للفلاتر المحددة</div>';
            return;
        }
        const cardsHtml = filtered.map(t => {
            const isExpired = t.status === 'expired';
            const extraClass = isExpired ? 'border-red-500/50 bg-red-900/20' : '';
            return `
                <div class="simulate-teacher-card bg-white/5 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-white/10 border border-white/5 hover:border-yellow-500/30 transition-all duration-300 group ${extraClass}"
                     data-code="${t.code || t.id}"
                     data-name="${escapeHtml(t.name)}"
                     data-expired="${isExpired}"
                     data-plan="${t.plan}">
                    ${buildTeacherCardInnerHtml(t)}
                </div>
            `;
        }).join('');
        container.innerHTML = cardsHtml;
        document.querySelectorAll('.simulate-teacher-card').forEach(card => {
            card.addEventListener('click', async () => {
                const teacherCode = card.getAttribute('data-code');
                const teacherName = card.getAttribute('data-name');
                const isExpired = card.getAttribute('data-expired') === 'true';
                const teacherPlan = card.getAttribute('data-plan');
                const currentUserCode = sessionStorage.getItem('peak_teacher_code');
                const isDeveloper = currentUserCode === ADMIN_SECRET_KEY;
                if (isExpired && !isDeveloper) {
                    Swal.fire({
                        title: '🚫 محاكاة غير مسموحة',
                        text: `المعلم "${teacherName}" انتهت صلاحية اشتراكه. لا يمكنك محاكاة حساب منتهي الصلاحية.`,
                        icon: 'warning',
                        confirmButtonText: 'حسناً',
                        background: '#0f172a',
                        color: '#fff'
                    });
                    return;
                }
                if (isExpired && isDeveloper) {
                    const confirm = await Swal.fire({
                        title: '⚠️ محاكاة حساب منتهي الصلاحية',
                        html: `<p>المعلم <strong>${escapeHtml(teacherName)}</strong> منتهي صلاحية اشتراكه.</p><p class="text-yellow-400">هذه المحاكاة لأغراض الاختبار فقط. لن يتمكن هذا المعلم من استخدام الميزات المدفوعة.</p><p>هل تريد المتابعة؟</p>`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'نعم، محاكاة',
                        cancelButtonText: 'إلغاء',
                        background: '#0f172a',
                        color: '#fff'
                    });
                    if (!confirm.isConfirmed) return;
                }
                if (!isDeveloper && !isExpired) {
                    const { checkTeacherAccess } = await import('../../services/subscriptionGuard.js');
                    const access = await checkTeacherAccess(teacherCode);
                    if (!access.allowed) {
                        Swal.fire({
                            title: '🚫 غير مسموح',
                            text: access.message,
                            icon: 'error',
                            confirmButtonText: 'حسناً',
                            background: '#0f172a',
                            color: '#fff'
                        });
                        return;
                    }
                }
                sessionStorage.setItem('simulate_teacher_code', teacherCode);
                sessionStorage.setItem('simulate_mode', 'true');
                window.open('platform.html?simulate=true', '_blank');
                if (typeof showNotification === 'function') showNotification(`🔓 جاري تهيئة المنصة ومحاكاة حساب المعلم: ${teacherName}`, 'info');
            });
        });
    };
    filterPlanSelect?.addEventListener('change', applyFilters);
    filterStatusSelect?.addEventListener('change', applyFilters);
    searchInput?.addEventListener('input', applyFilters);
    resetBtn?.addEventListener('click', () => {
        if (filterPlanSelect) filterPlanSelect.value = 'all';
        if (filterStatusSelect) filterStatusSelect.value = 'all';
        if (searchInput) searchInput.value = '';
        applyFilters();
    });
    window.applySimulateFilters = applyFilters;
}