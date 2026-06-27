// src/arena/helpers/showToast.js
// نظام إشعارات منبثقة (Toast) بتصميم عصري

let activeToast = null;
let toastTimeout = null;

/**
 * عرض إشعار منبثق جميل
 * @param {string} message - نص الإشعار
 * @param {string} type - success, error, warning, info
 * @param {number} duration - مدة الظهور بالمللي ثانية (افتراضي 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    // إزالة أي توست موجود
    if (activeToast) {
        activeToast.remove();
        if (toastTimeout) clearTimeout(toastTimeout);
    }
    
    // إنشاء عنصر التوست
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[10000] transition-all duration-300 ease-out opacity-0 translate-y-10';
    
    // تحديد الأيقونة واللون حسب النوع
    let icon = 'ℹ️';
    let bgClass = 'bg-slate-800/95 border-blue-500/50';
    if (type === 'success') {
        icon = '✅';
        bgClass = 'bg-green-800/95 border-green-500';
    } else if (type === 'error') {
        icon = '❌';
        bgClass = 'bg-red-800/95 border-red-500';
    } else if (type === 'warning') {
        icon = '⚠️';
        bgClass = 'bg-yellow-800/95 border-yellow-500';
    }
    
    toast.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md ${bgClass} border-l-4 max-w-sm mx-4">
            <span class="text-2xl">${icon}</span>
            <p class="text-white text-sm font-medium break-words flex-1">${escapeHtml(message)}</p>
            <button class="toast-close text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
    `;
    
    document.body.appendChild(toast);
    activeToast = toast;
    
    // إظهار مع حركة
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-10');
        toast.classList.add('opacity-100', 'translate-y-0');
    }, 10);
    
    // زر الإغلاق
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        closeToast(toast);
    });
    
    // إخفاء تلقائي
    toastTimeout = setTimeout(() => {
        closeToast(toast);
    }, duration);
}

function closeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-10');
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
        if (activeToast === toast) activeToast = null;
    }, 300);
    if (toastTimeout) clearTimeout(toastTimeout);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}