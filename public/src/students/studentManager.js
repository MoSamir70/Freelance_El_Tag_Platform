// ===================== src/students/studentManager.js =====================
// هذا الملف هو واجهة تصدير (barrel) لوحدة studentManager.
// جميع الدوال تم نقلها إلى مجلد studentManager/ مع الحفاظ على نفس أسماء التصدير.

export {
    renderStudentsEdit,
    addStudent,
    deleteStudent,
    openEditStudentModal,
    updateStudentAfterEdit,
    closeEditModal
} from './studentManager/crud.js';

export {
    renderStudentSelect,
    addStudentToCurrentRace
} from './studentManager/studentSelect.js';

export {
    renderTeamsUI,
    adjustTeamCount,
    shuffleTeams,
    balancedTeams,
    confirmTeamsAndProceed,
    showAddStudentModal,
    renderTeamSetupScreen
} from './studentManager/teamSetup.js';

export {
    saveTeamTemplate,
    loadTeamTemplate
} from './studentManager/teamTemplates.js';