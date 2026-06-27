// src/landing/login-fallback.js
// هذا الملف مسؤول عن تسجيل الدخول بشكل مستقل مع تعيين الجلسة

window.openLoginModal = function() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeLoginModal = function() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', function() {
    // ربط أزرار الفتح
    const navBtn = document.getElementById('nav-login-btn');
    if (navBtn) navBtn.addEventListener('click', window.openLoginModal);
    const heroBtn = document.getElementById('hero-login-btn');
    if (heroBtn) heroBtn.addEventListener('click', window.openLoginModal);
    
    // ربط إغلاق النافذة
    const closeBtn = document.getElementById('close-login-modal');
    if (closeBtn) closeBtn.addEventListener('click', window.closeLoginModal);
    
    // أزرار التبديل بين الأدوار
    const enterTeacher = document.getElementById('enter-as-teacher-btn');
    const enterStudent = document.getElementById('enter-as-student-btn');
    const backTeacher = document.getElementById('back-to-role-from-teacher-btn');
    const backStudent = document.getElementById('back-to-role-selection-btn');
    
    if (enterTeacher) {
        enterTeacher.addEventListener('click', () => {
            document.getElementById('role-selection-buttons').classList.add('hidden');
            document.getElementById('teacher-code-prompt').classList.remove('hidden');
        });
    }
    if (enterStudent) {
        enterStudent.addEventListener('click', () => {
            document.getElementById('role-selection-buttons').classList.add('hidden');
            document.getElementById('student-id-prompt').classList.remove('hidden');
        });
    }
    if (backTeacher) {
        backTeacher.addEventListener('click', () => {
            document.getElementById('role-selection-buttons').classList.remove('hidden');
            document.getElementById('teacher-code-prompt').classList.add('hidden');
        });
    }
    if (backStudent) {
        backStudent.addEventListener('click', () => {
            document.getElementById('role-selection-buttons').classList.remove('hidden');
            document.getElementById('student-id-prompt').classList.add('hidden');
        });
    }
    
    // تأكيد دخول المعلم
    const confirmTeacher = document.getElementById('confirm-teacher-login-btn');
    if (confirmTeacher) {
        confirmTeacher.addEventListener('click', function() {
            const code = document.getElementById('teacher-code-input').value.trim();
            if (!code) {
                Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء إدخال كود المعلم' });
                return;
            }
            
            // كود المطور
            if (code === '29910141300038') {
                // ✅ تعيين الجلسة لتجنب إعادة التوجيه المستمر
                sessionStorage.setItem('peak_teacher_logged_in', 'true');
                sessionStorage.setItem('peak_teacher_code', code);
                sessionStorage.setItem('peak_teacher_name', 'المطور (صاحب المنصة)');
                sessionStorage.setItem('is_admin', 'true');
                sessionStorage.setItem('teacher_plan', 'platinum');
                sessionStorage.setItem('teacher_locked_subject', '');
                
                window.location.href = 'platform.html';
                return;
            }
            
            // إذا كان الكود غير مطابق، نعطي رسالة خطأ (بدون توجيه)
            Swal.fire({ icon: 'error', title: 'فشل الدخول', text: 'كود المعلم غير صحيح' });
        });
    }
    
    // تأكيد دخول الطالب (اختياري)
    
// تأكيد دخول الطالب
const confirmStudent = document.getElementById('confirm-student-id-btn');
if (confirmStudent) {
    confirmStudent.addEventListener('click', async function() {
        const id = document.getElementById('student-id-input').value.trim();
        if (!id) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء إدخال معرف الطالب' });
            return;
        }
        try {
            const { loginAsStudent } = await import('../firebase/auth.js');
            const result = await loginAsStudent(id);
            if (!result.success) {
                Swal.fire({ icon: 'error', title: 'فشل الدخول', text: result.error || 'معرف غير صحيح' });
            }
            // loginAsStudent يقوم بالتوجيه عند النجاح
        } catch (err) {
            console.error(err);
            Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء محاولة الدخول' });
        }
    });
}
});