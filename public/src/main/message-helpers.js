import { db, collection, doc, getDocs, addDoc, query, where, serverTimestamp } from '../firebase/init.js';

const messagesCollection = collection(db, 'messages');

export async function getTeacherMessages() {
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    if (!teacherId) return [];
    const q = query(messagesCollection, where('to', 'in', [teacherId, 'admin', 'all']), where('from', 'in', [teacherId, 'admin']));
    const snapshot = await getDocs(q);
    let messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    messages.sort((a,b) => (b.timestamp?.toMillis?.() || b.timestamp) - (a.timestamp?.toMillis?.() || a.timestamp));
    return messages;
}

export async function sendTeacherMessage(subject, content) {
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    const teacherName = sessionStorage.getItem('peak_teacher_name') || 'معلم';
    if (!teacherId || !subject || !content) return false;
    await addDoc(messagesCollection, {
        from: teacherId, fromName: teacherName, to: 'admin',
        subject, content, timestamp: serverTimestamp(), read: false
    });
    updateUnreadCount();
    return true;
}

export async function updateUnreadCount() {
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    if (!teacherId) return;
    const q = query(messagesCollection, where('to', '==', teacherId), where('read', '==', false));
    const snapshot = await getDocs(q);
    const unread = snapshot.size;
    const badge = document.getElementById('unread-badge');
    if (badge) {
        if (unread > 0) {
            badge.innerText = unread > 9 ? '9+' : unread;
            badge.classList.remove('hidden');
        } else badge.classList.add('hidden');
    }
}