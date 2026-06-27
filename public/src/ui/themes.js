// src/ui/themes.js
// نظام الثيمات المتقدم (40 ثيماً) مع دعم المحتوى الديناميكي
// [FIX] تحسين تطبيق الثيم على العناصر الديناميكية ومنع الوميض
// [FIX] تحسين مراقبة DOM لتطبيق الثيم فور إضافة العناصر
// [FIX] تقييد الثيمات حسب خطة المستخدم (مجاني: 3, فضي: 10, ذهبي/مطور: الكل)

import { showFloatingNotification } from '../utils/helpers/notifications.js';
import { getTeacherPlan } from '../firebase/auth.js';

// قائمة الثيمات (40 ثيماً)
export const THEMES = [
    { id: 'theme-default', name: '✨ الافتراضي', icon: '🌙' },
    { id: 'theme-1', name: 'الذهب الأسود', icon: '🖤' },
    { id: 'theme-2', name: 'الفضة الباردة', icon: '❄️' },
    { id: 'theme-3', name: 'الناري', icon: '🔥' },
    { id: 'theme-4', name: 'الجليدي', icon: '🧊' },
    { id: 'theme-5', name: 'الزمردي', icon: '🌿' },
    { id: 'theme-6', name: 'الياقوتي', icon: '💎' },
    { id: 'theme-7', name: 'الأزرق العميق', icon: '🌊' },
    { id: 'theme-8', name: 'الوردي', icon: '🌸' },
    { id: 'theme-9', name: 'الأرجواني', icon: '🍇' },
    { id: 'theme-10', name: 'الشمس الذهبية', icon: '☀️' },
    { id: 'theme-11', name: 'القمر الفضي', icon: '🌙' },
    { id: 'theme-12', name: 'الغابي', icon: '🌲' },
    { id: 'theme-13', name: 'الصحراوي', icon: '🏜️' },
    { id: 'theme-14', name: 'البركاني', icon: '🌋' },
    { id: 'theme-15', name: 'البرتقالي', icon: '🎃' },
    { id: 'theme-16', name: 'الشوكولاتة', icon: '🍫' },
    { id: 'theme-17', name: 'الحلوى', icon: '🍬' },
    { id: 'theme-18', name: 'الفني', icon: '🎨' },
    { id: 'theme-19', name: 'السحري', icon: '🧙' },
    { id: 'theme-20', name: 'التكنو', icon: '🤖' },
    { id: 'theme-21', name: 'الرمادي الأنيق', icon: '⌨️' },
    { id: 'theme-22', name: 'النيون الأخضر', icon: '💚' },
    { id: 'theme-23', name: 'أورورا', icon: '🌌' },
    { id: 'theme-24', name: 'المرجاني الحيوي', icon: '🐠' },
    { id: 'theme-25', name: 'الليلكي الفاتح', icon: '🌸' },
    { id: 'theme-26', name: 'العاجي', icon: '🧁' },
    { id: 'theme-27', name: 'الكهرماني', icon: '🍯' },
    { id: 'theme-28', name: 'التركواز', icon: '💎' },
    { id: 'theme-29', name: 'الباستيل الهادئ', icon: '🕊️' },
    { id: 'theme-30', name: 'الوردي النيون', icon: '🎀' },
    { id: 'theme-31', name: 'الأزرق السماوي', icon: '☁️' },
    { id: 'theme-32', name: 'العنابي', icon: '🍷' },
    { id: 'theme-33', name: 'الصدئي', icon: '🏺' },
    { id: 'theme-34', name: 'الزمردي الغامق', icon: '🌲' },
    { id: 'theme-35', name: 'الليلكي الداكن', icon: '🌙' },
    { id: 'theme-36', name: 'النيلي العميق', icon: '🌌' },
    { id: 'theme-37', name: 'الكاكي العسكري', icon: '🪖' },
    { id: 'theme-38', name: 'الجبس الأبيض', icon: '⬜' },
    { id: 'theme-39', name: 'الأزرق الليلي', icon: '🌃' },
    { id: 'theme-40', name: 'العقيقي البرتقالي', icon: '🔶' }
];

let currentTheme = localStorage.getItem('peak_theme') || 'theme-default';
let dynamicObserver = null;

// ========== دوال تحديد الثيمات حسب الخطة ==========
/**
 * الحصول على قائمة الثيمات المسموحة حسب خطة المستخدم
 * @param {string} plan - 'free', 'silver', 'gold', 'developer'
 * @returns {Array} قائمة الثيمات (كل الكائنات) المسموحة
 */
export function getAllowedThemesByPlan(plan) {
    if (plan === 'developer' || plan === 'gold') {
        return THEMES; // كل الثيمات
    }
    
    if (plan === 'silver') {
        // للفضي: 10 ثيمات (نختار أول 10 بعد الافتراضي + الافتراضي)
        const silverThemeIds = [
            'theme-default', 
            'theme-1', 'theme-2', 'theme-3', 'theme-4', 
            'theme-5', 'theme-6', 'theme-7', 'theme-8', 'theme-9'
        ];
        return THEMES.filter(t => silverThemeIds.includes(t.id));
    }
    
    // مجاني: 3 ثيمات فقط
    const freeThemeIds = ['theme-default', 'theme-38', 'theme-8']; // الافتراضي، الجبس الأبيض، الوردي
    return THEMES.filter(t => freeThemeIds.includes(t.id));
}

/**
 * التحقق مما إذا كان الثيم مسموحاً للمستخدم
 * @param {string} themeId 
 * @param {string} plan 
 * @returns {boolean}
 */
export function isThemeAllowed(themeId, plan) {
    const allowed = getAllowedThemesByPlan(plan);
    return allowed.some(t => t.id === themeId);
}

// دالة لتطبيق الثيم على عنصر واحد
function applyThemeToElement(element, themeId) {
    if (!element || !element.classList) return;
    // إزالة جميع الثيمات القديمة من هذا العنصر
    THEMES.forEach(theme => {
        element.classList.remove(theme.id);
    });
    element.classList.add(themeId);
    // إجبار إعادة الحساب
    element.style.transform = 'translateZ(0)';
    setTimeout(() => {
        if (element.style) element.style.transform = '';
    }, 10);
}

// دالة لإعادة تطبيق الثيم على العناصر التي تم إنشاؤها ديناميكياً
export function reapplyTheme() {
    const themeId = localStorage.getItem('peak_theme') || 'theme-default';
    
    // إزالة جميع الثيمات السابقة من body
    THEMES.forEach(theme => {
        document.body.classList.remove(theme.id);
    });
    
    // إضافة الثيم الجديد إلى body
    document.body.classList.add(themeId);
    currentTheme = themeId;
    
    // قائمة المحددات التي تحتاج إلى تطبيق الثيم
    const selectors = [
        '.glass-panel', '.student-card', '.gradeSelectBtn', '.mode-card', 
        '.team-card', '.lobby-player-card', '.public-room-card', 
        '.online-user-item', '.settings-card', '.subject-stats-card', 
        '.team-preview-chip', '.student-card-select', '.kpi-card', 
        '.bottom-card', '.heatmap-card', '.live-feed', '.analysis-stat-card', 
        '.student-card-glass', '.grade-card-glass', '.cmp-player-card', 
        '.student-select-grid', '.stats-page', '.race-lane', '.option-btn',
        '.withdraw-btn', '.team-card', '.lobby-players-grid', '.countdown-overlay'
    ];
    
    // تطبيق الثيم على جميع العناصر الموجودة حالياً
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            applyThemeToElement(el, themeId);
        });
    });
    
    // تحديث كلاسات الأزرار النشطة في نافذة اختيار الثيمات
    document.querySelectorAll('.theme-grid-btn').forEach(btn => {
        if (btn.dataset.themeId === themeId) {
            btn.classList.add('active-theme-btn');
        } else {
            btn.classList.remove('active-theme-btn');
        }
    });
    
    const indicator = document.getElementById('current-theme-indicator');
    if (indicator) {
        const theme = THEMES.find(t => t.id === themeId);
        if (theme) {
            indicator.innerHTML = `🎨 الثيم الحالي: ${theme.icon} ${theme.name}`;
        }
    }
}

// دالة تطبيق الثيم مع التحقق من الصلاحية
export async function applyTheme(themeId) {
    if (!themeId) return;
    
    // جلب خطة المستخدم الحالي
    let plan = 'free';
    const isTeacher = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    if (isTeacher) {
        plan = sessionStorage.getItem('teacher_plan') || 'free';
    } else {
        plan = sessionStorage.getItem('student_teacher_plan') || 'free';
    }
    
    // التحقق من أن الثيم مسموح
    if (!isThemeAllowed(themeId, plan)) {
        let upgradeMsg = '';
        if (plan === 'free') {
            upgradeMsg = 'الباقة المجانية تتيح 3 ثيمات فقط. قم بالترقية للفضية أو الذهبية للحصول على المزيد.';
        } else if (plan === 'silver') {
            upgradeMsg = 'الباقة الفضية تتيح 10 ثيمات. قم بالترقية للذهبية للحصول على جميع الثيمات (40 ثيماً).';
        }
        showFloatingNotification(`❌ هذا الثيم غير متاح في خطتك الحالية. ${upgradeMsg}`, 'error');
        return;
    }
    
    const themeExists = THEMES.some(t => t.id === themeId);
    if (!themeExists) return;
    
    localStorage.setItem('peak_theme', themeId);
    reapplyTheme();
    
    const theme = THEMES.find(t => t.id === themeId);
    if (theme) {
        console.log(`🎨 تم تطبيق الثيم: ${theme.name}`);
    }
}

// دالة للتبديل إلى الثيم التالي (دائري) – مع تجاوز الثيمات غير المسموحة
export async function cycleTheme() {
    let plan = 'free';
    const isTeacher = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    if (isTeacher) {
        plan = sessionStorage.getItem('teacher_plan') || 'free';
    } else {
        plan = sessionStorage.getItem('student_teacher_plan') || 'free';
    }
    
    const allowedThemes = getAllowedThemesByPlan(plan);
    if (allowedThemes.length === 0) return;
    
    let current = localStorage.getItem('peak_theme') || 'theme-default';
    // إذا كان الثيم الحالي غير مسموح، ننتقل إلى أول ثيم مسموح
    if (!allowedThemes.some(t => t.id === current)) {
        current = allowedThemes[0].id;
    }
    
    const currentIndex = allowedThemes.findIndex(t => t.id === current);
    const nextIndex = (currentIndex + 1) % allowedThemes.length;
    const nextTheme = allowedThemes[nextIndex];
    await applyTheme(nextTheme.id);
    showFloatingNotification(`🎨 تم التبديل إلى ${nextTheme.icon} ${nextTheme.name}`, 'info', 1000);
}

// دالة لعرض نافذة اختيار الثيمات (تعرض فقط الثيمات المسموحة)
export async function showThemeSelector() {
    let plan = 'free';
    const isTeacher = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    if (isTeacher) {
        plan = sessionStorage.getItem('teacher_plan') || 'free';
    } else {
        plan = sessionStorage.getItem('student_teacher_plan') || 'free';
    }
    
    const allowedThemes = getAllowedThemesByPlan(plan);
    const currentThemeId = localStorage.getItem('peak_theme') || 'theme-default';
    
    let buttonsHtml = '';
    allowedThemes.forEach(theme => {
        const isActive = theme.id === currentThemeId;
        buttonsHtml += `
            <button class="theme-grid-btn ${isActive ? 'active-theme-btn' : ''}" data-theme-id="${theme.id}" style="
                background: rgba(15,25,45,0.7);
                backdrop-filter: blur(8px);
                border: 2px solid ${isActive ? '#facc15' : 'rgba(250,204,21,0.3)'};
                border-radius: 48px;
                padding: 0.7rem 0.3rem;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.3rem;
                color: white;
                font-weight: bold;
            ">
                <span style="font-size: 1.8rem;">${theme.icon}</span>
                <span style="font-size: 0.7rem;">${theme.name}</span>
            </button>
        `;
    });
    
    // إضافة رسالة توضيحية عن عدد الثيمات المتاحة
    let upgradeNote = '';
    if (plan === 'free') {
        upgradeNote = '<p class="text-yellow-400 text-sm mt-2">🌟 الباقة المجانية: 3 ثيمات. قم بالترقية للفضية (10 ثيمات) أو الذهبية (جميع الثيمات الـ40).</p>';
    } else if (plan === 'silver') {
        upgradeNote = '<p class="text-yellow-400 text-sm mt-2">🌟 الباقة الفضية: 10 ثيمات. قم بالترقية للذهبية للحصول على جميع الثيمات الـ40.</p>';
    }
    
    await Swal.fire({
        title: '🎨 اختر ثيمك المفضل',
        html: `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.8rem; max-height: 60vh; overflow-y: auto; padding: 0.5rem;">${buttonsHtml}</div>${upgradeNote}`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        background: 'rgba(15, 25, 45, 0.95)',
        backdrop: 'rgba(0,0,0,0.7)',
        customClass: {
            popup: 'rounded-3xl border-2 border-yellow-500'
        },
        didOpen: () => {
            document.querySelectorAll('.theme-grid-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const themeId = btn.dataset.themeId;
                    await applyTheme(themeId);
                    Swal.close();
                });
            });
        }
    });
}

// دالة لإضافة أزرار الثيمات إلى صفحة الإحصائيات
export async function addThemeButtonsToStats() {
    const statsContainer = document.getElementById('teacher-advanced-settings');
    if (!statsContainer) return;
    if (document.getElementById('theme-buttons-container')) return;
    
    const themeSection = document.createElement('div');
    themeSection.className = 'glass-panel p-6 mt-6';
    themeSection.innerHTML = `
        <h3 class="text-3xl font-bold text-yellow-400 text-center mb-4">🎨 اختر ثيمك المفضل</h3>
        <div id="theme-buttons-container"></div>
    `;
    statsContainer.appendChild(themeSection);
    await initThemeButtons();
}

// دالة تهيئة أزرار الثيمات (تعرض فقط المسموحة)
export async function initThemeButtons() {
    const container = document.getElementById('theme-buttons-container');
    if (!container) return;
    
    let plan = 'free';
    const isTeacher = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    if (isTeacher) {
        plan = sessionStorage.getItem('teacher_plan') || 'free';
    } else {
        plan = sessionStorage.getItem('student_teacher_plan') || 'free';
    }
    
    const allowedThemes = getAllowedThemesByPlan(plan);
    const currentThemeId = localStorage.getItem('peak_theme') || 'theme-default';
    
    const grid = document.createElement('div');
    grid.className = 'theme-grid';
    
    allowedThemes.forEach(theme => {
        const btn = document.createElement('button');
        btn.className = 'theme-grid-btn';
        if (theme.id === currentThemeId) btn.classList.add('active-theme-btn');
        btn.dataset.themeId = theme.id;
        btn.innerHTML = `<span class="theme-icon">${theme.icon}</span><span class="theme-name">${theme.name}</span>`;
        btn.title = `تطبيق ثيم ${theme.name}`;
        btn.addEventListener('click', () => applyTheme(theme.id));
        grid.appendChild(btn);
    });
    
    container.innerHTML = '';
    container.appendChild(grid);
    
    const currentIndicator = document.createElement('div');
    currentIndicator.id = 'current-theme-indicator';
    const currentThemeObj = THEMES.find(t => t.id === currentThemeId);
    if (currentThemeObj) {
        currentIndicator.innerHTML = `🎨 الثيم الحالي: ${currentThemeObj.icon} ${currentThemeObj.name}`;
    } else {
        currentIndicator.innerHTML = `🎨 الثيم الحالي: ${currentThemeId}`;
    }
    container.appendChild(currentIndicator);
    
    // إضافة ملاحظة عن عدد الثيمات المتاحة
    const note = document.createElement('div');
    note.className = 'text-xs text-gray-400 text-center mt-2';
    if (plan === 'free') {
        note.innerText = `🌟 الباقة المجانية: ${allowedThemes.length} ثيمات متاحة. قم بالترقية للفضية (10 ثيمات) أو الذهبية (جميع الثيمات).`;
    } else if (plan === 'silver') {
        note.innerText = `🌟 الباقة الفضية: ${allowedThemes.length} ثيمات متاحة. قم بالترقية للذهبية للحصول على جميع الثيمات الـ40.`;
    } else {
        note.innerText = `✨ الباقة ${plan === 'gold' ? 'الذهبية' : 'المطور'}: جميع الثيمات الـ40 متاحة.`;
    }
    container.appendChild(note);
}

// دالة لربط أزرار الثيمات (تُستدعى من main.js)
export async function hookThemeButtons() {
    if (sessionStorage.getItem('peak_teacher_logged_in') === 'true') {
        await addThemeButtonsToStats();
    }
    observeDynamicContent();
}

// دالة لمراقبة المحتوى الديناميكي وتطبيق الثيم تلقائياً
export function observeDynamicContent() {
    if (dynamicObserver) {
        dynamicObserver.disconnect();
    }
    
    dynamicObserver = new MutationObserver((mutations) => {
        let shouldReapply = false;
        const themeId = localStorage.getItem('peak_theme') || 'theme-default';
        
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const selectors = [
                            '.glass-panel', '.student-card', '.gradeSelectBtn', 
                            '.mode-card', '.team-card', '.lobby-player-card', 
                            '.public-room-card', '.online-user-item', '.settings-card', 
                            '.subject-stats-card', '.team-preview-chip', '.student-card-select',
                            '.kpi-card', '.bottom-card', '.heatmap-card', '.live-feed', 
                            '.analysis-stat-card', '.student-card-glass', '.grade-card-glass',
                            '.cmp-player-card', '.student-select-grid', '.stats-page',
                            '.race-lane', '.option-btn', '.withdraw-btn', '.team-card'
                        ];
                        
                        for (const selector of selectors) {
                            if (node.matches && node.matches(selector)) {
                                applyThemeToElement(node, themeId);
                                shouldReapply = true;
                                break;
                            }
                            if (node.querySelectorAll && node.querySelectorAll(selector).length > 0) {
                                node.querySelectorAll(selector).forEach(el => applyThemeToElement(el, themeId));
                                shouldReapply = true;
                            }
                        }
                    }
                });
            }
        });
        
        if (shouldReapply) {
            requestAnimationFrame(() => {
                const selectors = ['.active-turn', '.selected', '.correct-ans', '.wrong-ans'];
                selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        el.style.transform = 'translateZ(0)';
                        setTimeout(() => { el.style.transform = ''; }, 10);
                    });
                });
            });
        }
    });
    
    dynamicObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
    });
}

export function disconnectDynamicObserver() {
    if (dynamicObserver) {
        dynamicObserver.disconnect();
        dynamicObserver = null;
    }
}

export default {
    THEMES,
    applyTheme,
    reapplyTheme,
    cycleTheme,
    showThemeSelector,
    hookThemeButtons,
    observeDynamicContent,
    disconnectDynamicObserver,
    initThemeButtons,
    addThemeButtonsToStats,
    getAllowedThemesByPlan,
    isThemeAllowed
};