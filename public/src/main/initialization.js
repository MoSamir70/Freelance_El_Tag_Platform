import { 
    db, collection, getDocs, addDoc 
} from '../firebase/init.js';
import { registerGlobalAuthFunctions, _getSecureStudentId } from '../firebase/auth.js';
import { loadLightData, ensureDefaultGrades, refreshAllGradeSelects } from '../db/localstorage.js';
import { addGlobalStyles, createStars } from '../utils/helpers/dom.js';
import { showLoading, hideLoading } from '../utils/helpers/loader.js';
import { applyTheme, reapplyTheme, observeDynamicContent, hookThemeButtons } from '../ui/themes.js';
import { showPage, setupNavButtons } from '../ui/navigation.js';
import { updateTeacherDisplayName, renderSubscriptionCard, showSubscriptionInfo, refreshTeacherSubscriptionUI } from '../teacher/dashboard.js';
import { setupFirestoreListeners, setupStudentStatsListener, _cleanupFirestoreListeners } from './firestore-listeners.js';
import { setupNotificationsListener } from './notifications-listener.js'; // سننشئ هذا الملف
import { checkMaintenanceOnLoad, setupMaintenanceWatcher, showExpiredModal } from './maintenance.js';
import { resetAllSessionData } from './reset-session.js';
import { registerGlobalFunctions } from './registration.js';
import { bindPageEvents, bindQuestionBankEvents, bindAdvancedSettingsEvents, bindScoreAdjustEvents } from './event-bindings.js';
import { bindExcelEvents } from '../questions/excel.js';
import { startTimeoutService } from '../services/tournamentTimeoutService.js';
import { startArchiveService } from '../services/archiveService.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';

const ADMIN_SECRET_KEY = "29910141300038";

// تهيئة الصوت (تعطيل مؤقت)
const initSounds = () => {};
const updateSoundButtonIcon = () => {};
const isSoundMuted = false;

async function loadInitialData() {
    showLoading();
    try {
        loadLightData();
        await ensureDefaultGrades();
        const customGradesCollection = collection(db, 'customGrades');
        const gradesSnapshot = await getDocs(customGradesCollection);
        if (gradesSnapshot.empty) {
            const { getDynamicGrades } = await import('../db/localstorage.js');
            const defaultGrades = getDynamicGrades();
            const { addCustomGradeToFirestore } = await import('./grade-helpers.js');
            for (const grade of defaultGrades) await addCustomGradeToFirestore(grade);
        }
        initSounds();
        addGlobalStyles();
        createStars();
        updateSoundButtonIcon();
        const savedTheme = localStorage.getItem('peak_theme') || 'theme-default';
        applyTheme(savedTheme);
        refreshAllGradeSelects();
        
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        const studentId = await _getSecureStudentId();
        if (teacherCode && sessionStorage.getItem('peak_teacher_logged_in') === 'true') {
            updateTeacherDisplayName();
            setupFirestoreListeners(teacherCode);
        } else if (studentId) {
            await setupStudentStatsListener(studentId);
        } else {
            setupFirestoreListeners(null);
        }
        hideLoading();
        return true;
    } catch (error) {
        console.error(error);
        hideLoading();
        return false;
    }
}

export async function start() {
    const urlParams = new URLSearchParams(window.location.search);
    const raceMode = urlParams.get('race');
    if (raceMode === 'participant' || raceMode === 'observer') {
        console.log('[Main] Race mode, skipping full initialization');
        registerGlobalAuthFunctions();
        return;
    }
    
    registerGlobalAuthFunctions();
    
    const simulateMode = sessionStorage.getItem('simulate_mode') === 'true';
    const simulateTeacherCode = sessionStorage.getItem('simulate_teacher_code');
    
    if (simulateMode && simulateTeacherCode) {
        console.log('[Main] Simulate mode detected for teacher:', simulateTeacherCode);
        if (typeof window._loginAsTeacher === 'function') {
            const result = await window._loginAsTeacher(simulateTeacherCode);
            if (!result || !result.success) {
                console.error('[Main] Simulation login failed:', result?.error);
                if (typeof showFloatingNotification === 'function') {
                    showFloatingNotification('فشل الدخول في وضع المحاكاة', 'error');
                }
                return;
            }
        } else {
            console.error('[Main] _loginAsTeacher not available');
        }
    }
    
    console.log('[Main] Starting with full Firebase sync');
    
    if (window.location.pathname.includes('arena.html')) {
        registerGlobalFunctions();
        return;
    }
    
    resetAllSessionData();
    await loadInitialData();
    registerGlobalFunctions();
    
    const teacherLogged = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    const studentId = await _getSecureStudentId();
    
    if (studentId && !teacherLogged) {
        window.location.href = 'arena.html';
        return;
    }
    
    if (!teacherLogged && !studentId) {
        console.log('[Main] No active session, redirecting to landing.html');
        window.location.href = 'index.html';
        return;
    }
    
    if (teacherLogged) {
        const authScreen = document.getElementById('auth-screen');
        const navbar = document.getElementById('navbar');
        const mainContent = document.getElementById('main-content');
        
        if (authScreen) authScreen.classList.add('hidden');
        if (navbar) navbar.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
        
        const teacherHome = document.getElementById('teacher-home');
        const studentHome = document.getElementById('student-home');
        const teacherStats = document.getElementById('teacher-stats');
        const studentStatsDiv = document.getElementById('student-stats');
        
        if (teacherHome) teacherHome.classList.remove('hidden');
        if (studentHome) studentHome.classList.add('hidden');
        if (teacherStats) teacherStats.classList.remove('hidden');
        if (studentStatsDiv) studentStatsDiv.classList.add('hidden');
        
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        updateTeacherDisplayName();
        
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        if (teacherCode) {
            setupFirestoreListeners(teacherCode);
            setupNotificationsListener(teacherCode);
            renderSubscriptionCard(teacherCode);
            const { subscribeToTeacherData } = await import('../services/dataService.js');
            window._teacherDataUnsubscribe = subscribeToTeacherData(teacherCode);
            const isDeveloper = teacherCode === ADMIN_SECRET_KEY;
            const canProceed = await checkMaintenanceOnLoad(teacherCode, isDeveloper);
            if (!canProceed) return;
            setupMaintenanceWatcher(teacherCode, isDeveloper);
        }
        
        let subscriptionCheckInterval = setInterval(async () => {
            const currentTeacherCode = sessionStorage.getItem('peak_teacher_code');
            if (currentTeacherCode) {
                try {
                    const { refreshTeacherSession } = await import('../services/subscriptionGuard.js');
                    const isValid = await refreshTeacherSession(currentTeacherCode);
                    if (!isValid) {
                        clearInterval(subscriptionCheckInterval);
                        showExpiredModal();
                    }
                } catch (err) {
                    console.warn('[Main] Subscription check error:', err);
                }
            } else {
                clearInterval(subscriptionCheckInterval);
            }
        }, 5 * 60 * 1000);
        window._subscriptionCheckInterval = subscriptionCheckInterval;
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        
        setTimeout(() => reapplyTheme(), 100);
    }
    
    setupNavButtons();
    
    const statsNavBtn = document.querySelector('[data-nav="stats-page"]');
    if (statsNavBtn) {
        statsNavBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'stats-preview.html';
        });
    }
    
    const adminNavBtn = document.querySelector('[data-nav="admin-page"]');
    if (adminNavBtn) {
        adminNavBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isAdmin = sessionStorage.getItem('is_admin') === 'true';
            if (isAdmin) {
                window.location.href = 'admin-panel.html';
            } else {
                showFloatingNotification('غير مصرح لك بالدخول إلى لوحة التحكم', 'error');
            }
        });
    }
    
    bindPageEvents();
    bindQuestionBankEvents();
    bindExcelEvents();
    hookThemeButtons();
    bindAdvancedSettingsEvents();
    bindScoreAdjustEvents();
    observeDynamicContent();
    
    showPage('home');
    
    console.log('[Main] Platform ready');
    
    startTimeoutService();
    startArchiveService();
}