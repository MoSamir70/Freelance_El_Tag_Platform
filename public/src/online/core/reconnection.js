// src/online/core/reconnection.js
// استعادة الجلسة بعد فقدان الاتصال (Reconnection)

import { getDocumentOnce, subscribeToDocument } from './firestoreSync.js';
import { RACE_STATUS } from '../constants/raceConfig.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

/**
 * محاولة استعادة جلسة سباق بعد انقطاع الشبكة
 * @param {string} sessionId 
 * @returns {Promise<{success: boolean, raceData: object|null, message: string}>}
 */
export async function restoreRaceSession(sessionId) {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race) {
    return { success: false, raceData: null, message: 'السباق غير موجود أو انتهى' };
  }
  
  const user = await getCurrentUserInfo();
  if (!user) {
    return { success: false, raceData: null, message: 'يجب تسجيل الدخول أولاً' };
  }
  
  // التحقق من أن المستخدم مشارك في السباق
  const isPlayer = race.players.some(p => p.id === user.id);
  const isSpectator = race.spectators?.some(s => s.id === user.id);
  if (!isPlayer && !isSpectator) {
    return { success: false, raceData: null, message: 'أنت لست مشاركاً في هذا السباق' };
  }
  
  if (race.status === RACE_STATUS.FINISHED) {
    return { success: false, raceData: null, message: 'السباق قد انتهى بالفعل' };
  }
  
  return { success: true, raceData: race, message: 'تم استعادة الجلسة بنجاح' };
}

/**
 * إعادة الاتصال التلقائي مع إعادة تشغيل المستمعات
 * @param {string} sessionId 
 * @param {Function} onRestored - تستدعى بعد الاستعادة (تستقبل raceData)
 * @param {number} maxAttempts - أقصى عدد محاولات
 * @param {number} intervalMs - الفاصل بين المحاولات
 */
export async function autoReconnect(sessionId, onRestored, maxAttempts = 5, intervalMs = 3000) {
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    const { success, raceData, message } = await restoreRaceSession(sessionId);
    if (success) {
      clearInterval(interval);
      showFloatingNotification(message, 'success');
      if (onRestored) onRestored(raceData);
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      showFloatingNotification(message, 'error');
      // توجيه إلى الصفحة الرئيسية بعد 2 ثانية
      setTimeout(() => {
        window.location.href = 'platform.html';
      }, 2000);
    }
  }, intervalMs);
}

/**
 * مراقبة حالة الاتصال بالشبكة وتفعيل إعادة الاتصال تلقائياً عند العودة
 * @param {string} sessionId 
 * @param {Function} onOnline - تستدعى عند عودة النت واستعادة الجلسة
 */
export function watchNetworkAndReconnect(sessionId, onOnline) {
  let wasOffline = false;
  
  const handleOnline = async () => {
    if (wasOffline) {
      showFloatingNotification('تم استعادة الاتصال بالإنترنت، جاري إعادة الاتصال...', 'info');
      const { success, raceData, message } = await restoreRaceSession(sessionId);
      if (success) {
        showFloatingNotification(message, 'success');
        if (onOnline) onOnline(raceData);
      } else {
        showFloatingNotification(message, 'error');
      }
      wasOffline = false;
    }
  };
  
  const handleOffline = () => {
    wasOffline = true;
    showFloatingNotification('انقطع الاتصال بالإنترنت، جاري محاولة إعادة الاتصال...', 'warning');
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // إرجاع دالة لإزالة المستمعين
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}