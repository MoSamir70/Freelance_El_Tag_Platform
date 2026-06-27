// src/online/presence/presenceManager.js
// نظام إدارة الحضور (Presence) للمستخدمين (معلمين وطلاب)
// + دوال إدارة الحضور داخل الغرفة (Room Presence)

import { db, doc, setDoc, updateDoc, getDoc, collection, query, where, onSnapshot, serverTimestamp, getDocs, addDoc } from '../../firebase/init.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

let presenceUnsubscribe = null;
let heartbeatInterval = null;
let currentUserPresenceRef = null;

// ========== دوال الحضور العامة (Global Presence) ==========

/**
 * بدء جلسة الحضور للمستخدم الحالي
 * يتم استدعاؤها بعد تسجيل الدخول مباشرة
 */
export async function startPresence() {
  const user = await getCurrentUserInfo();
  if (!user) return;

  currentUserPresenceRef = doc(db, 'userPresence', user.id);
  
  await setDoc(currentUserPresenceRef, {
    userId: user.id,
    name: user.name,
    img: user.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    role: user.isTeacher ? 'teacher' : 'student',
    teacherId: user.isTeacher ? null : (user.teacherId || null),
    grade: user.isTeacher ? null : (user.grade || null),
    online: true,
    lastSeen: serverTimestamp(),
    currentRoom: null,
    currentRace: null
  }, { merge: true });

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(async () => {
    if (document.visibilityState === 'visible') {
      await updateDoc(currentUserPresenceRef, { lastSeen: serverTimestamp() });
    }
  }, 30000);

  window.addEventListener('beforeunload', () => {
    if (currentUserPresenceRef) {
      updateDoc(currentUserPresenceRef, { online: false, lastSeen: serverTimestamp() }).catch(console.error);
    }
  });
}

/**
 * إيقاف جلسة الحضور (عند تسجيل الخروج)
 */
export async function stopPresence() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  const user = await getCurrentUserInfo();
  if (user && currentUserPresenceRef) {
    await updateDoc(currentUserPresenceRef, { online: false, lastSeen: serverTimestamp() });
  }
  if (presenceUnsubscribe) {
    presenceUnsubscribe();
    presenceUnsubscribe = null;
  }
}

/**
 * تحديث موقع المستخدم الحالي (الغرفة أو السباق)
 */
export async function updateUserLocation(roomId = null, raceId = null) {
  const user = await getCurrentUserInfo();
  if (!user || !currentUserPresenceRef) return;
  await updateDoc(currentUserPresenceRef, {
    currentRoom: roomId,
    currentRace: raceId,
    lastSeen: serverTimestamp()
  });
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
 * الاستماع الحي للمستخدمين المتصلين (للوحات الجانبية)
 */
export function subscribeToOnlineUsers(callback) {
  if (presenceUnsubscribe) presenceUnsubscribe();
  const q = query(collection(db, 'userPresence'), where('online', '==', true));
  presenceUnsubscribe = onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  });
  return () => {
    if (presenceUnsubscribe) {
      presenceUnsubscribe();
      presenceUnsubscribe = null;
    }
  };
}

/**
 * الحصول على آخر ظهور لمستخدم معين
 */
export async function getLastSeen(userId) {
  const ref = doc(db, 'userPresence', userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const lastSeen = snap.data().lastSeen;
    return lastSeen?.toDate ? lastSeen.toDate() : (lastSeen ? new Date(lastSeen) : null);
  }
  return null;
}

/**
 * التحقق مما إذا كان المستخدم متصلاً حالياً
 */
export async function isUserOnline(userId) {
  const ref = doc(db, 'userPresence', userId);
  const snap = await getDoc(ref);
  return snap.exists() && snap.data().online === true;
}

// ========== دوال الحضور داخل الغرفة (Room Presence) - جديدة ==========

/**
 * بدء تتبع الحضور في غرفة محددة
 * @param {string} roomId 
 * @param {Function} onPresenceChange - (users) => {} حيث users مصفوفة المستخدمين المتصلين حالياً في الغرفة
 * @returns {Promise<Function>} دالة لإلغاء الاشتراك
 */
export async function startRoomPresence(roomId, onPresenceChange) {
  const user = await getCurrentUserInfo();
  if (!user) return () => {};

  const userPresenceRef = doc(db, 'activeRooms', roomId, 'presence', user.id);
  
  // تعيين الحضور كمتصل
  await setDoc(userPresenceRef, {
    userId: user.id,
    name: user.name,
    img: user.img || '',
    online: true,
    lastSeen: serverTimestamp(),
    role: user.isTeacher ? 'teacher' : 'student'
  }, { merge: true });

  // الاستماع للتغييرات في حضور الغرفة
  const presenceCollectionRef = collection(db, 'activeRooms', roomId, 'presence');
  const unsubscribe = onSnapshot(presenceCollectionRef, (snapshot) => {
    const users = snapshot.docs.map(doc => doc.data());
    if (onPresenceChange) onPresenceChange(users);
  });

  // معالج عند إغلاق الصفحة أو التنقل بعيداً
  const handleBeforeUnload = () => {
    updateDoc(userPresenceRef, { online: false, lastSeen: serverTimestamp() }).catch(console.error);
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  // دالة التنظيف التي يتم استدعاؤها عند مغادرة الغرفة
  return async () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    await updateDoc(userPresenceRef, { online: false, lastSeen: serverTimestamp() });
    unsubscribe();
  };
}
/**
 * إيقاف تتبع الحضور في الغرفة (مغادرة الغرفة)
 * @param {string} roomId 
 * @param {string} userId 
 */
export async function stopRoomPresence(roomId, userId) {
  if (!roomId || !userId) return;
  try {
    const userPresenceRef = doc(db, 'activeRooms', roomId, 'presence', userId);
    await updateDoc(userPresenceRef, { online: false, lastSeen: serverTimestamp() });
  } catch (e) {
    // تجاهل إذا كانت الوثيقة غير موجودة
  }
}

/**
 * إرسال إشعار حضور (انضمام/مغادرة) داخل الغرفة عبر الدردشة
 * @param {string} roomId 
 * @param {string} userName 
 * @param {string} type - 'join' أو 'leave'
 */
export async function sendPresenceNotification(roomId, userName, type) {
  // استيراد دالة إرسال الرسائل من دردشة الغرفة (تجنب الاعتماد الدائري)
  const { sendRoomMessage } = await import('../chat/roomChat.js');
  const message = type === 'join' ? `🎉 انضم ${userName} إلى الغرفة` : `👋 غادر ${userName} الغرفة`;
  await sendRoomMessage(roomId, message);
}

/**
 * الحصول على قائمة المتصلين حالياً في الغرفة (استعلام لمرة واحدة)
 * @param {string} roomId 
 * @returns {Promise<Array>}
 */
export async function getRoomOnlineUsers(roomId) {
  const presenceRef = collection(db, 'activeRooms', roomId, 'presence');
  const q = query(presenceRef, where('online', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}