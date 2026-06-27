// جلب وتحديث بيانات المعلم من Firestore
import { db, collection, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp } from '../../firebase/init.js';
import { getPlanDetails, DEVELOPER_CODE } from './plans.js';
import { getCached, setCached, invalidateCache } from '../../utils/cache.js';

const SUBSCRIPTION_CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

// الحصول على وثيقة المعلم باستخدام الكود
export async function getTeacherDocumentByCode(teacherCode) {
    const q = query(collection(db, 'teachers'), where('code', '==', teacherCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { ref: docSnap.ref, data: docSnap.data() };
}

// الحصول على خطة المعلم مع كاش (المستخدمة في أغلب الدوال)
export async function getTeacherSubscription(teacherCode) {
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    if (teacherCode === DEVELOPER_CODE || isAdmin) {
        const gold = getPlanDetails('GOLD');
        return {
            plan: 'gold',
            expiryDate: null,
            allowedSubject: null,
            totalQuestionsCount: 0,
            onlineRoomsUsedThisMonth: 0,
            subjectChangeCount: 0,
            lastResetDate: null,
            lockedSubject: null,
            maxStudents: gold.maxStudents,
            maxQuestions: gold.maxQuestions,
            maxOnlineGamesPerMonth: gold.maxOnlineGamesPerMonth
        };
    }

    const cacheKey = `teacher_sub_${teacherCode}`;
    let cached = getCached(cacheKey);
    if (cached) {
        if (cached.expiryDate && new Date(cached.expiryDate) < new Date()) {
            invalidateCache(cacheKey);
            cached = null;
        } else {
            return cached;
        }
    }

    try {
        const teacherDoc = await getTeacherDocumentByCode(teacherCode);
        if (teacherDoc) {
            const teacherData = teacherDoc.data;
            let plan = teacherData.plan || 'free';
            const expiryDate = teacherData.expiryDate ? new Date(teacherData.expiryDate) : null;
            if (expiryDate && expiryDate < new Date()) {
                plan = 'free';
                await updateDoc(teacherDoc.ref, { plan: 'free' });
                sessionStorage.setItem('teacher_plan', 'free');
                // إشعار (يمكن استيراده لاحقاً)
                if (typeof showFloatingNotification === 'function') {
                    showFloatingNotification('⚠️ انتهت صلاحية اشتراكك، تم تحويلك إلى الباقة المجانية', 'warning');
                }
            }
            const planDetails = getPlanDetails(plan);
            const subscription = {
                plan: plan,
                expiryDate: teacherData.expiryDate || null,
                allowedSubject: teacherData.subjects?.[0] || null,
                totalQuestionsCount: teacherData.totalQuestionsCount || 0,
                onlineRoomsUsedThisMonth: teacherData.onlineRoomsUsedThisMonth || 0,
                subjectChangeCount: teacherData.subjectChangeCount || 0,
                lastResetDate: teacherData.lastResetDate || null,
                lockedSubject: teacherData.lockedSubject || null,
                maxStudents: planDetails.maxStudents,
                maxQuestions: planDetails.maxQuestions,
                maxOnlineGamesPerMonth: planDetails.maxOnlineGamesPerMonth
            };
            setCached(cacheKey, subscription, SUBSCRIPTION_CACHE_TTL);
            return subscription;
        }
    } catch (error) {
        console.error('[getTeacherSubscription] Error:', error);
    }
    const freePlan = getPlanDetails('FREE');
    return {
        plan: 'free',
        expiryDate: null,
        allowedSubject: null,
        totalQuestionsCount: 0,
        onlineRoomsUsedThisMonth: 0,
        subjectChangeCount: 0,
        lastResetDate: null,
        lockedSubject: null,
        maxStudents: freePlan.maxStudents,
        maxQuestions: freePlan.maxQuestions,
        maxOnlineGamesPerMonth: freePlan.maxOnlineGamesPerMonth
    };
}

// تحديث خطة المعلم (للإدارة)
export async function updateTeacherSubscription(teacherCode, subscriptionData) {
    try {
        const teacherDoc = await getTeacherDocumentByCode(teacherCode);
        if (!teacherDoc) return { success: false, error: 'المعلم غير موجود' };
        await updateDoc(teacherDoc.ref, {
            plan: subscriptionData.plan,
            expiryDate: subscriptionData.expiryDate || null,
            updatedAt: serverTimestamp()
        });
        invalidateTeacherSubscriptionCache(teacherCode);
        return { success: true };
    } catch (error) {
        console.error('[updateTeacherSubscription] Error:', error);
        return { success: false, error: error.message };
    }
}

// إبطال كاش الخطة
export function invalidateTeacherSubscriptionCache(teacherCode) {
    const cacheKey = `teacher_sub_${teacherCode}`;
    invalidateCache(cacheKey);
}

// الحصول على المادة المقفلة للمعلم
export async function getLockedSubject(teacherCode) {
    const sub = await getTeacherSubscription(teacherCode);
    return sub.lockedSubject || null;
}

// تعيين المادة المقفلة (للخطط الفضية والمجانية)
export async function setLockedSubject(teacherCode, subject) {
    const teacherDoc = await getTeacherDocumentByCode(teacherCode);
    if (teacherDoc) {
        await updateDoc(teacherDoc.ref, { lockedSubject: subject });
        invalidateTeacherSubscriptionCache(teacherCode);
        sessionStorage.setItem('teacher_locked_subject', subject);
    }
}

// تحديث عدد الأسئلة الإجمالي للمعلم
export async function updateTeacherTotalQuestions(teacherCode, delta) {
    const teacherDoc = await getTeacherDocumentByCode(teacherCode);
    if (teacherDoc) {
        const current = teacherDoc.data.totalQuestionsCount || 0;
        await updateDoc(teacherDoc.ref, { totalQuestionsCount: current + delta });
        invalidateTeacherSubscriptionCache(teacherCode);
        sessionStorage.setItem('teacher_total_questions', current + delta);
    }
}

// تحديث الخطة إذا انتهت صلاحيتها (تُستدعى قبل التحقق من الصلاحيات)
export async function refreshTeacherPlanIfExpired(teacherCode) {
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    if (teacherCode === DEVELOPER_CODE || isAdmin) return;
    const sub = await getTeacherSubscription(teacherCode);
    if (sub.expiryDate && new Date(sub.expiryDate) < new Date() && sub.plan !== 'free') {
        const teacherDoc = await getTeacherDocumentByCode(teacherCode);
        if (teacherDoc) {
            await updateDoc(teacherDoc.ref, { plan: 'free' });
            invalidateTeacherSubscriptionCache(teacherCode);
            sessionStorage.setItem('teacher_plan', 'free');
            if (typeof showFloatingNotification === 'function') {
                showFloatingNotification('⚠️ انتهت صلاحية اشتراكك، تم تحويلك إلى الباقة المجانية', 'warning');
            }
        }
    }
}   