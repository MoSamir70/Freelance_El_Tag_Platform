// ===================== src/utils/helpers/dom.js =====================
// دوال التعامل مع DOM والعناصر العامة (النجوم، الأنماط، الأزرار، إلخ)
// [FIX] تحسين أمان escapeHtml
// [FIX] إضافة throttle و debounce للعمليات المتكررة على DOM
// [FIX] تحسين إضافة الأنماط لتجنب التكرار

import { WINNER_MESSAGES } from '../../constants.js';

// ===================== دالة آمنة لتنظيف النصوص من HTML (مكافحة XSS) =====================
export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;')
        .replace(/\//g, '&#x2F;');
}

// ===================== دوال التحكم في أزرار الإجابة =====================
export function lockAnswerButtons() {
    document.querySelectorAll('#q-area-opts .option-btn').forEach(b => b.disabled = true);
}

export function unlockAnswerButtons() {
    document.querySelectorAll('#q-area-opts .option-btn').forEach(b => b.disabled = false);
}

// ===================== تنظيف المؤقتات العامة (للتوافق القديم) =====================
export function clearAllRaceIntervals() {
    if (window.raceData) {
        if (window.raceData.timerInterval) {
            clearInterval(window.raceData.timerInterval);
            window.raceData.timerInterval = null;
        }
        if (window.raceData.timerTimeout) {
            clearTimeout(window.raceData.timerTimeout);
            window.raceData.timerTimeout = null;
        }
        if (window.raceData.memoryTimeout) {
            clearTimeout(window.raceData.memoryTimeout);
            window.raceData.memoryTimeout = null;
        }
        if (window.raceData._timerRaf) {
            cancelAnimationFrame(window.raceData._timerRaf);
            window.raceData._timerRaf = null;
        }
        window.raceData._timerDeadline = null;
    }
}

// ===================== إضافة الأنماط العامة للثيمات الديناميكية (مرة واحدة) =====================
let globalStylesAdded = false;
export function addGlobalStyles() {
    if (globalStylesAdded) return;
    if (document.getElementById('dynamic-theme-styles')) return;
    const style = document.createElement('style');
    style.id = 'dynamic-theme-styles';
    style.innerHTML = `
        .glass-panel, .student-card, .gradeSelectBtn, .mode-card, .team-card, .race-lane, .option-btn {
            background: var(--glass-bg, rgba(15, 25, 45, 0.7)) !important;
            backdrop-filter: blur(14px) !important;
            border: var(--glass-border, 1px solid rgba(255,255,255,0.1)) !important;
            transition: all 0.3s ease;
            color: var(--text-primary, #fff) !important;
        }
        .glass-panel:hover, .student-card:hover, .gradeSelectBtn:hover, .mode-card:hover, .team-card:hover, .race-lane:hover {
            border-color: var(--glass-border-hover, rgba(250,204,21,0.3)) !important;
            background: var(--glass-bg-hover, rgba(15,25,45,0.85)) !important;
            box-shadow: 0 0 20px var(--text-glow, rgba(250,204,21,0.3)) !important;
        }
        .gradeSelectBtn.selected, .mode-card.selected {
            background: var(--btn-primary-bg, #facc15) !important;
            color: var(--btn-primary-color, #000) !important;
            border-color: var(--btn-primary-bg, #facc15) !important;
            box-shadow: 0 0 12px var(--text-glow, rgba(250,204,21,0.4)) !important;
        }
        .race-lane.active-turn {
            border-color: var(--track-active-glow, #4a9eff) !important;
            box-shadow: 0 0 12px var(--track-active-glow, rgba(74,158,255,0.5)) !important;
        }
        .option-btn:hover:not(:disabled) {
            background: var(--btn-primary-bg, #facc15) !important;
            color: var(--btn-primary-color, #000) !important;
            transform: scale(1.02) !important;
            border-color: var(--btn-primary-bg, #facc15) !important;
        }
        .correct-ans {
            background: var(--correct-bg, rgba(16,185,129,0.25)) !important;
            border-color: var(--correct-border, #10b981) !important;
            box-shadow: 0 0 35px var(--correct-glow, rgba(16,185,129,0.5)) !important;
        }
        .wrong-ans {
            background: var(--wrong-bg, rgba(239,68,68,0.25)) !important;
            border-color: var(--wrong-border, #ef4444) !important;
            box-shadow: 0 0 35px var(--wrong-glow, rgba(239,68,68,0.5)) !important;
        }
    `;
    document.head.appendChild(style);
    globalStylesAdded = true;
}

// ===================== إنشاء النجوم والخلفية المتحركة =====================
export function createStars() {
    const bg = document.getElementById('star-bg');
    if (!bg) return;
    // تجنب إعادة إنشاء النجوم إذا كانت موجودة مسبقاً
    if (bg.children.length > 0) return;
    for (let i = 0; i < 100; i++) {
        let star = document.createElement('div');
        star.classList.add('star');
        let size = Math.random() * 3 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.opacity = 0.3 + Math.random() * 0.3;
        bg.appendChild(star);
    }
    for (let i = 0; i < 5; i++) {
        let meteor = document.createElement('div');
        meteor.classList.add('shooting-star');
        meteor.style.left = Math.random() * 100 + '%';
        meteor.style.top = Math.random() * 100 + '%';
        meteor.style.animationDelay = Math.random() * 15 + 's';
        meteor.style.animationDuration = Math.random() * 4 + 2 + 's';
        bg.appendChild(meteor);
    }
}

// ===================== تحديث واجهة المؤقت (باستخدام throttle) =====================
let lastTimerUpdate = 0;
export function updateTimerUI(raceData) {
    if (!raceData) return;
    const now = Date.now();
    // تحديث المؤقت بحد أقصى 30 مرة في الثانية (أكثر من كافي)
    if (now - lastTimerUpdate < 33) return;
    lastTimerUpdate = now;
    let timerElem = document.getElementById('timer-text');
    if (timerElem) timerElem.innerText = Math.ceil(raceData.timeLeft);
    let percent = (raceData.timeLeft / raceData.timeLimit) * 100;
    const bar = document.getElementById('timer-bar');
    if (bar) bar.style.width = Math.max(0, percent) + '%';
}

// ===================== رسائل الفوز العشوائية =====================
export function getRandomWinnerMessage() { 
    return WINNER_MESSAGES[Math.floor(Math.random() * WINNER_MESSAGES.length)]; 
}