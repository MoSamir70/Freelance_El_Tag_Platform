// src/config.js
// إعدادات Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyCRhVgP-p2a3AGm7_W6kps7atkzUpq4uJk",
  authDomain: "al-taj-platform-test.firebaseapp.com",
  projectId: "al-taj-platform-test",
  storageBucket: "al-taj-platform-test.firebasestorage.app",
  messagingSenderId: "981800916722",
  appId: "1:981800916722:web:2a5e4cd356dc7c343ca26b",
  measurementId: "G-BXVZFEPX6R"
};

export const DEFAULT_IMG = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
export const TEACHER_IMG = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

// ========== تشفير قوي لكود المطور (AES-GCM + PBKDF2) ==========
// ✅ تم تحديث القيم بالقيم الحقيقية المولدة
const encryptedData = {
  iv: "QWuaK0A9wIk3LV8w",
  ciphertext: "muBTXlNNt8CvS2lCFmccsUGYTD1xCvL9V0l/e3s0"
};

let _decryptedKey = null;

async function deriveKey(password, salt) {
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
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function decryptAdminKey() {
  if (_decryptedKey) return _decryptedKey;
  try {
    const password = "Al-Taj-Platform-2026-Secret-Key";
    const salt = "taj-salt-2026";
    const key = await deriveKey(password, salt);
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encryptedData.ciphertext), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );
    _decryptedKey = new TextDecoder().decode(decrypted);
    return _decryptedKey;
  } catch (err) {
    console.error('❌ فشل فك تشفير كود المطور:', err);
    return null;
  }
}

// قيمة مؤقتة للتوافق (سيتم تحديثها بعد فك التشفير)
export let ADMIN_SECRET_KEY = "29910141300038";

// فك التشفير التلقائي عند تحميل الملف
decryptAdminKey().then(key => {
  if (key) {
    ADMIN_SECRET_KEY = key;
    console.log('✅ تم فك تشفير كود المطور بنجاح');
  }
}).catch(err => console.error(err));

// دالة للاستخدام غير المتزامن (في حال كنت بحاجة للانتظار)
export async function getAdminSecretKey() {
  return await decryptAdminKey();
}