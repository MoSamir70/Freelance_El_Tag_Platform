// utils/crypto.js
// تشفير وفك تشفير البيانات الحساسة باستخدام Web Crypto API (AES-GCM)

/**
 * تحويل النص إلى ArrayBuffer
 */
function strToBuffer(str) {
  return new TextEncoder().encode(str);
}

/**
 * تحويل ArrayBuffer إلى نص
 */
function bufferToStr(buffer) {
  return new TextDecoder().decode(buffer);
}

/**
 * توليد مفتاح تشفير من كلمة مرور (teacherCode) باستخدام PBKDF2
 * @param {string} password - كلمة المرور (مثل كود المعلم)
 * @param {Uint8Array} salt - ملح عشوائي
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * تشفير نص باستخدام مفتاح مشتق من كلمة مرور + ملح عشوائي
 * @param {string} plaintext - النص المراد تشفيره
 * @param {string} password - كلمة المرور (teacherCode)
 * @returns {Promise<string>} - النص المشفر بصيغة base64 (salt+iv+ciphertext)
 */
export async function encryptWithPassword(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encoded = strToBuffer(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoded
  );
  // دمج الملح + IV + النص المشفر في كائن واحد ثم تحويله إلى base64
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * فك تشفير نص مشفر باستخدام نفس كلمة المرور
 * @param {string} ciphertextBase64 - النص المشفر (بصيغة base64)
 * @param {string} password - كلمة المرور (teacherCode)
 * @returns {Promise<string>} - النص الأصلي
 */
export async function decryptWithPassword(ciphertextBase64, password) {
  const combined = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );
  return bufferToStr(decrypted);
}

/**
 * توقيع بيانات باستخدام HMAC-SHA256 (للتحقق من سلامة sessionStorage)
 * @param {string} data - البيانات المراد توقيعها
 * @param {string} secret - مفتاح سري (مشتق من teacherCode أو جلسة)
 * @returns {Promise<string>} - التوقيع بصيغة hex
 */
export async function signData(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * التحقق من توقيع البيانات
 * @param {string} data - البيانات الأصلية
 * @param {string} signature - التوقيع المراد التحقق منه
 * @param {string} secret - المفتاح السري
 * @returns {Promise<boolean>}
 */
export async function verifySignature(data, signature, secret) {
  const expected = await signData(data, secret);
  return expected === signature;
}