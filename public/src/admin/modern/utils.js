// src/admin/modern/utils.js
// الدوال المساعدة والثوابت المشتركة – مع دعم صلاحيات المساعدين (محسّن)

import { db, collection, getDocs, addDoc, serverTimestamp } from '../../firebase/init.js';

// ========== الثوابت ==========
export const EGYPT_SUBJECTS = [
    "اللغة العربية", "التربية الإسلامية", "التربية المسيحية", "الدراسات الاجتماعية",
    "الرياضيات", "العلوم", "الفيزياء", "الكيمياء", "الأحياء", "الجيولوجيا",
    "اللغة الإنجليزية", "اللغة الفرنسية", "الحاسب الآلي", "التاريخ", "الجغرافيا",
    "الفلسفة", "علم النفس", "الاقتصاد", "الإحصاء", "التفكير النقدي"
];

export const EGYPT_GRADES = [
    "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
    "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
    "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
    "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"
];

export const SWAL_DEFAULT_CONFIG = {
    background: '#0f172a',
    color: '#fff',
    confirmButtonColor: '#facc15',
    cancelButtonColor: '#6b7280'
};

export const MESSAGES_SWAL_CONFIG = {
    background: '#0f172a',
    color: '#fff',
    confirmButtonColor: '#4f46e5',
    cancelButtonColor: '#6b7280'
};

// ========== متغيرات عامة ==========
export let currentChatTeacherId = null;
export let messagesRefreshInterval = null;

// Cache للصلاحيات
let permissionsCache = null;

// ========== إشعار فوري ==========
export function showNotification(msg, type = 'info') {
    let container = document.getElementById('notif-queue-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notif-queue-container';
        container.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px;';
        document.body.appendChild(container);
    }
    const notif = document.createElement('div');
    notif.className = `floating-notif ${type}`;
    notif.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${msg}`;
    notif.style.cssText = 'background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); border-radius:12px; padding:10px 16px; color:#fff; margin-top:5px; box-shadow:0 4px 12px rgba(0,0,0,0.3); border-right:4px solid #facc15; font-size:0.9rem;';
    container.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
}

// ========== دوال مساعدة عامة ==========
export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

export function showLoading(containerId, text) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="text-center py-12"><div class="loading-spinner mx-auto mb-3"></div><p class="text-gray-400">${text || 'جاري التحميل...'}</p></div>`;
}

export async function addAuditLog(action, details) {
    try {
        const auditLogCollection = collection(db, 'auditLog');
        await addDoc(auditLogCollection, { action, details, timestamp: serverTimestamp(), admin: 'المطور' });
    } catch (e) { console.error('Audit log error:', e); }
}

export function compressImage(file, maxWidth = 200, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

export async function getAllStudents() {
    const studentsCollection = collection(db, 'students');
    const snapshot = await getDocs(studentsCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function animateNumber(elementId, target, duration = 1000) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const increment = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, 16);
}

export function buildTeacherCardInnerHtml(t) {
    const teacherCode = t.code || t.id;
    const hasValidImg = t.img && t.img !== 'undefined' && t.img.startsWith('data:image');
    const planConfigs = {
        free: { class: 'badge-free', text: 'مجاني', color: '#ef4444' },
        silver: { class: 'badge-silver', text: 'فضي', color: '#9ca3af' },
        gold: { class: 'badge-gold', text: 'ذهبي', color: '#facc15' }
    };
    const currentPlan = planConfigs[t.plan] || planConfigs.free;
    let daysText = `<span class="text-gray-400 text-xs">♾️ غير محدود</span>`;
    let statusBadge = '<span class="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold">دائم</span>';
    if (t.daysLeft !== null) {
        if (t.daysLeft < 0) {
            daysText = `<span class="text-red-400 text-xs">⛔ منتهي منذ ${Math.abs(t.daysLeft)} يوم</span>`;
            statusBadge = '<span class="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">منتهي</span>';
        } else if (t.daysLeft <= 7) {
            daysText = `<span class="text-orange-400 text-xs">⚠️ متبقي ${t.daysLeft} يوم</span>`;
            statusBadge = '<span class="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-bold">ينتهي قريباً</span>';
        } else {
            daysText = `<span class="text-green-400 text-xs">✅ متبقي ${t.daysLeft} يوم</span>`;
            statusBadge = '<span class="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold">نشط</span>';
        }
    }
    if (t.isNew) statusBadge = '<span class="bg-yellow-500/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full animate-pulse font-bold">جديد</span>';
    const expiryDateStr = t.expiryDate ? new Date(t.expiryDate).toLocaleDateString('ar-EG') : 'غير محدد';
    const imgHtml = hasValidImg
        ? `<img src="${t.img}" class="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/50 shadow-md">`
        : `<div class="w-12 h-12 rounded-full border-2 border-red-500/50 bg-red-900/30 flex items-center justify-center text-red-300 font-bold text-lg shadow-md">?</div>`;
    return `
        ${imgHtml}
        <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="font-bold text-white truncate group-hover:text-yellow-400 transition-colors">${escapeHtml(t.name)}</div>
                <div class="flex gap-1.5">
                    <span class="${currentPlan.class} text-[11px] font-bold px-2 py-0.5 rounded-full" style="background:${currentPlan.color}15; color:${currentPlan.color};">${currentPlan.text}</span>
                    ${statusBadge}
                </div>
            </div>
            <div class="text-[11px] text-gray-500 font-mono mt-0.5">${teacherCode}</div>
            <div class="flex flex-wrap justify-between items-center mt-2 text-xs text-gray-400">
                <div class="flex items-center gap-1"><span>📅</span> <span class="font-mono">${expiryDateStr}</span></div>
                <div>${daysText}</div>
            </div>
        </div>
        <div class="text-yellow-500/40 group-hover:text-yellow-400 text-xs font-bold transition-colors flex items-center gap-1 self-center pr-1 select-none">
            <span>🔓</span> <span class="hidden sm:inline">محاكاة</span>
        </div>
    `;
}

// ==================================================================
// ========== دوال الصلاحيات للمساعدين (محسّنة ومفصلة) ==========
// ==================================================================

/**
 * إعادة تحميل الصلاحيات من sessionStorage وتحديث الكاش
 */
export function refreshPermissionsCache() {
    const perms = sessionStorage.getItem('assistant_permissions');
    if (perms) {
        try {
            permissionsCache = JSON.parse(perms);
        } catch(e) { permissionsCache = null; }
    } else {
        permissionsCache = null;
    }
    return permissionsCache;
}

/**
 * الحصول على صلاحيات المساعد الحالي
 */
export function getCurrentAdminPermissions() {
    if (permissionsCache) return permissionsCache;
    return refreshPermissionsCache();
}

/**
 * التحقق من صلاحية المستخدم – مع دعم المطور الكامل
 * @param {string} module - اسم الوحدة (teachers, students, ...)
 * @param {string} action - الإجراء (view, create, edit, delete, export, upload, reply, resolve, unsuspend, manage, assign, configure)
 * @returns {boolean}
 */
export function hasPermission(module, action) {
    // كود المطور الثابت
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    const ADMIN_DEV_CODE = "29910141300038";
    
    // المطور الحقيقي
    if (teacherCode === ADMIN_DEV_CODE || 
        sessionStorage.getItem('is_developer') === 'true' || 
        sessionStorage.getItem('is_admin') === 'true') {
        return true;
    }
    
    // إذا لم يكن مساعداً، لا توجد صلاحيات
    if (sessionStorage.getItem('is_assistant') !== 'true') return false;
    
    const perms = getCurrentAdminPermissions();
    if (!perms) return false;
    
    const modulePerms = perms[module];
    if (!modulePerms) return false;
    
    // إذا كان action مفقوداً، نعتبر أن view هي الأساس للتحقق من وجود الوحدة
    if (!action) return modulePerms.view === true;
    
    return modulePerms[action] === true;
}

/**
 * الحصول على جميع الصلاحيات الخاصة بوحدة معينة (كائن)
 */
export function getModulePermissions(module) {
    if (hasPermission(module, '')) {
        const perms = getCurrentAdminPermissions();
        return perms[module] || {};
    }
    return {};
}

/**
 * تطبيق الصلاحيات على عناصر الواجهة باستخدام data-perm و data-perm-disable
 */
export function applyUIPermissions() {
    // عناصر تختفي بالكامل
    document.querySelectorAll('[data-perm]').forEach(el => {
        const perm = el.getAttribute('data-perm');
        if (!perm) return;
        const [module, action] = perm.split('.');
        if (!hasPermission(module, action)) {
            el.style.display = 'none';
        } else {
            el.style.display = '';
        }
    });
    
    // عناصر يتم تعطيلها فقط
    document.querySelectorAll('[data-perm-disable]').forEach(el => {
        const perm = el.getAttribute('data-perm-disable');
        if (!perm) return;
        const [module, action] = perm.split('.');
        if (!hasPermission(module, action)) {
            el.disabled = true;
            el.classList.add('opacity-50', 'cursor-not-allowed');
            el.title = 'لا تملك صلاحية لهذا الإجراء';
        } else {
            el.disabled = false;
            el.classList.remove('opacity-50', 'cursor-not-allowed');
            el.title = '';
        }
    });
}

/**
 * أداة لعرض رسالة عدم صلاحية بشكل منسق
 */
export function showPermissionDenied(message = 'ليس لديك صلاحية للوصول إلى هذه الميزة.') {
    Swal.fire({
        icon: 'warning',
        title: 'غير مصرح',
        text: message,
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#facc15'
    });
}

/**
 * التحقق من الصلاحية وعرض رسالة إذا لم تكن موجودة، ثم إرجاع false
 */
export function checkPermission(module, action, customMessage = null) {
    if (hasPermission(module, action)) return true;
    showPermissionDenied(customMessage || `ليس لديك صلاحية ${ACTION_DESCRIPTIONS[action] || action} على وحدة ${MODULE_NAMES[module] || module}.`);
    return false;
}

// ========== تعريفات وصفية للصلاحيات والوحدات (للعرض) ==========
export const ACTION_DESCRIPTIONS = {
    view: 'العرض',
    create: 'الإضافة',
    edit: 'التعديل',
    delete: 'الحذف',
    export: 'التصدير',
    upload: 'الرفع',
    reply: 'الرد',
    resolve: 'الحل',
    unsuspend: 'رفع التعليق',
    manage: 'الإدارة الكاملة',
    assign: 'التعيين',
    configure: 'التهيئة'
};

export const MODULE_NAMES = {
    dashboard: 'لوحة المعلومات',
    teachers: 'المعلمين',
    students: 'الطلاب',
    questions: 'بنك الأسئلة',
    messages: 'المراسلات',
    violations: 'المخالفات',
    audit: 'سجل التعديلات',
    simulate: 'محاكاة المعلم',
    advanced: 'الإعدادات المتقدمة',
    assistants: 'المساعدين'
};

/**
 * الحصول على رمز أيقونة لكل صلاحية
 */
export function getActionIcon(action) {
    const icons = {
        view: '👁️',
        create: '➕',
        edit: '✏️',
        delete: '🗑️',
        export: '📤',
        upload: '📤',
        reply: '💬',
        resolve: '✅',
        unsuspend: '🔓',
        manage: '🛠️',
        assign: '👥',
        configure: '⚙️'
    };
    return icons[action] || '🔘';
}

/**
 * إخفاء عناصر غير مصرح بها بناءً على مجموعة من المحددات
 */
export function hideUnauthorizedElements(selector, module, action) {
    if (!hasPermission(module, action)) {
        document.querySelectorAll(selector).forEach(el => el.style.display = 'none');
    } else {
        document.querySelectorAll(selector).forEach(el => el.style.display = '');
    }
}