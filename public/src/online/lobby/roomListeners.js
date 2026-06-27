// src/online/lobby/roomListeners.js
// مستمعات الغرفة لتحديث واجهة المستخدم تلقائياً عند تغيير البيانات
// ✅ الإصدار المعدل: تعطيل نظام الحضور (presence) مؤقتاً لحل مشكلة اختفاء اللوبي

import { subscribeToDocument } from '../core/firestoreSync.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
// import { startRoomPresence, stopRoomPresence, sendPresenceNotification } from '../presence/presenceManager.js'; // معطل مؤقتاً
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

let currentRoomUnsubscribe = null;

/**
 * بدء الاستماع إلى غرفة معينة (لوبي أو سباق)
 * ✅ تم تعطيل نظام الحضور (presence) لمنع فشل الاشتراك
 * @param {string} roomId 
 * @param {Function} onRoomUpdate - تستقبل كائن الغرفة (أو null إذا حُذفت)
 * @param {Function} onError 
 * @returns {Promise<Function>} دالة لإلغاء الاشتراك
 */
export async function listenToRoom(roomId, onRoomUpdate, onError = null) {
  // تنظيف أي مستمعات سابقة
  if (currentRoomUnsubscribe) {
    currentRoomUnsubscribe();
    currentRoomUnsubscribe = null;
  }

  // 1. الاشتراك في تحديثات الغرفة نفسها
  const unsubscribeRoom = subscribeToDocument('activeRooms', roomId, (roomData) => {
    if (!roomData) {
      onRoomUpdate(null);
      return;
    }
    onRoomUpdate(roomData);
  }, (error) => {
    console.error('[roomListeners] Error in room subscription:', error);
    if (onError) onError(error);
    else onRoomUpdate(null);
  });

  currentRoomUnsubscribe = unsubscribeRoom;

  // ✅ تم تعطيل نظام الحضور (presence) مؤقتاً لحل مشكلة اختفاء اللوبي
  // سيتم إعادة تفعيله لاحقاً بعد إصلاح قواعد Firebase أو تعديل presenceManager.js
  
  /*
  // 2. تفعيل نظام الحضور في هذه الغرفة (معطل حالياً)
  const user = await getCurrentUserInfo();
  if (user) {
    try {
      const cleanupPresence = await startRoomPresence(roomId, async (users) => {
        // تحديث الواجهة بالحضور (يمكن إضافته لاحقاً)
      });
      currentPresenceCleanup = cleanupPresence;
      await sendPresenceNotification(roomId, user.name, 'join');
    } catch (err) {
      console.warn('[roomListeners] Failed to start presence (disabled temporarily):', err);
      // لا نرمي الخطأ لضمان عمل اللوبي
    }
  }
  */

  // إرجاع دالة تنظيف شاملة
  return async () => {
    if (currentRoomUnsubscribe) {
      currentRoomUnsubscribe();
      currentRoomUnsubscribe = null;
    }
    /*
    if (currentPresenceCleanup) {
      await currentPresenceCleanup();
      currentPresenceCleanup = null;
    }
    const currentUser = await getCurrentUserInfo();
    if (currentUser && roomId) {
      await sendPresenceNotification(roomId, currentUser.name, 'leave');
    }
    */
  };
}

/**
 * إلغاء الاستماع إلى الغرفة الحالية
 */
export async function stopListeningToRoom() {
  if (currentRoomUnsubscribe) {
    currentRoomUnsubscribe();
    currentRoomUnsubscribe = null;
  }
  /*
  if (currentPresenceCleanup) {
    await currentPresenceCleanup();
    currentPresenceCleanup = null;
  }
  */
}

/**
 * الحصول على قائمة الغرف المتاحة للطالب (الغرف التي أنشأها معلمه فقط)
 * @param {Function} callback - تستقبل مصفوفة الغرف
 * @returns {Function}
 */
export function listenToAvailableRoomsForStudent(callback) {
  import('../../firebase/init.js').then(({ db, collection, onSnapshot, query, where }) => {
    (async () => {
      const user = await getCurrentUserInfo();
      if (!user || user.isTeacher) {
        callback([]);
        return;
      }
      const teacherId = user.teacherId;
      if (!teacherId) {
        callback([]);
        return;
      }
      const q = query(collection(db, 'activeRooms'), where('teacherId', '==', teacherId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(rooms);
      }, (error) => {
        console.error('Error listening to rooms:', error);
        callback([]);
      });
      // لا نعيد unsubscribe هنا لأنه سيتم استدعاؤها من الخارج
    })();
  });
  return () => {}; // مؤقت
}