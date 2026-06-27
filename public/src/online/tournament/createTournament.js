// src/online/tournament/createTournament.js
// إنشاء بطولة جديدة مع دعم الصلاحيات:
// - مجاني: ممنوع تماماً
// - فضي: حد أقصى 5 بطولات شهرياً
// - ذهبي/مطور: غير محدود

import { db, collection, addDoc, serverTimestamp, doc, setDoc, updateDoc, getDoc, query, where, getDocs } from '../../firebase/init.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { checkTeacherAccess, getUserPlan, getPlanLimits } from '../../services/subscriptionGuard.js';

/**
 * الحصول على عدد البطولات المستخدمة هذا الشهر للمعلم
 * @param {string} teacherId 
 * @returns {Promise<number>}
 */
async function getTeacherTournamentsUsedThisMonth(teacherId) {
    try {
        const teachersRef = collection(db, 'teachers');
        const q = query(teachersRef, where('code', '==', teacherId));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return 0;
        const teacherData = snapshot.docs[0].data();
        return teacherData.tournamentsUsedThisMonth || 0;
    } catch(e) {
        console.error('[getTeacherTournamentsUsedThisMonth] Error:', e);
        return 0;
    }
}

/**
 * زيادة عداد البطولات الشهري للمعلم
 * @param {string} teacherId 
 * @returns {Promise<boolean>}
 */
async function incrementTournamentCount(teacherId) {
    try {
        const teachersRef = collection(db, 'teachers');
        const q = query(teachersRef, where('code', '==', teacherId));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return false;
        const teacherDoc = snapshot.docs[0];
        const current = teacherDoc.data().tournamentsUsedThisMonth || 0;
        await updateDoc(teacherDoc.ref, { tournamentsUsedThisMonth: current + 1 });
        return true;
    } catch(e) {
        console.error('[incrementTournamentCount] Error:', e);
        return false;
    }
}

/**
 * إنشاء بطولة جديدة
 * @param {Object} data - بيانات البطولة
 * @returns {Promise<{success: boolean, tournamentId?: string, error?: string}>}
 */
export async function createTournament(data) {
    const user = await getCurrentUserInfo();
    if (!user || !user.isTeacher) {
        showFloatingNotification('يجب تسجيل الدخول كمعلم لإنشاء بطولة', 'error');
        return { success: false, error: 'Not a teacher' };
    }

    const teacherCode = user.code || user.id;

    // 1. التحقق الأساسي من صلاحية المعلم (اشتراك منتهي أو محظور)
    const access = await checkTeacherAccess(teacherCode);
    if (!access.allowed) {
        showFloatingNotification(access.message, 'error');
        return { success: false, error: access.message };
    }

    const teacherPlan = access.plan;

    // 2. منع المعلم المجاني تماماً
    if (teacherPlan === 'free') {
        showFloatingNotification('الباقة المجانية لا تسمح بإنشاء بطولات. يرجى الترقية للفضية أو الذهبية.', 'error');
        return { success: false, error: 'Free plan cannot create tournaments' };
    }

    // 3. التحقق من الحد الشهري للمعلم الفضي (5 بطولات)
    if (teacherPlan === 'silver') {
        const used = await getTeacherTournamentsUsedThisMonth(teacherCode);
        const maxAllowed = 5; // الحد الأقصى للفضي
        if (used >= maxAllowed) {
            showFloatingNotification(`⚠️ لقد استنفذت الحد الشهري المسموح به من البطولات (${maxAllowed} بطولة). الترقية للذهبية تتيح بطولات غير محدودة.`, 'error');
            return { success: false, error: 'Monthly tournament limit reached for silver plan' };
        }
        
        // إشعار تنبيهي عند الاقتراب من الحد
        if (used >= maxAllowed - 1) {
            showFloatingNotification(`تنبيه: تبقى لك ${maxAllowed - used} بطولة هذا الشهر (الحد الأقصى ${maxAllowed})`, 'warning', 4000);
        }
    }

    // الذهبي والمطور غير محدودين – يستمران بدون فحص إضافي

    // 4. إنشاء البطولة في Firestore
    const tournamentId = `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const tournament = {
        tournamentId,
        name: data.name,
        type: data.type,
        grade: data.grade,
        subject: data.subject,
        questionCount: data.questionCount || 10,
        timePerQuestion: data.timePerQuestion || 12,
        maxPlayers: data.maxPlayers || 16,
        accessCode: data.accessCode || null,
        teacherId: teacherCode,
        teacherName: user.name,
        teacherPlan: teacherPlan,
        status: 'waiting', // waiting, active, finished
        players: [],
        matches: [],
        winnerId: null,
        winnerName: null,
        createdAt: serverTimestamp(),
        startedAt: null,
        finishedAt: null
    };

    try {
        await setDoc(doc(db, 'tournaments', tournamentId), tournament);
        
        // 5. زيادة العداد الشهري للمعلم الفضي فقط
        if (teacherPlan === 'silver') {
            await incrementTournamentCount(teacherCode);
        }
        
        showFloatingNotification(`تم إنشاء البطولة "${data.name}" بنجاح`, 'success');
        return { success: true, tournamentId };
    } catch (error) {
        console.error('[CreateTournament] Error:', error);
        showFloatingNotification('فشل إنشاء البطولة', 'error');
        return { success: false, error: error.message };
    }
}