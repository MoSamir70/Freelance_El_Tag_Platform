// src/landing/sections/experience-tabs.js

export function switchPremiumTab(key) {
    // تحديث الكلاسات النشطة على الأزرار العلوية
    document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
        btn.classList.remove('premium-tab-active');
    });
    const activeBtn = document.getElementById(`tab-btn-${key}`);
    if(activeBtn) activeBtn.classList.add('premium-tab-active');

    // إخفاء كافة لوحات العرض
    document.querySelectorAll('.premium-pane').forEach(pane => {
        pane.classList.add('hidden');
        pane.style.opacity = '0';
        pane.style.transform = 'translateY(12px)';
    });

    // إظهار اللوحة المستهدفة
    const activePane = document.getElementById(`premium-pane-${key}`);
    if(activePane) {
        activePane.classList.remove('hidden');
        setTimeout(() => {
            activePane.style.opacity = '1';
            activePane.style.transform = 'translateY(0)';
        }, 40);
    }
}

export function initExperienceTabs() {
    const teacherBtn = document.getElementById('tab-btn-teacher');
    const studentBtn = document.getElementById('tab-btn-student');
    const parentBtn = document.getElementById('tab-btn-parent');
    
    if (teacherBtn) teacherBtn.onclick = () => switchPremiumTab('teacher');
    if (studentBtn) studentBtn.onclick = () => switchPremiumTab('student');
    if (parentBtn) parentBtn.onclick = () => switchPremiumTab('parent');
}

// تعريف الدالة العامة للاستخدام المباشر في onclick
window.switchPremiumTab = switchPremiumTab;