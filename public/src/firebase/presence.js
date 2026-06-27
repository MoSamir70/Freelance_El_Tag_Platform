// src/firebase/presence.js
// نظام تتبع المتصلين (Presence) باستخدام Firestore
// الإصدار المعدل لدعم التبويبات المتعددة

import { db, collection, doc, getDocs, query, where, setDoc, updateDoc, onSnapshot, serverTimestamp } from './init.js';
import { getCurrentUserInfo } from './auth.js';

let presenceInterval = null;
let currentTabId = null;

/**
 * بدء جلسة الحضور للمستخدم الحالي
 * يتم استدعاؤها بعد تسجيل الدخول مباشرة
 */
export async function startPresence() {
    const user = await getCurrentUserInfo();
    if (!user) return;

    // إنشاء معرف فريد لهذا التبويب
    if (!currentTabId) {
        currentTabId = crypto.randomUUID();
        sessionStorage.setItem('presence_tab_id', currentTabId);
    } else {
        currentTabId = sessionStorage.getItem('presence_tab_id');
    }

    const userRef = doc(db, 'userPresence', user.id);
    
    await setDoc(userRef, {
        userId: user.id,
        name: user.name,
        img: user.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        role: user.isTeacher ? 'teacher' : 'student',
        online: true,
        tabId: currentTabId,
        lastSeen: serverTimestamp()
    }, { merge: true });

    // تنظيف أي فاصل سابق
    if (presenceInterval) clearInterval(presenceInterval);
    
    // تحديث lastSeen كل دقيقة (لإبقاء الجلسة حية) فقط إذا كان التبويب مرئياً
    presenceInterval = setInterval(async () => {
        if (document.visibilityState === 'visible') {
            // تحقق أن هذا التبويب لا يزال هو المسجل
            const docSnap = await getDoc(userRef);
            if (docSnap.exists() && docSnap.data().tabId === currentTabId) {
                await updateDoc(userRef, { lastSeen: serverTimestamp() });
            }
        }
    }, 60000);

    // عند إغلاق الصفحة أو الخروج، نغير الحالة إلى غير متصل فقط إذا كان هذا التبويب هو المسؤول
    window.addEventListener('beforeunload', async () => {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().tabId === currentTabId) {
            await updateDoc(userRef, { online: false, lastSeen: serverTimestamp() });
        }
    });
    
    // مراقبة تغيير رؤية التبويب
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            // أصبح مرئياً: تحديث lastSeen وتأكيد أنه لا يزال متصلاً
            const docSnap = await getDoc(userRef);
            if (docSnap.exists() && docSnap.data().tabId === currentTabId) {
                await updateDoc(userRef, { online: true, lastSeen: serverTimestamp() });
            }
        } else {
            // أصبح مخفياً: لا نغير online إلى false فوراً، بل نترك interval يتعامل
            // يمكننا فقط تحديث lastSeen
            const docSnap = await getDoc(userRef);
            if (docSnap.exists() && docSnap.data().tabId === currentTabId) {
                await updateDoc(userRef, { lastSeen: serverTimestamp() });
            }
        }
    });
}

/**
 * إيقاف جلسة الحضور (عند تسجيل الخروج)
 */
export async function stopPresence() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
    const user = await getCurrentUserInfo();
    if (user && currentTabId) {
        const userRef = doc(db, 'userPresence', user.id);
        // نتحقق من tabId قبل التحديث
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().tabId === currentTabId) {
            await updateDoc(userRef, { online: false, lastSeen: serverTimestamp() });
        }
    }
}

/**
 * الحصول على قائمة المستخدمين المتصلين حالياً (استعلام لمرة واحدة)
 */
export async function getOnlineUsers() {
    const q = query(collection(db, 'userPresence'), where('online', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * الاستماع الحي للمستخدمين المتصلين (للواجهات الديناميكية)
 * @param {Function} callback - دالة تستقبل مصفوفة المستخدمين
 * @returns {Function} دالة لإلغاء الاشتراك
 */
export function subscribeToOnlineUsers(callback) {
    const q = query(collection(db, 'userPresence'), where('online', '==', true));
    return onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(users);
    });
}