// src/db/indexeddb.js
// إدارة تخزين الأسئلة في IndexedDB
// [FIX] رفع الإصدار إلى 3 لضمان وجود الفهارس
// [FIX] إضافة upgradeDatabase لإدارة الترقية بين الإصدارات
// [FIX] تحسين معالجة الأخطاء وتسجيلها في Console
// [FIX] إضافة timeout لمنع تعليق العمليات

const DB_NAME = 'PeakQuestionsDB';
const DB_VERSION = 3;          // تمت الترقية إلى الإصدار 3
const STORE_NAME = 'questions';
const TIMEOUT_MS = 10000;      // 10 ثواني كحد أقصى لكل عملية

/**
 * تهيئة قاعدة البيانات (فتح أو إنشاء)
 * @returns {Promise<IDBDatabase>}
 */
export async function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        let timeoutId = setTimeout(() => {
            reject(new Error('IndexedDB initialization timeout'));
        }, TIMEOUT_MS);
        
        request.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error('[IndexedDB] Open error:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = (event) => {
            clearTimeout(timeoutId);
            const db = event.target.result;
            console.log(`[IndexedDB] Opened ${DB_NAME} v${DB_VERSION}`);
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;
            console.log(`[IndexedDB] Upgrading from version ${oldVersion} to ${DB_VERSION}`);
            
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // إنشاء مخزن جديد
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'grade' });
                store.createIndex('grade_index', 'grade', { unique: false });
                console.log('[IndexedDB] Created object store and index');
            } else if (oldVersion < 2) {
                // ترقية من الإصدار 1 إلى 2 أو أعلى: إضافة فهرس إذا لم يكن موجوداً
                const transaction = event.target.transaction;
                const store = transaction.objectStore(STORE_NAME);
                if (!store.indexNames.contains('grade_index')) {
                    store.createIndex('grade_index', 'grade', { unique: false });
                    console.log('[IndexedDB] Created grade_index during upgrade');
                }
            }
            
            // يمكن إضافة ترقيات إضافية هنا للإصدارات المستقبلية
            if (oldVersion < 3 && oldVersion >= 2) {
                // ترقية إلى الإصدار 3: التحقق من وجود الفهارس مرة أخرى (ضمان)
                const transaction = event.target.transaction;
                const store = transaction.objectStore(STORE_NAME);
                if (!store.indexNames.contains('grade_index')) {
                    store.createIndex('grade_index', 'grade', { unique: false });
                    console.log('[IndexedDB] Re-created grade_index for v3');
                }
            }
        };
    });
}

/**
 * حفظ الأسئلة لصف معين
 * @param {string} grade - اسم الصف
 * @param {Array} questions - مصفوفة الأسئلة
 * @returns {Promise<void>}
 */
export async function saveQuestionsToIndexedDB(grade, questions) {
    if (!grade || typeof grade !== 'string') {
        console.warn('[IndexedDB] Invalid grade for saving:', grade);
        return;
    }
    if (!Array.isArray(questions)) {
        console.warn('[IndexedDB] Invalid questions array');
        return;
    }
    
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put({ grade, questions });
        
        let timeoutId = setTimeout(() => {
            reject(new Error('Save operation timeout'));
        }, TIMEOUT_MS);
        
        request.onsuccess = () => {
            clearTimeout(timeoutId);
            console.log(`[IndexedDB] Saved ${questions.length} questions for grade: ${grade}`);
            resolve();
        };
        
        request.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error(`[IndexedDB] Save error for grade ${grade}:`, request.error);
            reject(request.error);
        };
        
        tx.oncomplete = () => {
            // تم بالفعل في onsuccess
        };
        tx.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error(`[IndexedDB] Transaction error:`, tx.error);
            reject(tx.error);
        };
    });
}

/**
 * تحميل الأسئلة لصف معين
 * @param {string} grade - اسم الصف
 * @returns {Promise<Array>}
 */
export async function loadQuestionsFromIndexedDB(grade) {
    if (!grade || typeof grade !== 'string') {
        console.warn(`[IndexedDB] Invalid grade provided: ${grade}, returning empty array`);
        return [];
    }
    
    try {
        const db = await initIndexedDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const getRequest = store.get(grade);
            
            let timeoutId = setTimeout(() => {
                reject(new Error('Load operation timeout'));
            }, TIMEOUT_MS);
            
            getRequest.onsuccess = () => {
                clearTimeout(timeoutId);
                const result = getRequest.result;
                const questions = result ? result.questions : [];
                console.log(`[IndexedDB] Loaded ${questions.length} questions for grade: ${grade}`);
                resolve(questions);
            };
            
            getRequest.onerror = (event) => {
                clearTimeout(timeoutId);
                console.error(`[IndexedDB] Load error for grade ${grade}:`, getRequest.error);
                reject(getRequest.error);
            };
            
            tx.onerror = (event) => {
                clearTimeout(timeoutId);
                console.error(`[IndexedDB] Transaction error:`, tx.error);
                reject(tx.error);
            };
        });
    } catch (error) {
        console.error('[IndexedDB] Load error (outer):', error);
        return [];
    }
}

/**
 * حذف جميع أسئلة صف معين
 * @param {string} grade - اسم الصف
 * @returns {Promise<void>}
 */
export async function deleteQuestionsFromIndexedDB(grade) {
    if (!grade || typeof grade !== 'string') {
        console.warn('[IndexedDB] Invalid grade for deletion:', grade);
        return;
    }
    
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const deleteRequest = store.delete(grade);
        
        let timeoutId = setTimeout(() => {
            reject(new Error('Delete operation timeout'));
        }, TIMEOUT_MS);
        
        deleteRequest.onsuccess = () => {
            clearTimeout(timeoutId);
            console.log(`[IndexedDB] Deleted questions for grade: ${grade}`);
            resolve();
        };
        
        deleteRequest.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error(`[IndexedDB] Delete error for grade ${grade}:`, deleteRequest.error);
            reject(deleteRequest.error);
        };
        
        tx.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error(`[IndexedDB] Transaction error:`, tx.error);
            reject(tx.error);
        };
    });
}

/**
 * تحميل جميع الأسئلة لكل الصفوف
 * @returns {Promise<Object>} - كائن بمفاتيح الصفوف وقيمها مصفوفات الأسئلة
 */
export async function getAllQuestionsFromIndexedDB() {
    try {
        const db = await initIndexedDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const getAllRequest = store.getAll();
            
            let timeoutId = setTimeout(() => {
                reject(new Error('GetAll operation timeout'));
            }, TIMEOUT_MS);
            
            getAllRequest.onsuccess = () => {
                clearTimeout(timeoutId);
                const all = getAllRequest.result;
                const result = {};
                all.forEach(item => {
                    if (item.grade && Array.isArray(item.questions)) {
                        result[item.grade] = item.questions;
                    }
                });
                console.log(`[IndexedDB] Loaded all data for ${Object.keys(result).length} grades`);
                resolve(result);
            };
            
            getAllRequest.onerror = (event) => {
                clearTimeout(timeoutId);
                console.error('[IndexedDB] GetAll error:', getAllRequest.error);
                reject(getAllRequest.error);
            };
            
            tx.onerror = (event) => {
                clearTimeout(timeoutId);
                console.error('[IndexedDB] Transaction error:', tx.error);
                reject(tx.error);
            };
        });
    } catch (error) {
        console.error('[IndexedDB] GetAll error (outer):', error);
        return {};
    }
}

/**
 * حذف جميع الأسئلة من جميع الصفوف (مسح كامل)
 * @returns {Promise<void>}
 */
export async function clearAllQuestionsFromIndexedDB() {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const clearRequest = store.clear();
        
        let timeoutId = setTimeout(() => {
            reject(new Error('Clear operation timeout'));
        }, TIMEOUT_MS);
        
        clearRequest.onsuccess = () => {
            clearTimeout(timeoutId);
            console.log('[IndexedDB] Cleared all questions');
            resolve();
        };
        
        clearRequest.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error('[IndexedDB] Clear error:', clearRequest.error);
            reject(clearRequest.error);
        };
        
        tx.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error('[IndexedDB] Transaction error:', tx.error);
            reject(tx.error);
        };
    });
}