// src/main.js
// ملف الواجهة بعد إعادة الهيكلة – يقوم بإعادة تصدير جميع وظائف المنصة من مجلد main/
// والبدء في تشغيل التطبيق

// استيراد start وكل الدوال العامة من المجلد الجديد
import { 
    start,
    _cleanupFirestoreListeners,
    setupFirestoreListeners,
    setupStudentStatsListener,
    setupMaintenanceWatcher,
    checkMaintenanceOnLoad,
    showExpiredModal,
    updateStudentProgress,
    getStudentStats,
    addGameHistoryRecord,
    addStudentToFirestore,
    updateStudentInFirestore,
    deleteStudentFromFirestore,
    addCustomGradeToFirestore,
    deleteCustomGradeFromFirestore,
    renderGradesGrid,
    getTeacherMessages,
    sendTeacherMessage,
    updateUnreadCount,
    exportBackup,
    importBackup,
    renderAdvancedStatsRedirect,
    updateStudentSearchListRedirect,
    exportGradeReportRedirect,
    exportComparisonPDFRedirect,
    bindPageEvents,
    bindQuestionBankEvents,
    bindAdvancedSettingsEvents,
    bindScoreAdjustEvents,
    resetAllSessionData,
    showNotificationsList,
    updateUnreadNotificationsCount,
    registerGlobalFunctions,
    setupNotificationsListener
} from './main/index.js';

// إعادة تصدير كل شيء للتوافق مع الملفات القديمة التي قد تستورد من './main.js'
export {
    start,
    _cleanupFirestoreListeners,
    setupFirestoreListeners,
    setupStudentStatsListener,
    setupMaintenanceWatcher,
    checkMaintenanceOnLoad,
    showExpiredModal,
    updateStudentProgress,
    getStudentStats,
    addGameHistoryRecord,
    addStudentToFirestore,
    updateStudentInFirestore,
    deleteStudentFromFirestore,
    addCustomGradeToFirestore,
    deleteCustomGradeFromFirestore,
    renderGradesGrid,
    getTeacherMessages,
    sendTeacherMessage,
    updateUnreadCount,
    exportBackup,
    importBackup,
    renderAdvancedStatsRedirect,
    updateStudentSearchListRedirect,
    exportGradeReportRedirect,
    exportComparisonPDFRedirect,
    bindPageEvents,
    bindQuestionBankEvents,
    bindAdvancedSettingsEvents,
    bindScoreAdjustEvents,
    resetAllSessionData,
    showNotificationsList,
    updateUnreadNotificationsCount,
    registerGlobalFunctions,
    setupNotificationsListener
};

// بدء التطبيق
start();