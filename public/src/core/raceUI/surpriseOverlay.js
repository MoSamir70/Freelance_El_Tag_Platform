// src/core/raceUI/surpriseOverlay.js
// نافذة اختيار الهدف لبطاقات المفاجآت (Surprise Cards) في وضع solo_surprise
// [FIX] تصدير الدوال بشكل صحيح (export function)

import { DEFAULT_IMG } from '../../constants.js';
import { escapeHtml, showFloatingNotification } from '../../utils.js';

let surpriseOverlayActive = false;
let surpriseResolve = null;
let surpriseTimerInterval = null;

export function showTargetSelectionOverlay(sessionId, card, opponents, raceData) {
    return new Promise((resolve) => {
        if (surpriseOverlayActive) {
            if (surpriseResolve) surpriseResolve(null);
            closeSurpriseOverlay();
        }
        
        surpriseResolve = resolve;
        surpriseOverlayActive = true;

        const overlay = document.createElement('div');
        overlay.id = 'surprise-target-overlay';
        overlay.className = 'surprise-glass-overlay';
        let timeLeft = 15;
        let choiceMade = false;

        const updateTimerDisplay = () => {
            const timerSpan = overlay.querySelector('.surprise-timer-number');
            if (timerSpan) timerSpan.innerText = timeLeft;
            const progressCircle = overlay.querySelector('.surprise-timer-progress');
            if (progressCircle) {
                const circumference = 2 * Math.PI * 18;
                const offset = circumference - (timeLeft / 15) * circumference;
                progressCircle.style.strokeDashoffset = offset;
            }
        };

        const closeOverlay = (selectedTarget = null) => {
            if (choiceMade) return;
            choiceMade = true;
            if (surpriseTimerInterval) clearInterval(surpriseTimerInterval);
            if (overlay.parentNode) overlay.remove();
            surpriseOverlayActive = false;
            if (surpriseResolve) {
                surpriseResolve(selectedTarget);
                surpriseResolve = null;
            }
        };

        overlay.innerHTML = `
            <div class="surprise-card">
                <div class="surprise-header">
                    <span class="surprise-icon">${card.name.split(' ')[0]}</span>
                    <span class="surprise-title">${escapeHtml(card.name)}</span>
                    <div class="surprise-timer-circle">
                        <svg viewBox="0 0 40 40" width="50" height="50">
                            <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,215,0,0.2)" stroke-width="2"/>
                            <circle class="surprise-timer-progress" cx="20" cy="20" r="18" fill="none" stroke="#facc15" stroke-width="2" stroke-dasharray="113.097" stroke-dashoffset="0" transform="rotate(-90 20 20)"/>
                        </svg>
                        <span class="surprise-timer-number">${timeLeft}</span>
                    </div>
                </div>
                <div class="surprise-desc">${escapeHtml(card.desc)}</div>
                <div class="surprise-sub">اختر من سيتأثر بهذه البطاقة:</div>
                <div class="surprise-targets">
                    ${opponents.map(p => `
                        <div class="target-option" data-id="${p.id}">
                            <img src="${p.img || DEFAULT_IMG}" class="target-img">
                            <span class="target-name">${escapeHtml(p.name)}</span>
                            <div class="target-score">⭐ ${p.score || 0}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="surprise-cancel">إلغاء (تضيع البطاقة)</button>
            </div>
        `;
        document.body.appendChild(overlay);

        surpriseTimerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(surpriseTimerInterval);
                closeOverlay(null);
                showFloatingNotification(`⌛ انتهى وقت اختيار الهدف لبطاقة ${card.name}`, 'info', 1500);
            }
        }, 1000);

        overlay.querySelectorAll('.target-option').forEach(opt => {
            opt.addEventListener('click', () => {
                if (!surpriseOverlayActive || choiceMade) return;
                const targetId = opt.dataset.id;
                const target = opponents.find(p => p.id === targetId);
                if (target) {
                    if (surpriseTimerInterval) clearInterval(surpriseTimerInterval);
                    closeOverlay(target);
                }
            });
        });

        const cancelBtn = overlay.querySelector('.surprise-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (!surpriseOverlayActive || choiceMade) return;
                if (surpriseTimerInterval) clearInterval(surpriseTimerInterval);
                closeOverlay(null);
                showFloatingNotification(`❌ تم إلغاء بطاقة ${card.name}`, 'info', 1500);
            });
        }

        updateTimerDisplay();
    });
}

export function closeSurpriseOverlay() {
    const existing = document.getElementById('surprise-target-overlay');
    if (existing) existing.remove();
    if (surpriseTimerInterval) clearInterval(surpriseTimerInterval);
    surpriseOverlayActive = false;
    if (surpriseResolve) {
        surpriseResolve(null);
        surpriseResolve = null;
    }
}