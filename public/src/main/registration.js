// src/main/registration.js
// تسجيل جميع الدوال في window

// استيرادات Firebase ووظائف المساعدة
import { db, collection, doc, getDocs, query, where, updateDoc, deleteDoc, setDoc, getDoc } from '../firebase/init.js';

// استيرادات من الوحدات المختلفة
import { addStudentToFirestore, updateStudentInFirestore, deleteStudentFromFirestore, updateStudentProgress, getStudentStats, addGameHistoryRecord } from './student-helpers.js';
import { addCustomGradeToFirestore, deleteCustomGradeFromFirestore, renderGradesGrid } from './grade-helpers.js';
import { sendTeacherMessage, getTeacherMessages, updateUnreadCount } from './message-helpers.js';
import { syncAllToFirebase, loadAllFromFirebase } from '../firebase/sync.js';
import { exportBackup, importBackup } from './backup.js';
import { renderAdvancedStatsRedirect, updateStudentSearchListRedirect, exportGradeReportRedirect, exportComparisonPDFRedirect } from './stats-redirect.js';
import { resetAllSessionData } from './reset-session.js';
import { showNotificationsList, updateUnreadNotificationsCount } from './notifications.js';
import { nextPlayer } from '../core/raceEngine.js';
import { clearNavigationCache, showPage } from '../ui/navigation.js';
import { renderSubjectsForGrade } from '../questions/bank.js';
import { showLessonsList, showLessonDetail, showLessonsModal, updateSelectedLessonsPreview, populateSubjectsForGrade, openMergeModal } from '../questions/lessons.js';
import { renderStudentsEdit } from '../students/studentManager/crud.js';
import { renderStudentSelect, addStudentToCurrentRace } from '../students/studentManager/studentSelect.js';
import { renderTeamsUI, adjustTeamCount, shuffleTeams, balancedTeams, confirmTeamsAndProceed, showAddStudentModal, renderTeamSetupScreen } from '../students/studentManager/teamSetup.js';
import { saveTeamTemplate, loadTeamTemplate } from '../students/studentManager/teamTemplates.js';
import { getStudentById } from '../services/dataService.js';
import { showAdvancedAnalysis, printStudentReport, showGradeSelectionModal, showStudentSelectionModal } from '../students/analysis.js';
import { updateTeacherDisplayName, renderSubscriptionCard, showSubscriptionInfo, refreshTeacherSubscriptionUI } from '../teacher/dashboard.js';
import { renderGradesManagement } from '../teacher/grades.js';
import { renderTracks, updateSingleLane, startTimerForCurrentQuestion, handleTimeUp, clearAllRaceTimeouts, startCountdown, showBetOverlay, showTargetSelectionOverlay, closeSurpriseOverlay, showQuestion, resetTimerBar } from '../core/raceUI.js';
import { startRaceWithSettings, exitRaceImmediate, withdrawEntity } from '../core/raceEngine.js';
import { RaceSessionManager } from '../core/raceSession.js';
import { cycleTheme, showThemeSelector, applyTheme, reapplyTheme } from '../ui/themes.js';
import { smartUploadExcel, exportQuestionsToExcel } from '../questions/excel.js';
import { resetBank } from '../questions/bank.js';
import { raceSettings, resetRaceSettings } from '../core/raceSettings.js';
import { loadSettingsPage, renderModesPage } from '../ui/gameSetupNew.js';
import { renderLeaderboard, updateHallFilter, getMostWinsStudent, getMostAccurateStudent } from '../students/leaderboard.js';
import { refreshGradesPageCache } from '../ui/navigation.js';
import { _cleanupFirestoreListeners, setupStudentStatsListener } from './firestore-listeners.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';
import { playCorrect, playWrong, playWin, toggleMute } from '../utils/helpers/sound.js';

export function registerGlobalFunctions() {
    // دوال أساسية للطلاب
    window.addStudent = addStudentToFirestore;
    window.updateStudent = updateStudentInFirestore;
    window.deleteStudent = deleteStudentFromFirestore;
    window.updateStudentInFirestore = updateStudentInFirestore;
    window.addStudentToFirestore = addStudentToFirestore;
    window.deleteStudentFromFirestore = deleteStudentFromFirestore;
    
    window.updateStudentScore = async (studentId, delta) => {
        const studentsCollection = collection(db, 'students');
        const studentDoc = doc(studentsCollection, studentId);
        const studentSnap = await getDoc(studentDoc);
        if (studentSnap.exists()) {
            const student = studentSnap.data();
            await updateDoc(studentDoc, { score: (student.score || 0) + delta });
            await updateStudentProgress(studentId, delta, delta > 0, false);
        }
    };
    
    window.addGameHistory = addGameHistoryRecord;
    window.updateTeacherSubscription = (teacherId, data) => setDoc(doc(collection(db, 'teacherSubscriptions'), teacherId), data);
    window.getTeacherSubscription = (teacherId) => getDoc(doc(collection(db, 'teacherSubscriptions'), teacherId)).then(d => d.data());
    window.showPage = showPage;

    window.addNewGrade = async () => {
        const newGradeName = document.getElementById('new-grade-name')?.value.trim();
        if (newGradeName) await addCustomGradeToFirestore(newGradeName);
        const inputElem = document.getElementById('new-grade-name');
        if (inputElem) inputElem.value = '';
    };
    window.renameGrade = async (oldName, newName) => {
        if (!newName) return;
        await deleteCustomGradeFromFirestore(oldName);
        await addCustomGradeToFirestore(newName);
        const studentsCollectionRef = collection(db, 'students');
        const q = query(studentsCollectionRef, where('grade', '==', oldName));
        const studentsToUpdate = (await getDocs(q)).docs;
        for (const s of studentsToUpdate) {
            await updateDoc(s.ref, { grade: newName });
        }
    };
    window.deleteGrade = async (gradeName) => {
        await deleteCustomGradeFromFirestore(gradeName);
        const studentsCollectionRef = collection(db, 'students');
        const q = query(studentsCollectionRef, where('grade', '==', gradeName));
        const studentsToDelete = (await getDocs(q)).docs;
        for (const s of studentsToDelete) {
            await deleteDoc(s.ref);
        }
    };
    
    window.updateStudentProgress = updateStudentProgress;
    window.getStudentStats = getStudentStats;
    window.setupStudentStatsListener = setupStudentStatsListener;
    
    window.sendTeacherMessage = sendTeacherMessage;
    window.getTeacherMessages = getTeacherMessages;
    window.updateUnreadCount = updateUnreadCount;
    
    window.syncAllToFirebase = syncAllToFirebase;
    window.loadAllFromFirebase = loadAllFromFirebase;
    window.renderGradesGrid = renderGradesGrid;
    window.nextPlayer = nextPlayer;
    window.clearNavigationCache = clearNavigationCache;
    window.renderSubjectsForGrade = renderSubjectsForGrade;
    window.showLessonsList = showLessonsList;
    window.showLessonDetail = showLessonDetail;
    window.showLessonsModal = showLessonsModal;
    window.updateSelectedLessonsPreview = updateSelectedLessonsPreview;
    window.populateSubjectsForGrade = populateSubjectsForGrade;
    window.openMergeModal = openMergeModal;
    window.renderStudentsEdit = renderStudentsEdit;
    window.renderStudentSelect = renderStudentSelect;
    window.addStudentToCurrentRace = addStudentToCurrentRace;
    window.renderTeamsUI = renderTeamsUI;
    window.adjustTeamCount = adjustTeamCount;
    window.shuffleTeams = shuffleTeams;
    window.balancedTeams = balancedTeams;
    window.confirmTeamsAndProceed = confirmTeamsAndProceed;
    window.showAddStudentModal = showAddStudentModal;
    window.renderTeamSetupScreen = renderTeamSetupScreen;
    window.saveTeamTemplate = saveTeamTemplate;
    window.loadTeamTemplate = loadTeamTemplate;
    window.getStudentById = getStudentById;

    window.renderAdvancedStats = renderAdvancedStatsRedirect;
    window.updateStudentSearchList = updateStudentSearchListRedirect;
    window.exportGradeReport = exportGradeReportRedirect;
    window.exportComparisonPDF = exportComparisonPDFRedirect;
    
    window.showAdvancedAnalysis = showAdvancedAnalysis;
    window.printStudentReport = printStudentReport;
    window.showGradeSelectionModal = showGradeSelectionModal;
    window.showStudentSelectionModal = showStudentSelectionModal;

    window.updateTeacherDisplayName = updateTeacherDisplayName;
    window.renderSubscriptionCard = renderSubscriptionCard;
    window.showSubscriptionInfo = showSubscriptionInfo;
    window.refreshTeacherSubscriptionUI = refreshTeacherSubscriptionUI;
    window.renderGradesManagement = renderGradesManagement;

    window.renderTracks = renderTracks;
    window.updateSingleLane = updateSingleLane;
    window.startTimerForCurrentQuestion = startTimerForCurrentQuestion;
    window.handleTimeUp = handleTimeUp;
    window.clearAllRaceTimeouts = clearAllRaceTimeouts;
    window.startCountdown = startCountdown;
    window.showBetOverlay = showBetOverlay;
    window.showTargetSelectionOverlay = showTargetSelectionOverlay;
    window.closeSurpriseOverlay = closeSurpriseOverlay;
    window.showQuestion = showQuestion;
    window.startRaceWithSettings = startRaceWithSettings;
    window.exitRaceImmediate = exitRaceImmediate;
    window.withdrawEntity = withdrawEntity;
    window.RaceSessionManager = RaceSessionManager;
    window.resetTimerBar = resetTimerBar;
    window.lockAnswerButtons = () => document.querySelectorAll('#q-area-opts .option-btn').forEach(btn => btn.disabled = true);
    window.unlockAnswerButtons = () => document.querySelectorAll('#q-area-opts .option-btn').forEach(btn => btn.disabled = false);
    window.clearAllRaceIntervals = () => {
        const activeSession = RaceSessionManager.getActive();
        if (activeSession?.raceData) {
            if (activeSession.raceData.timerInterval) clearInterval(activeSession.raceData.timerInterval);
            if (activeSession.raceData.timerTimeout) clearTimeout(activeSession.raceData.timerTimeout);
            if (activeSession.raceData.memoryTimeout) clearTimeout(activeSession.raceData.memoryTimeout);
            if (activeSession.raceData._timerRaf) cancelAnimationFrame(activeSession.raceData._timerRaf);
        }
    };
    window.updateTimerUI = (sessionId) => {
        const session = RaceSessionManager.getSession(sessionId);
        if (session?.raceData) {
            const timerElem = document.getElementById('timer-text');
            if (timerElem) timerElem.innerText = Math.ceil(session.raceData.timeLeft);
            const percent = (session.raceData.timeLeft / session.raceData.timeLimit) * 100;
            const bar = document.getElementById('timer-bar');
            if (bar) bar.style.width = Math.max(0, percent) + '%';
        }
    };
    window.showFloatingNotification = showFloatingNotification;
    window.playCorrect = playCorrect;
    window.playWrong = playWrong;
    window.playWin = playWin;
    window.toggleMute = toggleMute;
    window.cycleTheme = cycleTheme;
    window.showThemeSelector = showThemeSelector;
    window.applyTheme = applyTheme;
    window.reapplyTheme = reapplyTheme;
    window.smartUploadExcel = smartUploadExcel;
    window.exportQuestionsToExcel = exportQuestionsToExcel;
    window.resetBank = resetBank;
    window.raceSettings = raceSettings;
    window.resetRaceSettings = resetRaceSettings;
    window.loadSettingsPage = loadSettingsPage;
    window.renderModesPage = renderModesPage;
    window.renderLeaderboard = renderLeaderboard;
    window.updateHallFilter = updateHallFilter;
    window.getMostWinsStudent = getMostWinsStudent;
    window.getMostAccurateStudent = getMostAccurateStudent;
    window.refreshGradesPageCache = refreshGradesPageCache;
    window.resetAllSessionData = resetAllSessionData;
    window.showPage = showPage;
    window.logout = () => import('../firebase/auth.js').then(({ logout }) => logout());
    window._cleanupFirestoreListeners = _cleanupFirestoreListeners;
    window.showNotificationsList = showNotificationsList;
    window.updateUnreadNotificationsCount = updateUnreadNotificationsCount;
    
    const createTournamentBtn = document.getElementById('createTournamentBtn');
    if (createTournamentBtn && !createTournamentBtn.hasListener) {
        createTournamentBtn.hasListener = true;
        createTournamentBtn.addEventListener('click', () => window.location.href = 'tournament.html');
    }
    // أضف هذه الأسطر داخل registerGlobalFunctions() في registration.js

// دالة فتح نافذة إنشاء غرفة (للاستخدام العام)
window.openCreateRoomModal = () => {
    // استيراد ديناميكي لتجنب الاعتماد الدائري
    import('../online/lobby/createRoom.js').then(module => {
        if (module.showCreateRoomModal) {
            module.showCreateRoomModal();
        } else {
            console.error('showCreateRoomModal not found');
            window.showFloatingNotification('تعذر فتح نافذة إنشاء الغرفة', 'error');
        }
    }).catch(err => {
        console.error('Failed to load createRoom module:', err);
        window.showFloatingNotification('حدث خطأ في تحميل واجهة الغرفة', 'error');
    });
};

// دالة الانضمام إلى غرفة خاصة (للاستخدام العام)
window.joinPrivateRoom = async () => {
    const code = document.getElementById('join-private-code-input')?.value.trim();
    if (!code) {
        window.showFloatingNotification('يرجى إدخال رمز الغرفة', 'error');
        return;
    }
    try {
        const { joinRoomByCode } = await import('../online/lobby/joinRoom.js');
        await joinRoomByCode(code);
    } catch(err) {
        console.error('Join room error:', err);
        window.showFloatingNotification('فشل الانضمام إلى الغرفة', 'error');
    }
};

// دالة تحديث قائمة الغرف العامة (للوحة الطالب)
window.refreshPublicRooms = async () => {
    try {
        const { getPublicRooms } = await import('../online/lobby/roomListeners.js');
        const rooms = await getPublicRooms();
        const container = document.getElementById('public-rooms-list');
        if (container) {
            if (rooms.length === 0) {
                container.innerHTML = '<div class="text-center text-gray-400">لا توجد غرف عامة حالياً</div>';
            } else {
                container.innerHTML = rooms.map(room => `
                    <div class="glass-panel p-3 flex justify-between items-center">
                        <button onclick="window.joinRoomById('${room.id}')" class="bg-green-600 px-3 py-1 rounded-full text-sm">انضمام</button>
                        <div>
                            <span class="font-bold">${escapeHtml(room.name)}</span>
                            <span class="text-xs text-gray-400 mr-2">${room.players?.length || 0}/${room.maxPlayers || 8}</span>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch(err) {
        console.error('Refresh rooms error:', err);
    }
};

window.joinRoomById = async (roomId) => {
    try {
        const { joinRoomById } = await import('../online/lobby/joinRoom.js');
        await joinRoomById(roomId);
    } catch(err) {
        console.error('Join room by id error:', err);
    }
};

// تأكد من وجود escapeHtml إذا لم تكن معرفة
if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    };
}
}