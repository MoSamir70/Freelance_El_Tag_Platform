import { addNewGrade, renameGrade, deleteGrade, renderGradesManagement } from '../teacher/grades.js';
import { resetBank, renderSubjectsForGrade } from '../questions/bank.js';
import { bindExcelEvents } from '../questions/excel.js';
import { closeAnalysisModal, showGradeSelectionModal } from '../students/analysis.js';
import { addStudent, updateStudentAfterEdit, closeEditModal } from '../students/studentManager/crud.js';
import { showThemeSelector, cycleTheme, reapplyTheme } from '../ui/themes.js';
import { RaceSessionManager } from '../core/raceSession.js';
import { exitRaceImmediate } from '../core/raceEngine.js';
import { showSubscriptionInfo } from '../teacher/dashboard.js';
import { exportBackup, importBackup } from './backup.js';
import { toggleMute } from '../utils/helpers/sound.js';

export function bindPageEvents() {
    const createRoomBtn = document.querySelector('[onclick="openCreateRoomModal()"]');
    if (createRoomBtn) {
        createRoomBtn.removeAttribute('onclick');
        createRoomBtn.addEventListener('click', openCreateRoomModal);
    }
   
    const addGradeBtn = document.getElementById('add-grade-btn');
    if (addGradeBtn) addGradeBtn.addEventListener('click', addNewGrade);
    const soundBtn = document.getElementById('toggle-sound-btn');
    if (soundBtn) soundBtn.addEventListener('click', toggleMute);
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); });
    const exitRaceBtn = document.getElementById('exitRaceBtn');
    if (exitRaceBtn) exitRaceBtn.addEventListener('click', () => { const activeSession = RaceSessionManager.getActive(); if (activeSession) exitRaceImmediate(activeSession.id); });
    const closeAnalysisBtn = document.getElementById('closeAnalysisModalBtn');
    if (closeAnalysisBtn) closeAnalysisBtn.addEventListener('click', closeAnalysisModal);
    window.closeEditModal = closeEditModal;
    const saveEditBtn = document.getElementById('saveEditStudentBtn');
    if (saveEditBtn) saveEditBtn.addEventListener('click', updateStudentAfterEdit);
    const addStudentBtn = document.querySelector('[data-action="addStudent"]');
    if (addStudentBtn) addStudentBtn.addEventListener('click', addStudent);
    const showAnalysisBtn = document.getElementById('showStudentAnalyticsBtn');
    if (showAnalysisBtn) showAnalysisBtn.addEventListener('click', showGradeSelectionModal);
    const viewMyDataBtn = document.getElementById('viewMyDataBtn');
    if (viewMyDataBtn) viewMyDataBtn.addEventListener('click', showSubscriptionInfo);
    const cycleThemeBtn = document.getElementById('cycle-theme-btn');
    if (cycleThemeBtn) cycleThemeBtn.addEventListener('click', showThemeSelector);
    const exportBackupBtn = document.querySelector('[data-action="exportBackup"]');
    if (exportBackupBtn) exportBackupBtn.addEventListener('click', exportBackup);
    const importBackupBtn = document.querySelector('[data-action="importBackup"]');
    if (importBackupBtn) importBackupBtn.addEventListener('click', () => { document.getElementById('restore-file-input')?.click(); });
    const restoreInput = document.getElementById('restore-file-input');
    if (restoreInput) restoreInput.addEventListener('change', importBackup);
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener('click', async () => { const { logout } = await import('../firebase/auth.js'); logout(); });
    }
  
    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const grade = btn.dataset.grade;
        if (action === 'renameGrade' && grade) {
            const { value: newName } = await Swal.fire({
                title: 'تغيير اسم الصف',
                input: 'text',
                inputValue: grade,
                showCancelButton: true,
                confirmButtonText: 'تغيير',
                cancelButtonText: 'إلغاء',
                background: '#0f172a',
                color: '#fff'
            });
            if (newName && newName !== grade) await renameGrade(grade, newName);
        } else if (action === 'deleteGrade' && grade) {
            await deleteGrade(grade);
        }
    });
}

export function bindQuestionBankEvents() {
    const gradeSelect = document.getElementById('q-grade-sel');
    if (gradeSelect) gradeSelect.addEventListener('change', async () => { if (gradeSelect.value) await renderSubjectsForGrade(gradeSelect.value); setTimeout(() => reapplyTheme(), 50); });
    const resetBankBtn = document.querySelector('[data-action="resetBank"]');
    if (resetBankBtn) resetBankBtn.addEventListener('click', async () => { const grade = document.getElementById('q-grade-sel')?.value; if (grade) await resetBank(grade); setTimeout(() => reapplyTheme(), 50); });
}

export function bindAdvancedSettingsEvents() {
    const cycleThemeBtn = document.getElementById('cycle-theme-btn');
    if (cycleThemeBtn) cycleThemeBtn.addEventListener('click', () => { if (typeof window.cycleTheme === 'function') window.cycleTheme(); setTimeout(() => reapplyTheme(), 50); });
    const viewMyDataBtn = document.getElementById('viewMyDataBtn');
    if (viewMyDataBtn) viewMyDataBtn.addEventListener('click', () => { if (typeof window.showSubscriptionInfo === 'function') window.showSubscriptionInfo(); });
}

export function bindScoreAdjustEvents() {
    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('.adjustScoreBtn');
        if (btn) {
            const scoreChange = parseInt(btn.dataset.score);
            const modal = document.getElementById('edit-student-modal');
            if (modal && !modal.classList.contains('hidden')) {
                const studentId = window.currentEditStudentId;
                if (studentId && typeof window.updateStudentScore === 'function') {
                    await window.updateStudentScore(studentId, scoreChange);
                    setTimeout(() => reapplyTheme(), 50);
                }
            }
        }
    });
}

// helper for create room modal (to be defined elsewhere)
function openCreateRoomModal() {
    // This function should be imported or defined globally
    if (typeof window.openCreateRoomModal === 'function') window.openCreateRoomModal();
}