// src/landing/utils/counters.js
import { animateNumber } from './helpers.js';

export function observeCounters() {
    const counters = document.querySelectorAll('.counter');
    const counterObserver = new IntersectionObserver((entries) => { 
        entries.forEach(entry => { 
            if (entry.isIntersecting) { 
                const target = parseInt(entry.target.dataset.target);
                animateNumber(entry.target, target);
                counterObserver.unobserve(entry.target);
            } 
        }); 
    }, { threshold: 0.5 });
    counters.forEach(counter => counterObserver.observe(counter));
}