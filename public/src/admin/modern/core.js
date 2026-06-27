// src/admin/modern/core.js
// تهيئة الصفحة، التبويبات، القائمة الجانبية

import { showNotification } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { renderTeachers } from './teachers.js';
import { renderStudents } from './students.js';
import { renderQuestions } from './questions.js';
import { renderMessages } from './messages.js';
import { renderViolations } from './violations.js';
import { renderAuditLog } from './audit.js';
import { renderSimulateTeacher } from './simulate.js';
import { renderAdvancedSettings } from './advanced.js';
import { renderAssistants } from './assistants.js';

// ========== التهيئة الأساسية ==========
export function initThemeToggle() {
    const isLight = localStorage.getItem('admin_theme') === 'light';
    if (isLight) document.body.classList.add('light-mode');
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('admin_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    });
}

export function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    menuToggle?.addEventListener('click', () => sidebar?.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar?.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuToggle) {
            sidebar.classList.remove('open');
        }
    });
}

export function addRippleEffect() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            const rect = item.getBoundingClientRect();
            ripple.style.left = `${e.clientX - rect.left}px`;
            ripple.style.top = `${e.clientY - rect.top}px`;
            item.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
}

export function logoutAdmin() {
    sessionStorage.removeItem('is_admin');
    sessionStorage.removeItem('peak_teacher_logged_in');
    sessionStorage.removeItem('peak_teacher_code');
    window.location.href = 'index.html';
}

// ========== دالة التبديل بين التبويبات ==========
export async function switchTab(tabId) {
    // تحديث القائمة الجانبية
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.sidebar-item[data-tab="${tabId}"]`).classList.add('active');
    // إخفاء جميع الألواح
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active-tab'));
    document.getElementById(`${tabId}Pane`).classList.add('active-tab');
    // تحميل المحتوى حسب التبويب
    if (tabId === 'dashboard') await renderDashboard();
    else if (tabId === 'teachers') await renderTeachers();
    else if (tabId === 'students') await renderStudents();
    else if (tabId === 'questions') await renderQuestions();
    else if (tabId === 'messages') await renderMessages();
    else if (tabId === 'violations') await renderViolations();
    else if (tabId === 'audit') await renderAuditLog();
    else if (tabId === 'simulate') await renderSimulateTeacher();
    else if (tabId === 'advanced') await renderAdvancedSettings();
    else if (tabId === 'assistants') {
        // لا يسمح للمساعدين برؤية إدارة المساعدين (فقط المطور الحقيقي)
        const isAdmin = sessionStorage.getItem('is_admin') === 'true';
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        const ADMIN_DEV_CODE = "29910141300038";
        if (!isAdmin && teacherCode !== ADMIN_DEV_CODE) {
            Swal.fire('غير مصرح', 'ليس لديك صلاحية الوصول إلى إدارة المساعدين', 'error');
            return;
        }
        await renderAssistants();
    }
}

// ========== ربط أزرار القائمة الجانبية ==========
export function bindSidebarTabs() {
    document.querySelectorAll('.sidebar-item[data-tab]').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });
    document.getElementById('logoutAdminSidebar')?.addEventListener('click', logoutAdmin);
    document.getElementById('refreshDataBtn')?.addEventListener('click', () => {
        const activeTab = document.querySelector('.sidebar-item.active')?.dataset.tab || 'dashboard';
        switchTab(activeTab);
    });
}

// ========== التهيئة الكاملة ==========
export function initCore() {
    initThemeToggle();
    initMobileMenu();
    addRippleEffect();
    bindSidebarTabs();
    applySidebarPermissions();
}

function applySidebarPermissions() {
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    const ADMIN_DEV_CODE = "29910141300038";
    const isDeveloper = isAdmin || teacherCode === ADMIN_DEV_CODE;
    
    if (isDeveloper) return; // المطور يرى كل شيء
    
    const perms = window.currentAdminPermissions;
    if (!perms) return;
    
    const tabPermissions = {
        dashboard: { module: 'dashboard', action: 'view' },
        teachers: { module: 'teachers', action: 'view' },
        students: { module: 'students', action: 'view' },
        questions: { module: 'questions', action: 'view' },
        messages: { module: 'messages', action: 'view' },
        violations: { module: 'violations', action: 'view' },
        audit: { module: 'audit', action: 'view' },
        simulate: { module: 'simulate', action: 'view' },
        advanced: { module: 'advanced', action: 'view' },
        assistants: { module: 'assistants', action: 'view' }
    };
    
    Object.entries(tabPermissions).forEach(([tab, req]) => {
        const has = perms[req.module]?.[req.action] === true;
        if (!has) {
            const sidebarItem = document.querySelector(`.sidebar-item[data-tab="${tab}"]`);
            if (sidebarItem) sidebarItem.style.display = 'none';
        }
    });
}