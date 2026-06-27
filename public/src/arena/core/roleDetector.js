// src/arena/core/roleDetector.js
// تحديد صلاحيات المستخدم بناءً على الخطة (مجاني، فضي، ذهبي، مطور)
// الإصدار النهائي الموحد

export function roleDetector(user) {
    const isTeacher = user.isTeacher === true;
    let plan = 'free';
    let isDeveloper = false;
    
    if (isTeacher) {
        // المعلم: الخطة من user.plan أو من sessionStorage
        plan = user.plan || sessionStorage.getItem('teacher_plan') || 'free';
        // كشف المطور (الكود السري أو علامة المطور)
        const isDevByCode = (user.code === '29910141300038') || (sessionStorage.getItem('peak_teacher_code') === '29910141300038');
        const isDevByFlag = sessionStorage.getItem('is_developer') === 'true';
        isDeveloper = (plan === 'developer') || isDevByCode || isDevByFlag;
        if (isDeveloper) plan = 'developer';
    } else {
        // الطالب: الخطة مخزنة عند تسجيل الدخول (تبعاً لمعلمه)
        plan = sessionStorage.getItem('student_teacher_plan') || user.teacherPlan || 'free';
    }

    // ========== صلاحيات المعلمين والطلاب بناءً على الخطة ==========
    
    // مشاهدة سباق جارٍ (spectate):
    // - للمعلم الذهبي أو المطور
    // - للطالب إذا كانت خطة معلمه ذهبية (لأنه يتبع صلاحية معلمه)
    const canWatchAllRooms = (plan === 'gold' || plan === 'developer') || (!isTeacher && plan === 'gold');
    
    // رؤية قائمة الغرف:
    // - الفضي فأعلى (للمعلم أو الطالب)
    const canViewAllRooms = (plan === 'silver' || plan === 'gold' || plan === 'developer');
    
    // حذف الغرفة: فقط المعلم (أي خطة) أو المطور
    const canDeleteRoom = isTeacher || plan === 'developer';
    
    // إنشاء غرفة:
    // - للمعلم غير المجاني (فضي، ذهبي، مطور)
    // - الطلاب لا يمكنهم الإنشاء أبداً
    const canCreateRoom = isTeacher && (plan !== 'free');
    
    // الدردشة العامة (الغرفة العالمية):
    // - للمعلم الفضي أو الذهبي أو المطور (وليس للطلاب ولا للمعلم المجاني)
    const canUseChat = isTeacher && (plan === 'silver' || plan === 'gold' || plan === 'developer');
    
    // إدارة المنصة (admin-panel): فقط المطور
    const canAccessAdminPanel = (plan === 'developer');

    return {
        isTeacher,
        plan,               // 'free', 'silver', 'gold', 'developer'
        isDeveloper,
        canWatchAllRooms,   // مشاهدة السباقات الجارية
        canViewAllRooms,    // رؤية قائمة الغرف
        canDeleteRoom,      // حذف غرفة (للمعلم أو المطور)
        canCreateRoom,      // إنشاء غرفة (للمعلم غير المجاني)
        canUseChat,         // دردشة عامة (للمعلم الفضي+)
        canAccessAdminPanel,// لوحة تحكم المطور
        studentGrade: isTeacher ? null : (user.grade || null),
        teacherId: isTeacher ? user.id : (user.teacherId || null)
    };
}