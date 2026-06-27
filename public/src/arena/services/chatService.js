    // src/arena/services/chatService.js
    // خدمات الدردشة العالمية (للمعلمين فقط)

    import { db, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from '../../firebase/init.js';
    import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
    let unsubscribeChat = null;

    /**
     * بدء الاستماع الحي للدردشة العالمية
     * @param {Function} onNewMessage - (message) => {}
     * @returns {Function} دالة لإلغاء الاشتراك
     */
    export function subscribeToGlobalChat(onNewMessage) {
        if (unsubscribeChat) unsubscribeChat();
        const q = query(collection(db, 'communityChat'), orderBy('timestamp', 'desc'), limit(100));
        unsubscribeChat = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const msg = { id: change.doc.id, ...change.doc.data() };
                    onNewMessage(msg);
                }
            });
        }, (error) => {
            console.error('[ChatService] subscribe error:', error);
        });
        return () => {
            if (unsubscribeChat) unsubscribeChat();
        };
    }

    /**
     * إرسال رسالة في الدردشة العالمية (للمعلمين فقط)
     * @param {string} text - نص الرسالة
     * @returns {Promise<boolean>}
     */
    export async function sendGlobalMessage(text) {
        const user = await getCurrentUserInfo();
        if (!user || !user.isTeacher) {
            throw new Error('غير مصرح لك بالدردشة العامة');
        }
        const teacherPlan = sessionStorage.getItem('teacher_plan') || 'free';
        if (teacherPlan === 'free') {
            throw new Error('الباقة المجانية لا تسمح بالدردشة العامة');
        }
        if (!text.trim()) return false;
        await addDoc(collection(db, 'communityChat'), {
            userId: user.id,
            userName: user.name,
            userImg: user.img || '',
            userPlan: teacherPlan,
            text: text.trim(),
            timestamp: serverTimestamp(),
            role: 'teacher'
        });
        return true;
    }

    /**
     * إيقاف الاستماع عند مغادرة الصفحة
     */
    export function stopListeningToChat() {
        if (unsubscribeChat) {
            unsubscribeChat();
            unsubscribeChat = null;
        }
    }
  