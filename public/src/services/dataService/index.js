// index.js - إعادة تصدير جميع دوال dataService من الوحدات المختلفة
// هذا الملف يحل محل dataService.js القديم – لا حاجة لتغيير أي استيراد في باقي المنصة

// helpers
export {
    getCurrentTeacherId,
    ensureFirestoreHasData,
    getTeacherDocumentByCode,
    getCurrentTeacherCode,
    getTeacherPlan,
    getTeacherLockedSubject,
    getTeacherTotalQuestions,
    getTeacherOnlineRoomsUsed,
    updateTeacherPlanInSession,
    updateTeacherLockedSubjectInSession,
    updateTeacherTotalQuestionsInSession,
    updateTeacherOnlineRoomsUsedInSession,
    saveAllData,
    reloadData,
    save
} from './helpers.js';

// student
export {
    getStudents,
    getAllStudentsGlobal,
    getStudentsByTeacher,
    getGlobalLeaderboard,
    getStudentById,
    addStudent,
    updateStudent,
    deleteStudent,
    getStudentStats,
    updateStudentStats,
    getGameHistory,
    addGameHistory,
    updateStudentProgress
} from './student.js';

// questions
export {
    getQuestions,
    saveQuestions,
    deleteQuestions
} from './questions.js';

// grades
export {
    getAllGrades,
    addCustomGrade,
    removeCustomGrade
} from './grades.js';

// tournaments
export {
    createTournament,
    getTournamentByCode,
    getTournamentById,
    addPlayerToTournament,
    updateTournament,
    deleteTournament,
    getActiveTournaments,
    getActiveTournamentsForStudent
} from './tournaments.js';

// quickRace
export {
    createQuickRace,
    getQuickRaceByCode,
    getQuickRaceById,
    addPlayerToQuickRace,
    updateQuickRace,
    deleteQuickRace
} from './quickRace.js';

// storeFriends
export {
    getStoreItems,
    addStoreItem,
    purchaseItem,
    getUserInventory,
    getFriendsList,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getFriendRequests,
    getSentFriendRequests,
    removeFriend,
    getOnlineUsers
} from './storeFriends.js';

// subscription
export {
    getTeacherSubscription,
    updateTeacherSubscription,
    canAddStudent,
    getTeacherStudentCount,
    canUploadQuestions,
    setLockedSubject,
    getLockedSubject,
    updateTeacherTotalQuestions,
    getTeacherQuestionCount,
    invalidateTeacherSubscriptionCache,
    canTeacherCreateRoom,
    canCreateOnlineGame,
    incrementTeacherRoomCount,
    incrementTeacherRoomCountForStudent,
    incrementOnlineGameCount,
    resetTeacherMonthlyCountersIfNeeded
} from './subscription.js';

// cache
export {
    fetchAllCachedData,
    invalidateGlobalCache
} from './cache.js';

// teacherListeners
export {
    subscribeToTeacherData,
    unsubscribeFromTeacherData
} from './teacherListeners.js';

// إعادة تصدير refreshTeacherPlanIfExpired (مستورد من auth.js)
export { refreshTeacherPlanIfExpired } from '../../firebase/auth.js';

// إعادة تصدير دوال التخزين المحلي (للتوافق)
export {
    dbLight,
    loadLightData,
    saveLightData,
    refreshAllGradeSelects,
    getDynamicGrades
} from '../../db/localstorage.js';