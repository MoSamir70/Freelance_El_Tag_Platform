// ===================== src/utils/helpers/loader.js =====================
// دوال إظهار وإخفاء شاشة التحميل (Loading Overlay) – نسخة محسّنة
// [FIX] إضافة عداد مرجعي لمنع الإغلاق المبكر
// [FIX] استخدام requestAnimationFrame لتحسين الأداء
// [FIX] إضافة مؤقت أمان للإخفاء التلقائي

let showCount = 0;
let safeHideTimeout = null;
let currentOverlay = null;

// الحصول على عنصر الـ overlay (ينشئه إذا لم يكن موجوداً)
function getOverlay() {
    if (currentOverlay && document.body.contains(currentOverlay)) return currentOverlay;
    
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 1rem;
            font-family: 'Cairo', sans-serif;
            direction: rtl;
        `;
        overlay.innerHTML = `
            <div class="loader-spinner" style="
                width: 60px;
                height: 60px;
                border: 5px solid rgba(250,204,21,0.3);
                border-top: 5px solid #facc15;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <div id="loader-text" style="color: white; font-size: 1.2rem; font-weight: bold;">جاري التحميل...</div>
        `;
        // إضافة تعريف keyframes إذا لم يكن موجوداً
        if (!document.querySelector('#loader-keyframes')) {
            const style = document.createElement('style');
            style.id = 'loader-keyframes';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        document.body.appendChild(overlay);
    }
    currentOverlay = overlay;
    return overlay;
}

/**
 * إظهار شاشة التحميل
 * @param {string} [text] - نص اختياري يظهر أثناء التحميل
 */
export function showLoading(text = 'جاري التحميل...') {
    const overlay = getOverlay();
    const textEl = document.getElementById('loader-text');
    if (textEl) textEl.innerText = text;
    
    showCount++;
    
    if (safeHideTimeout) {
        clearTimeout(safeHideTimeout);
        safeHideTimeout = null;
    }
    
    if (showCount === 1) {
        // استخدام requestAnimationFrame لتجنب حظر الواجهة
        requestAnimationFrame(() => {
            overlay.style.display = 'flex';
            // إضافة كلاس للرسوم المتحركة (اختياري)
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s';
            requestAnimationFrame(() => { overlay.style.opacity = '1'; });
        });
    }
    
    // مؤقت أمان: إخفاء تلقائي بعد 5 ثوانٍ كحد أقصى (يمنع بقاء الـ loader عالقاً)
    safeHideTimeout = setTimeout(() => {
        if (showCount > 0) {
            console.warn('⚠️ Loading overlay forced hide after timeout (5s)');
            showCount = 1; // لضمان إخفاء كامل
            hideLoading();
        }
    }, 5000);
}

/**
 * إخفاء شاشة التحميل
 * @param {boolean} [force=false] - إخفاء فوري حتى لو كان العداد > 0
 */
export function hideLoading(force = false) {
    if (force) {
        showCount = 0;
    } else {
        showCount = Math.max(0, showCount - 1);
    }
    
    if (showCount === 0) {
        const overlay = getOverlay();
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (showCount === 0) {
                overlay.style.display = 'none';
            }
        }, 200);
        
        if (safeHideTimeout) {
            clearTimeout(safeHideTimeout);
            safeHideTimeout = null;
        }
    }
}

/**
 * إعادة تعيين عداد التحميل (للحالات الطارئة)
 */
export function resetLoadingCounter() {
    showCount = 0;
    if (safeHideTimeout) {
        clearTimeout(safeHideTimeout);
        safeHideTimeout = null;
    }
    const overlay = getOverlay();
    overlay.style.display = 'none';
    overlay.style.opacity = '';
}