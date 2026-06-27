// src/db/localstorage.js
// نسخة محسّنة – تستخدم كـ Cache فقط، ويتم تحديثها عبر onSnapshot من Firestore
// ✅ تم إعادة كتابة دوال الاشتراك لدعم الخطط: مجاني، فضي، ذهبي، مطور
// ✅ تم إزالة أي ذكر لـ "platinum" نهائياً
// ✅ الفضي: حد 10 غرف شهرياً، حد 1000 سؤال إجمالي، مادة واحدة مقفلة
// ✅ الذهبي: غير محدود، يمكن تغيير المادة مرتين شهرياً
// ✅ المطور: غير محدود، صلاحية كاملة

export let dbLight = { students: [], studentStats: {}, gameHistory: [], customGrades: [] };
export let teacherSubscriptions = {};

// قائمة الصفوف الافتراضية
export const DEFAULT_GRADES = [
    "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
    "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
    "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
    "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"
];

// تحميل البيانات من localStorage (مرة واحدة عند بدء التشغيل)
export function loadLightData() {
    const stored = localStorage.getItem('peak_platform_light');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            dbLight.students = data.students || [];
            dbLight.studentStats = data.studentStats || {};
            dbLight.gameHistory = data.gameHistory || [];
            dbLight.customGrades = data.customGrades || [];
            teacherSubscriptions = data.teacherSubscriptions || {};
        } catch(e) { console.warn(e); }
    }
}

// حفظ البيانات إلى localStorage (يُستدعى بعد تحديث dbLight من onSnapshot)
export function saveLightData() {
    localStorage.setItem('peak_platform_light', JSON.stringify({
        students: dbLight.students,
        studentStats: dbLight.studentStats,
        gameHistory: dbLight.gameHistory,
        customGrades: dbLight.customGrades,
        teacherSubscriptions: teacherSubscriptions
    }));
}

// ========== دوال الصفوف المتقدمة ==========
export function getSortedGrades(grades) {
    const gradeOrder = [...DEFAULT_GRADES];
    return grades.sort((a, b) => {
        let indexA = gradeOrder.indexOf(a), indexB = gradeOrder.indexOf(b);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        return indexA - indexB;
    });
}

export function getDynamicGrades() {
    const gradesSet = new Set();
    dbLight.students.forEach(s => { if (s.grade) gradesSet.add(s.grade); });
    dbLight.customGrades.forEach(g => gradesSet.add(g));
    DEFAULT_GRADES.forEach(g => gradesSet.add(g));
    return getSortedGrades(Array.from(gradesSet));
}

export function getGradeStage(gradeName) {
    if (!gradeName || typeof gradeName !== 'string') return 'أخرى';
    if (gradeName.includes('ابتدائي')) return 'ابتدائي';
    if (gradeName.includes('إعدادي')) return 'إعدادي';
    if (gradeName.includes('ثانوي')) return 'ثانوي';
    return 'أخرى';
}

export function getDynamicGradesDetailed() {
    const gradesSet = new Set();
    dbLight.students.forEach(s => {
        if (s.grade && typeof s.grade === 'string') gradesSet.add(s.grade);
    });
    dbLight.customGrades.forEach(g => {
        if (g && typeof g === 'string') gradesSet.add(g);
    });
    DEFAULT_GRADES.forEach(g => gradesSet.add(g));
    
    const grades = Array.from(gradesSet).filter(g => g && typeof g === 'string');
    
    const stageOrder = ['ابتدائي', 'إعدادي', 'ثانوي', 'أخرى'];
    return grades.map(name => ({ name, stage: getGradeStage(name) }))
        .sort((a, b) => {
            if (a.stage !== b.stage) return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
            let idxA = DEFAULT_GRADES.indexOf(a.name);
            let idxB = DEFAULT_GRADES.indexOf(b.name);
            if (idxA === -1) idxA = 999;
            if (idxB === -1) idxB = 999;
            return idxA - idxB;
        });
}

export async function ensureDefaultGrades() {
    console.log('ensureDefaultGrades called');
    refreshAllGradeSelects();
}

export function refreshAllGradeSelects() {
    const detailed = getDynamicGradesDetailed();
    const stageNames = { 'ابتدائي': '📘 المرحلة الابتدائية', 'إعدادي': '📙 المرحلة الإعدادية', 'ثانوي': '📕 المرحلة الثانوية', 'أخرى': '📓 صفوف أخرى' };
    const grouped = {};
    detailed.forEach(item => {
        if (!item.name) return;
        if (!grouped[item.stage]) grouped[item.stage] = [];
        grouped[item.stage].push(item.name);
    });
    let optgroupsHTML = '';
    for (let [stage, grades] of Object.entries(grouped)) {
        optgroupsHTML += `<optgroup label="${stageNames[stage] || stage}">`;
        grades.forEach(g => {
            optgroupsHTML += `<option value="${g}">${g}</option>`;
        });
        optgroupsHTML += `</optgroup>`;
    }
    const selectIds = ['new-grade', 'q-grade-sel', 'edit-grade-student'];
    selectIds.forEach(id => {
        let sel = document.getElementById(id);
        if (sel) {
            let currentVal = sel.value;
            sel.innerHTML = optgroupsHTML;
            if (currentVal && [...sel.options].some(o => o.value === currentVal)) {
                sel.value = currentVal;
            }
        }
    });
    const filterIds = ['hall-grade-filter', 'student-grade-filter'];
    filterIds.forEach(id => {
        let sel = document.getElementById(id);
        if (sel) {
            let current = sel.value;
            sel.innerHTML = '<option value="all">جميع الصفوف</option>' + optgroupsHTML;
            if (current && (current === 'all' || [...sel.options].some(o => o.value === current))) {
                sel.value = current;
            } else {
                sel.value = 'all';
            }
        }
    });
    const analyticsSel = document.getElementById('analytics-grade-select');
    if (analyticsSel) {
        let current = analyticsSel.value;
        analyticsSel.innerHTML = '<option value="">اختر صفاً</option>' + optgroupsHTML;
        if (current && [...analyticsSel.options].some(o => o.value === current)) {
            analyticsSel.value = current;
        }
    }
}

// ========== دوال الاشتراكات (تعمل مع localStorage كـ Cache) ==========
// ✅ تم تعديلها بالكامل لدعم silver و developer وإزالة platinum

export function getTeacherSubscription(teacherCode) {
    if (!teacherSubscriptions[teacherCode]) {
        // لا نعطي قيماً افتراضية دائمة، بل نستخدم القيم التي ستأتي من Firebase
        // ولكن للتوافق مع الكود القديم (عند عدم وجود بيانات) نضع plan افتراضي مجاني
        teacherSubscriptions[teacherCode] = {
            plan: 'free',
            expiryDate: null,
            allowedSubject: null,
            totalQuestionsCount: 0,
            onlineRoomsUsedThisMonth: 0,
            subjectChangeCount: 0,
            lastResetDate: null
        };
    }
    return teacherSubscriptions[teacherCode];
}

// دالة مساعدة لإعادة تعيين العدادات الشهرية إذا لزم الأمر
export function resetTeacherMonthlyCountersIfNeeded(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    if (sub.lastResetDate !== currentMonthKey) {
        // إعادة تعيين العدادات الشهرية
        sub.onlineRoomsUsedThisMonth = 0;
        if (sub.plan === 'gold' || sub.plan === 'developer') {
            sub.subjectChangeCount = 0;
        }
        sub.lastResetDate = currentMonthKey;
        saveLightData();
    }
}

// ========== دوال إنشاء الغرف ==========
export function canTeacherCreateRoom(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    resetTeacherMonthlyCountersIfNeeded(teacherCode);
    const plan = sub.plan;
    
    if (plan === 'free') return false;
    if (plan === 'silver') {
        return sub.onlineRoomsUsedThisMonth < 10; // حد 10 غرف شهرياً للفضي
    }
    if (plan === 'gold' || plan === 'developer') return true;
    return false;
}

export function incrementTeacherRoomCount(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    const plan = sub.plan;
    
    if (plan === 'silver') {
        if (sub.onlineRoomsUsedThisMonth < 10) {
            sub.onlineRoomsUsedThisMonth++;
            saveLightData();
            return true;
        }
        return false;
    }
    if (plan === 'gold' || plan === 'developer') {
        // الذهبي والمطور غير محدودين، لكننا نزيد العداد للإحصاء (اختياري)
        sub.onlineRoomsUsedThisMonth++;
        saveLightData();
        return true;
    }
    return false;
}

// ========== دوال رفع الأسئلة ==========
export function canTeacherUploadQuestions(teacherCode, subject, newQuestionsCount) {
    const sub = getTeacherSubscription(teacherCode);
    const plan = sub.plan;
    
    // التحقق من المادة المسموحة
    if (plan === 'free') {
        if (sub.allowedSubject === null) {
            // أول مرة يرفع فيها أسئلة: نقفل على هذه المادة
            return { allowed: true, needReplace: false };
        }
        if (sub.allowedSubject !== subject) {
            return { allowed: false, message: `الخطة المجانية تسمح بمادة واحدة فقط. المادة المسموحة: ${sub.allowedSubject}` };
        }
        const newTotal = (sub.totalQuestionsCount || 0) + newQuestionsCount;
        if (newTotal > 150) {
            return { allowed: false, message: `لا يمكن تجاوز 150 سؤالاً في الباقة المجانية. لديك ${sub.totalQuestionsCount} سؤالاً.` };
        }
        return { allowed: true, needReplace: false };
    }
    
    if (plan === 'silver') {
        if (sub.allowedSubject === null) {
            // أول مرة يرفع فيها أسئلة: نقفل على هذه المادة
            return { allowed: true, needReplace: false };
        }
        if (sub.allowedSubject !== subject) {
            return { allowed: false, message: `الباقة الفضية مقفلة على مادة "${sub.allowedSubject}". لا يمكن تغييرها.` };
        }
        const newTotal = (sub.totalQuestionsCount || 0) + newQuestionsCount;
        if (newTotal > 1000) {
            return { allowed: false, message: `لا يمكن تجاوز 1000 سؤال في الباقة الفضية. لديك ${sub.totalQuestionsCount} سؤالاً.` };
        }
        return { allowed: true, needReplace: false };
    }
    
    if (plan === 'gold') {
        resetTeacherMonthlyCountersIfNeeded(teacherCode);
        if (sub.allowedSubject === null) {
            return { allowed: true, needReplace: false };
        }
        if (sub.allowedSubject !== subject) {
            // الذهبي يسمح بتغيير المادة مرتين شهرياً
            if (sub.subjectChangeCount >= 2) {
                return { allowed: false, message: 'لقد استنفدت حد تغيير المادة هذا الشهر (مرتين). يمكنك التغيير في الشهر القادم.' };
            }
            return { allowed: true, needReplace: true, oldSubject: sub.allowedSubject };
        }
        return { allowed: true, needReplace: false };
    }
    
    if (plan === 'developer') {
        // المطور: لا قيود على الإطلاق
        return { allowed: true, needReplace: false };
    }
    
    return { allowed: false, message: 'خطة غير معروفة' };
}

// دوال لتحديث إحصائيات الأسئلة للمعلم
export function updateTeacherTotalQuestions(teacherCode, delta) {
    const sub = getTeacherSubscription(teacherCode);
    sub.totalQuestionsCount = (sub.totalQuestionsCount || 0) + delta;
    saveLightData();
}

export function setLockedSubject(teacherCode, subject) {
    const sub = getTeacherSubscription(teacherCode);
    sub.allowedSubject = subject;
    saveLightData();
}

export function getLockedSubject(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    return sub.allowedSubject || null;
}

export function getTeacherPlan(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    return sub.plan;
}

// تسجيل تغيير المادة (للذهبي فقط)
export function recordTeacherSubjectChange(teacherCode, newSubject) {
    const sub = getTeacherSubscription(teacherCode);
    if (sub.plan === 'gold') {
        sub.subjectChangeCount = (sub.subjectChangeCount || 0) + 1;
        sub.allowedSubject = newSubject;
        saveLightData();
    }
}

// دوال الحذف (للمساعدة في إدارة الأسئلة)
export function deleteTeacherQuestionsBySubject(teacherCode, subject) {
    // هذه الدالة لا تقوم بالحذف الفعلي للأسئلة، بل تستخدم لتحديث العداد إذا لزم الأمر
    // سيتم التعامل مع حذف الأسئلة في مكان آخر
    console.warn(`deleteTeacherQuestionsBySubject called for ${teacherCode}, subject ${subject}`);
}

// ========== دوال التحديث بعد تغيير النقاط ==========
export function updateUIAfterScoreChange() {
    if (typeof window.renderLeaderboard === 'function') window.renderLeaderboard();
    const filter = document.getElementById('student-grade-filter');
    if (filter && typeof window.renderStudentsEdit === 'function') window.renderStudentsEdit(filter.value);
    const analysisModal = document.getElementById('student-analysis-modal');
    if (analysisModal && analysisModal.style.display === 'flex') {
        const studentId = analysisModal.dataset.studentId;
        if (studentId && typeof window.showAdvancedAnalysis === 'function') window.showAdvancedAnalysis(studentId);
    }
}

// ========== دوال إضافية ==========
export function logDeviceForTeacher(teacherId, deviceInfo) {
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (teacher) {
        if (!teacher.devices) teacher.devices = [];
        const existing = teacher.devices.findIndex(d => d.deviceId === deviceInfo.deviceId);
        if (existing !== -1) {
            teacher.devices[existing].lastSeen = Date.now();
        } else {
            teacher.devices.push({ ...deviceInfo, firstSeen: Date.now(), lastSeen: Date.now() });
        }
        saveLightData();
    }
}

export function addViolation(teacherId, type, details) {
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (teacher) {
        if (!teacher.violations) teacher.violations = [];
        teacher.violations.push({ type, date: Date.now(), details, resolved: false });
        saveLightData();
    }
}

export const save = saveLightData;