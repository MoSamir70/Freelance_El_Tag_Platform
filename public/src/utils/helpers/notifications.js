// src/utils/helpers/notifications.js
// نظام إشعارات متطور وجذاب للمنصة
// يدعم RTL، أيقونات، شريط تقدم، وتأثيرات حركية

let notificationContainer = null;
let notificationCounter = 0;

// أيقونات حسب النوع
const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
};

// ألوان الخلفية (بدرجات شفافة)
const bgColors = {
    success: 'rgba(34, 197, 94, 0.15)',
    error: 'rgba(239, 68, 68, 0.15)',
    warning: 'rgba(245, 158, 11, 0.15)',
    info: 'rgba(59, 130, 246, 0.15)'
};

// ألوان الحدود
const borderColors = {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
};

function ensureContainer() {
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'taj-notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            left: auto;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 380px;
            width: calc(100% - 40px);
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);
    }
    return notificationContainer;
}

/**
 * عرض إشعار عائم
 * @param {string} message - نص الإشعار
 * @param {string} type - نوع الإشعار (success, error, warning, info)
 * @param {number} duration - مدة الظهور بالمللي ثانية (افتراضي 4000)
 * @param {boolean} showCloseButton - عرض زر إغلاق
 * @returns {string} معرف الإشعار (لإزالته يدوياً)
 */
export function showFloatingNotification(message, type = 'info', duration = 4000, showCloseButton = true) {
    if (!message) return;
    
    const container = ensureContainer();
    const id = `notif_${Date.now()}_${notificationCounter++}`;
    
    // إنشاء عنصر الإشعار
    const notification = document.createElement('div');
    notification.id = id;
    notification.style.cssText = `
        position: relative;
        background: ${bgColors[type]};
        backdrop-filter: blur(12px);
        border-right: 4px solid ${borderColors[type]};
        border-radius: 16px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05);
        transform: translateX(calc(100% + 20px));
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);
        pointer-events: auto;
        font-family: 'Cairo', 'Tajawal', sans-serif;
        direction: rtl;
    `;
    
    // الأيقونة
    const iconSpan = document.createElement('span');
    iconSpan.textContent = icons[type] || icons.info;
    iconSpan.style.fontSize = '1.4rem';
    iconSpan.style.flexShrink = '0';
    
    // النص
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    textSpan.style.fontSize = '0.9rem';
    textSpan.style.fontWeight = '500';
    textSpan.style.color = '#fff';
    textSpan.style.lineHeight = '1.4';
    textSpan.style.flex = '1';
    textSpan.style.wordBreak = 'break-word';
    
    // زر الإغلاق (اختياري)
    let closeBtn = null;
    if (showCloseButton) {
        closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #aaa;
            font-size: 1rem;
            cursor: pointer;
            padding: 4px;
            margin: -4px;
            transition: color 0.2s;
            flex-shrink: 0;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.color = '#fff';
        closeBtn.onmouseleave = () => closeBtn.style.color = '#aaa';
        closeBtn.onclick = () => removeNotification(id);
    }
    
    notification.appendChild(iconSpan);
    notification.appendChild(textSpan);
    if (closeBtn) notification.appendChild(closeBtn);
    
    // شريط التقدم (المدة)
    if (duration > 0 && !showCloseButton) { // إذا كان هناك زر إغلاق، شريط التقدم اختياري أو يمكن إضافته أيضاً
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: ${borderColors[type]};
            border-radius: 0 0 16px 16px;
            transform-origin: right;
            animation: shrink ${duration}ms linear forwards;
        `;
        notification.appendChild(progressBar);
        
        // إضافة keyframes إذا لم تكن موجودة
        if (!document.querySelector('#taj-notif-keyframes')) {
            const style = document.createElement('style');
            style.id = 'taj-notif-keyframes';
            style.textContent = `
                @keyframes shrink {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    container.appendChild(notification);
    
    // تحريك للداخل
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);
    
    // إزالة تلقائية بعد المدة
    if (duration > 0) {
        setTimeout(() => {
            removeNotification(id);
        }, duration);
    }
    
    return id;
}

/**
 * إزالة إشعار معين
 * @param {string} id 
 */
export function removeNotification(id) {
    const notification = document.getElementById(id);
    if (!notification) return;
    notification.style.transform = 'translateX(calc(100% + 20px))';
    notification.style.opacity = '0';
    setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
    }, 300);
}

/**
 * إزالة جميع الإشعارات
 */
export function clearAllNotifications() {
    if (notificationContainer) {
        notificationContainer.innerHTML = '';
    }
}

// دالة مساعدة لعرض إشعارات بأسلوب أسهل (اختصارات)
export const notifySuccess = (msg, duration = 3000) => showFloatingNotification(msg, 'success', duration);
export const notifyError = (msg, duration = 4000) => showFloatingNotification(msg, 'error', duration);
export const notifyWarning = (msg, duration = 3500) => showFloatingNotification(msg, 'warning', duration);
export const notifyInfo = (msg, duration = 3000) => showFloatingNotification(msg, 'info', duration);