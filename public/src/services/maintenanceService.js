// src/services/maintenanceService.js
// خدمة مركزية لإدارة وضع الصيانة (Maintenance Mode)
// جميع صفحات المنصة ستستخدم هذه الدوال بدلاً من تكرار الكود

import { db, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from '../firebase/init.js';
import { cache, setCached, getCached, invalidateCache } from '../utils/cache.js';
import { addAuditLog } from './auditLog.js'; // سننشئها لاحقاً
import { ADMIN_SECRET_KEY } from '../config.js';

// الثوابت
const MAINTENANCE_DOC_PATH = 'systemSettings/maintenance'; // مستند Firestore
const CACHE_KEY = 'maintenance_state';
const CACHE_TTL = 30000; // 30 ثانية

// متغيرات المستمع الحي
let maintenanceUnsubscribe = null;
let activeCallbacks = [];

/**
 * الحصول على بيانات الصيانة من Firestore (مع كاش)
 * @returns {Promise<{enabled: boolean, message: string, endTime: Date|null, updatedAt: Date|null}>}
 */
export async function getMaintenanceData() {
  // أولاً نحاول من الكاش
  const cached = getCached(CACHE_KEY);
  if (cached) return cached;

  try {
    const docSnap = await getDoc(doc(db, MAINTENANCE_DOC_PATH));
    let data = {
      enabled: false,
      message: 'المنصة تحت الصيانة حالياً. نعتذر عن الإزعاج، يرجى المحاولة لاحقاً.',
      endTime: null,
      updatedAt: null
    };

    if (docSnap.exists()) {
      const firestoreData = docSnap.data();
      data.enabled = firestoreData.enabled === true;
      data.message = firestoreData.message || data.message;
      data.endTime = firestoreData.endTime ? firestoreData.endTime.toDate() : null;
      data.updatedAt = firestoreData.updatedAt ? firestoreData.updatedAt.toDate() : null;
    } else {
      // إنشاء المستند الافتراضي إذا لم يكن موجوداً
      await setDoc(doc(db, MAINTENANCE_DOC_PATH), {
        enabled: false,
        message: data.message,
        endTime: null,
        updatedAt: serverTimestamp()
      });
    }

    setCached(CACHE_KEY, data, CACHE_TTL);
    return data;
  } catch (error) {
    console.error('[Maintenance] خطأ في جلب بيانات الصيانة:', error);
    return { enabled: false, message: '', endTime: null, updatedAt: null };
  }
}
// دالة مساعدة لتسجيل الأحداث (بدون الاعتماد على auditLog.js)
async function logEvent(action, details) {
    console.log(`[Audit] ${action}: ${details}`);
    // محاولة استدعاء الدالة العامة إذا كانت موجودة (مثل في admin-panel.html)
    if (typeof window.addAuditLog === 'function') {
        await window.addAuditLog(action, details);
    } else if (typeof addAuditLog !== 'undefined') {
        await addAuditLog(action, details);
    }
}
/**
 * التحقق مما إذا كانت الصيانة مفعلة (دالة سريعة للفحص)
 * @returns {Promise<boolean>}
 */
export async function isMaintenanceActive() {
  const data = await getMaintenanceData();
  // إذا كان هناك وقت انتهاء محدد وانتهى، نعتبر الصيانة غير مفعلة
  if (data.enabled && data.endTime && data.endTime < new Date()) {
    // تحديث تلقائي (إيقاف الصيانة إذا انتهى الوقت)
    await disableMaintenance('system_auto');
    return false;
  }
  return data.enabled;
}

/**
 * تفعيل وضع الصيانة
 * @param {string} message - رسالة تظهر للمستخدمين
 * @param {Date|null} endTime - وقت العودة المتوقع (اختياري)
 * @param {string} adminId - معرف المطور الذي قام بالتفعيل (للتسجيل)
 * @returns {Promise<boolean>}
 */
export async function enableMaintenance(message, endTime = null, adminId = 'unknown') {
  try {
    const maintenanceRef = doc(db, MAINTENANCE_DOC_PATH);
    await setDoc(maintenanceRef, {
      enabled: true,
      message: message || 'المنصة تحت الصيانة حالياً. نعتذر عن الإزعاج.',
      endTime: endTime ? endTime : null,
      updatedAt: serverTimestamp(),
      lastActivatedBy: adminId
    }, { merge: true });

    // مسح الكاش
    invalidateCache(CACHE_KEY);
    
    // تسجيل في سجل التدقيق
    if (typeof addAuditLog === 'function') {
      await addAuditLog('تفعيل وضع الصيانة', `بواسطة ${adminId}، وقت العودة: ${endTime ? endTime.toLocaleString() : 'غير محدد'}`);
    }
    
    console.log('[Maintenance] تم تفعيل وضع الصيانة بواسطة', adminId);
    return true;
  } catch (error) {
    console.error('[Maintenance] فشل تفعيل الصيانة:', error);
    return false;
  }
}

/**
 * إلغاء وضع الصيانة
 * @param {string} adminId - معرف المطور (للتسجيل)
 * @returns {Promise<boolean>}
 */
export async function disableMaintenance(adminId = 'unknown') {
  try {
    const maintenanceRef = doc(db, MAINTENANCE_DOC_PATH);
    await updateDoc(maintenanceRef, {
      enabled: false,
      updatedAt: serverTimestamp(),
      lastDeactivatedBy: adminId
    });

    invalidateCache(CACHE_KEY);
    
    if (typeof addAuditLog === 'function') {
      await addAuditLog('إلغاء وضع الصيانة', `بواسطة ${adminId}`);
    }
    
    console.log('[Maintenance] تم إلغاء وضع الصيانة بواسطة', adminId);
    return true;
  } catch (error) {
    console.error('[Maintenance] فشل إلغاء الصيانة:', error);
    return false;
  }
}

/**
 * إعداد مستمع حي لتغييرات وضع الصيانة
 * @param {Function} callback - دالة تُستدعى عند تغيير الحالة (تستقبل {enabled, message, endTime})
 * @param {boolean} isDeveloper - هل المستخدم الحالي مطور (إذا كان مطوراً لا يتم طرده)
 * @returns {Function} دالة لإلغاء المستمع
 */
export function watchMaintenance(callback, isDeveloper = false) {
  if (maintenanceUnsubscribe) {
    // إذا كان هناك مستمع سابق، نلغيه (لضمان عدم التكرار)
    maintenanceUnsubscribe();
    maintenanceUnsubscribe = null;
  }

  // إذا كان المستخدم مطوراً، لا نراقب (لأنه متجاوز)
  if (isDeveloper) {
    console.log('[Maintenance] Developer logged in – skipping maintenance watcher');
    return () => {};
  }

  const maintenanceRef = doc(db, MAINTENANCE_DOC_PATH);
  maintenanceUnsubscribe = onSnapshot(maintenanceRef, (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    const enabled = data.enabled === true;
    const message = data.message || '';
    let endTime = data.endTime ? data.endTime.toDate() : null;
    
    // التحقق من انتهاء الوقت
    if (enabled && endTime && endTime < new Date()) {
      // إلغاء الصيانة تلقائياً (ولكننا لا نعدل المستند هنا، فقط نعتبرها غير مفعلة لهذا المستخدم)
      // نستدعي callback بحالة false
      callback({ enabled: false, message: '', endTime: null });
      return;
    }
    
    callback({ enabled, message, endTime });
    
    // إذا تم تفعيل الصيانة والمستخدم ليس مطوراً، نستدعي دالة تسجيل خروج فورية
    if (enabled && !isDeveloper) {
      console.log('[Maintenance] Maintenance mode activated – forcing logout');
      // ننادي callback ثانية مع أمر تسجيل الخروج
      callback({ enabled, message, endTime, forceLogout: true });
    }
  }, (error) => {
    console.error('[Maintenance] Error in watcher:', error);
  });

  // إرجاع دالة لإلغاء المستمع
  return () => {
    if (maintenanceUnsubscribe) {
      maintenanceUnsubscribe();
      maintenanceUnsubscribe = null;
    }
  };
}

/**
 * التحقق مما إذا كان المستخدم الحالي يستطيع تجاوز الصيانة
 * @param {string} userCode - كود المستخدم (معلم أو طالب)
 * @returns {Promise<boolean>}
 */
export async function canBypassMaintenance(userCode) {
  // 1. المطور الأساسي
  if (userCode === ADMIN_SECRET_KEY) return true;
  
  // 2. قائمة الاستثناءات (يمكن تخزينها في Firestore أو localStorage)
  try {
    const exceptionsRef = doc(db, 'systemSettings', 'maintenanceExceptions');
    const snap = await getDoc(exceptionsRef);
    if (snap.exists()) {
      const exceptions = snap.data().codes || [];
      if (exceptions.includes(userCode)) return true;
    }
  } catch(e) { /* تجاهل */ }
  
  // 3. معرفة إذا كان المستخدم مسجلاً كمطور في sessionStorage
  const isAdmin = sessionStorage.getItem('is_admin') === 'true';
  if (isAdmin) return true;
  
  return false;
}

/**
 * إضافة كود استثناء (للمطورين أو معلمين معينين)
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function addMaintenanceException(code) {
  const exceptionsRef = doc(db, 'systemSettings', 'maintenanceExceptions');
  const snap = await getDoc(exceptionsRef);
  let codes = snap.exists() ? snap.data().codes || [] : [];
  if (!codes.includes(code)) {
    codes.push(code);
    await setDoc(exceptionsRef, { codes }, { merge: true });
  }
}

/**
 * إزالة كود استثناء
 */
export async function removeMaintenanceException(code) {
  const exceptionsRef = doc(db, 'systemSettings', 'maintenanceExceptions');
  const snap = await getDoc(exceptionsRef);
  let codes = snap.exists() ? snap.data().codes || [] : [];
  codes = codes.filter(c => c !== code);
  await setDoc(exceptionsRef, { codes }, { merge: true });
}

// تصدير دوال مساعدة إضافية
export default {
  getMaintenanceData,
  isMaintenanceActive,
  enableMaintenance,
  disableMaintenance,
  watchMaintenance,
  canBypassMaintenance,
  addMaintenanceException,
  removeMaintenanceException
};