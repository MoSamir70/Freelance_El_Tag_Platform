// src/admin/createTeacherHelper.js
// ملف مستقل لإنشاء حسابات المعلمين - يعتمد على Firebase المهيأة مسبقاً

// استيراد Firebase من الملف الرئيسي (يتم تهيئته في admin-panel.html)
import { 
    auth, db, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    doc, setDoc, collection, query, where, getDocs
} from '../firebase/init.js';
import { TEACHER_IMG } from '../config.js';

/**
 * إنشاء حساب معلم جديد
 * @param {string} teacherCode - كود المعلم الفريد
 * @param {string} teacherName - اسم المعلم
 * @param {string} plan - الخطة (free, silver, gold)
 * @param {string|null} expiryDate - تاريخ انتهاء الاشتراك
 * @returns {Promise<{success: boolean, uid?: string, error?: string}>}
 */
export async function createTeacherAccount(teacherCode, teacherName, plan = 'free', expiryDate = null) {
    console.log('[createTeacherHelper] بدء إنشاء حساب المعلم:', teacherCode, teacherName);
    
    // التحقق من وجود Firebase
    if (!db || !auth) {
        console.error('[createTeacherHelper] Firebase not initialized - db:', !!db, 'auth:', !!auth);
        // محاولة الحصول على Firebase من window كحل احتياطي
        if (window.db && window.auth) {
            console.log('[createTeacherHelper] باستخدام Firebase من window');
            window.db = db;
            window.auth = auth;
        } else {
            return { success: false, error: 'Firebase لم يتم تهيئته بشكل صحيح. يرجى تحديث الصفحة.' };
        }
    }
    
    try {
        if (!teacherCode || !teacherName) {
            return { success: false, error: 'الاسم والكود مطلوبان' };
        }
        
        // التحقق من عدم وجود الكود مسبقاً
        const codeQuery = query(collection(db, 'teacherCodes'), where('code', '==', teacherCode));
        const codeSnap = await getDocs(codeQuery);
        if (!codeSnap.empty) {
            return { success: false, error: 'هذا الكود موجود مسبقاً' };
        }
        
        // إنشاء حساب Firebase Auth
        const email = `teacher_${teacherCode}@platform.com`;
        const password = `Teacher@${teacherCode}`;
        
        let userCredential;
        try {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('[createTeacherHelper] تم إنشاء حساب Firebase:', userCredential.user.uid);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log('[createTeacherHelper] تم تسجيل الدخول إلى حساب موجود:', userCredential.user.uid);
            } else {
                throw error;
            }
        }
        
        const uid = userCredential.user.uid;
        
        // حفظ بيانات المعلم في teachers
        await setDoc(doc(db, 'teachers', uid), {
            id: teacherCode,
            code: teacherCode,
            name: teacherName,
            plan: plan,
            expiryDate: expiryDate || null,
            email: '',
            phone: '',
            img: TEACHER_IMG,
            subjects: [],
            grades: [],
            status: 'active',
            createdAt: new Date().toISOString(),
            devices: [],
            violations: [],
            isTeacher: true
        });
        
        // حفظ الكود في teacherCodes
        await setDoc(doc(db, 'teacherCodes', teacherCode), {
            code: teacherCode,
            uid: uid,
            name: teacherName,
            plan: plan,
            createdAt: new Date().toISOString()
        });
        
        console.log('[createTeacherHelper] تم إنشاء المعلم بنجاح:', teacherName);
        return { success: true, uid: uid };
        
    } catch (error) {
        console.error('[createTeacherHelper] فشل:', error);
        let errorMessage = error.message;
        if (error.code === 'auth/weak-password') errorMessage = 'كلمة المرور ضعيفة';
        else if (error.code === 'auth/invalid-email') errorMessage = 'البريد الإلكتروني غير صالح';
        else if (error.code === 'auth/operation-not-allowed') errorMessage = 'عملية غير مسموحة';
        return { success: false, error: errorMessage };
    }
}

// تسجيل الدالة في window للاستخدام العام (اختياري)
if (typeof window !== 'undefined') {
    window.createTeacherAccount = createTeacherAccount;
}