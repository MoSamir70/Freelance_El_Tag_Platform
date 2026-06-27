import { db, doc, onSnapshot, getDoc } from '../firebase/init.js';
import { escapeHtml } from '../utils/helpers/dom.js';

let maintenanceUnsubscribe = null;
let maintenanceLogoutTimer = null;

async function showMaintenanceModalAndScheduleLogout(message, endTime, isDeveloper) {
    if (isDeveloper) return;
    if (document.getElementById('maintenance-alert-shown')) return;

    let timeLeftHtml = '';
    if (endTime && !isNaN(endTime.getTime())) {
        const diff = endTime - new Date();
        if (diff > 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (3600000)) / 60000);
            timeLeftHtml = `<p class="text-sm text-yellow-400 mt-2">⏰ الوقت المتبقي للصيانة: ${hours} ساعة ${minutes} دقيقة</p>`;
        }
    }

    const marker = document.createElement('div');
    marker.id = 'maintenance-alert-shown';
    marker.style.display = 'none';
    document.body.appendChild(marker);

    await Swal.fire({
        title: '🛠️ المنصة تحت الصيانة',
        html: `<div dir="rtl">
                 <p>${escapeHtml(message)}</p>
                 ${timeLeftHtml}
                 <p class="text-red-400 mt-3">⚠️ سيتم تسجيل خروجك تلقائياً خلال 30 ثانية.</p>
               </div>`,
        icon: 'warning',
        confirmButtonText: 'تسجيل الخروج الآن',
        allowOutsideClick: false,
        allowEscapeKey: false,
        background: '#0f172a',
        color: '#fff',
        timer: 30000,
        timerProgressBar: true,
        didOpen: () => {
            maintenanceLogoutTimer = setTimeout(() => {
                performMaintenanceLogout();
            }, 30000);
        },
        willClose: () => {
            if (maintenanceLogoutTimer) clearTimeout(maintenanceLogoutTimer);
        }
    }).then((result) => {
        if (result.isConfirmed) {
            if (maintenanceLogoutTimer) clearTimeout(maintenanceLogoutTimer);
            performMaintenanceLogout();
        }
    });
}

async function performMaintenanceLogout() {
    if (maintenanceUnsubscribe) {
        maintenanceUnsubscribe();
        maintenanceUnsubscribe = null;
    }
    if (typeof window.logout === 'function') {
        await window.logout();
    } else {
        sessionStorage.clear();
        window.location.href = 'index.html?maintenance=true';
    }
}

export function setupMaintenanceWatcher(teacherCode, isDeveloper) {
    if (maintenanceUnsubscribe) {
        maintenanceUnsubscribe();
        maintenanceUnsubscribe = null;
    }
    if (isDeveloper) {
        console.log('[Maintenance] Developer logged in – skipping maintenance watcher');
        return;
    }

    const maintenanceRef = doc(db, 'systemSettings', 'maintenance');
    maintenanceUnsubscribe = onSnapshot(maintenanceRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        if (data.enabled === true) {
            const message = data.message || 'المنصة تحت الصيانة حالياً. نعتذر عن الإزعاج.';
            let endTime = data.endTime ? (data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime)) : null;
            showMaintenanceModalAndScheduleLogout(message, endTime, false);
        }
    }, (error) => {
        console.error('[Maintenance] Error in watcher:', error);
    });
}

export async function checkMaintenanceOnLoad(teacherCode, isDeveloper) {
    if (isDeveloper) return true;

    try {
        const maintenanceRef = doc(db, 'systemSettings', 'maintenance');
        const docSnap = await getDoc(maintenanceRef);
        if (docSnap.exists() && docSnap.data().enabled === true) {
            const data = docSnap.data();
            await showMaintenanceModalAndScheduleLogout(data.message, data.endTime, false);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[Maintenance] Check on load error:', err);
        return true;
    }
}

// نافذة انتهاء الاشتراك
export function showExpiredModal() {
    const modal = document.getElementById('expired-subscription-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.pointerEvents = 'none';
        document.body.style.opacity = '0.8';
        
        let logoutBtnInModal = document.getElementById('expired-logout-btn');
        if (!logoutBtnInModal) {
            const btn = document.createElement('button');
            btn.id = 'expired-logout-btn';
            btn.innerText = 'تسجيل الخروج';
            btn.className = 'bg-red-600 px-6 py-2 rounded-full font-bold mt-4';
            btn.onclick = () => {
                if (typeof window.logout === 'function') window.logout();
                else window.location.href = 'index.html';
            };
            modal.querySelector('.glass-panel')?.appendChild(btn);
        }
    } else {
        Swal.fire({
            title: '⚠️ انتهت صلاحية الاشتراك',
            text: 'انتهت صلاحية اشتراكك في المنصة. يرجى التواصل مع المطور للتجديد.',
            icon: 'error',
            confirmButtonText: 'تسجيل الخروج',
            allowOutsideClick: false,
            background: '#0f172a',
            color: '#fff'
        }).then(() => {
            if (typeof window.logout === 'function') window.logout();
            else window.location.href = 'index.html';
        });
    }
}