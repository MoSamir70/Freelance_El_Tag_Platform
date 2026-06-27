// src/online/chat/roomChat.js
// دردشة داخل الغرفة (تخزين في subcollection تحت activeRooms)
// يدعم الرسائل النصية مع صور المستخدمين وإشعارات الانضمام/المغادرة

import { db, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, doc, updateDoc, getDoc } from '../../firebase/init.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

let unsubscribeChat = null;
let unsubscribePresence = null;

/**
 * نظام الرسائل داخل الغرفة
 */
const ROOM_CHAT_LIMIT = 200; // الحد الأقصى للرسائل المخزنة

/**
 * بدء الاستماع لدردشة غرفة معينة
 * @param {string} roomId 
 * @param {Function} onNewMessage - (message) => {}
 * @param {Function} onPresenceUpdate - (user, action) => {} اختياري (user joined/left)
 */
export function listenToRoomChat(roomId, onNewMessage, onPresenceUpdate) {
  if (unsubscribeChat) unsubscribeChat();
  
  const chatRef = collection(db, 'activeRooms', roomId, 'chat');
  const q = query(chatRef, orderBy('timestamp', 'asc'), limit(ROOM_CHAT_LIMIT));
  
  unsubscribeChat = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const msg = change.doc.data();
        onNewMessage(msg);
      }
    });
  }, (error) => {
    console.error('[RoomChat] Error:', error);
  });

  // مراقبة الحضور في الغرفة (من يغادر/ينضم)
  if (onPresenceUpdate) {
    const presenceRef = collection(db, 'activeRooms', roomId, 'presence');
    const qPresence = query(presenceRef, orderBy('lastSeen', 'desc'));
    unsubscribePresence = onSnapshot(qPresence, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        if (change.type === 'added') {
          onPresenceUpdate(data, 'joined');
        } else if (change.type === 'removed') {
          onPresenceUpdate(data, 'left');
        } else if (change.type === 'modified' && data.online === false) {
          onPresenceUpdate(data, 'left');
        }
      });
    });
  }
}

/**
 * إرسال رسالة نصية في الغرفة
 * @param {string} roomId 
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function sendRoomMessage(roomId, text) {
  const user = await getCurrentUserInfo();
  if (!user || !text.trim()) return false;
  
  const chatRef = collection(db, 'activeRooms', roomId, 'chat');
  try {
    await addDoc(chatRef, {
      userId: user.id,
      userName: user.name,
      userImg: user.img || '',
      text: text.trim(),
      timestamp: serverTimestamp(),
      isTeacher: user.isTeacher || false,
      role: user.isTeacher ? 'teacher' : 'student'
    });
    return true;
  } catch (error) {
    console.error('[RoomChat] Send error:', error);
    showFloatingNotification('فشل إرسال الرسالة', 'error');
    return false;
  }
}

/**
 * إرسال إشعار انضمام/مغادرة (رسالة نظام)
 * @param {string} roomId 
 * @param {string} type - 'join' أو 'leave'
 */

export async function sendSystemMessage(roomId, type) {
  const user = await getCurrentUserInfo();
  if (!user) return;
  
  const chatRef = collection(db, 'activeRooms', roomId, 'chat');
  const text = type === 'join' ? `🎉 انضم ${user.name} إلى الغرفة` : `👋 غادر ${user.name} الغرفة`;
  
  await addDoc(chatRef, {
    userId: 'system',
    userName: 'النظام',
    userImg: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    text,
    timestamp: serverTimestamp(),
    isSystem: true,
    isTeacher: false
  });
}

/**
 * تحديث حضور المستخدم في الغرفة (يُستدعى عند الدخول)
 * @param {string} roomId 
 */
export async function updateUserPresence(roomId) {
  const user = await getCurrentUserInfo();
  if (!user) return;
  
  const presenceRef = doc(db, 'activeRooms', roomId, 'presence', user.id);
  await updateDoc(presenceRef, {
    userId: user.id,
    name: user.name,
    img: user.img || '',
    online: true,
    lastSeen: serverTimestamp()
  }, { merge: true });
}

/**
 * إزالة حضور المستخدم (يُستدعى عند المغادرة)
 * @param {string} roomId 
 */
export async function removeUserPresence(roomId) {
  const user = await getCurrentUserInfo();
  if (!user) return;
  
  const presenceRef = doc(db, 'activeRooms', roomId, 'presence', user.id);
  await updateDoc(presenceRef, { online: false, lastSeen: serverTimestamp() });
}

export function stopListeningToRoomChat() {
  if (unsubscribeChat) {
    unsubscribeChat();
    unsubscribeChat = null;
  }
  if (unsubscribePresence) {
    unsubscribePresence();
    unsubscribePresence = null;
  }
}