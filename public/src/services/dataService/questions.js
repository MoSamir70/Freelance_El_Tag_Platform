// src/services/dataService/questions.js
// إدارة الأسئلة (جلب، حفظ، حذف، مزامنة)
// [FIX] إضافة دوال مساعدة داخلية (getCurrentTeacherId, escapeHtml)
// [FIX] تحسين معالجة الأخطاء في getQuestions و saveQuestions
// [FIX] إضافة syncQuestionsFromFirebase لمزامنة جميع الصفوف
// [FIX] إضافة getAllQuestions

import { db, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from '../../firebase/init.js';
import { loadQuestionsFromIndexedDB, saveQuestionsToIndexedDB, deleteQuestionsFromIndexedDB, getAllQuestionsFromIndexedDB } from '../../db/indexeddb.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

// ========== دوال مساعدة داخلية ==========
function getCurrentTeacherId() {
    // محاولة الحصول على معرف المعلم من sessionStorage أو localStorage
    const teacherCode = sessionStorage.getItem('peak_teacher_code') || localStorage.getItem('peak_teacher_code');
    const isAdmin = sessionStorage.getItem('is_admin') === 'true' || localStorage.getItem('is_admin') === 'true';
    if (isAdmin) return 'admin_super';
    return teacherCode || null;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

/**
 * جلب الأسئلة لصف معين
 * @param {string} grade - اسم الصف
 * @returns {Promise<Array>}
 */
export async function getQuestions(grade) {
    if (!grade || typeof grade !== 'string') {
        console.warn('[getQuestions] Invalid grade:', grade);
        return [];
    }
    
    try {
        // أولاً: محاولة التحميل من IndexedDB (سريع)
        const localQuestions = await loadQuestionsFromIndexedDB(grade);
        if (localQuestions && localQuestions.length > 0) {
            console.log(`[getQuestions] Loaded ${localQuestions.length} questions from IndexedDB for ${grade}`);
            return localQuestions;
        }
        
        // ثانياً: إذا لم توجد محلياً، نحاول من Firestore
        const teacherId = getCurrentTeacherId();
        if (teacherId) {
            const docRef = doc(db, 'questions', grade);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const firestoreData = docSnap.data();
                const questions = firestoreData.questions || [];
                // تخزين في IndexedDB للاستخدام المستقبلي
                if (questions.length > 0) {
                    await saveQuestionsToIndexedDB(grade, questions);
                    console.log(`[getQuestions] Synced ${questions.length} questions from Firestore to IndexedDB for ${grade}`);
                }
                return questions;
            }
        }
        
        // ثالثاً: إذا كان المطور (admin) يحاول الوصول
        const isAdmin = sessionStorage.getItem('is_admin') === 'true';
        if (isAdmin) {
            const adminDocRef = doc(db, 'questions', `admin_${grade}`);
            const adminDocSnap = await getDoc(adminDocRef);
            if (adminDocSnap.exists()) {
                const questions = adminDocSnap.data().questions || [];
                if (questions.length > 0) {
                    await saveQuestionsToIndexedDB(grade, questions);
                }
                return questions;
            }
        }
        
        return [];
    } catch (error) {
        console.error(`[getQuestions] Failed to load for grade ${grade}:`, error);
        // محاولة أخيرة: إعادة المحاولة من IndexedDB (قد يكون هناك بيانات قديمة)
        try {
            const fallback = await loadQuestionsFromIndexedDB(grade);
            return fallback || [];
        } catch(e) {
            return [];
        }
    }
}

/**
 * حفظ الأسئلة لصف معين (في IndexedDB و Firestore)
 * @param {string} grade - اسم الصف
 * @param {Array} questions - مصفوفة الأسئلة
 * @returns {Promise<void>}
 */
export async function saveQuestions(grade, questions) {
    if (!grade || typeof grade !== 'string') {
        console.warn('[saveQuestions] Invalid grade');
        return;
    }
    if (!Array.isArray(questions)) {
        console.warn('[saveQuestions] Invalid questions array');
        return;
    }
    
    try {
        // حفظ في IndexedDB أولاً
        await saveQuestionsToIndexedDB(grade, questions);
        console.log(`[saveQuestions] Saved ${questions.length} questions to IndexedDB for ${grade}`);
        
        // مزامنة مع Firestore إذا كان المستخدم معلماً أو مطوراً
        const teacherId = getCurrentTeacherId();
        if (teacherId) {
            const isAdmin = teacherId === 'admin_super' || sessionStorage.getItem('is_admin') === 'true';
            const docRef = doc(db, 'questions', isAdmin ? `admin_${grade}` : grade);
            await setDoc(docRef, {
                grade,
                questions,
                teacherId: teacherId,
                updatedAt: new Date().toISOString()
            });
            console.log(`[saveQuestions] Synced to Firestore for ${grade}`);
        }
        
        showFloatingNotification(`تم حفظ ${questions.length} سؤال للصف ${escapeHtml(grade)}`, 'success');
    } catch (error) {
        console.error(`[saveQuestions] Failed to save for grade ${grade}:`, error);
        showFloatingNotification(`فشل حفظ الأسئلة للصف ${escapeHtml(grade)}`, 'error');
        throw error;
    }
}

/**
 * حذف جميع أسئلة صف معين
 * @param {string} grade - اسم الصف
 * @returns {Promise<void>}
 */
export async function deleteQuestions(grade) {
    if (!grade || typeof grade !== 'string') {
        console.warn('[deleteQuestions] Invalid grade');
        return;
    }
    
    try {
        // حذف من IndexedDB
        await deleteQuestionsFromIndexedDB(grade);
        console.log(`[deleteQuestions] Deleted from IndexedDB for ${grade}`);
        
        // حذف من Firestore
        const teacherId = getCurrentTeacherId();
        if (teacherId) {
            const isAdmin = teacherId === 'admin_super' || sessionStorage.getItem('is_admin') === 'true';
            const docRef = doc(db, 'questions', isAdmin ? `admin_${grade}` : grade);
            await deleteDoc(docRef);
            console.log(`[deleteQuestions] Deleted from Firestore for ${grade}`);
        }
        
        showFloatingNotification(`تم حذف أسئلة الصف ${escapeHtml(grade)}`, 'success');
    } catch (error) {
        console.error(`[deleteQuestions] Failed to delete for grade ${grade}:`, error);
        showFloatingNotification(`فشل حذف أسئلة الصف ${escapeHtml(grade)}`, 'error');
        throw error;
    }
}

/**
 * مزامنة جميع الأسئلة من Firestore إلى IndexedDB
 * (يُستخدم بعد تسجيل الدخول أو عند الحاجة للتحديث)
 * @returns {Promise<Object>} - كائن يحتوي على عدد الأسئلة لكل صف
 */
export async function syncQuestionsFromFirebase() {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) {
        console.warn('[syncQuestionsFromFirebase] No teacher logged in');
        return {};
    }
    
    const isAdmin = teacherId === 'admin_super' || sessionStorage.getItem('is_admin') === 'true';
    const prefix = isAdmin ? 'admin_' : '';
    
    try {
        // جلب جميع وثائق الأسئلة من Firestore (تبدأ بـ grade)
        const questionsCollection = collection(db, 'questions');
        const querySnapshot = await getDocs(questionsCollection);
        
        const results = {};
        for (const docSnap of querySnapshot.docs) {
            const docId = docSnap.id;
            let grade = docId;
            if (docId.startsWith('admin_')) {
                if (!isAdmin) continue; // فقط المدير يمكنه قراءة admin_*
                grade = docId.replace('admin_', '');
            }
            const data = docSnap.data();
            if (data.questions && Array.isArray(data.questions) && (data.teacherId === teacherId || isAdmin)) {
                await saveQuestionsToIndexedDB(grade, data.questions);
                results[grade] = data.questions.length;
                console.log(`[syncQuestionsFromFirebase] Synced ${data.questions.length} questions for grade ${grade}`);
            }
        }
        
        showFloatingNotification(`تمت مزامنة الأسئلة من السحاب (${Object.keys(results).length} صف)`, 'success');
        return results;
    } catch (error) {
        console.error('[syncQuestionsFromFirebase] Failed:', error);
        showFloatingNotification('فشلت المزامنة من السحاب', 'error');
        return {};
    }
}

/**
 * الحصول على جميع الأسئلة من جميع الصفوف (من IndexedDB)
 * @returns {Promise<Object>}
 */
export async function getAllQuestions() {
    try {
        return await getAllQuestionsFromIndexedDB();
    } catch (error) {
        console.error('[getAllQuestions] Failed:', error);
        return {};
    }
}