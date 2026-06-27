// src/ui/navigation.js
// إدارة التنقل بين صفحات المنصة مع تحسين الأداء
// [FIX] تحسين معالجة زر الانسحاب لتمرير المعاملات بشكل صحيح
// [FIX] إضافة debouncing لمنع التنقل المتكرر
// [FIX] تحسين إدارة الكاش وتحديثه عند تغيير الصفحات
// [FIX] إضافة معالجة الأخطاء للصفحات غير الموجودة
// [MOD] عند فتح "التحليلات المتقدمة" يتم التوجيه إلى stats-preview.html مع فحص الصلاحية


import { raceSettings } from '../core/raceSettings.js';
import { renderStudentSelect } from '../students/studentManager.js';
import { renderTeamSetupScreen } from '../students/studentManager.js';
import { loadSettingsPage, renderModesPage } from './gameSetupNew.js';
import { renderStudentsEdit } from '../students/studentManager.js';
import { renderLeaderboard, updateHallFilter } from '../students/leaderboard.js';
import { renderSubjectsForGrade } from '../questions/bank.js';
import { switchStudentTab } from '../student/dashboard.js';
import { updateTeacherDisplayName } from '../teacher/dashboard.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';
import { canAccessAnalytics } from '../services/subscriptionGuard.js';
import { getCurrentUserInfo } from '../firebase/auth.js';
export let currentPage = 'home';

let cachedPages = null;
let cachedNavButtons = null;
let navDebounceTimer = null;
let isNavigating = false;

function refreshDOMElements() {
    if (!cachedPages) {
        cachedPages = {};
        document.querySelectorAll('.page').forEach(p => {
            cachedPages[p.id] = p;
        });
    }
    if (!cachedNavButtons) {
        cachedNavButtons = {};
        document.querySelectorAll('#navbar .nav-main-btn').forEach(btn => {
            const navId = btn.getAttribute('data-nav');
            if (navId) cachedNavButtons[navId] = btn;
        });
    }
}

export function clearNavigationCache() {
    cachedPages = null;
    cachedNavButtons = null;
    if (navDebounceTimer) clearTimeout(navDebounceTimer);
    navDebounceTimer = null;
    console.log('[Navigation] Cache cleared');
    if (currentPage) {
        setTimeout(() => {
            executeShowPage(currentPage);
        }, 10);
    }
}

export function refreshGradesPageCache() {
    if (cachedPages) {
        const gradesPage = document.getElementById('grades-page');
        if (gradesPage) cachedPages['grades-page'] = gradesPage;
    }
    console.log('[Navigation] Grades page cache refreshed');
}

export function showPage(pageId) {
    if (isNavigating) {
        console.log(`[Navigation] Skipping navigation to ${pageId} - already navigating`);
        return;
    }
    if (navDebounceTimer) clearTimeout(navDebounceTimer);
    navDebounceTimer = setTimeout(() => {
        navDebounceTimer = null;
        executeShowPage(pageId);
    }, 50);
}

function executeShowPage(pageId) {
    if (isNavigating) return;
    isNavigating = true;
    
    try {
        refreshDOMElements();
        
        if (cachedNavButtons) {
            Object.values(cachedNavButtons).forEach(btn => btn.classList.remove('active-nav'));
            if (cachedNavButtons[pageId]) cachedNavButtons[pageId].classList.add('active-nav');
        }
        
        if (cachedPages) {
            Object.values(cachedPages).forEach(p => p.classList.add('hidden'));
        } else {
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        }
        
        const target = cachedPages?.[pageId] || document.getElementById(pageId);
        if (!target) {
            console.error(`[Navigation] Page "${pageId}" not found`);
            showFloatingNotification(`الصفحة "${pageId}" غير موجودة`, 'error');
            isNavigating = false;
            return;
        }
        
        target.classList.remove('hidden');
        currentPage = pageId;
        
        switch (pageId) {
            case 'grade-choice-page':
                if (typeof window.renderGradesGrid === 'function') window.renderGradesGrid();
                break;
            case 'student-select-page':
                const titleEl = document.getElementById('studentSelectTitle');
                if (titleEl) titleEl.innerText = raceSettings.raceType === 'solo' ? '🎖️ اختر طالبًا واحدًا (فردي)' : '👥 اختر الطلاب';
                raceSettings.studentIds = [];
                renderStudentSelect();
                break;
            case 'team-setup-screen':
                renderTeamSetupScreen();
                break;
            case 'game-settings-page':
                loadSettingsPage();
                break;
            case 'game-mode-page':
                renderModesPage();
                break;
            case 'st-page':
                renderStudentsEdit(document.getElementById('student-grade-filter')?.value);
                break;
            case 'hall-page':
                renderLeaderboard().catch(err => console.warn('Leaderboard error:', err));
                updateHallFilter();
                break;
            case 'stats-page':
                // ✅ فتح صفحة الإحصائيات مع التحقق من الصلاحية
                (async () => {
                    const user = await getCurrentUserInfo();
                    if (user && user.plan === 'free') {
                        showFloatingNotification('❌ الباقة المجانية لا تسمح بالوصول إلى التحليلات المتقدمة.', 'error');
                        return;
                    }
                    const canAccess = await canAccessAnalytics(user.id, user.isTeacher);
                    if (!canAccess) {
                        showFloatingNotification('❌ هذه الميزة غير متاحة في خطتك الحالية. يرجى الترقية.', 'error');
                        return;
                    }
                    window.open('stats-preview.html', '_blank');
                })();
                break;
            case 'grades-page':
                if (typeof window.renderGradesManagement === 'function') window.renderGradesManagement();
                break;
            case 'q-page':
                const sel = document.getElementById('q-grade-sel');
                if (sel && sel.value) renderSubjectsForGrade(sel.value);
                break;
            case 'home':
                document.body.classList.add('no-scroll');
                const studentHome = document.getElementById('student-home');
                if (studentHome && !studentHome.classList.contains('hidden')) {
                    switchStudentTab('profile');
                    loadPublicRooms();
                }
                const teacherHome = document.getElementById('teacher-home');
                if (teacherHome && !teacherHome.classList.contains('hidden')) {
                    updateTeacherDisplayName();
                }
                break;
            default:
                document.body.classList.remove('no-scroll');
                break;
        }
    } catch (error) {
        console.error(`[Navigation] Error showing page ${pageId}:`, error);
        showFloatingNotification('حدث خطأ أثناء التنقل', 'error');
    } finally {
        isNavigating = false;
    }
}

let navClickHandlerAttached = false;

export function setupNavButtons() {
    if (navClickHandlerAttached) return;
    document.body.removeEventListener('click', handleNavClick);
    document.body.addEventListener('click', handleNavClick);
    navClickHandlerAttached = true;
    console.log('[Navigation] Nav buttons handler attached');
}

function handleNavClick(e) {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) {
        e.preventDefault();
        e.stopPropagation();
        showPage(navBtn.dataset.nav);
        return;
    }
    
    const racePrepBtn = e.target.closest('[data-race-prep]');
    if (racePrepBtn) {
        e.preventDefault();
        e.stopPropagation();
        raceSettings.raceType = racePrepBtn.dataset.racePrep;
        raceSettings.isTeam = false;
        raceSettings.teams = [];
        raceSettings.studentIds = [];
        showPage('grade-choice-page');
        return;
    }
    
    const competitionBtn = e.target.closest('[data-competition]');
    if (competitionBtn) {
        e.preventDefault();
        e.stopPropagation();
        raceSettings.isTeam = (competitionBtn.dataset.competition === 'teams');
        showPage('student-select-page');
        return;
    }
    
    const backBtn = e.target.closest('[data-nav-back]');
    if (backBtn) {
        e.preventDefault();
        e.stopPropagation();
        showPage(backBtn.getAttribute('data-nav-back'));
        return;
    }
    
    const target = e.target;
    const { id, classList, dataset } = target;
    
    if (id === 'logout-btn' && typeof window.logout === 'function') {
        e.preventDefault();
        window.logout();
        return;
    }
    if (id === 'toggle-sound-btn' && typeof window.toggleMute === 'function') {
        window.toggleMute();
        return;
    }
    if (id === 'refresh-public-rooms-btn') {
        loadPublicRooms();
        return;
    }
    if (id === 'refresh-online-users-btn' && typeof window.renderOnlineUsersList === 'function') {
        window.renderOnlineUsersList();
        return;
    }
    if (id === 'expired-logout-btn') {
        document.getElementById('expired-subscription-modal')?.classList.add('hidden');
        if (typeof window.logout === 'function') window.logout();
        return;
    }
    if (id === 'fullscreenBtn') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
        return;
    }
    if (id === 'exitRaceBtn' && typeof window.exitRaceImmediate === 'function') {
        window.exitRaceImmediate();
        return;
    }
    
    if (classList.contains('withdraw-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const sessionId = dataset.sessionId;
        const entityId = dataset.entityId;
        const isTeam = dataset.isTeam === 'true';
        console.log('[Navigation] Withdraw button clicked:', { sessionId, entityId, isTeam });
        if (sessionId && entityId && typeof window.withdrawEntity === 'function') {
            window.withdrawEntity(sessionId, entityId, isTeam);
        } else if (typeof window.withdrawEntity === 'function') {
            console.warn('[Navigation] No sessionId in button, calling with entity only');
            window.withdrawEntity(null, entityId, isTeam);
        } else {
            console.error('[Navigation] withdrawEntity function not found');
            showFloatingNotification('لا يمكن الانسحاب الآن، حاول مرة أخرى', 'error');
        }
        return;
    }
    
    const tabBtn = e.target.closest('.student-tab-btn');
    if (tabBtn && typeof switchStudentTab === 'function') {
        e.preventDefault();
        switchStudentTab(tabBtn.dataset.tab);
        return;
    }
    
    const gradeFilter = document.getElementById('student-grade-filter');
    if (gradeFilter && (target === gradeFilter || gradeFilter.contains(target))) {
        gradeFilter.addEventListener('change', (e2) => {
            renderStudentsEdit(e2.target.value);
        }, { once: true });
    }
}

export function navigateToHomeAndReset() {
    resetRaceSettings();
    showPage('home');
    if (typeof window.resetAllSessionData === 'function') {
        window.resetAllSessionData();
    }
}

export { refreshDOMElements, executeShowPage };