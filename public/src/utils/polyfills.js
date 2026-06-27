// utils/polyfills.js
// توافق مع المتصفحات القديمة (polyfills)
// [FIX] تم إزالة simpleEncrypt و simpleDecrypt لأسباب أمنية

/**
 * إضافة دالة randomUUID إلى crypto إذا لم تكن موجودة
 * مصدر الخوارزمية: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
 */
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

/**
 * إضافة دالة getRandomValues إذا لزم الأمر
 * بعض المتصفحات القديمة لا تدعم crypto.getRandomValues بشكل كامل
 */
if (typeof crypto !== 'undefined' && !crypto.getRandomValues) {
  crypto.getRandomValues = function(array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

/**
 * التحقق من وجود Web Crypto API (AES-GCM قد لا يكون مدعوماً في بعض البيئات غير الآمنة)
 */
export function isSecureContextAvailable() {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' && 
         crypto.subtle !== null &&
         window.isSecureContext === true;
}

// ===================== ⚠️ تم إزالة simpleEncrypt و simpleDecrypt لأسباب أمنية ⚠️ =====================
// لا تستخدم أبداً XOR مع btoa للتشفير – فهو ليس آمناً ويمكن فكه بسهولة.
// إذا كنت بحاجة إلى تشفير حقيقي، استخدم الدوال في crypto.js (AES-GCM) مع HTTPS.
// بالنسبة للتطوير المحلي، يمكنك تخزين البيانات بدون تشفير.

/**
 * @deprecated تم إزالة هذه الدالة لأنها غير آمنة. استخدم encryptWithPassword من crypto.js بدلاً منها.
 */
export function simpleEncrypt(text, key) {
  console.warn('⚠️ simpleEncrypt تم إزالتها لأسباب أمنية. استخدم encryptWithPassword من crypto.js بدلاً من ذلك.');
  return text; // إرجاع النص كما هو (للتطوير فقط)
}

/**
 * @deprecated تم إزالة هذه الدالة لأنها غير آمنة. استخدم decryptWithPassword من crypto.js بدلاً منها.
 */
export function simpleDecrypt(encoded, key) {
  console.warn('⚠️ simpleDecrypt تم إزالتها لأسباب أمنية. استخدم decryptWithPassword من crypto.js بدلاً من ذلك.');
  try {
    // محاولة فك التشفير بطريقة بسيطة فقط للتوافق مع البيانات القديمة (إن وجدت)
    const text = atob(encoded);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch(e) {
    return encoded;
  }
}

console.log('✅ Polyfills: تم تحميل التوافق للمتصفحات القديمة (مع إزالة التشفير غير الآمن)');