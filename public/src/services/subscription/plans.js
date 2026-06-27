// تعريف ثوابت الخطط والحدود
export const PLANS = {
    FREE: {
        name: 'مجاني',
        maxStudents: 10,
        maxQuestions: 150,
        maxOnlineGamesPerMonth: 0,
        canAccessAnalytics: false,
        canPrintReports: false,
        canCreateOnlineRoom: false,
        lockedSubjectRequired: false
    },
    SILVER: {
        name: 'فضي',
        maxStudents: 50,
        maxQuestions: 1000,
        maxOnlineGamesPerMonth: 10,
        canAccessAnalytics: true,      // تحليلات أساسية فقط
        canPrintReports: false,
        canCreateOnlineRoom: true,
        lockedSubjectRequired: true
    },
    GOLD: {
        name: 'ذهبي',
        maxStudents: Infinity,
        maxQuestions: Infinity,
        maxOnlineGamesPerMonth: Infinity,
        canAccessAnalytics: true,
        canPrintReports: true,
        canCreateOnlineRoom: true,
        lockedSubjectRequired: false
    },
    DEVELOPER: {
        name: 'مطور',
        maxStudents: Infinity,
        maxQuestions: Infinity,
        maxOnlineGamesPerMonth: Infinity,
        canAccessAnalytics: true,
        canPrintReports: true,
        canCreateOnlineRoom: true,
        lockedSubjectRequired: false,
        isDeveloper: true
    }
};

export const DEFAULT_PLAN = 'FREE';
export const DEVELOPER_CODE = "29910141300038";

// دالة مساعدة للحصول على تفاصيل الخطة
export function getPlanDetails(planKey) {
    const key = planKey?.toUpperCase() || DEFAULT_PLAN;
    return PLANS[key] || PLANS[DEFAULT_PLAN];
}