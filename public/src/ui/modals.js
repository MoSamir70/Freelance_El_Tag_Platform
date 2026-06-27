// ===================== src/ui/modals.js =====================
// دوال النوافذ المنبثقة العامة (في حال احتجنا أي نافذة إضافية – أغلبها موجود في ملفات أخرى)
// هذا الملف اختياري، لكن نضيفه للاكتمال.

import { showFloatingNotification } from '../utils.js';

// مثال: نافذة تأكيد عامة
export function showConfirmDialog(title, message, onConfirm) {
    Swal.fire({
        title,
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم',
        cancelButtonText: 'إلغاء',
        background: '#0f172a',
        color: '#fff'
    }).then(result => {
        if (result.isConfirmed && onConfirm) onConfirm();
    });
}

// نافذة إدخال نص
export async function showPromptDialog(title, placeholder = '') {
    const { value } = await Swal.fire({
        title,
        input: 'text',
        inputPlaceholder: placeholder,
        showCancelButton: true,
        confirmButtonText: 'تأكيد',
        cancelButtonText: 'إلغاء',
        background: '#0f172a',
        color: '#fff'
    });
    return value;
}

// نافذة رسالة خطأ سريعة
export function showErrorDialog(message) {
    Swal.fire({
        title: 'خطأ',
        text: message,
        icon: 'error',
        confirmButtonText: 'حسناً',
        background: '#0f172a',
        color: '#fff'
    });
}