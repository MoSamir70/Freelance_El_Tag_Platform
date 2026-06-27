// src/landing/maintenance.js
import { escapeHtml } from './utils/helpers.js';

let maintenanceCache = { enabled: false, message: '', endTime: null, lastCheck: 0 };
const MAINTENANCE_CACHE_TTL = 30000;

export async function checkMaintenanceBeforeAction() {
    const now = Date.now();
    if (maintenanceCache.lastCheck && (now - maintenanceCache.lastCheck) < MAINTENANCE_CACHE_TTL) {
        return maintenanceCache.enabled ? { maintenance: true, message: maintenanceCache.message, endTime: maintenanceCache.endTime } : { maintenance: false };
    }
    
    try {
        const db = firebase.firestore();
        const maintenanceRef = db.collection('systemSettings').doc('maintenance');
        const docSnap = await maintenanceRef.get();
        
        let enabled = false, message = '', endTime = null;
        if (docSnap.exists) {
            const data = docSnap.data();
            enabled = data.enabled === true;
            message = data.message || 'المنصة تحت الصيانة حالياً. نعتذر عن الإزعاج.';
            endTime = data.endTime ? (data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime)) : null;
        }
        maintenanceCache = { enabled, message, endTime, lastCheck: now };
        if (enabled) return { maintenance: true, message, endTime };
        return { maintenance: false };
    } catch (err) {
        console.error('خطأ في فحص وضع الصيانة:', err);
        return { maintenance: false };
    }
}

export async function showMaintenanceModal(message, endTime) {
    let timeLeftHtml = '';
    if (endTime && !isNaN(endTime.getTime())) {
        const now = new Date();
        const diff = endTime - now;
        if (diff > 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (3600000)) / 60000);
            timeLeftHtml = `<p class="text-sm text-yellow-400 mt-2">⏰ الوقت المتبقي للصيانة: ${hours} ساعة ${minutes} دقيقة</p>`;
        }
    }
    await Swal.fire({
        title: '🛠️ المنصة تحت الصيانة',
        html: `<p>${escapeHtml(message)}</p>${timeLeftHtml}<p class="text-gray-400 text-sm mt-3">يرجى المحاولة لاحقاً.</p>`,
        icon: 'info',
        confirmButtonText: 'حسناً',
        allowOutsideClick: false,
        background: '#0f172a',
        color: '#fff'
    });
}

// تعريف الدوال العامة للاستخدام المباشر
window.checkMaintenanceBeforeAction = checkMaintenanceBeforeAction;
window.showMaintenanceModal = showMaintenanceModal;