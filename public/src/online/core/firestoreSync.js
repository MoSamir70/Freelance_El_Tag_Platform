// src/online/core/firestoreSync.js
// دوال موحدة للتعامل مع Firestore مع إعادة المحاولة والاشتراك الحي
// ✅ تم إصلاح createDocumentWithRetry: setDoc لا ترجع docRef

import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from '../../firebase/init.js';

// ========== الدوال الأساسية ==========

/**
 * قراءة مستند واحد مع إعادة المحاولة
 * @param {string} path - مسار المستند (مثل 'activeRooms/room123')
 * @param {number} retries - عدد محاولات إعادة المحاولة
 * @returns {Promise<Object|null>}
 */
export async function getDocumentOnce(path, retries = 3) {
  let lastError = null;
  for (let i = 0; i < retries; i++) {
    try {
      const docRef = doc(db, path);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    } catch (error) {
      lastError = error;
      console.warn(`[firestoreSync] getDocumentOnce attempt ${i + 1} failed for ${path}:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  console.error(`[firestoreSync] getDocumentOnce failed after ${retries} attempts for ${path}`, lastError);
  return null;
}

/**
 * إنشاء مستند جديد مع إعادة المحاولة (يتم إنشاء ID تلقائي)
 * ✅ تم إصلاح الخطأ: setDoc لا ترجع docRef
 * @param {string} collectionName - اسم المجموعة
 * @param {Object} data - البيانات
 * @param {number} retries - عدد المحاولات
 * @returns {Promise<{success: boolean, id?: string, error?: any}>}
 */
export async function createDocumentWithRetry(collectionName, data, retries = 3) {
  let lastError = null;
  for (let i = 0; i < retries; i++) {
    try {
      const collectionRef = collection(db, collectionName);
      const docRef = doc(collectionRef);  // إنشاء مرجع المستند أولاً
      await setDoc(docRef, data);         // حفظ البيانات
      return { success: true, id: docRef.id };
    } catch (error) {
      lastError = error;
      console.warn(`[firestoreSync] createDocument attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  return { success: false, error: lastError };
}

/**
 * تحديث مستند موجود مع إعادة المحاولة
 * @param {string} path - مسار المستند
 * @param {Object} updates - الحقول المراد تحديثها
 * @param {number} retries - عدد المحاولات
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function updateDocumentWithRetry(path, updates, retries = 3) {
  let lastError = null;
  for (let i = 0; i < retries; i++) {
    try {
      const docRef = doc(db, path);
      await updateDoc(docRef, { ...updates, lastUpdated: serverTimestamp() });
      return { success: true };
    } catch (error) {
      lastError = error;
      console.warn(`[firestoreSync] updateDocument attempt ${i + 1} failed for ${path}:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  return { success: false, error: lastError };
}

/**
 * حذف مستند مع إعادة المحاولة
 * @param {string} path - مسار المستند
 * @param {number} retries - عدد المحاولات
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function deleteDocumentWithRetry(path, retries = 3) {
  let lastError = null;
  for (let i = 0; i < retries; i++) {
    try {
      const docRef = doc(db, path);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error) {
      lastError = error;
      console.warn(`[firestoreSync] deleteDocument attempt ${i + 1} failed for ${path}:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  return { success: false, error: lastError };
}

/**
 * الاشتراك المباشر بمستند واحد (onSnapshot)
 * @param {string} collectionName - اسم المجموعة
 * @param {string} docId - معرف المستند
 * @param {Function} onData - callback(data) عند التغيير
 * @param {Function} onError - callback(error)
 * @returns {Function} دالة إلغاء الاشتراك
 */
export function subscribeToDocument(collectionName, docId, onData, onError = null) {
  const docRef = doc(db, collectionName, docId);
  const unsubscribe = onSnapshot(docRef, 
    (snapshot) => {
      if (snapshot.exists()) {
        onData({ id: snapshot.id, ...snapshot.data() });
      } else {
        onData(null);
      }
    },
    (error) => {
      console.error(`[firestoreSync] subscribeToDocument error for ${collectionName}/${docId}:`, error);
      if (onError) onError(error);
      else onData(null);
    }
  );
  return unsubscribe;
}

/**
 * الاشتراك المباشر بمجموعة كاملة مع شروط
 * @param {string} collectionName 
 * @param {Array} constraints - مصفوفة من where, orderBy, limit
 * @param {Function} onData - callback(array)
 * @param {Function} onError 
 * @returns {Function}
 */
export function subscribeToCollection(collectionName, constraints, onData, onError = null) {
  let q = collection(db, collectionName);
  if (constraints && constraints.length) {
    q = query(q, ...constraints);
  }
  const unsubscribe = onSnapshot(q,
    (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onData(results);
    },
    (error) => {
      console.error(`[firestoreSync] subscribeToCollection error for ${collectionName}:`, error);
      if (onError) onError(error);
      else onData([]);
    }
  );
  return unsubscribe;
}

// ========== دوال مساعدة إضافية ==========

/**
 * جلب مستندات من مجموعة مع شروط (مرة واحدة)
 * @param {string} collectionName 
 * @param {Array} constraints 
 * @returns {Promise<Array>}
 */
export async function getDocumentsOnce(collectionName, constraints = []) {
  let q = collection(db, collectionName);
  if (constraints.length) {
    q = query(q, ...constraints);
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * تنفيذ عمليات متعددة في Batch
 * @param {Array} operations - [{ type: 'set'|'update'|'delete', path, data }]
 * @returns {Promise<boolean>}
 */
export async function executeBatch(operations) {
  const batch = writeBatch(db);
  for (const op of operations) {
    const ref = doc(db, op.path);
    if (op.type === 'set') batch.set(ref, op.data, { merge: true });
    else if (op.type === 'update') batch.update(ref, op.data);
    else if (op.type === 'delete') batch.delete(ref);
    else throw new Error(`Unknown batch operation: ${op.type}`);
  }
  await batch.commit();
  return true;
}