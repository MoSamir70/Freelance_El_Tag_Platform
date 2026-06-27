// src/online/chat/chatUtils.js
// دوال مساعدة لتنسيق الرسائل وتصفية المحتوى

/**
 * تنسيق نص الرسالة (تحويل الروابط إلى روابط قابلة للنقر، إلخ)
 * @param {string} text 
 * @returns {string}
 */
export function formatMessageText(text) {
  if (!text) return '';
  
  // تحويل الروابط
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let formatted = text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 underline">${url}</a>`);
  
  // تحويل الإيموجي النصي (اختياري)
  formatted = formatted.replace(/:\)/g, '😊').replace(/:\(/g, '😞').replace(/:D/g, '😃');
  
  return formatted;
}

/**
 * فلترة الكلمات البذيئة (قائمة سوداء بسيطة)
 * @param {string} text 
 * @returns {string} النص المنقى
 */
export function filterProfanity(text) {
  const blacklist = ['كسم', 'كس اختك', 'عير', 'منيك', 'قحبة']; // أضف ما تشاء
  let filtered = text;
  blacklist.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  return filtered;
}

/**
 * التحقق من صحة الرسالة قبل الإرسال
 * @param {string} text 
 * @returns {{valid: boolean, message?: string}}
 */
export function validateMessage(text) {
  if (!text || text.trim().length === 0) {
    return { valid: false, message: 'الرسالة فارغة' };
  }
  if (text.trim().length > 500) {
    return { valid: false, message: 'الرسالة طويلة جداً (الحد الأقصى 500 حرف)' };
  }
  const filtered = filterProfanity(text);
  if (filtered !== text) {
    return { valid: false, message: 'الرسالة تحتوي على كلمات غير لائقة' };
  }
  return { valid: true };
}