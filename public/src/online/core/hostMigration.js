// src/online/core/hostMigration.js
// نقل دور المضيف تلقائياً عند تعطله (Host Migration)

import { updateDocumentWithRetry, getDocumentOnce, subscribeToDocument } from './firestoreSync.js';
import { HOST_HEARTBEAT_INTERVAL, HOST_TIMEOUT_MS } from '../constants/raceConfig.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

let heartbeatInterval = null;
let migrationCheckInterval = null;

/**
 * بدء إرسال نبضات القلب (Ping) من المستخدم الحالي إذا كان هو المضيف
 * @param {string} sessionId 
 * @returns {Promise<void>}
 */
export async function startHeartbeat(sessionId) {
  const user = await getCurrentUserInfo();
  if (!user) return;

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  heartbeatInterval = setInterval(async () => {
    const race = await getDocumentOnce(`activeRaces/${sessionId}`);
    if (!race) {
      clearInterval(heartbeatInterval);
      return;
    }
    // فقط المضيف الحالي يرسل نبضات
    if (race.hostId === user.id) {
      await updateDocumentWithRetry(`activeRaces/${sessionId}`, { lastPing: new Date() });
    }
  }, HOST_HEARTBEAT_INTERVAL);
}

/**
 * بدء مراقبة نبضات المضيف (يستمع لها جميع اللاعبين)
 * @param {string} sessionId 
 * @param {Function} onHostFailed - تستدعى عند اكتشاف فشل المضيف ونجاح الترحيل
 * @returns {Function} دالة لإلغاء المراقبة
 */
export function monitorHostHeartbeat(sessionId, onHostFailed) {
  if (migrationCheckInterval) clearInterval(migrationCheckInterval);
  
  let lastPingTime = Date.now();
  let unsubscribe = null;
  
  // اشتراك في التغييرات لمعرفة آخر ping
  unsubscribe = subscribeToDocument('activeRaces', sessionId, (race) => {
    if (!race) return;
    if (race.lastPing) {
      const pingDate = race.lastPing.toDate ? race.lastPing.toDate() : new Date(race.lastPing);
      lastPingTime = pingDate.getTime();
    }
  });
  
  // فحص دوري
  migrationCheckInterval = setInterval(async () => {
    const now = Date.now();
    if (now - lastPingTime > HOST_TIMEOUT_MS) {
      const race = await getDocumentOnce(`activeRaces/${sessionId}`);
      if (race && race.status === 'playing') {
        const user = await getCurrentUserInfo();
        // لا يقوم بالترحيل إلا إذا كان المستخدم الحالي ليس المضيف القديم
        if (user.id !== race.hostId) {
          const success = await migrateHost(sessionId, race);
          if (success && onHostFailed) onHostFailed();
        }
      }
      // إيقاف المراقبة بعد نجاح الترحيل أو فشله
      clearInterval(migrationCheckInterval);
      if (unsubscribe) unsubscribe();
    }
  }, 5000);
  
  // إرجاع دالة التنظيف
  return () => {
    clearInterval(migrationCheckInterval);
    if (unsubscribe) unsubscribe();
  };
}

/**
 * تنفيذ نقل دور المضيف إلى أول لاعب متاح
 * @param {string} sessionId 
 * @param {object} currentRace 
 * @returns {Promise<boolean>}
 */
async function migrateHost(sessionId, currentRace) {
  // البحث عن أول لاعب ليس هو المضيف القديم
  const newHost = currentRace.players.find(p => p.id !== currentRace.hostId);
  if (!newHost) return false;
  
  console.log(`[HostMigration] Migrating from ${currentRace.hostId} to ${newHost.id}`);
  
  const result = await updateDocumentWithRetry(`activeRaces/${sessionId}`, {
    hostId: newHost.id,
    migrationCount: (currentRace.migrationCount || 0) + 1,
    lastPing: new Date()
  });
  
  if (result.success) {
    showFloatingNotification(`⚠️ تم نقل دور المضيف إلى ${newHost.name} تلقائياً`, 'warning');
  }
  return result.success;
}

/**
 * إيقاف إرسال النبضات ومراقبتها
 */
export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (migrationCheckInterval) {
    clearInterval(migrationCheckInterval);
    migrationCheckInterval = null;
  }
}