// دوال التحقق من الصلاحيات حسب الخطة
import { getTeacherDocumentByCode, getTeacherSubscription, refreshTeacherPlanIfExpired, invalidateTeacherSubscriptionCache } from './teacherData.js';
import { getPlanDetails, DEVELOPER_CODE } from './plans.js';
import { getTeacherStudentCount, getTeacherQuestionCount } from './counters.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

// التحقق من إمكانية إضافة طالب جديد
export async function canAddStudent(teacherId, currentStudentCount) {
    await refreshTeacherPlanIfExpired(teacherId);
    const sub = await getTeacherSubscription(teacherId);
    if (currentStudentCount >= sub.maxStudents) {
        let planName = sub.plan === 'free' ? 'المجانية' : (sub.plan === 'silver' ? 'الفضية' : 'الذهبية');
        return { allowed: false, message: `لقد تجاوزت الحد الأقصى للطلاب في الباقة ${planName} (${sub.maxStudents} طالب). يرجى الترقية للذهبية لإضافة المزيد.` };
    }
    return { allowed: true };
}

// التحقق من إمكانية رفع الأسئلة
export async function canUploadQuestions(teacherId, newQuestions, requestedSubject) {
    const { checkTeacherAccess } = await import('./checks.js'); // تجنب دائري
    const access = await checkTeacherAccess(teacherId);
    if (!access.allowed) {
        return { allowed: false, message: access.message };
    }
    
    await refreshTeacherPlanIfExpired(teacherId);
    const sub = await getTeacherSubscription(teacherId);
    const plan = sub.plan;
    
    const currentCount = await getTeacherQuestionCount(teacherId);
    const newCount = newQuestions.length;
    if (currentCount + newCount > sub.maxQuestions) {
        const planName = plan === 'free' ? 'المجانية' : (plan === 'silver' ? 'الفضية' : 'الذهبية');
        return { allowed: false, message: `تجاوز الحد الأقصى للأسئلة في الباقة ${planName} (${sub.maxQuestions} سؤال). لديك حالياً ${currentCount} سؤال، وتحاول إضافة ${newCount} سؤال.` };
    }
    
    if (plan === 'free' || plan === 'silver') {
        if (!sub.lockedSubject) {
            return { allowed: true, lockedSubject: requestedSubject };
        } else {
            const mismatch = newQuestions.some(q => (q.subject || '').trim().toLowerCase() !== sub.lockedSubject.trim().toLowerCase());
            if (mismatch) {
                return { allowed: false, message: `المادة التي تحاول رفعها (${requestedSubject}) تختلف عن المادة المسموح بها (${sub.lockedSubject}). لا يمكنك تغيير المادة في الباقة ${plan === 'free' ? 'المجانية' : 'الفضية'}.` };
            }
        }
    }
    return { allowed: true };
}

// التحقق من إمكانية إنشاء غرفة أونلاين
export async function canCreateOnlineGame(teacherCode) {
    const { checkTeacherAccess } = await import('./checks.js');
    const access = await checkTeacherAccess(teacherCode, 'silver');
    if (!access.allowed) {
        return { allowed: false, message: access.message };
    }
    await refreshTeacherPlanIfExpired(teacherCode);
    const sub = await getTeacherSubscription(teacherCode);
    if (sub.plan === 'free') {
        return { allowed: false, message: 'الباقة المجانية لا تسمح بإنشاء غرف أونلاين. يرجى الترقية للفضية أو الذهبية.' };
    }
    if (sub.plan === 'silver') {
        const used = sub.onlineRoomsUsedThisMonth || 0;
        const max = sub.maxOnlineGamesPerMonth || 10;
        if (used >= max) {
            return { allowed: false, message: `لقد استنفذت عدد المباريات الشهرية المسموحة (${max}/ شهر). يرجى الانتظار حتى الشهر القادم أو الترقية للذهبية.`, remaining: 0 };
        }
        return { allowed: true, remaining: max - used };
    }
    return { allowed: true };
}

// وظيفة سابقة (مرادفة)
export async function canTeacherCreateRoom(teacherCode) {
    return canCreateOnlineGame(teacherCode);
}

// التحقق من الوصول إلى التحليلات المتقدمة
export async function canAccessAnalytics(teacherCode, showNotification = false) {
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    if (teacherCode === DEVELOPER_CODE || isAdmin) return true;
    await refreshTeacherPlanIfExpired(teacherCode);
    const sub = await getTeacherSubscription(teacherCode);
    const plan = sub.plan;
    const canAccess = (plan === 'gold' || plan === 'silver'); // سيلفر يسمح بتحليلات أساسية، ذهبي كاملة
    if (!canAccess && showNotification) {
        showFloatingNotification('هذه الميزة متاحة فقط في الباقة الذهبية أو الفضية.', 'error');
    }
    return canAccess;
}

// الحصول على اسم الخطة الحالية للمعلم
export async function getUserPlan(teacherCode, useCache = true) {
    if (!useCache) {
        invalidateTeacherSubscriptionCache(teacherCode);
    }
    const sub = await getTeacherSubscription(teacherCode);
    return sub.plan;
}

// التحقق العام من صلاحية المعلم (لأي عملية تتطلب خطة معينة)
export async function checkTeacherAccess(teacherCode, requiredPlan = 'free') {
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    if (teacherCode === DEVELOPER_CODE || isAdmin) return { allowed: true, plan: 'gold' };
    await refreshTeacherPlanIfExpired(teacherCode);
    const sub = await getTeacherSubscription(teacherCode);
    const plan = sub.plan;
    const planLevel = { free: 0, silver: 1, gold: 2 };
    const requiredLevel = planLevel[requiredPlan] || 0;
    const currentLevel = planLevel[plan] || 0;
    if (currentLevel >= requiredLevel) {
        return { allowed: true, plan };
    } else {
        let msg = `هذه الميزة تتطلب الباقة ${requiredPlan === 'silver' ? 'الفضية' : 'الذهبية'}. خطتك الحالية: ${plan === 'free' ? 'مجانية' : (plan === 'silver' ? 'فضية' : 'ذهبية')}`;
        return { allowed: false, message: msg, plan };
    }
}