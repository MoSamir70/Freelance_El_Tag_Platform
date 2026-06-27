import { db, collection, doc, query, orderBy, getDocs, writeBatch, arrayUnion } from '../firebase/init.js';
import { escapeHtml } from '../utils/helpers/dom.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';

export async function showNotificationsList() {
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    if (!teacherId) {
        showFloatingNotification('يجب تسجيل الدخول كمعلم', 'error');
        return;
    }
    const q = query(collection(db, 'globalNotifications'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const unread = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(n => !(n.readBy && n.readBy.includes(teacherId)));
    if (unread.length === 0) {
        Swal.fire('📭 لا توجد إشعارات جديدة', '', 'info');
        return;
    }
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    unread.forEach(n => {
        const time = n.timestamp?.toDate().toLocaleString() || 'تاريخ غير معروف';
        html += `<div style="border-bottom:1px solid #444; padding:8px; margin-bottom:8px;">
                    <div style="color:#facc15;">📢 ${time}</div>
                    <div>${escapeHtml(n.message)}</div>
                 </div>`;
    });
    html += '</div>';
    await Swal.fire({
        title: '📬 الإشعارات الجديدة',
        html: html,
        confirmButtonText: 'تحديد كمقروء',
        background: '#0f172a',
        color: '#fff'
    });
    const batch = writeBatch(db);
    unread.forEach(n => {
        const ref = doc(db, 'globalNotifications', n.id);
        batch.update(ref, { readBy: arrayUnion(teacherId) });
    });
    await batch.commit();
    await updateUnreadNotificationsCount();
}

export async function updateUnreadNotificationsCount() {
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    if (!teacherId) return;
    const q = query(collection(db, 'globalNotifications'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const unreadCount = snapshot.docs.filter(doc => {
        const data = doc.data();
        return !(data.readBy && data.readBy.includes(teacherId));
    }).length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}