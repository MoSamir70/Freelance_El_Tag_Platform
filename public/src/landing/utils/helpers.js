// src/landing/utils/helpers.js

/**
 * هروب النص لمنع XSS
 */
export function escapeHtml(str) {
    if (!str) return '';
    const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, function(m) {
        return escapeMap[m];
    });
}

/**
 * عرض إشعار عائم
 */
export function showFloatingNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 left-1/2 transform -translate-x-1/2 z-[10000] px-6 py-3 rounded-xl text-white font-bold shadow-2xl transition-all duration-300 animate-bounce ${
        type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-purple-600'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * تحريك الأرقام من 0 إلى القيمة المستهدفة
 */
export function animateNumber(element, target, duration = 2000) {
    if (!element) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
            element.textContent = target.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(start).toLocaleString();
        }
    }, 16);
}

// تعريف دوال عامة للاستخدام المباشر في HTML
window.escapeHtml = escapeHtml;
window.showFloatingNotification = showFloatingNotification;
window.animateNumber = animateNumber;