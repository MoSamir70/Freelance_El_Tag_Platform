// src/admin/modern/teachers.js
// إدارة المعلمين – مع دعم صلاحيات المساعدين (hasPermission)
// تم إضافة: data-perm على جميع الأزرار، وفحوصات صلاحيات داخل الدوال.

import { db as firestoreDb, collection, getDocs, doc, updateDoc, writeBatch, deleteDoc, serverTimestamp, setDoc, getDoc, query, where, addDoc } from '../../firebase/init.js';
import { getTeachersList, createTeacherAccount } from '../../firebase/auth.js';
import { getTeacherDocumentByCode } from '../../services/dataService.js';
import { loadQuestionsFromIndexedDB, saveQuestionsToIndexedDB, deleteQuestionsFromIndexedDB } from '../../db/indexeddb.js';
import { getAllStudents, showNotification, escapeHtml, showLoading, addAuditLog, compressImage, EGYPT_SUBJECTS, EGYPT_GRADES, buildTeacherCardInnerHtml, hasPermission, applyUIPermissions } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { renderStudents } from './students.js';
import { renderMessages } from './messages.js';

// ========== متغيرات عامة ==========
let currentTeacherPage = 1;
let teacherPerPage = 10;

// مراجع Firestore
const teachersCollection = collection(firestoreDb, 'teachers');
const studentsCollection = collection(firestoreDb, 'students');
const messagesCollection = collection(firestoreDb, 'messages');

// ========== 1. العرض الرئيسي ==========
export async function renderTeachers() {
    // ✅ التحقق من صلاحية العرض
    if (!hasPermission('teachers', 'view')) {
        document.getElementById('teachersPane').innerHTML = `
            <div class="glass-card p-5 text-center">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <h3 class="text-xl font-bold text-red-400">غير مصرح</h3>
                <p class="text-gray-400">ليس لديك صلاحية لعرض قائمة المعلمين.</p>
            </div>`;
        return;
    }

    showLoading('teachersPane');
    const teachers = await getTeachersList();
    
    // حساب عدد الأسئلة لكل معلم (من IndexedDB)
    const teacherQuestionsCount = {};
    const allGrades = EGYPT_GRADES;
    for (const grade of allGrades) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        for (const q of questions) {
            const teacherId = q.teacherId;
            if (teacherId) teacherQuestionsCount[teacherId] = (teacherQuestionsCount[teacherId] || 0) + 1;
        }
    }
    
    // جلب عدد الطلاب لكل معلم
    const allStudents = await getAllStudents();
    const teacherStudentsCount = {};
    for (const student of allStudents) {
        const teacherId = student.teacherId;
        if (teacherId) teacherStudentsCount[teacherId] = (teacherStudentsCount[teacherId] || 0) + 1;
    }
    
    const html = `
        <div class="glass-card p-5">
            <div class="flex flex-wrap justify-between items-center mb-5">
                <h3 class="text-2xl font-bold text-yellow-400"><i class="fas fa-chalkboard-user ml-2"></i> قائمة المعلمين</h3>
                <div class="flex gap-2">
                    <button id="addTeacherBtn" class="btn-primary" data-perm="teachers.create"><i class="fas fa-plus"></i> إضافة معلم</button>
                    <button id="deleteAllTeachersBtn" class="btn-danger" data-perm="teachers.delete"><i class="fas fa-trash-alt"></i> حذف الكل</button>
                    <button id="exportTeachersBtn" class="btn-secondary" data-perm="teachers.view"><i class="fas fa-file-excel"></i> تصدير</button>
                </div>
            </div>
            <div class="flex flex-wrap gap-3 mb-5 items-end">
                <div><label class="text-sm text-gray-300 block mb-1">الخطة</label><select id="filterTeacherPlan" class="filter-select"><option value="all">جميع الخطط</option><option value="free">مجاني</option><option value="silver">فضي</option><option value="gold">ذهبي</option><option value="coupon">كوبون</option></select></div>
                <div><label class="text-sm text-gray-300 block mb-1">الحالة</label><select id="filterTeacherStatus" class="filter-select"><option value="all">الكل</option><option value="active">نشط</option><option value="suspended">معلق</option><option value="expired">منتهي الاشتراك</option></select></div>
                <div><label class="text-sm text-gray-300 block mb-1">الترتيب حسب</label><select id="sortTeachersBy" class="filter-select"><option value="newest">الأحدث</option><option value="oldest">الأقدم</option><option value="nearExpiry">قريب من الانتهاء</option><option value="mostStudents">الأكثر طلاباً</option><option value="mostQuestions">الأكثر أسئلة</option><option value="mostActive">الأكثر نشاطاً</option></select></div>
                <div class="flex-1"><input type="text" id="searchTeacher" class="filter-input w-full" placeholder="🔍 بحث بالاسم أو الكود"></div>
                <div><button id="resetTeacherFiltersBtn" class="btn-secondary text-sm px-3 py-2">إعادة تعيين</button></div>
            </div>
            <div class="overflow-x-auto"><table class="admin-table"><thead><tr><th>الصورة</th><th>الاسم</th><th>الكود</th><th>النوع</th><th>المواد</th><th>الصفوف</th><th>الخطة</th><th>الحالة</th><th>تاريخ الانتهاء</th><th>عدد الأسئلة</th><th>عدد الطلاب</th><th>آخر نشاط</th><th>بطاقة المعلم</th></tr></thead><tbody id="teachersTableBody"></tbody></table></div>
            <div id="teacherPagination" class="flex justify-center gap-2 mt-5"></div>
        </div>
    `;
    document.getElementById('teachersPane').innerHTML = html;
    applyUIPermissions(); // إخفاء الأزرار غير المسموحة

    const filterPlanSelect = document.getElementById('filterTeacherPlan');
    const filterStatusSelect = document.getElementById('filterTeacherStatus');
    const sortSelect = document.getElementById('sortTeachersBy');
    const searchInput = document.getElementById('searchTeacher');
    const resetBtn = document.getElementById('resetTeacherFiltersBtn');

    const applyFiltersAndRender = async () => {
        const filterPlan = filterPlanSelect.value;
        const filterStatus = filterStatusSelect.value;
        const sortBy = sortSelect.value;
        const search = searchInput.value.toLowerCase();
        let filtered = [...teachers];
        if (filterPlan !== 'all') {
            if (filterPlan === 'coupon') filtered = filtered.filter(t => t.createdByCoupon === true);
            else filtered = filtered.filter(t => t.plan === filterPlan);
        }
        if (filterStatus !== 'all') {
            if (filterStatus === 'expired') filtered = filtered.filter(t => t.expiryDate && new Date(t.expiryDate).getTime() < Date.now());
            else filtered = filtered.filter(t => t.status === filterStatus);
        }
        if (search) filtered = filtered.filter(t => t.name.toLowerCase().includes(search) || (t.code || t.id).toLowerCase().includes(search));
        const now = Date.now();
        const enriched = filtered.map(t => {
            const teacherCode = t.code || t.id;
            const studentsCount = teacherStudentsCount[teacherCode] || 0;
            const questionsCount = teacherQuestionsCount[teacherCode] || 0;
            const expiryDate = t.expiryDate ? new Date(t.expiryDate).getTime() : null;
            const isExpired = expiryDate ? expiryDate < now : false;
            const status = t.status === 'suspended' ? 'suspended' : (isExpired ? 'expired' : (t.status || 'active'));
            let lastActive = t.lastActive || t.createdAt || 0;
            if (lastActive?.toMillis) lastActive = lastActive.toMillis();
            return { ...t, studentsCount, questionsCount, status, isExpired, lastActive: typeof lastActive === 'number' ? lastActive : 0 };
        });
        if (sortBy === 'newest') enriched.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        else if (sortBy === 'oldest') enriched.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        else if (sortBy === 'nearExpiry') enriched.sort((a, b) => (new Date(a.expiryDate).getTime() || Infinity) - (new Date(b.expiryDate).getTime() || Infinity));
        else if (sortBy === 'mostStudents') enriched.sort((a, b) => (b.studentsCount || 0) - (a.studentsCount || 0));
        else if (sortBy === 'mostQuestions') enriched.sort((a, b) => (b.questionsCount || 0) - (a.questionsCount || 0));
        else if (sortBy === 'mostActive') enriched.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
        renderTeachersTable(enriched);
    };
    
    filterPlanSelect.addEventListener('change', () => setTimeout(applyFiltersAndRender, 10));
    filterStatusSelect.addEventListener('change', () => setTimeout(applyFiltersAndRender, 10));
    sortSelect.addEventListener('change', () => setTimeout(applyFiltersAndRender, 10));
    searchInput.addEventListener('input', () => setTimeout(applyFiltersAndRender, 10));
    resetBtn.addEventListener('click', () => {
        filterPlanSelect.value = 'all';
        filterStatusSelect.value = 'all';
        sortSelect.value = 'newest';
        searchInput.value = '';
        setTimeout(applyFiltersAndRender, 10);
    });
    
    const addBtn = document.getElementById('addTeacherBtn');
    if (addBtn) addBtn.addEventListener('click', () => showAddTeacherModal());
    const deleteAllBtn = document.getElementById('deleteAllTeachersBtn');
    if (deleteAllBtn) deleteAllBtn.addEventListener('click', () => confirmDeleteAllTeachers());
    const exportBtn = document.getElementById('exportTeachersBtn');
    if (exportBtn) exportBtn.addEventListener('click', () => exportTeachersToExcel());
    
    await applyFiltersAndRender();
}

// ========== 2. عرض الجدول مع صلاحيات ==========
export function renderTeachersTable(allTeachers) {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;
    tbody.innerHTML = allTeachers.map(t => {
        const subjects = Array.isArray(t.subjects) ? t.subjects : [];
        const grades = Array.isArray(t.grades) ? t.grades : [];
        const plan = t.plan || 'free';
        const createdByCoupon = t.createdByCoupon === true;
        
        // ✅ تحسين عرض تاريخ الانتهاء مع الأيام المتبقية
        let expiryDisplay = 'غير محدد';
        let daysLeftHtml = '';
        if (t.expiryDate) {
            const expiryDateObj = new Date(t.expiryDate);
            const now = new Date();
            if (expiryDateObj > now) {
                const diffDays = Math.ceil((expiryDateObj - now) / (1000 * 60 * 60 * 24));
                daysLeftHtml = `<span class="text-yellow-400 text-xs"> (متبقي ${diffDays} يوم)</span>`;
                expiryDisplay = expiryDateObj.toLocaleDateString('ar-EG') + daysLeftHtml;
            } else {
                expiryDisplay = expiryDateObj.toLocaleDateString('ar-EG') + ' <span class="text-red-400">(منتهي)</span>';
            }
        }
        
        const questionsCount = t.questionsCount || 0;
        const studentsCount = t.studentsCount || 0;
        const status = t.status || 'active';
        let lastActiveText = 'غير معروف';
        const lastActive = t.lastActive || t.createdAt || 0;
        if (lastActive && typeof lastActive === 'object' && lastActive.toDate) lastActiveText = lastActive.toDate().toLocaleDateString('ar-EG');
        else if (lastActive && typeof lastActive === 'number' && lastActive > 0) lastActiveText = new Date(lastActive).toLocaleDateString('ar-EG');
        else if (typeof lastActive === 'string') lastActiveText = new Date(lastActive).toLocaleDateString('ar-EG');
        
        let planClass = '', planText = '';
        if (createdByCoupon) { planClass = 'badge-coupon'; planText = 'كوبون'; }
        else if (plan === 'free') { planClass = 'badge-free'; planText = 'مجاني'; }
        else if (plan === 'silver') { planClass = 'badge-silver'; planText = 'فضي'; }
        else { planClass = 'badge-gold'; planText = 'ذهبي'; }
        
        const accountType = createdByCoupon ? '<span class="text-purple-400 text-xs bg-purple-500/20 px-2 py-0.5 rounded-full">🎟️ كوبون</span>' : '<span class="text-gray-400 text-xs">عادي</span>';
        const hasValidImg = t.img && t.img !== 'undefined' && t.img.startsWith('data:image');
        const teacherCode = t.code || t.id;
        
        let statusHtml = '';
        if (status === 'active') statusHtml = '<span class="text-green-400"><i class="fas fa-check-circle"></i> نشط</span>';
        else if (status === 'suspended') statusHtml = '<span class="text-red-400"><i class="fas fa-ban"></i> معلق</span>';
        else if (status === 'expired') statusHtml = '<span class="text-orange-400"><i class="fas fa-hourglass-end"></i> منتهي</span>';
        else statusHtml = '<span class="text-gray-400">غير معروف</span>';
        
        return `
            <tr data-teacher-code="${teacherCode}">
                <td>${hasValidImg ? `<img src="${t.img}" class="w-10 h-10 rounded-full object-cover border border-yellow-500 premium-avatar">` : `<div class="w-10 h-10 rounded-full border-2 border-red-500 bg-red-900/30 flex items-center justify-center text-[10px] text-red-300 font-bold">!</div>`}</td>
                <td><span class="font-bold teacher-name-link" data-code="${teacherCode}" style="cursor:pointer; color:#facc15;">${escapeHtml(t.name)}</span></td>
                <td>${teacherCode}</td>
                <td>${accountType}</td>
                <td class="max-w-xs">${subjects.slice(0, 3).join(', ')}${subjects.length > 3 ? ' +' : ''}</td>
                <td class="max-w-xs">${grades.slice(0, 2).join(', ')}${grades.length > 2 ? '...' : ''}</td>
                <td><span class="${planClass}">${planText}</span></td>
                <td>${statusHtml}</td>
                <td>${expiryDisplay}</td>
                <td class="text-yellow-400 font-bold">📚 ${questionsCount}</td>
                <td class="text-cyan-400 font-bold">👥 ${studentsCount}</td>
                <td class="text-gray-400 text-xs">${lastActiveText}</td>
                <td><button class="viewTeacherCardBtn btn-secondary text-sm py-1 px-3" data-code="${teacherCode}" data-perm="teachers.view"><i class="fas fa-id-card"></i> بطاقة المعلم</button></td>
            </tr>
        `;
    }).join('');
    attachTeacherEvents();
    applyUIPermissions();
}
// ========== 3. ربط الأحداث ==========
export function attachTeacherEvents() {
    document.body.removeEventListener('click', window._teacherEventHandler);
    window._teacherEventHandler = function(e) {
        const target = e.target.closest('.viewTeacherCardBtn');
        if (target) {
            e.preventDefault();
            const teacherCode = target.getAttribute('data-code');
            if (teacherCode) showTeacherCard(teacherCode);
            return;
        }
        const nameLink = e.target.closest('.teacher-name-link');
        if (nameLink) {
            e.preventDefault();
            const teacherCode = nameLink.getAttribute('data-code');
            if (teacherCode) showTeacherCard(teacherCode);
        }
    };
    document.body.addEventListener('click', window._teacherEventHandler);
}

// ========== 4. حذف جميع المعلمين (مع التحقق من الصلاحية) ==========
export async function confirmDeleteAllTeachers() {
    if (!hasPermission('teachers', 'delete')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لحذف المعلمين', 'error');
        return;
    }
    const result = await Swal.fire({
        title: '⚠️ تأكيد حذف جميع المعلمين',
        text: 'سيتم حذف جميع المعلمين وطلابهم وأسئلتهم بشكل نهائي. لا يمكن التراجع!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف الجميع',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff'
    });
    if (!result.isConfirmed) return;
    Swal.fire({ title: 'جارٍ الحذف...', text: 'الرجاء الانتظار، قد يستغرق هذا دقيقة.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const teachersSnapshot = await getDocs(teachersCollection);
        const teachers = teachersSnapshot.docs.map(doc => ({ id: doc.id, code: doc.data().code, ...doc.data() }));
        const batch = writeBatch(firestoreDb);
        const allStudents = await getAllStudents();
        for (const teacher of teachers) {
            const teacherCode = teacher.code;
            const studentsToDelete = allStudents.filter(s => s.teacherId === teacherCode);
            for (const student of studentsToDelete) {
                batch.delete(doc(firestoreDb, 'students', student.id));
                batch.delete(doc(firestoreDb, 'studentStats', student.id));
            }
            batch.delete(doc(firestoreDb, 'teachers', teacher.id));
            batch.delete(doc(firestoreDb, 'teacherCodes', teacherCode));
        }
        for (const grade of EGYPT_GRADES) await deleteQuestionsFromIndexedDB(grade);
        if (window.questionsCache) window.questionsCache.clear();
        await batch.commit();
        await addAuditLog('حذف جميع المعلمين', 'تم حذف كل المعلمين وبياناتهم');
        Swal.fire('تم الحذف', 'تم حذف جميع المعلمين والطلاب والأسئلة بنجاح', 'success');
        showNotification('🗑️ تم حذف جميع المعلمين والطلاب والأسئلة', 'success');
        await renderTeachers();
        if (typeof renderStudents === 'function') await renderStudents();
        await renderDashboard();
    } catch (error) {
        console.error('Error deleting all teachers:', error);
        Swal.fire('خطأ', 'فشل حذف المعلمين: ' + error.message, 'error');
    }
}

// ========== 5. بطاقة المعلم (مع صلاحيات داخل الأزرار) ==========
export async function showTeacherCard(teacherIdOrCode) {
    if (!hasPermission('teachers', 'view')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لعرض بطاقة المعلم', 'error');
        return;
    }
    let teacher = null;
    let teacherCode = teacherIdOrCode;
    const teacherRefResult = await getTeacherDocumentByCode(teacherCode);
    if (teacherRefResult) teacher = teacherRefResult.data;
    if (!teacher) {
        Swal.fire('خطأ', 'المعلم غير موجود', 'error');
        return;
    }
    const allStudents = await getAllStudents();
    const studentsUnder = allStudents.filter(s => !s.isTeacher && s.teacherId === teacherCode);
    let totalQuestions = 0;
    const gradesSet = new Set(studentsUnder.map(s => s.grade));
    for (const grade of gradesSet) {
        let qs = window.questionsCache?.get(grade);
        if (!qs) {
            qs = await loadQuestionsFromIndexedDB(grade);
            if (window.questionsCache) window.questionsCache.set(grade, qs);
        }
        totalQuestions += qs.reduce((count, q) => q.teacherId === teacherCode ? count + 1 : count, 0);
    }
    const planBadges = {
        free: '<span class="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">مجاني</span>',
        silver: '<span class="px-3 py-1 rounded-full text-xs font-bold bg-slate-400/10 text-slate-300 border border-slate-400/20">فضي</span>',
        gold: '<span class="px-3 py-1 rounded-full text-xs font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">ذهبي</span>'
    };
    const statusBadges = {
        active: '<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fas fa-circle text-[8px] ml-1 animate-pulse"></i> نشط</span>',
        suspended: '<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">معلق</span>'
    };
    const hasValidImg = teacher.img && teacher.img !== 'undefined' && teacher.img.startsWith('data:image');
    // بناء الأزرار مع data-perm حسب الصلاحيات
    let actionsHtml = '';
    if (hasPermission('teachers', 'edit')) actionsHtml += `<button class="teacher-action-btn bg-yellow-500/20 p-2 rounded" data-action="edit" data-code="${teacherCode}">✏️ تعديل</button>`;
    if (hasPermission('teachers', 'delete')) actionsHtml += `<button class="teacher-action-btn bg-red-500/20 p-2 rounded" data-action="delete" data-code="${teacherCode}">🗑️ حذف</button>`;
    if (hasPermission('teachers', 'edit')) actionsHtml += `<button class="teacher-action-btn bg-orange-500/20 p-2 rounded" data-action="suspend" data-code="${teacherCode}" data-status="${teacher.status}">${teacher.status === 'active' ? 'تعليق' : 'تنشيط'}</button>`;
    if (hasPermission('teachers', 'create') || hasPermission('teachers', 'edit')) actionsHtml += `<button class="teacher-action-btn bg-amber-500/20 p-2 rounded" data-action="upgrade" data-code="${teacherCode}">ترقية الخطة</button>`;
    if (hasPermission('messages', 'reply')) actionsHtml += `<button class="teacher-action-btn bg-blue-500/20 p-2 rounded" data-action="message" data-code="${teacherCode}">رسالة</button>`;
    if (hasPermission('questions', 'edit')) actionsHtml += `<button class="teacher-action-btn bg-purple-500/20 p-2 rounded" data-action="questions" data-code="${teacherCode}">نقل الأسئلة</button>`;

    Swal.fire({
        html: `<div class="w-full text-right text-gray-200">
            <div class="flex flex-col sm:flex-row items-center gap-4 pb-5 border-b border-white/10">
                ${hasValidImg ? `<img src="${teacher.img}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;">` : `<div style="width:64px;height:64px;border-radius:50%;background:#7f1a1a;border:2px solid #ef4444;display:flex;align-items:center;justify-content:center;color:#fca5a5;font-weight:bold;font-size:24px;">?</div>`}
                <div class="flex-1">
                    <h2 class="text-xl font-black text-white">${escapeHtml(teacher.name)}</h2>
                    <p class="text-xs text-gray-400">الكود: ${teacherCode}</p>
                </div>
                <div class="flex gap-2">${planBadges[teacher.plan]} ${statusBadges[teacher.status]}</div>
            </div>
            <div class="grid grid-cols-2 gap-4 my-4">
                <div><i class="fas fa-envelope"></i> ${teacher.email || '-'}</div>
                <div><i class="fas fa-phone"></i> ${teacher.phone || '-'}</div>
                <div><i class="fas fa-calendar-alt"></i> تاريخ الانتهاء: ${teacher.expiryDate ? new Date(teacher.expiryDate).toLocaleDateString('ar-EG') : 'غير محدد'}</div>
                <div><i class="fas fa-users"></i> عدد الطلاب: ${studentsUnder.length}</div>
                <div><i class="fas fa-database"></i> الأسئلة: ${totalQuestions}</div>
            </div>
            <div class="grid grid-cols-3 gap-2">
                ${actionsHtml}
            </div>
        </div>`,
        showConfirmButton: false, showCloseButton: true, width: '780px', background: '#1e293b',
        customClass: { popup: 'teacher-card-modal' },
        didOpen: () => {
            document.querySelectorAll('.teacher-action-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const code = btn.dataset.code;
                    const currentStatus = btn.dataset.status;
                    Swal.close();
                    if (action === 'suspend') await toggleTeacherStatus(code, currentStatus);
                    else if (action === 'upgrade') await showUpgradePlanModal(code);
                    else if (action === 'delete') await deleteTeacher(code);
                    else if (action === 'message') await showSendMessageModal(code, teacher.name);
                    else if (action === 'questions') await transferQuestions(code);
                    else if (action === 'edit') await showEditTeacherModal(teacher);
                    await renderTeachers();
                });
            });
        }
    });
}

// ========== 6. تغيير حالة المعلم ==========
export async function toggleTeacherStatus(teacherCode, currentStatus) {
    if (!hasPermission('teachers', 'edit')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لتغيير حالة المعلم', 'error');
        return;
    }
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    if (!isAdmin) {
        Swal.fire('خطأ', 'أنت لست مطوراً، لا يمكنك تغيير حالة المعلم', 'error');
        return;
    }
    try {
        const teacherRefResult = await getTeacherDocumentByCode(teacherCode);
        if (!teacherRefResult) {
            Swal.fire('خطأ', `المعلم بالكود ${teacherCode} غير موجود`, 'error');
            return;
        }
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        await updateDoc(teacherRefResult.ref, { status: newStatus, updatedAt: serverTimestamp() });
        await addAuditLog('تغيير حالة معلم', `${teacherCode} -> ${newStatus}`);
        Swal.fire('تم', `تم ${newStatus === 'active' ? 'تنشيط' : 'تعليق'} المعلم`, 'success');
        showNotification(`✅ تم ${newStatus === 'active' ? 'تنشيط' : 'تعليق'} المعلم`, 'success');
        await renderTeachers();
    } catch (error) {
        console.error('toggleTeacherStatus error:', error);
        Swal.fire('خطأ', 'فشل تغيير الحالة: ' + error.message, 'error');
    }
}

// ========== 7. ترقية خطة المعلم ==========
export async function showUpgradePlanModal(teacherCode) {
    if (!hasPermission('teachers', 'edit')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لترقية خطة المعلم', 'error');
        return;
    }
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    if (!isAdmin) {
        Swal.fire('خطأ', 'أنت لست مطوراً، لا يمكنك ترقية المعلم', 'error');
        return;
    }
    const { value: newPlan } = await Swal.fire({
        title: 'ترقية خطة المعلم',
        input: 'select',
        inputOptions: { 'silver': 'فضي', 'gold': 'ذهبي' },
        inputPlaceholder: 'اختر الخطة الجديدة',
        showCancelButton: true,
        background: '#0f172a', color: '#fff'
    });
    if (!newPlan) return;
    try {
        const teacherRefResult = await getTeacherDocumentByCode(teacherCode);
        if (!teacherRefResult) {
            Swal.fire('خطأ', `المعلم بالكود ${teacherCode} غير موجود في قاعدة البيانات`, 'error');
            return;
        }
        const teacherData = teacherRefResult.data;
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        await updateDoc(teacherRefResult.ref, { plan: newPlan, expiryDate: newExpiry.toISOString(), updatedAt: serverTimestamp() });
        const codeDocRef = doc(firestoreDb, 'teacherCodes', teacherCode);
        await updateDoc(codeDocRef, { plan: newPlan });
        await addAuditLog('ترقية معلم', `${teacherData.name} -> ${newPlan}`);
        Swal.fire('تمت الترقية', `تمت ترقية المعلم ${teacherData.name} إلى خطة ${newPlan === 'gold' ? 'ذهبية' : 'فضية'}`, 'success');
        showNotification(`🎉 تمت ترقية المعلم ${teacherData.name}`, 'success');
        await renderTeachers();
    } catch (error) {
        console.error('upgrade error:', error);
        Swal.fire('خطأ', 'فشل الترقية: ' + error.message, 'error');
    }
}

// ========== 8. حذف معلم ==========
export async function deleteTeacher(teacherCode) {
    if (!hasPermission('teachers', 'delete')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لحذف المعلم', 'error');
        return;
    }
    const confirm = await Swal.fire({
        title: 'تأكيد الحذف',
        text: 'سيتم حذف المعلم وجميع بياناته (الطلاب والأسئلة) نهائياً. هل أنت متأكد؟',
        icon: 'warning', showCancelButton: true, background: '#0f172a', color: '#fff'
    });
    if (!confirm.isConfirmed) return;
    Swal.fire({ title: 'جارٍ الحذف...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const teacherRefResult = await getTeacherDocumentByCode(teacherCode);
        if (!teacherRefResult) {
            Swal.fire('خطأ', `المعلم بالكود ${teacherCode} غير موجود`, 'error');
            return;
        }
        const teacherId = teacherRefResult.ref.id;
        const teacherName = teacherRefResult.data.name;
        const students = await getAllStudents();
        const studentsToDelete = students.filter(s => s.teacherId === teacherCode);
        const batch = writeBatch(firestoreDb);
        for (const student of studentsToDelete) {
            batch.delete(doc(firestoreDb, 'students', student.id));
            batch.delete(doc(firestoreDb, 'studentStats', student.id));
        }
        batch.delete(doc(firestoreDb, 'teachers', teacherId));
        batch.delete(doc(firestoreDb, 'teacherCodes', teacherCode));
        await batch.commit();
        const gradesSet = new Set(studentsToDelete.map(s => s.grade));
        for (const grade of gradesSet) {
            let questions = await loadQuestionsFromIndexedDB(grade);
            const filtered = questions.filter(q => q.teacherId !== teacherCode);
            await saveQuestionsToIndexedDB(grade, filtered);
        }
        await addAuditLog('حذف معلم', `تم حذف المعلم ${teacherName}`);
        Swal.fire('تم الحذف', '', 'success');
        showNotification(`🗑️ تم حذف المعلم ${teacherName} وكل بياناته`, 'success');
        await renderTeachers();
        await renderDashboard();
    } catch (error) {
        console.error('deleteTeacher error:', error);
        Swal.fire('خطأ', 'فشل حذف المعلم: ' + error.message, 'error');
    }
}

// ========== 9. إرسال رسالة ==========
export async function showSendMessageModal(teacherCode, teacherName) {
    if (!hasPermission('messages', 'reply')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لإرسال رسائل للمعلمين', 'error');
        return;
    }
    const { value: message } = await Swal.fire({
        title: `إرسال رسالة إلى ${escapeHtml(teacherName)}`,
        input: 'textarea',
        inputPlaceholder: 'اكتب رسالتك هنا...',
        showCancelButton: true,
        confirmButtonText: 'إرسال',
        background: '#0f172a', color: '#fff'
    });
    if (!message) return;
    try {
        await addDoc(messagesCollection, {
            from: 'admin',
            fromName: 'المطور',
            to: teacherCode,
            subject: 'رسالة خاصة من المطور',
            content: message,
            timestamp: serverTimestamp(),
            read: false
        });
        await addAuditLog('إرسال رسالة خاصة', `إلى ${teacherName} (${teacherCode})`);
        Swal.fire('تم الإرسال', '', 'success');
        showNotification(`📨 تم إرسال رسالة إلى ${teacherName}`, 'info');
        if (typeof renderMessages === 'function') await renderMessages();
    } catch (error) {
        console.error('sendMessage error:', error);
        Swal.fire('خطأ', 'فشل إرسال الرسالة: ' + error.message, 'error');
    }
}

// ========== 10. نقل الأسئلة ==========
export async function transferQuestions(teacherCode) {
    if (!hasPermission('questions', 'edit')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لنقل الأسئلة', 'error');
        return;
    }
    const sourceTeacherRef = await getTeacherDocumentByCode(teacherCode);
    if (!sourceTeacherRef) {
        Swal.fire('خطأ', `المعلم بالكود ${teacherCode} غير موجود`, 'error');
        return;
    }
    const sourceTeacher = sourceTeacherRef.data;
    const sourceTeacherName = sourceTeacher.name;
    const allTeachers = await getTeachersList();
    const targetOptions = allTeachers.filter(t => t.code !== teacherCode).map(t => `<option value="${t.code}">${escapeHtml(t.name)} (${t.code})</option>`).join('');
    if (!targetOptions) {
        Swal.fire('تنبيه', 'لا يوجد معلم آخر لنقل الأسئلة إليه', 'info');
        return;
    }
    const { value: targetCode } = await Swal.fire({
        title: `نقل أسئلة ${escapeHtml(sourceTeacherName)}`,
        html: `<select id="targetTeacher" class="swal2-select">${targetOptions}</select><p class="text-sm text-gray-400 mt-2">سيتم نقل جميع أسئلة هذا المعلم إلى المعلم المستلم.</p>`,
        preConfirm: () => document.getElementById('targetTeacher').value,
        background: '#0f172a', color: '#fff'
    });
    if (!targetCode) return;
    Swal.fire({ title: 'جارٍ النقل...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const students = await getAllStudents();
        const studentsUnderSource = students.filter(s => s.teacherId === teacherCode);
        const gradesSet = new Set(studentsUnderSource.map(s => s.grade));
        for (const grade of gradesSet) {
            let questions = await loadQuestionsFromIndexedDB(grade);
            let updated = false;
            for (let q of questions) {
                if (q.teacherId === teacherCode) {
                    q.teacherId = targetCode;
                    updated = true;
                }
            }
            if (updated) await saveQuestionsToIndexedDB(grade, questions);
        }
        await addAuditLog('نقل أسئلة', `من ${sourceTeacherName} (${teacherCode}) إلى معلم آخر (${targetCode})`);
        Swal.fire('تم النقل', '', 'success');
        showNotification(`📚 تم نقل أسئلة المعلم ${sourceTeacherName}`, 'success');
        await renderTeachers();
    } catch (error) {
        console.error('transferQuestions error:', error);
        Swal.fire('خطأ', 'فشل نقل الأسئلة: ' + error.message, 'error');
    }
}
// ========== إضافة معلم (مع اختيار الأشهر الثابتة أو إدخال الأيام يدوياً) ==========

export async function showAddTeacherModal() {
    // 1. التحقق من الصلاحيات
    if (!hasPermission('teachers', 'create')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لإضافة معلم جديد', 'error');
        return;
    }

    // 2. إعداد قوائم المواد والصفوف بحجم مصغر وتنسيق زجاجي متناسق
    const labelStyle = `display: inline-flex; align-items: center; margin: 3px; gap: 6px; padding: 4px 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; cursor: pointer; user-select: none; font-size: 0.85rem; color: #e2e8f0; transition: all 0.2s;`;
    
    const subjectsList = EGYPT_SUBJECTS.map(s => `
        <label style="${labelStyle}" onmouseover="this.style.background='rgba(250, 204, 21, 0.15)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <input type="checkbox" value="${s}" class="subject-check" style="accent-color: #facc15; scale: 1.05;"> ${s}
        </label>
    `).join('');

    const gradesList = EGYPT_GRADES.map(g => `
        <label style="${labelStyle}" onmouseover="this.style.background='rgba(250, 204, 21, 0.15)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <input type="checkbox" value="${g}" class="grade-check" style="accent-color: #facc15; scale: 1.05;"> ${g}
        </label>
    `).join('');

    const DEFAULT_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 24 24' fill='none' stroke='%23facc15' stroke-width='1.5'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";

    // 3. إطلاق نافذة SweetAlert2 بتأثير زجاجي فاخر وألوان متناسقة وعريضة
    const { value: formData } = await Swal.fire({
        title: '<span style="font-size: 1.6rem; font-weight: 800; letter-spacing: -0.5px; color: #facc15;">👨‍🏫 إضافة معلم جديد للمنصة</span>',
        background: 'rgba(15, 23, 42, 0.85)', // خلفية داكنة شبه شفافة
        color: '#f8fafc',
        confirmButtonColor: '#eab308', 
        cancelButtonColor: 'rgba(255, 255, 255, 0.1)',
        confirmButtonText: '<span style="font-size: 1.05rem; font-weight: bold; padding: 0 10px;">تأكيد الإضافة</span>',
        cancelButtonText: '<span style="font-size: 1.05rem; color: #cbd5e1;">إلغاء</span>',
        showCancelButton: true,
        width: '850px', // عرض مريح وممتاز للتوزيع الأفقي
        customClass: {
            popup: 'glass-popup-effect' // كلاس مخصص لتطبيق الفلتر الزجاجي عبر الـ CSS
        },
        html: `
            <style>
                .glass-popup-effect {
                    backdrop-filter: blur(16px) saturate(120%);
                    -webkit-backdrop-filter: blur(16px) saturate(120%);
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
                    border-radius: 16px !important;
                }
                .glass-input {
                    margin: 0 !important; width: 100% !important; height: 46px !important; 
                    background: rgba(30, 41, 59, 0.7) !important; color: #fff !important; 
                    border: 1px solid rgba(255, 255, 255, 0.1) !important; border-radius: 8px !important;
                    font-size: 1rem !important; padding: 0 12px !important; transition: all 0.2s ease;
                }
                .glass-input:focus {
                    border-color: #eab308 !important; box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.2) !important;
                }
                .glass-label {
                    display: block; margin-bottom: 6px; font-size: 0.95rem; font-weight: 600; color: #94a3b8;
                }
            </style>

            <div style="text-align: right; font-family: system-ui, -apple-system, sans-serif; direction: rtl; padding: 10px 5px 5px 5px;">
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 18px;">
                    <div>
                        <label class="glass-label">الاسم الكامل للمعلم *</label>
                        <input id="name" class="glass-input" placeholder="مثال: أ. محمد أحمد">
                    </div>
                    <div>
                        <label class="glass-label">كود المعلم (رقم فريد) *</label>
                        <input id="teacherId" class="glass-input" placeholder="مثال: T2026">
                    </div>
                    <div>
                        <label class="glass-label">باقة الاشتراك الحالية</label>
                        <select id="plan" class="glass-input" style="appearance: auto;">
                            <option value="free">🎯 مجاني (Free)</option>
                            <option value="silver">🥈 فضي (Silver)</option>
                            <option value="gold">🥇 ذهبي (Gold)</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 18px;">
                    <div>
                        <label class="glass-label">البريد الإلكتروني</label>
                        <input id="email" type="email" class="glass-input" placeholder="name@example.com">
                    </div>
                    <div>
                        <label class="glass-label">رقم الهاتف الجوال</label>
                        <input id="phone" class="glass-input" placeholder="01xxxxxxxxx">
                    </div>
                    <div>
                        <label class="glass-label">الصورة الشخصية</label>
                        <input type="file" id="teacherImg" accept="image/*" class="glass-input" style="padding: 8px 12px !important; font-size: 0.85rem !important;">
                    </div>
                </div>
                
                <div style="background: rgba(30, 41, 59, 0.4); padding: 14px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.08); display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; align-items: center;">
                    <div>
                        <label style="display:block; font-weight: 700; margin-bottom: 6px; font-size: 1rem; color:#facc15;">📆 طريقة تحديد مدة الاشتراك</label>
                        <select id="durationType" class="glass-input" style="background:#0f172a !important; appearance: auto;">
                            <option value="months">أشهر ثابتة (1-12)</option>
                            <option value="days">أيام محددة يدوياً</option>
                        </select>
                    </div>

                    <div id="monthsContainer">
                        <label class="glass-label">عدد أشهر الاشتراك التلقائي</label>
                        <select id="subscriptionMonths" class="glass-input" style="background:#0f172a !important; appearance: auto;">
                            <option value="1">شهر واحد</option><option value="2">شهرين</option><option value="3">3 أشهر</option>
                            <option value="4">4 أشهر</option><option value="5">5 أشهر</option><option value="6">6 أشهر</option>
                            <option value="7">7 أشهر</option><option value="8">8 أشهر</option><option value="9">9 أشهر</option>
                            <option value="10">10 أشهر</option><option value="11">11 شهراً</option><option value="12">12 شهراً</option>
                        </select>
                    </div>

                    <div id="daysContainer" style="display:none;">
                        <label class="glass-label">عدد الأيام المطلوبة يدوياً</label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="number" id="subscriptionDaysManual" class="glass-input" style="background:#0f172a !important;" placeholder="مثال: 45" min="1" value="30">
                            <span style="font-size: 0.85rem; color: #94a3b8; white-space: nowrap;">(من 1 إلى 365 يوم)</span>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <label style="display:block; font-weight:700; margin-bottom:6px; font-size:0.95rem; color:#facc15;">📚 تخصيص المواد الدراسية:</label>
                        <div class="subjects-grid" style="display:flex; flex-wrap:wrap; background: rgba(15, 23, 42, 0.6); padding: 6px; border-radius: 8px; max-height: 85px; overflow-y: auto; border: 1px solid rgba(255, 255, 255, 0.05);">
                            ${subjectsList}
                        </div>
                    </div>
                    
                    <div>
                        <label style="display:block; font-weight:700; margin-bottom:6px; font-size:0.95rem; color:#facc15;">🎓 تحديد الصفوف التعليمية:</label>
                        <div class="grades-grid" style="display:flex; flex-wrap:wrap; background: rgba(15, 23, 42, 0.6); padding: 6px; border-radius: 8px; max-height: 85px; overflow-y: auto; border: 1px solid rgba(255, 255, 255, 0.05);">
                            ${gradesList}
                        </div>
                    </div>
                </div>

            </div>`,
        preConfirm: async () => {
            const name = document.getElementById('name').value.trim();
            const teacherId = document.getElementById('teacherId').value.trim();
            
            if (!name || !teacherId) {
                Swal.showValidationMessage('الاسم الكامل وكود المعلم حقول مطلوبة');
                return false;
            }
            
            let imgBase64 = DEFAULT_SVG;
            const fileInput = document.getElementById('teacherImg');
            if (fileInput.files && fileInput.files[0]) {
                imgBase64 = await compressImage(fileInput.files[0]);
            }
            
            const subjects = Array.from(document.querySelectorAll('.subject-check:checked')).map(cb => cb.value);
            const grades = Array.from(document.querySelectorAll('.grade-check:checked')).map(cb => cb.value);
            
            const durationType = document.getElementById('durationType').value;
            let expiryDateISO = null;
            const today = new Date();
            
            if (durationType === 'months') {
                const months = parseInt(document.getElementById('subscriptionMonths').value);
                if (months > 0) {
                    const expiryDateObj = new Date(today);
                    expiryDateObj.setMonth(expiryDateObj.getMonth() + months);
                    expiryDateISO = expiryDateObj.toISOString();
                }
            } else {
                const days = parseInt(document.getElementById('subscriptionDaysManual').value);
                if (days > 0 && !isNaN(days)) {
                    const expiryDateObj = new Date(today);
                    expiryDateObj.setDate(expiryDateObj.getDate() + days);
                    expiryDateISO = expiryDateObj.toISOString();
                } else {
                    Swal.showValidationMessage('يرجى إدخال عدد أيام صحيح (أكبر من 0)');
                    return false;
                }
            }
            
            return { 
                name, 
                teacherId, 
                email: document.getElementById('email').value.trim(), 
                phone: document.getElementById('phone').value.trim(), 
                plan: document.getElementById('plan').value, 
                expiryDate: expiryDateISO,
                img: imgBase64, 
                subjects, 
                grades 
            };
        },
        didOpen: () => {
            const durationType = document.getElementById('durationType');
            const monthsDiv = document.getElementById('monthsContainer');
            const daysDiv = document.getElementById('daysContainer');
            
            if (durationType && monthsDiv && daysDiv) {
                durationType.addEventListener('change', () => {
                    if (durationType.value === 'months') {
                        monthsDiv.style.display = 'block';
                        daysDiv.style.display = 'none';
                    } else {
                        monthsDiv.style.display = 'none';
                        daysDiv.style.display = 'block';
                    }
                });
            }
        }
    });
    
    // 4. معالجة البيانات بعد الضغط على زر "إضافة المعلم"
    if (formData) {
        const existing = await getTeachersList();
        if (existing.some(t => t.id === formData.teacherId)) {
            Swal.fire({ title: 'خطأ', text: 'كود المعلم موجود مسبقاً، يرجى اختيار كود آخر', icon: 'error', background: '#0f172a', color: '#fff' });
            return;
        }
        
        try {
            Swal.showLoading();
            const module = await import('../../admin/createTeacherHelper.js');
            const { createTeacherAccount } = module;
            if (typeof createTeacherAccount !== 'function') throw new Error('createTeacherAccount ليس دالة برمجية معرفة');
            
            const result = await createTeacherAccount(formData.teacherId, formData.name, formData.plan, formData.expiryDate);
            if (!result.success) {
                Swal.fire({ title: 'خطأ', text: result.error || 'فشل إنشاء حساب المعلم في النظام', icon: 'error', background: '#0f172a', color: '#fff' });
                return;
            }
            
            const uid = result.uid;
            await setDoc(doc(firestoreDb, 'teachers', uid), {
                id: formData.teacherId,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                plan: formData.plan,
                expiryDate: formData.expiryDate || null,
                img: formData.img,
                subjects: formData.subjects,
                grades: formData.grades,
                status: 'active',
                createdAt: serverTimestamp(),
                devices: [],
                violations: [],
                isTeacher: true
            }, { merge: true });
            
            await addAuditLog('إضافة معلم', `تم إضافة المعلم ${formData.name} (الكود: ${formData.teacherId})`);
            
            Swal.close();
            Swal.fire({ title: 'تمت الإضافة بنجاح 🎉', text: `تم تسجيل المعلم ${formData.name} في قاعدة البيانات`, icon: 'success', background: '#0f172a', color: '#fff' });
            showNotification(`👨‍🏫 تم إضافة المعلم الجديد ${formData.name}`, 'success');
            
            await renderTeachers();
        } catch (err) {
            console.error('خطأ في معالجة إضافة المعلم:', err);
            Swal.fire({ title: 'خطأ غير متوقع', text: 'فشل تحميل وظيفة إنشاء المعلم: ' + err.message, icon: 'error', background: '#0f172a', color: '#fff' });
        }
    }
}
// ========== 12. تصدير المعلمين إلى Excel ==========
export async function exportTeachersToExcel() {
    if (!hasPermission('teachers', 'view')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لتصدير المعلمين', 'error');
        return;
    }
    const teachers = await getTeachersList();
    const wsData = teachers.map(t => ({ 'الاسم': t.name, 'الكود': t.id, 'البريد': t.email, 'الخطة': t.plan, 'الحالة': t.status, 'تاريخ الانتهاء': t.expiryDate ? new Date(t.expiryDate).toLocaleDateString() : '' }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المعلمون');
    XLSX.writeFile(wb, `معلمون_المنصة.xlsx`);
    showNotification('📥 تم تصدير قائمة المعلمين إلى Excel', 'success');
}
// ========== 13. تعديل معلم ==========
// ========== 13. تعديل معلم ==========
export async function showEditTeacherModal(teacher) {
    if (!hasPermission('teachers', 'edit')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لتعديل المعلم', 'error');
        return;
    }
    
    const teacherCode = teacher.code || teacher.id;
    const teacherRefResult = await getTeacherDocumentByCode(teacherCode);
    if (!teacherRefResult) {
        Swal.fire('خطأ', `لم يتم العثور على معلم بالكود: ${teacherCode}`, 'error');
        return;
    }
    
    const actualTeacherRef = teacherRefResult.ref;
    const teacherData = teacherRefResult.data;

    const labelCardStyle = `display: inline-flex; align-items: center; margin: 3px; gap: 6px; padding: 4px 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; cursor: pointer; user-select: none; font-size: 0.85rem; color: #e2e8f0; transition: all 0.2s;`;
    
    const subjectsList = EGYPT_SUBJECTS.map(s => `
        <label style="${labelCardStyle}" onmouseover="this.style.background='rgba(250, 204, 21, 0.15)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <input type="checkbox" value="${s}" ${(teacherData.subjects || []).includes(s) ? 'checked' : ''} class="edit-subject-check" style="accent-color: #facc15; scale: 1.05;"> ${s}
        </label>
    `).join('');

    const gradesList = EGYPT_GRADES.map(g => `
        <label style="${labelCardStyle}" onmouseover="this.style.background='rgba(250, 204, 21, 0.15)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <input type="checkbox" value="${g}" ${(teacherData.grades || []).includes(g) ? 'checked' : ''} class="edit-grade-check" style="accent-color: #facc15; scale: 1.05;"> ${g}
        </label>
    `).join('');

    const DEFAULT_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 24 24' fill='none' stroke='%23facc15' stroke-width='1.5'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";

    const { value: formData } = await Swal.fire({
        title: `<span style="font-size: 1.5rem; font-weight: 800; color: #facc15; display:block; padding-left: 30px;">✏️ تعديل بيانات المعلم: ${escapeHtml(teacherData.name)}</span>`,
        background: 'rgba(15, 23, 42, 0.85)',
        color: '#f8fafc',
        confirmButtonColor: '#eab308',
        cancelButtonColor: 'rgba(255, 255, 255, 0.1)',
        confirmButtonText: '<span style="font-size: 1.05rem; font-weight: bold; padding: 0 5px;">💾 حفظ التغييرات</span>',
        cancelButtonText: '<span style="font-size: 1.05rem; color: #cbd5e1;">إلغاء</span>',
        showCancelButton: true,
        showCloseButton: true, // ✅ إظهار علامة X للخروج
        width: '850px',
        customClass: {
            popup: 'glass-popup-effect',
            closeButton: 'glass-close-btn' // ✅ كلاس مخصص لتصميم زر الخروج
        },
        html: `
            <style>
                .glass-popup-effect {
                    backdrop-filter: blur(16px) saturate(120%);
                    -webkit-backdrop-filter: blur(16px) saturate(120%);
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
                    border-radius: 16px !important;
                }
                /* تنسيق علامة الـ X لتناسب المظهر الزجاجي */
                .glass-close-btn {
                    color: #94a3b8 !important;
                    font-size: 24px !important;
                    transition: all 0.2s ease !important;
                    border-radius: 50% !important;
                    outline: none !important;
                }
                .glass-close-btn:hover {
                    color: #ef4444 !important;
                    background: rgba(239, 68, 68, 0.1) !important;
                }
                .glass-input {
                    margin: 0 !important; width: 100% !important; height: 46px !important; 
                    background: rgba(30, 41, 59, 0.7) !important; color: #fff !important; 
                    border: 1px solid rgba(255, 255, 255, 0.1) !important; border-radius: 8px !important;
                    font-size: 1rem !important; padding: 0 12px !important; transition: all 0.2s ease;
                }
                .glass-input:focus {
                    border-color: #eab308 !important; box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.2) !important;
                }
                .glass-label {
                    display: block; margin-bottom: 6px; font-size: 0.95rem; font-weight: 600; color: #94a3b8;
                }
                .action-btn {
                    padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; cursor: pointer; border: none; transition: background 0.2s;
                }
            </style>

            <div style="text-align: right; font-family: system-ui, -apple-system, sans-serif; direction: rtl; padding: 10px 5px 5px 5px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 18px;">
                    <div>
                        <label class="glass-label">الاسم الكامل *</label>
                        <input id="editName" class="glass-input" value="${escapeHtml(teacherData.name)}" placeholder="الاسم الكامل">
                    </div>
                    <div>
                        <label class="glass-label">كود المعلم (فريد) *</label>
                        <input id="editTeacherId" class="glass-input" value="${escapeHtml(teacherData.code)}" placeholder="كود المعلم">
                    </div>
                    <div>
                        <label class="glass-label">باقة الاشتراك</label>
                        <select id="editPlan" class="glass-input" style="appearance: auto;">
                            <option value="free" ${teacherData.plan === 'free' ? 'selected' : ''}>🎯 مجاني (Free)</option>
                            <option value="silver" ${teacherData.plan === 'silver' ? 'selected' : ''}>🥈 فضي (Silver)</option>
                            <option value="gold" ${teacherData.plan === 'gold' ? 'selected' : ''}>🥇 ذهبي (Gold)</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 18px;">
                    <div>
                        <label class="glass-label">البريد الإلكتروني</label>
                        <input id="editEmail" type="email" class="glass-input" value="${escapeHtml(teacherData.email || '')}" placeholder="name@example.com">
                    </div>
                    <div>
                        <label class="glass-label">رقم الهاتف الجوال</label>
                        <input id="editPhone" class="glass-input" value="${escapeHtml(teacherData.phone || '')}" placeholder="01xxxxxxxxx">
                    </div>
                    <div>
                        <label class="glass-label">تاريخ انتهاء الاشتراك</label>
                        <input id="editExpiry" type="date" class="glass-input" value="${teacherData.expiryDate ? teacherData.expiryDate.split('T')[0] : ''}">
                    </div>
                </div>
                
                <div style="background: rgba(30, 41, 59, 0.4); padding: 12px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: space-between; gap: 20px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <img src="${teacherData.img || DEFAULT_SVG}" id="editTeacherImgPreview" style="width: 55px; height: 55px; border-radius: 50%; object-fit: cover; border: 2px solid #facc15; background: #0f172a;">
                        <div>
                            <span style="display: block; font-weight: bold; font-size: 0.95rem; color: #fff;">الصورة الشخصية للمعلم</span>
                            <span style="font-size: 0.8rem; color: #94a3b8;">يمكنك استبدال الصورة الحالية أو العودة للافتراضية</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="changeTeacherImgBtn" class="action-btn" style="background: #2563eb; color: #fff;">تغيير الصورة</button>
                        <button type="button" id="resetTeacherImgBtn" class="action-btn" style="background: #475569; color: #cbd5e1;">الافتراضية</button>
                    </div>
                    <input type="file" id="editTeacherImgInput" accept="image/*" style="display: none;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <label style="display:block; font-weight:700; margin-bottom:6px; font-size:0.95rem; color:#facc15;">📚 تخصيص المواد الدراسية:</label>
                        <div class="subjects-grid" style="display:flex; flex-wrap:wrap; background: rgba(15, 23, 42, 0.6); padding: 6px; border-radius: 8px; max-height: 85px; overflow-y: auto; border: 1px solid rgba(255, 255, 255, 0.05);">
                            ${subjectsList}
                        </div>
                    </div>
                    
                    <div>
                        <label style="display:block; font-weight:700; margin-bottom:6px; font-size:0.95rem; color:#facc15;">🎓 تحديد الصفوف التعليمية:</label>
                        <div class="grades-grid" style="display:flex; flex-wrap:wrap; background: rgba(15, 23, 42, 0.6); padding: 6px; border-radius: 8px; max-height: 85px; overflow-y: auto; border: 1px solid rgba(255, 255, 255, 0.05);">
                            ${gradesList}
                        </div>
                    </div>
                </div>
            </div>`,
        preConfirm: async () => {
            const name = document.getElementById('editName').value.trim();
            const teacherCodeInput = document.getElementById('editTeacherId').value.trim();
            
            if (!name || !teacherCodeInput) {
                Swal.showValidationMessage('الاسم الكامل وكود المعلم حقول مطلوبة');
                return false;
            }
            
            let newImg = document.getElementById('editTeacherImgPreview').src;
            const fileInput = document.getElementById('editTeacherImgInput');
            if (fileInput.files && fileInput.files[0]) {
                newImg = await compressImage(fileInput.files[0]);
            }
            if (!newImg || newImg === 'undefined' || newImg.includes('via.placeholder.com') || newImg === 'https://via.placeholder.com/150?text=Teacher') {
                newImg = DEFAULT_SVG;
            }
            
            return { name, teacherCode: teacherCodeInput, email: document.getElementById('editEmail').value.trim(), phone: document.getElementById('editPhone').value.trim(), plan: document.getElementById('editPlan').value, expiryDate: document.getElementById('editExpiry').value || null, subjects: Array.from(document.querySelectorAll('.edit-subject-check:checked')).map(cb => cb.value), grades: Array.from(document.querySelectorAll('.edit-grade-check:checked')).map(cb => cb.value), img: newImg };
        },
        didOpen: () => {
            const changeBtn = document.getElementById('changeTeacherImgBtn');
            const resetBtn = document.getElementById('resetTeacherImgBtn');
            const fileInput = document.getElementById('editTeacherImgInput');
            const preview = document.getElementById('editTeacherImgPreview');
            
            if (changeBtn) changeBtn.onclick = () => fileInput.click();
            if (resetBtn) resetBtn.onclick = () => preview.src = DEFAULT_SVG;
            if (fileInput) {
                fileInput.onchange = async (e) => {
                    if (e.target.files[0]) {
                        Swal.showLoading();
                        const compressed = await compressImage(e.target.files[0]);
                        preview.src = compressed;
                        Swal.hideLoading();
                    }
                };
            }
        }
    });

    if (!formData) return;
    
    Swal.fire({ title: 'جاري حفظ التعديلات...', text: 'الرجاء الانتظار قليلاً', background: '#0f172a', color: '#fff', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        await updateDoc(actualTeacherRef, {
            name: formData.name, code: formData.teacherCode, email: formData.email, phone: formData.phone, plan: formData.plan, expiryDate: formData.expiryDate || null, img: formData.img, subjects: formData.subjects, grades: formData.grades, updatedAt: serverTimestamp()
        });
        
        if (formData.teacherCode !== teacherData.code) {
            const oldCode = teacherData.code;
            const newCode = formData.teacherCode;
            const oldCodeRef = doc(firestoreDb, 'teacherCodes', oldCode);
            const newCodeRef = doc(firestoreDb, 'teacherCodes', newCode);
            
            const oldCodeSnap = await getDoc(oldCodeRef);
            if (oldCodeSnap.exists()) {
                await setDoc(newCodeRef, { ...oldCodeSnap.data(), code: newCode });
                await deleteDoc(oldCodeRef);
            }
            
            const studentsQuery = query(studentsCollection, where('teacherId', '==', oldCode));
            const studentsSnap = await getDocs(studentsQuery);
            const batch = writeBatch(firestoreDb);
            studentsSnap.forEach(docSnap => batch.update(docSnap.ref, { teacherId: newCode }));
            await batch.commit();
            
            await updateTeacherIdInQuestions(oldCode, newCode);
        }
        
        await renderTeachers();
        Swal.fire({ icon: 'success', title: 'تم التحديث بنجاح 🎉', text: `تم مزامنة وتعديل بيانات المعلم ${formData.name}`, timer: 2000, showConfirmButton: false, background: '#0f172a', color: '#fff' });
        showNotification(`✏️ تم تحديث بيانات المعلم ${formData.name}`, 'success');
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'فشل حفظ التعديلات', text: error.message || 'حدث خطأ غير متوقع بالخادم.', confirmButtonText: 'حسناً', background: '#0f172a', color: '#fff' });
    }
}
// ========== 14. تحديث معرف المعلم في الأسئلة ==========
export async function updateTeacherIdInQuestions(oldId, newId) {
    const allStudents = await getAllStudents();
    const gradesSet = new Set();
    allStudents.forEach(s => { if (s.grade) gradesSet.add(s.grade); });
    for (const grade of gradesSet) {
        let questions = await loadQuestionsFromIndexedDB(grade);
        let updated = false;
        for (let q of questions) {
            if (q.teacherId === oldId) {
                q.teacherId = newId;
                updated = true;
            }
        }
        if (updated) await saveQuestionsToIndexedDB(grade, questions);
    }
}