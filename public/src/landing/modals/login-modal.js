// src/landing/modals/login-modal.js
import { checkMaintenanceBeforeAction, showMaintenanceModal } from '../maintenance.js';

let loginModal = null;
let roleDiv = null;
let teacherPrompt = null;
let studentPrompt = null;

function openLoginModal() { 
    if (loginModal) loginModal.style.display = 'flex'; 
}

function closeLoginModal() { 
    if (loginModal) loginModal.style.display = 'none'; 
    if (roleDiv) roleDiv.classList.remove('hidden');
    if (teacherPrompt) teacherPrompt.classList.add('hidden');
    if (studentPrompt) studentPrompt.classList.add('hidden');
}

export function initLoginModal() {
    loginModal = document.getElementById('login-modal');
    roleDiv = document.getElementById('role-selection-buttons');
    teacherPrompt = document.getElementById('teacher-code-prompt');
    studentPrompt = document.getElementById('student-id-prompt');
    const teacherCodeInput = document.getElementById('teacher-code-input');
    const studentIdInput = document.getElementById('student-id-input');
    
    window.openLoginModal = openLoginModal;
    window.closeLoginModal = closeLoginModal;
    
    const navLoginBtn = document.getElementById('nav-login-btn');
    const heroLoginBtn = document.getElementById('hero-login-btn');
    const closeBtn = document.getElementById('close-login-modal');
    const enterTeacherBtn = document.getElementById('enter-as-teacher-btn');
    const enterStudentBtn = document.getElementById('enter-as-student-btn');
    const backToRoleTeacher = document.getElementById('back-to-role-from-teacher-btn');
    const backToRoleStudent = document.getElementById('back-to-role-selection-btn');
    const confirmTeacherBtn = document.getElementById('confirm-teacher-login-btn');
    const confirmStudentBtn = document.getElementById('confirm-student-id-btn');
    
    if (navLoginBtn) navLoginBtn.addEventListener('click', openLoginModal);
    if (heroLoginBtn) heroLoginBtn.addEventListener('click', openLoginModal);
    if (closeBtn) closeBtn.addEventListener('click', closeLoginModal);
    if (loginModal) {
        loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeLoginModal(); });
    }
    
    if (enterTeacherBtn) {
        enterTeacherBtn.addEventListener('click', () => {
            if (roleDiv) roleDiv.classList.add('hidden');
            if (teacherPrompt) teacherPrompt.classList.remove('hidden');
        });
    }
    if (enterStudentBtn) {
        enterStudentBtn.addEventListener('click', () => {
            if (roleDiv) roleDiv.classList.add('hidden');
            if (studentPrompt) studentPrompt.classList.remove('hidden');
        });
    }
    if (backToRoleTeacher) {
        backToRoleTeacher.addEventListener('click', () => {
            if (roleDiv) roleDiv.classList.remove('hidden');
            if (teacherPrompt) teacherPrompt.classList.add('hidden');
        });
    }
    if (backToRoleStudent) {
        backToRoleStudent.addEventListener('click', () => {
            if (roleDiv) roleDiv.classList.remove('hidden');
            if (studentPrompt) studentPrompt.classList.add('hidden');
        });
    }
    
    // تأكيد دخول المعلم (المسار الصحيح: ../../firebase/auth.js)
    if (confirmTeacherBtn) {
        confirmTeacherBtn.addEventListener('click', async () => {
            const code = teacherCodeInput?.value.trim();
            const isDeveloper = (typeof ADMIN_SECRET_KEY !== 'undefined' && code === ADMIN_SECRET_KEY);
            
            if (!isDeveloper) {
                const maintenance = await checkMaintenanceBeforeAction();
                if (maintenance.maintenance) {
                    await showMaintenanceModal(maintenance.message, maintenance.endTime);
                    return;
                }
            }
            
            if (!code) {
                Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى إدخال كود المعلم', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#EF4444' });
                return;
            }
            
            try {
                const { loginAsDeveloper, loginAsOrdinaryTeacher } = await import('../../firebase/auth.js');
                let result;
                if (isDeveloper) {
                    result = await loginAsDeveloper(code);
                } else {
                    result = await loginAsOrdinaryTeacher(code);
                }
                
                if (result && result.success) {
                    window.location.href = 'platform.html';
                } else {
                    Swal.fire({ icon: 'error', title: 'فشل الدخول', text: result?.error || 'كود غير صحيح', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#EF4444' });
                }
            } catch (err) {
                console.error(err);
                Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء محاولة الدخول', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#EF4444' });
            }
        });
    }
    
    // تأكيد دخول الطالب (المسار الصحيح: ../../firebase/auth.js)
    if (confirmStudentBtn) {
        confirmStudentBtn.addEventListener('click', async () => {
            const studentId = studentIdInput?.value.trim();
            const maintenance = await checkMaintenanceBeforeAction();
            if (maintenance.maintenance) {
                await showMaintenanceModal(maintenance.message, maintenance.endTime);
                return;
            }
            if (!studentId) {
                Swal.fire({ icon: 'error', title: 'معرف غير صحيح', text: 'يرجى إدخال معرف الطالب', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#EF4444' });
                return;
            }
            
            try {
                const { loginAsStudent } = await import('../../firebase/auth.js');
                const result = await loginAsStudent(studentId);
                if (!result.success) {
                    Swal.fire({ icon: 'error', title: 'فشل الدخول', text: result.error || 'معرف غير صحيح أو غير موجود', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#EF4444' });
                }
                // loginAsStudent يقوم بالتوجيه عند النجاح
            } catch (err) {
                console.error(err);
                Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء محاولة الدخول', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#EF4444' });
            }
        });
    }
}