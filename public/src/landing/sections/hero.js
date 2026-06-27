// src/landing/sections/hero.js

export function initHeroButtons() {
    const heroLoginBtn = document.getElementById('hero-login-btn');
    if (heroLoginBtn) {
        heroLoginBtn.addEventListener('click', () => {
            if (window.openLoginModal) window.openLoginModal();
        });
    }
    
    // زر شاهد الفيديو (اختياري)
    const videoBtn = document.querySelector('#home .glass-card:last-child');
    if (videoBtn) {
        videoBtn.addEventListener('click', () => {
            if (window.showFloatingNotification) {
                window.showFloatingNotification('جاري تجهيز الفيديو التعريفي...', 'info');
            }
        });
    }
}