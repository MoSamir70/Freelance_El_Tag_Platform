// src/main/index.js
// الواجهة الرئيسية بعد إعادة الهيكلة
// يقوم بتصدير جميع الوظائف المهمة واستدعاء start()

import { start } from './initialization.js';
import { _cleanupFirestoreListeners, setupFirestoreListeners, setupStudentStatsListener } from './firestore-listeners.js';
import { setupMaintenanceWatcher, checkMaintenanceOnLoad, showExpiredModal } from './maintenance.js';
import { updateStudentProgress, getStudentStats, addGameHistoryRecord, addStudentToFirestore, updateStudentInFirestore, deleteStudentFromFirestore } from './student-helpers.js';
import { addCustomGradeToFirestore, deleteCustomGradeFromFirestore, renderGradesGrid } from './grade-helpers.js';
import { getTeacherMessages, sendTeacherMessage, updateUnreadCount } from './message-helpers.js';
import { exportBackup, importBackup } from './backup.js';
import { renderAdvancedStatsRedirect, updateStudentSearchListRedirect, exportGradeReportRedirect, exportComparisonPDFRedirect } from './stats-redirect.js';
import { bindPageEvents, bindQuestionBankEvents, bindAdvancedSettingsEvents, bindScoreAdjustEvents } from './event-bindings.js';
import { resetAllSessionData } from './reset-session.js';
import { showNotificationsList, updateUnreadNotificationsCount } from './notifications.js';
import { registerGlobalFunctions } from './registration.js';
import { setupNotificationsListener } from './notifications-listener.js';

// تصدير كل ما قد يحتاجه أي ملف آخر
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

// بدء التشغيل
start();