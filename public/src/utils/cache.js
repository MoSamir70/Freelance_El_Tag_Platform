// utils/cache.js
// ذاكرة تخزين مؤقت بسيطة مع صلاحية زمنية (TTL)

class LocalCache {
  constructor() {
    this.store = new Map(); // key -> { value, expiry }
  }

  /**
   * تخزين قيمة في الكاش
   * @param {string} key - المفتاح
   * @param {any} value - القيمة
   * @param {number} ttl - مدة الصلاحية بالميلي ثانية (افتراضي 5 دقائق)
   */
  set(key, value, ttl = 5 * 60 * 1000) {
    const expiry = Date.now() + ttl;
    this.store.set(key, { value, expiry });
  }

  /**
   * استرجاع قيمة من الكاش
   * @param {string} key
   * @returns {any | null} - القيمة إذا كانت لا تزال صالحة، وإلا null
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * حذف مفتاح معين من الكاش
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * مسح الكاش بالكامل
   */
  clear() {
    this.store.clear();
  }

  /**
   * التحقق من وجود مفتاح صالح
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * تحديث صلاحية مفتاح موجود (تمديد العمر)
   * @param {string} key
   * @param {number} additionalTime - وقت إضافي بالميلي ثانية
   */
  renew(key, additionalTime = 2 * 60 * 1000) {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiry = Date.now() + additionalTime;
      this.store.set(key, entry);
    }
  }
}

// Singleton export
export const cache = new LocalCache();

// دوال مساعدة للاستخدام السريع
export function getCached(key) {
  return cache.get(key);
}

export function setCached(key, value, ttl) {
  cache.set(key, value, ttl);
}

export function invalidateCache(key) {
  cache.delete(key);
}

export function clearAllCache() {
  cache.clear();
}