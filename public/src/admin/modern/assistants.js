// src/admin/modern/assistants.js
// إدارة المساعدين – تدفق: صلاحيات أولاً ثم البيانات
// تم تحسين صلاحيات المساعدين بشكل مفصل وإضافة واجهة عرض أوضح

import { db, auth, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, getDoc, addDoc, serverTimestamp, createUserWithEmailAndPassword } from '../../firebase/init.js';
import { getTeachersList } from '../../firebase/auth.js';
import { showNotification, escapeHtml, addAuditLog, hasPermission, checkPermission, ACTION_DESCRIPTIONS, MODULE_NAMES, getActionIcon } from './utils.js';

const ADMIN_DEV_CODE = "29910141300038";

// ========== تعريف الوحدات والإجراءات المفصلة ==========
const MODULES = [
    { id: 'dashboard', label: '📊 لوحة المعلومات', actions: ['view'] },
    { id: 'teachers', label: '👥 المعلمين', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { id: 'students', label: '🎓 الطلاب', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { id: 'questions', label: '📚 بنك الأسئلة', actions: ['view', 'create', 'edit', 'delete', 'upload', 'export'] },
    { id: 'messages', label: '✉️ المراسلات', actions: ['view', 'reply'] },
    { id: 'violations', label: '⚠️ المخالفات', actions: ['view', 'resolve', 'unsuspend'] },
    { id: 'audit', label: '📜 سجل التعديلات', actions: ['view', 'export'] },
    { id: 'simulate', label: '🕵️ محاكاة المعلم', actions: ['view'] },
    { id: 'advanced', label: '⚙️ الإعدادات المتقدمة', actions: ['view', 'configure'] },
    { id: 'assistants', label: '🛡️ المساعدين', actions: ['view', 'create', 'edit', 'delete'] }
];

const ACTION_LABELS = {
    view: 'عرض', create: 'إضافة', edit: 'تعديل', delete: 'حذف',
    upload: 'رفع', reply: 'رد', resolve: 'حل', unsuspend: 'رفع تعليق',
    export: 'تصدير', configure: 'تهيئة'
};

// ========== النماذج الجاهزة (مفصلة أكثر) ==========
const ROLE_TEMPLATES = {
    admin_full: {
        name: '👑 مدير كامل',
        permissions: {
            dashboard: { view: true },
            teachers: { view: true, create: true, edit: true, delete: true, export: true },
            students: { view: true, create: true, edit: true, delete: true, export: true },
            questions: { view: true, create: true, edit: true, delete: true, upload: true, export: true },
            messages: { view: true, reply: true },
            violations: { view: true, resolve: true, unsuspend: true },
            audit: { view: true, export: true },
            simulate: { view: true },
            advanced: { view: true, configure: true },
            assistants: { view: true, create: true, edit: true, delete: true }
        }
    },
    supervisor_students: {
        name: '🎓 مشرف الطلاب',
        permissions: {
            dashboard: { view: true },
            teachers: { view: false, create: false, edit: false, delete: false, export: false },
            students: { view: true, create: true, edit: true, delete: true, export: true },
            questions: { view: false, create: false, edit: false, delete: false, upload: false, export: false },
            messages: { view: true, reply: false },
            violations: { view: true, resolve: false, unsuspend: false },
            audit: { view: false, export: false },
            simulate: { view: false },
            advanced: { view: false, configure: false },
            assistants: { view: false, create: false, edit: false, delete: false }
        }
    },
    supervisor_questions: {
        name: '📚 مشرف الأسئلة',
        permissions: {
            dashboard: { view: true },
            teachers: { view: false, create: false, edit: false, delete: false, export: false },
            students: { view: false, create: false, edit: false, delete: false, export: false },
            questions: { view: true, create: true, edit: true, delete: true, upload: true, export: true },
            messages: { view: true, reply: false },
            violations: { view: false, resolve: false, unsuspend: false },
            audit: { view: false, export: false },
            simulate: { view: false },
            advanced: { view: false, configure: false },
            assistants: { view: false, create: false, edit: false, delete: false }
        }
    },
    moderator_messages: {
        name: '✉️ وسيط مراسلات',
        permissions: {
            dashboard: { view: true },
            teachers: { view: true, create: false, edit: false, delete: false, export: false },
            students: { view: true, create: false, edit: false, delete: false, export: false },
            questions: { view: false, create: false, edit: false, delete: false, upload: false, export: false },
            messages: { view: true, reply: true },
            violations: { view: true, resolve: true, unsuspend: false },
            audit: { view: false, export: false },
            simulate: { view: false },
            advanced: { view: false, configure: false },
            assistants: { view: false, create: false, edit: false, delete: false }
        }
    },
    viewer_reports: {
        name: '📈 مراقب تقارير',
        permissions: {
            dashboard: { view: true },
            teachers: { view: true, create: false, edit: false, delete: false, export: true },
            students: { view: true, create: false, edit: false, delete: false, export: true },
            questions: { view: false, create: false, edit: false, delete: false, upload: false, export: false },
            messages: { view: false, reply: false },
            violations: { view: false, resolve: false, unsuspend: false },
            audit: { view: true, export: true },
            simulate: { view: false },
            advanced: { view: false, configure: false },
            assistants: { view: false, create: false, edit: false, delete: false }
        }
    }
};

function getTemplateColor(key) {
    const colors = {
        admin_full: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        supervisor_students: 'linear-gradient(135deg, #10b981, #059669)',
        supervisor_questions: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        moderator_messages: 'linear-gradient(135deg, #a855f7, #7c3aed)',
        viewer_reports: 'linear-gradient(135deg, #94a3b8, #64748b)'
    };
    return colors[key] || '#4f46e5';
}

// بناء HTML لجدول الصلاحيات (محسن بعرض أيقونات وأوصاف)
function buildPermissionsTableHTML(currentPerms) {
    const allActions = ['view', 'create', 'edit', 'delete', 'export', 'upload', 'reply', 'resolve', 'unsuspend', 'configure'];
    let html = `
        <div style="max-height: 65vh; overflow-y: auto; direction: rtl; padding: 0.5rem;">
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
                ${Object.entries(ROLE_TEMPLATES).map(([key, tmpl]) => `
                    <button type="button" class="role-template-btn" data-template="${key}" style="background: ${getTemplateColor(key)}; border: none; color: ${key === 'admin_full' ? '#1e1b0c' : 'white'}; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                        ${tmpl.name}
                    </button>
                `).join('')}
            </div>
            <div style="text-align: center; font-size: 0.7rem; color: #9ca3af; margin-bottom: 0.75rem;">✔️ اختر نموذجاً جاهزاً، ثم عدّل الصلاحيات يدوياً</div>
            <table style="width: 100%; text-align: right; border-collapse: collapse; background: rgba(15,23,42,0.4); border-radius: 0.75rem; overflow: hidden;">
                <thead style="background: rgba(51,65,85,0.6);">
                    <tr>
                        <th style="padding: 0.5rem; color: #facc15;">الوحدة</th>
                        ${allActions.map(act => `<th style="padding: 0.5rem; color: #67e8f9; font-size: 0.7rem;" title="${ACTION_DESCRIPTIONS[act]}">${getActionIcon(act)} ${ACTION_DESCRIPTIONS[act]}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${MODULES.map(mod => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.5rem; font-weight: bold; color: white;">${mod.label}</td>
                            ${allActions.map(act => {
                                if (!mod.actions.includes(act)) return '<td style="padding: 0.5rem; text-align: center; color: #334155;">—</td>';
                                const checked = currentPerms[mod.id]?.[act] === true;
                                return `<td style="text-align: center; padding: 0.25rem;"><input type="checkbox" class="perm-checkbox" data-module="${mod.id}" data-action="${act}" ${checked ? 'checked' : ''} style="width: 1rem; height: 1rem; accent-color: #eab308;"></td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="display: flex; justify-content: center; gap: 1rem; margin-top: 1rem;">
                <button type="button" id="selectAllPermsBtn" style="background: #059669; border: none; padding: 0.25rem 1rem; border-radius: 999px; font-size: 0.75rem; cursor: pointer;">✅ تحديد الكل</button>
                <button type="button" id="deselectAllPermsBtn" style="background: #dc2626; border: none; padding: 0.25rem 1rem; border-radius: 999px; font-size: 0.75rem; cursor: pointer;">❌ إلغاء الكل</button>
            </div>
            <div class="text-center text-[10px] text-gray-500 mt-3">✏️ مرر مؤشر الفأرة فوق أيقونات الصلاحيات لمعرفة معناها</div>
        </div>
    `;
    return html;
}

// ========== نافذة اختيار الصلاحيات (محسنة) ==========
async function selectPermissions(initialPerms, title) {
    let permsCopy = JSON.parse(JSON.stringify(initialPerms));
    
    const result = await Swal.fire({
        title: title,
        html: buildPermissionsTableHTML(permsCopy),
        width: '1100px',
        showConfirmButton: true,
        confirmButtonText: '✅ حفظ الصلاحيات',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        background: '#0f172a',
        color: '#fff',
        customClass: { popup: 'rounded-3xl border border-yellow-500/30' },
        didOpen: (popup) => {
            try {
                // أزرار النماذج
                popup.querySelectorAll('.role-template-btn').forEach(btn => {
                    btn.removeEventListener('click', window._templateHandler);
                    window._templateHandler = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const templateKey = btn.dataset.template;
                        const template = ROLE_TEMPLATES[templateKey];
                        if (template) {
                            for (let mod of MODULES) {
                                for (let act of mod.actions) {
                                    const value = template.permissions[mod.id]?.[act] === true;
                                    permsCopy[mod.id] = permsCopy[mod.id] || {};
                                    permsCopy[mod.id][act] = value;
                                    const cb = popup.querySelector(`.perm-checkbox[data-module="${mod.id}"][data-action="${act}"]`);
                                    if (cb) cb.checked = value;
                                }
                            }
                            showNotification(`تم تحميل نموذج: ${template.name}`, 'success');
                        }
                    };
                    btn.addEventListener('click', window._templateHandler);
                });
                
                // تحديد الكل
                const selectAllBtn = popup.querySelector('#selectAllPermsBtn');
                if (selectAllBtn) {
                    selectAllBtn.removeEventListener('click', window._selectAllHandler);
                    window._selectAllHandler = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        popup.querySelectorAll('.perm-checkbox').forEach(cb => {
                            cb.checked = true;
                            const module = cb.dataset.module;
                            const action = cb.dataset.action;
                            permsCopy[module] = permsCopy[module] || {};
                            permsCopy[module][action] = true;
                        });
                    };
                    selectAllBtn.addEventListener('click', window._selectAllHandler);
                }
                // إلغاء الكل
                const deselectAllBtn = popup.querySelector('#deselectAllPermsBtn');
                if (deselectAllBtn) {
                    deselectAllBtn.removeEventListener('click', window._deselectAllHandler);
                    window._deselectAllHandler = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        popup.querySelectorAll('.perm-checkbox').forEach(cb => {
                            cb.checked = false;
                            const module = cb.dataset.module;
                            const action = cb.dataset.action;
                            permsCopy[module] = permsCopy[module] || {};
                            permsCopy[module][action] = false;
                        });
                    };
                    deselectAllBtn.addEventListener('click', window._deselectAllHandler);
                }
                
                // التغييرات الفردية
                popup.querySelectorAll('.perm-checkbox').forEach(cb => {
                    cb.removeEventListener('change', window._checkboxChangeHandler);
                    window._checkboxChangeHandler = () => {
                        const module = cb.dataset.module;
                        const action = cb.dataset.action;
                        permsCopy[module] = permsCopy[module] || {};
                        permsCopy[module][action] = cb.checked;
                    };
                    cb.addEventListener('change', window._checkboxChangeHandler);
                });
            } catch (err) {
                console.error('خطأ في تهيئة نافذة الصلاحيات:', err);
            }
        },
        preConfirm: () => {
            return permsCopy;
        }
    });
    
    return result.isConfirmed ? result.value : null;
}

// ========== نافذة إدخال البيانات الأساسية ==========
async function enterBasicData() {
    const { value: data } = await Swal.fire({
        title: '📝 بيانات المساعد الجديد',
        html: `
            <div class="text-right space-y-3" dir="rtl">
                <input id="assistantName" class="swal2-input" placeholder="الاسم الكامل *" autocomplete="off">
                <input id="assistantPhone" class="swal2-input" placeholder="رقم الهاتف *" autocomplete="off">
                <div class="flex gap-2">
                    <input id="assistantCode" class="swal2-input flex-1" placeholder="رمز الدخول (أرقام فقط)" autocomplete="off">
                    <button type="button" id="genCodeBtn" class="bg-indigo-600 px-3 rounded-xl text-white">🎲 توليد</button>
                </div>
                <div class="text-xs text-gray-400">رمز الدخول سيستخدمه المساعد لتسجيل الدخول كمعلم (رقمي فقط).</div>
            </div>
        `,
        focusConfirm: false,
        showConfirmButton: true,
        confirmButtonText: '✅ إنشاء المساعد',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            const name = document.getElementById('assistantName').value.trim();
            const phone = document.getElementById('assistantPhone').value.trim();
            let code = document.getElementById('assistantCode').value.trim();
            if (!name || !phone) {
                Swal.showValidationMessage('الاسم ورقم الهاتف مطلوبان');
                return false;
            }
            if (!code) {
                code = generateNumericCode(6);
                document.getElementById('assistantCode').value = code;
            }
            if (!/^\d+$/.test(code)) {
                Swal.showValidationMessage('رمز الدخول يجب أن يكون أرقاماً فقط');
                return false;
            }
            return { name, phone, code };
        },
        background: '#0f172a', color: '#fff',
        didOpen: () => {
            document.getElementById('genCodeBtn')?.addEventListener('click', () => {
                document.getElementById('assistantCode').value = generateNumericCode(6);
            });
        }
    });
    return data;
}

// ========== دوال إدارة المساعدين الأساسية ==========
function isDeveloper() {
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    const isDevFlag = sessionStorage.getItem('is_developer') === 'true';
    const isAdminFlag = sessionStorage.getItem('is_admin') === 'true';
    return (teacherCode === ADMIN_DEV_CODE) || isDevFlag || isAdminFlag;
}

export async function renderAssistants() {
    if (!isDeveloper() && !hasPermission('assistants', 'view')) {
        document.getElementById('assistantsPane').innerHTML = `<div class="glass-card p-5 text-center"><i class="fas fa-lock text-4xl text-red-400 mb-3"></i><h3 class="text-xl font-bold text-red-400">غير مصرح</h3><p class="text-gray-400">ليس لديك صلاحية الوصول إلى إدارة المساعدين.</p></div>`;
        return;
    }
    const assistants = await getAllAssistants();
    const html = `
        <div class="glass-card p-5">
            <div class="flex flex-wrap justify-between items-center mb-5">
                <h3 class="text-2xl font-bold text-yellow-400"><i class="fas fa-user-shield ml-2"></i> إدارة المساعدين</h3>
                ${hasPermission('assistants', 'create') ? `<button id="addAssistantBtn" class="btn-primary"><i class="fas fa-plus"></i> إضافة مساعد جديد</button>` : ''}
            </div>
            <div class="flex flex-wrap gap-3 mb-5">
                <input type="text" id="searchAssistant" class="filter-input flex-1" placeholder="🔍 بحث بالاسم أو الهاتف أو الكود">
                <select id="filterAssistantRole" class="filter-select"><option value="all">جميع الأدوار</option>${Object.keys(ROLE_TEMPLATES).map(k => `<option value="${k}">${ROLE_TEMPLATES[k].name}</option>`).join('')}<option value="custom">مخصص</option></select>
                <select id="filterAssistantStatus" class="filter-select"><option value="all">جميع الحالات</option><option value="active">نشط</option><option value="inactive">معطل</option></select>
                <button id="resetAssistantFiltersBtn" class="btn-secondary text-sm">إعادة تعيين</button>
            </div>
            <div class="overflow-x-auto"><table class="admin-table"><thead><tr><th>الاسم</th><th>الهاتف</th><th>رمز الدخول</th><th>الدور</th><th>الصلاحيات</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>الإجراءات</th></tr></thead><tbody id="assistantsTableBody"></tbody></table></div>
        </div>`;
    document.getElementById('assistantsPane').innerHTML = html;
    bindAssistantEvents();
    await renderAssistantsTable(assistants);
}

async function getAllAssistants() {
    const snapshot = await getDocs(collection(db, 'admin_roles'));
    const assistants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const teachers = await getTeachersList();
    const teacherMap = Object.fromEntries(teachers.map(t => [t.uid, t]));
    return assistants.map(a => ({
        ...a,
        name: teacherMap[a.userId]?.name || a.displayName,
        phone: teacherMap[a.userId]?.phone || '',
        accessCode: teacherMap[a.userId]?.code || a.accessCode || a.userId.slice(0,8),
        createdAtDate: a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
    }));
}

async function renderAssistantsTable(assistants) {
    const filterRole = document.getElementById('filterAssistantRole')?.value || 'all';
    const filterStatus = document.getElementById('filterAssistantStatus')?.value || 'all';
    const search = (document.getElementById('searchAssistant')?.value || '').toLowerCase();
    let filtered = assistants.filter(a => {
        if (filterRole !== 'all' && a.role !== filterRole && !(filterRole === 'custom' && !ROLE_TEMPLATES[a.role])) return false;
        const isActive = a.isActive !== false;
        if (filterStatus !== 'all' && ((filterStatus === 'active' && !isActive) || (filterStatus === 'inactive' && isActive))) return false;
        if (search && !a.name?.toLowerCase().includes(search) && !a.phone?.includes(search) && !a.accessCode?.includes(search)) return false;
        return true;
    });
    const tbody = document.getElementById('assistantsTableBody');
    if (!tbody) return;
    if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-400">لا يوجد مساعدون</td></tr>'; return; }
    tbody.innerHTML = filtered.map(a => {
        const isActive = a.isActive !== false;
        const roleDisplay = ROLE_TEMPLATES[a.role]?.name || (a.role === 'custom' ? '📝 مخصص' : a.role);
        const statusHtml = isActive ? '<span class="text-green-400"><i class="fas fa-circle text-[8px] ml-1"></i> نشط</span>' : '<span class="text-red-400"><i class="fas fa-circle text-[8px] ml-1"></i> معطل</span>';
        const permissionsSummary = getPermissionsSummary(a.permissions);
        const createdDate = a.createdAtDate ? a.createdAtDate.toLocaleDateString('ar-EG') : '-';
        const canEdit = hasPermission('assistants', 'edit');
        const canDelete = hasPermission('assistants', 'delete');
        return `
            <tr>
                <td class="font-bold">${escapeHtml(a.name)}</td>
                <td>${escapeHtml(a.phone)}</td>
                <td dir="ltr" class="font-mono">${escapeHtml(a.accessCode)}</td>
                <td><span class="badge-silver text-xs">${escapeHtml(roleDisplay)}</span></td>
                <td class="max-w-xs"><div class="flex flex-wrap gap-1 text-lg" title="${permissionsSummary.tooltip}">${permissionsSummary.icons}</div></td>
                <td>${statusHtml}</td>
                <td>${createdDate}</td>
                <td>
                    ${canEdit ? `<button class="editAssistantBtn text-blue-400 ml-2" data-id="${a.userId}" title="تعديل الصلاحيات"><i class="fas fa-edit"></i></button>` : ''}
                    <button class="toggleAssistantBtn ${isActive ? 'text-orange-400' : 'text-green-400'} ml-2" data-id="${a.userId}" data-active="${isActive}" title="${isActive ? 'تعطيل' : 'تفعيل'}"><i class="fas ${isActive ? 'fa-ban' : 'fa-check-circle'}"></i></button>
                    ${canDelete ? `<button class="deleteAssistantBtn text-red-400" data-id="${a.userId}" title="حذف نهائي"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>`;
    }).join('');
    document.querySelectorAll('.editAssistantBtn').forEach(btn => btn.addEventListener('click', () => showEditAssistantModal(btn.dataset.id)));
    document.querySelectorAll('.toggleAssistantBtn').forEach(btn => btn.addEventListener('click', () => toggleAssistantStatus(btn.dataset.id, btn.dataset.active === 'true')));
    document.querySelectorAll('.deleteAssistantBtn').forEach(btn => btn.addEventListener('click', () => deleteAssistant(btn.dataset.id)));
}

function getPermissionsSummary(perms) {
    const icons = []; const tooltipParts = [];
    const moduleIcons = { teachers: '👥', students: '🎓', questions: '📚', messages: '✉️', violations: '⚠️', audit: '📜', simulate: '🕵️', advanced: '⚙️', assistants: '🛡️' };
    for (let [mod, icon] of Object.entries(moduleIcons)) {
        if (perms[mod]?.view) {
            icons.push(icon);
            let actions = [];
            if (perms[mod]?.create) actions.push('إضافة');
            if (perms[mod]?.edit) actions.push('تعديل');
            if (perms[mod]?.delete) actions.push('حذف');
            if (perms[mod]?.upload) actions.push('رفع');
            if (perms[mod]?.reply) actions.push('رد');
            if (perms[mod]?.resolve) actions.push('حل');
            if (perms[mod]?.unsuspend) actions.push('رفع تعليق');
            if (perms[mod]?.export) actions.push('تصدير');
            if (perms[mod]?.configure) actions.push('تهيئة');
            tooltipParts.push(`${MODULE_NAMES[mod]}: عرض${actions.length ? ' + ' + actions.join('، ') : ''}`);
        }
    }
    return { icons: icons.join(' '), tooltip: tooltipParts.join(' | ') };
}

function bindAssistantEvents() {
    if (hasPermission('assistants', 'create')) {
        document.getElementById('addAssistantBtn')?.addEventListener('click', () => showAddAssistantFlow());
    }
    document.getElementById('searchAssistant')?.addEventListener('input', async () => { const a = await getAllAssistants(); renderAssistantsTable(a); });
    document.getElementById('filterAssistantRole')?.addEventListener('change', async () => { const a = await getAllAssistants(); renderAssistantsTable(a); });
    document.getElementById('filterAssistantStatus')?.addEventListener('change', async () => { const a = await getAllAssistants(); renderAssistantsTable(a); });
    document.getElementById('resetAssistantFiltersBtn')?.addEventListener('click', async () => {
        document.getElementById('searchAssistant').value = '';
        document.getElementById('filterAssistantRole').value = 'all';
        document.getElementById('filterAssistantStatus').value = 'all';
        const a = await getAllAssistants(); renderAssistantsTable(a);
    });
}

// ========== تدفق إضافة مساعد جديد ==========
async function showAddAssistantFlow() {
    // التحقق من صلاحية create
    if (!hasPermission('assistants', 'create')) {
        showNotification('ليس لديك صلاحية لإضافة مساعدين', 'error');
        return;
    }
    // الخطوة 1: اختيار الصلاحيات
    const defaultPerms = JSON.parse(JSON.stringify(ROLE_TEMPLATES.admin_full.permissions));
    const finalPermissions = await selectPermissions(defaultPerms, '🔐 صلاحيات المساعد الجديد');
    if (!finalPermissions) return;

    // الخطوة 2: إدخال البيانات الأساسية
    const basicData = await enterBasicData();
    if (!basicData) return;

    Swal.fire({ title: 'جاري الإنشاء...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const email = `assistant_${basicData.code}@taj-platform.com`;
        const password = generateRandomPassword(10);
        let userCredential;
        try {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                Swal.fire('خطأ', 'البريد الإلكتروني مستخدم بالفعل', 'error');
                return;
            }
            throw err;
        }
        const uid = userCredential.user.uid;

        await setDoc(doc(db, 'teachers', uid), {
            code: basicData.code, name: basicData.name, phone: basicData.phone, email: email,
            plan: 'platinum', status: 'active', isAssistant: true, role: 'custom',
            createdAt: serverTimestamp(), img: null
        });

        await setDoc(doc(db, 'admin_roles', uid), {
            userId: uid, email: email, displayName: basicData.name, phone: basicData.phone,
            accessCode: basicData.code, role: 'custom', permissions: finalPermissions,
            createdBy: sessionStorage.getItem('firebase_uid'), createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(), isActive: true
        });

        await setDoc(doc(db, 'teacherCodes', basicData.code), {
            code: basicData.code, uid: uid, name: basicData.name, plan: 'platinum',
            createdAt: serverTimestamp(), isAssistant: true
        });

        await addAuditLog('إضافة مساعد', `${basicData.name} (${basicData.code}) - هاتف: ${basicData.phone}`);
        Swal.fire('تمت الإضافة', `تم إنشاء حساب المساعد بنجاح\n🔑 رمز الدخول: ${basicData.code}\n🔒 كلمة المرور: ${password}`, 'success');
        showNotification(`✅ تم إضافة المساعد ${basicData.name}`, 'success');
        await renderAssistants();
    } catch (err) {
        console.error(err);
        Swal.fire('خطأ', 'فشل إنشاء المساعد: ' + err.message, 'error');
    }
}

// ========== تعديل صلاحيات مساعد موجود ==========
async function showEditAssistantModal(userId) {
    if (!hasPermission('assistants', 'edit')) {
        showNotification('ليس لديك صلاحية لتعديل المساعدين', 'error');
        return;
    }
    const docSnap = await getDoc(doc(db, 'admin_roles', userId));
    if (!docSnap.exists()) { Swal.fire('خطأ', 'المساعد غير موجود', 'error'); return; }
    const data = docSnap.data();
    const currentPermissions = data.permissions;
    const newPermissions = await selectPermissions(currentPermissions, `🔧 تعديل صلاحيات: ${escapeHtml(data.displayName)}`);
    if (!newPermissions) return;
    Swal.fire({ title: 'جاري الحفظ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await updateDoc(doc(db, 'admin_roles', userId), { permissions: newPermissions, updatedAt: serverTimestamp() });
        await addAuditLog('تعديل صلاحيات مساعد', data.displayName);
        Swal.fire('تم التحديث', '', 'success');
        showNotification(`✏️ تم تحديث صلاحيات ${data.displayName}`, 'success');
        await renderAssistants();
    } catch (err) { Swal.fire('خطأ', 'فشل التحديث: ' + err.message, 'error'); }
}

// ========== تعطيل/تفعيل وحذف المساعد ==========
async function toggleAssistantStatus(userId, currentlyActive) {
    const newStatus = !currentlyActive;
    const confirm = await Swal.fire({ title: newStatus ? 'تفعيل المساعد' : 'تعطيل المساعد', text: 'هل أنت متأكد؟', icon: 'question', showCancelButton: true, confirmButtonText: newStatus ? 'نعم، فعّل' : 'نعم، عطّل', background: '#0f172a', color: '#fff' });
    if (!confirm.isConfirmed) return;
    await updateDoc(doc(db, 'admin_roles', userId), { isActive: newStatus, updatedAt: serverTimestamp() });
    await addAuditLog(newStatus ? 'تفعيل مساعد' : 'تعطيل مساعد', userId);
    showNotification(`✅ تم ${newStatus ? 'تفعيل' : 'تعطيل'} المساعد`, 'success');
    await renderAssistants();
}

async function deleteAssistant(userId) {
    if (!hasPermission('assistants', 'delete')) {
        showNotification('ليس لديك صلاحية لحذف المساعدين', 'error');
        return;
    }
    const confirm = await Swal.fire({ title: 'حذف المساعد نهائياً', text: 'لا يمكن التراجع.', icon: 'warning', showCancelButton: true, confirmButtonText: 'نعم، احذف', background: '#0f172a', color: '#fff' });
    if (!confirm.isConfirmed) return;
    Swal.fire({ title: 'جاري الحذف...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const roleSnap = await getDoc(doc(db, 'admin_roles', userId));
        const accessCode = roleSnap.exists() ? roleSnap.data().accessCode : null;
        await deleteDoc(doc(db, 'admin_roles', userId));
        await deleteDoc(doc(db, 'teachers', userId));
        if (accessCode) await deleteDoc(doc(db, 'teacherCodes', accessCode));
        await addAuditLog('حذف مساعد', userId);
        Swal.fire('تم الحذف', '', 'success');
        showNotification(`🗑️ تم حذف المساعد`, 'success');
        await renderAssistants();
    } catch (err) { Swal.fire('خطأ', 'فشل الحذف: ' + err.message, 'error'); }
}

function generateNumericCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10).toString();
    return code;
}
function generateRandomPassword(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}