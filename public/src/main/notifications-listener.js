import { db, collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from '../firebase/init.js';

let notificationsUnsubscribe = null;

export async function setupNotificationsListener(teacherId) {
    if (!teacherId) return;
    if (notificationsUnsubscribe) notificationsUnsubscribe();
    
    const q = query(collection(db, 'globalNotifications'), orderBy('timestamp', 'desc'));
    notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const notif = { id: change.doc.id, ...change.doc.data() };
                const hasRead = notif.readBy && notif.readBy.includes(teacherId);
                if (!hasRead) {
                    await Swal.fire({
                        title: '📢 إشعار جديد من الإدارة',
                        text: notif.message,
                        icon: 'info',
                        confirmButtonText: 'حسناً',
                        background: '#0f172a',
                        color: '#fff',
                        allowOutsideClick: false
                    });
                    const notifRef = doc(db, 'globalNotifications', notif.id);
                    await updateDoc(notifRef, {
                        readBy: arrayUnion(teacherId)
                    });
                }
            }
        });
    }, (error) => {
        console.error('خطأ في الاستماع للإشعارات:', error);
    });
}