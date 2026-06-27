// src/landing/sections/pricing.js

export function initPricingButtons() {
    const freeBtn = document.querySelector('.free-plan button');
    const silverBtn = document.querySelector('.silver-plan button');
    const goldBtn = document.querySelector('.pricing-card.popular .btn-gold-cta');
    
    const openLoginWithPlan = (plan) => {
        if (window.openLoginModal) {
            window.openLoginModal();
            sessionStorage.setItem('selected_plan', plan);
        } else {
            console.warn('openLoginModal not defined');
        }
    };
    
    if (freeBtn) {
        freeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openLoginWithPlan('free');
        });
    }
    if (silverBtn) {
        silverBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openLoginWithPlan('silver');
        });
    }
    if (goldBtn) {
        goldBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openLoginWithPlan('gold');
        });
    }
}