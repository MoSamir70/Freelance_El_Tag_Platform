// src/landing/navigation.js

export function initSmoothScroll() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId && targetId !== '#') {
                const targetSection = document.querySelector(targetId);
                if (targetSection) {
                    const navHeight = document.querySelector('nav').offsetHeight;
                    const targetPosition = targetSection.offsetTop - navHeight - 10;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

export function updateActiveTab() {
    const nav = document.querySelector('nav');
    if (!nav) return;
    const navHeight = nav.offsetHeight;
    const scrollPos = window.scrollY + navHeight + 80;
    
    let activeTab = null;
    
    document.querySelectorAll('.nav-link').forEach(link => {
        const targetId = link.getAttribute('href');
        if (targetId && targetId !== '#') {
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                const offsetTop = targetSection.offsetTop;
                const offsetBottom = offsetTop + targetSection.offsetHeight;
                if (scrollPos >= offsetTop && scrollPos < offsetBottom - 50) {
                    activeTab = link;
                }
            }
        }
    });
    
    if (!activeTab && window.scrollY < 150 && document.querySelector('.nav-link[href="#home"]')) {
        activeTab = document.querySelector('.nav-link[href="#home"]');
    }
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active-nav-tab'));
    if (activeTab) activeTab.classList.add('active-nav-tab');
}

export function toggleMobileNav() {
    const menu = document.getElementById('mobile-nav-menu');
    if (menu) menu.classList.toggle('open');
}

export function closeMobileNav() {
    const menu = document.getElementById('mobile-nav-menu');
    if (menu) menu.classList.remove('open');
}

// تعريف الدوال العامة للاستخدام في onclick
window.toggleMobileNav = toggleMobileNav;
window.closeMobileNav = closeMobileNav;