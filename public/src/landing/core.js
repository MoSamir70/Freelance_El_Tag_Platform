// src/landing/core.js
import { initSmoothScroll, updateActiveTab, toggleMobileNav, closeMobileNav } from './navigation.js';
import { initHeroButtons } from './sections/hero.js';
import { initExperienceTabs } from './sections/experience-tabs.js';
import { initModesTooltips, initMcqBloom } from './sections/modes.js';
import { initProgressSlider } from './sections/why-taj.js';
import { initAnalytics } from './sections/analytics.js';
import { initTestimonials } from './sections/testimonials.js';
import { initFaqAccordion } from './sections/faq.js';
import { initDeveloperCard } from './sections/developer.js';
import { initPricingButtons } from './sections/pricing.js';
import { initFutureVision } from './sections/future-vision.js';
import { initLoginModal } from './modals/login-modal.js';
import { checkMaintenanceBeforeAction, showMaintenanceModal } from './maintenance.js';
import { initLiveStats, registerVisitor } from './sections/liveStats.js';
import './globals.js';

// ✅ تعريف دوال عامة للنافذة المنبثقة (كداعم احتياطي في حال فشل login-modal.js)
function globalOpenLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'flex';
}
function globalCloseLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
}
window.openLoginModal = globalOpenLoginModal;
window.closeLoginModal = globalCloseLoginModal;

// دوال عامة للثيمات والخلفيات
function initBackToTop() {
    const backBtn = document.getElementById('backToTop');
    if (backBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) backBtn.classList.add('visible');
            else backBtn.classList.remove('visible');
        });
        backBtn.onclick = () => window.scrollTo({top: 0, behavior: 'smooth'});
    }
}

function initThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
        });
    }
}

function initGlobalListeners() {
    window.addEventListener('scroll', updateActiveTab);
    window.addEventListener('resize', updateActiveTab);
    
    const hamburgerBtn = document.getElementById('hamburger-btn');
    if (hamburgerBtn) {
        hamburgerBtn.onclick = () => {
            const menu = document.getElementById('mobile-nav-menu');
            if (menu) menu.classList.toggle('open');
        };
    }
}

function initScrollEffects() {
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -15% 0px',
        threshold: 0.01
    };
    
    const observer = new IntersectionObserver((entries) => { 
        entries.forEach(entry => { 
            if (entry.isIntersecting) { 
                entry.target.style.opacity = '1'; 
                entry.target.style.transform = 'translateY(0) scale(1) rotateX(0deg)';
                entry.target.style.filter = 'drop-shadow(0 20px 30px rgba(0,0,0,0.7))';
            } else {
                entry.target.style.opacity = '0'; 
                entry.target.style.transform = 'translateY(60px) scale(0.92) rotateX(-8deg)';
                entry.target.style.filter = 'drop-shadow(0 0px 0px rgba(0,0,0,0))';
            }
        }); 
    }, observerOptions);
    
    document.querySelectorAll('.glass-card, .pricing-card, .comment-card-user, .mcq-bloom-card, #multi-device-hub .group').forEach(el => {
        el.style.opacity = '0'; 
        el.style.transform = 'translateY(60px) scale(0.92) rotateX(-8deg)';
        el.style.transformOrigin = 'center bottom';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.85s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.6s ease-out';
        observer.observe(el);
    });
}

function initCouponHandler() {
    const couponBtn = document.getElementById('coupon-redeem-btn');
    if (couponBtn) {
        couponBtn.removeAttribute('onclick');
        couponBtn.addEventListener('click', () => {
            window.open('coupon.html', '_blank', 'width=600,height=700,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes');
        });
    }
}

// فحص الصيانة عند التحميل
async function immediateMaintenanceCheck() {
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    const isTeacherLogged = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    const isDeveloper = teacherCode === (typeof ADMIN_SECRET_KEY !== 'undefined' ? ADMIN_SECRET_KEY : '');
    
    if (isTeacherLogged && !isDeveloper) {
        const maintenance = await checkMaintenanceBeforeAction();
        if (maintenance.maintenance) {
            await showMaintenanceModal(maintenance.message, maintenance.endTime);
            if (typeof window.logout === 'function') window.logout();
            else {
                sessionStorage.clear();
                window.location.reload();
            }
        }
    }
}

// التهيئة الرئيسية
document.addEventListener('DOMContentLoaded', () => {
    // تهيئة المكونات الأساسية
    initBackToTop();
    initThemeToggle();
    initGlobalListeners();
    initSmoothScroll();
    initLiveStats();

    // تهيئة الأقسام
    initHeroButtons();
    initExperienceTabs();
    initModesTooltips();
    initMcqBloom();
    initProgressSlider();
    initAnalytics();
    initTestimonials();
    initFaqAccordion();
    initDeveloperCard();
    initPricingButtons();
    initFutureVision();
    initLoginModal();   // قد تفشل هذه الدالة إذا كان maintenance.js به مشكلة، لكن الأزرار ستعمل بفضل الدوال العامة
    
    // تأثيرات التمرير
    initScrollEffects();
    
    // معالج الكوبون
    initCouponHandler();
    
    // فحص الصيانة
    immediateMaintenanceCheck();
    
    // تسجيل زائر جديد (مرة واحدة لكل جلسة)
    if (!sessionStorage.getItem('visitor_registered')) {
        registerVisitor().catch(err => console.warn('تسجيل الزائر فشل:', err));
        sessionStorage.setItem('visitor_registered', 'true');
    }
    
    console.log('✅ Landing page modules initialized successfully');
});