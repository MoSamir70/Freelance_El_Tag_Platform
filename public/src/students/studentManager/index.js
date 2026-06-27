// ===================== src/students/studentManager/index.js =====================
// واجهة التصدير الداخلية لوحدة studentManager.
// يتم استيراد جميع الدوال من الملفات المنفصلة وإعادة تصديرها.

export { 
    addStudent, 
    deleteStudent, 
    openEditStudentModal, 
    updateStudentAfterEdit, 
    closeEditModal,
    renderStudentsEdit
} from './crud.js';

export { 
    renderStudentSelect, 
    addStudentToCurrentRace 
} from './studentSelect.js';

export { 
    renderTeamsUI, 
    adjustTeamCount, 
    shuffleTeams, 
    balancedTeams, 
    confirmTeamsAndProceed, 
    showAddStudentModal,
    renderTeamSetupScreen
} from './teamSetup.js';

export { 
    saveTeamTemplate, 
    loadTeamTemplate 
} from './teamTemplates.js';