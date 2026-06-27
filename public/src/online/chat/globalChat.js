// src/online/chat/globalChat.js
// الدردشة العامة – متاحة فقط للمعلمين (فضي، ذهبي، مطور)
// المعدل: إضافة فحص صريح للمعلم ومنع الطلاب تماماً

import { db, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from '../../firebase/init.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { filterProfanity } from './chatUtils.js';

let unsubscribeGlobal = null;
const GLOBAL_CHAT_LIMIT = 100;

/**
 * بدء الاستماع للدردشة العامة
 * @param {Function} onNewMessage - (message) => {}
 */
export function listenToGlobalChat(onNewMessage) {
  if (unsubscribeGlobal) unsubscribeGlobal();
  
  const q = query(collection(db, 'communityChat'), orderBy('timestamp', 'desc'), limit(GLOBAL_CHAT_LIMIT));
  unsubscribeGlobal = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        onNewMessage(change.doc.data());
      }
    });
  }, (error) => {
    console.error('[GlobalChat] Error:', error);
  });
}

/**
 * إرسال رسالة في الدردشة العامة
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function sendGlobalMessage(text) {
  const user = await getCurrentUserInfo();
  
  // ✅ منع الطلاب نهائياً
  if (!user || !user.isTeacher) {
    showFloatingNotification('الدردشة العامة متاحة للمعلمين فقط', 'error');
    return false;
  }
  
  // التحقق من خطة المعلم (مجاني ممنوع، فضي/ذهبي/مطور مسموح)
  const teacherPlan = sessionStorage.getItem('teacher_plan') || 'free';
  if (teacherPlan === 'free') {
    showFloatingNotification('الباقة المجانية لا تسمح بالدردشة العامة، يرجى الترقية', 'error');
    return false;
  }
  
  if (!text.trim()) return false;
  
  try {
    await addDoc(collection(db, 'communityChat'), {
      userId: user.id,
      userName: user.name,
      userImg: user.img || '',
      userPlan: teacherPlan,
      text: filterProfanity(text.trim()),
      timestamp: serverTimestamp(),
      role: 'teacher'
    });
    return true;
  } catch (error) {
    console.error('[GlobalChat] Send error:', error);
    showFloatingNotification('فشل إرسال الرسالة', 'error');
    return false;
  }
}

export function stopListeningToGlobalChat() {
  if (unsubscribeGlobal) {
    unsubscribeGlobal();
    unsubscribeGlobal = null;
  }
}