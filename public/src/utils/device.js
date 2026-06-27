// utils/device.js
// توليد معرف فريد لكل جهاز/متصفح (Device ID)

/**
 * الحصول على معرف الجهاز (ينشئ جديداً إذا لم يكن موجوداً)
 * المعرف يُخزن في localStorage ليستمر بين الجلسات
 * @returns {string} - معرف الجهاز (UUID)
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    // توليد معرف جديد
    if (typeof crypto.randomUUID === 'function') {
      deviceId = crypto.randomUUID();
    } else {
      // Fallback للمتصفحات القديمة
      deviceId = Date.now() + '-' + Math.random().toString(36).substring(2, 15) + '-' + performance.now();
    }
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

/**
 * الحصول على اسم الجهاز (متصفح + نظام تشغيل) – للإستخدام التجميلي فقط
 * @returns {string} - مثل "Chrome on Windows"
 */
export function getDeviceName() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';

  // تحديد المتصفح
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera')) browser = 'Opera';

  // تحديد نظام التشغيل
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

/**
 * إعادة تعيين معرف الجهاز (يُستخدم عند تسجيل الخروج من جميع الأجهزة)
 */
export function resetDeviceId() {
  localStorage.removeItem('device_id');
}

/**
 * التحقق مما إذا كان الجهاز الحالي هو نفس الجهاز المخزن في الجلسة
 * @param {string} expectedDeviceId - معرف الجهاز المتوقع من الجلسة
 * @returns {boolean}
 */
export function isCurrentDevice(expectedDeviceId) {
  return getDeviceId() === expectedDeviceId;
}   