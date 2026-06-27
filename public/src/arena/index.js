// src/arena/index.js
// المدخل الرئيسي للساحة العالمية (المعلم والطالب)
// [FIX] إضافة فحص صلاحية الوصول للساحة حسب خطة المستخدم (مجاني ممنوع)

import { getCurrentUserInfo } from '../firebase/auth.js';
import { roleDetector } from './core/roleDetector.js';
import { tabManager } from './core/tabManager.js';
import { showToast } from './helpers/showToast.js';
import { canAccessGlobalArena, getUserPlan } from '../services/subscriptionGuard.js';

// استيراد الـ Views (سيتم تحميلها ديناميكياً عند الحاجة)
const views = {
    rooms: () => import('./views/roomsView.js'),
    leaderboard: () => import('./views/leaderboardView.js'),
    profile: () => import('./views/profileView.js'),
    chat: () => import('./views/globalChatView.js'),
    tournaments: () => import('./views/tournamentsView.js')
};

let currentUser = null;
let currentRole = null;
let currentTabId = null;
let roomCleanerInterval = null;

async function init() {
    // 1. جلب بيانات المستخدم
    currentUser = await getCurrentUserInfo();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // 2. ✅ التحقق من صلاحية الدخول إلى الساحة العالمية (حسب خطة المستخدم)
    const canAccess = await canAccessGlobalArena(currentUser.id, !currentUser.isTeacher);
    if (!canAccess) {
        // عرض رسالة مناسبة ومنع الدخول
        const message = '❌ الباقة المجانية لا تسمح بدخول الساحة العالمية. يرجى ترقية اشتراكك للاستفادة من هذه الميزة.';
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                title: '🚫 غير مسموح',
                html: message,
                icon: 'error',
                confirmButtonText: 'العودة إلى المنصة',
                background: '#0f172a',
                color: '#fff'
            });
        } else {
            alert(message);
        }
        // التوجيه إلى الصفحة الرئيسية المناسبة
        if (currentUser.isTeacher) {
            window.location.href = 'platform.html';
        } else {
            window.location.href = 'platform.html?student=true';
        }
        return;
    }

    // 3. تحديث اسم المستخدم في الواجهة
    const userNameSpan = document.getElementById('user-name');
    if (userNameSpan) userNameSpan.innerText = `مرحباً، ${currentUser.name}`;

    // 4. تحديد الدور والصلاحيات
    currentRole = roleDetector(currentUser);
    console.log('[Arena] Role detected:', currentRole);

    // 5. بناء التبويبات حسب الدور
    const tabsConfig = getTabsConfig(currentRole);
    tabManager.init(tabsConfig, (tabId) => loadView(tabId));

    // 6. عرض التبويبات في الواجهة
    renderTabs(tabsConfig);

    // 7. تحميل التبويب الافتراضي (الأول)
    if (tabsConfig.length) {
        loadView(tabsConfig[0].id);
    }

    // 8. تسجيل الخروج
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        const { logout } = await import('../firebase/auth.js');
        logout();
    });

    // 9. بدء منظف الغرف الميتة (كل 10 دقائق)
    startRoomCleaner();
}

function getTabsConfig(role) {
    if (role.isTeacher) {
        const tabs = [
            { id: 'rooms', label: '🏠 الغرف', icon: 'fas fa-door-open' },
            { id: 'leaderboard', label: '🏆 الصدارة', icon: 'fas fa-trophy' }
        ];
        if (role.canUseChat) {
            tabs.push({ id: 'chat', label: '💬 الدردشة', icon: 'fas fa-comments' });
        }
        return tabs;
    } else {
        // طالب
        return [
            { id: 'rooms', label: '🏠 الغرف', icon: 'fas fa-door-open' },
            { id: 'leaderboard', label: '🏆 الصدارة', icon: 'fas fa-trophy' },
            { id: 'profile', label: '👤 ملفي', icon: 'fas fa-user' },
            { id: 'tournaments', label: '🏅 بطولات (قريباً)', icon: 'fas fa-clock', disabled: true }
        ];
    }
}

function renderTabs(tabsConfig) {
    const desktopContainer = document.getElementById('desktop-tabs');
    const mobileContainer = document.getElementById('bottom-nav');
    if (!desktopContainer || !mobileContainer) return;

    const render = (isMobile) => {
        const container = isMobile ? mobileContainer : desktopContainer;
        container.innerHTML = '';
        tabsConfig.forEach(tab => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${tab.id === currentTabId ? 'tab-active' : 'tab-inactive'}`;
            if (isMobile) {
                btn.innerHTML = `<i class="${tab.icon}"></i><span>${tab.label}</span>`;
            } else {
                btn.innerHTML = `<i class="${tab.icon} ml-2"></i>${tab.label}`;
            }
            if (tab.disabled) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.title = 'قريباً';
            }
            btn.addEventListener('click', () => {
                if (tab.disabled) {
                    showToast('هذه الميزة قيد التطوير', 'info');
                    return;
                }
                loadView(tab.id);
                setActiveTab(tab.id);
            });
            container.appendChild(btn);
        });
    };

    render(false);
    render(true);
}

function setActiveTab(activeId) {
    currentTabId = activeId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const btnText = btn.querySelector('span')?.innerText || btn.innerText;
        const isActive = btnText.includes(activeId) || btn.innerHTML.includes(activeId);
        if (isActive) {
            btn.classList.add('tab-active');
            btn.classList.remove('tab-inactive');
        } else {
            btn.classList.add('tab-inactive');
            btn.classList.remove('tab-active');
        }
    });
}

async function loadView(tabId) {
    if (!views[tabId]) return;
    const container = document.getElementById('app');
    if (!container) return;

    container.innerHTML = '<div class="flex justify-center items-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-4 border-yellow-400 border-t-transparent"></div></div>';

    try {
        const module = await views[tabId]();
        if (module.render) {
            await module.render(container, currentUser, currentRole);
        } else {
            container.innerHTML = '<div class="text-center text-red-400">خطأ في تحميل المحتوى</div>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="text-center text-red-400">فشل تحميل الصفحة</div>';
    }
}

function startRoomCleaner() {
    if (roomCleanerInterval) clearInterval(roomCleanerInterval);
    roomCleanerInterval = setInterval(async () => {
        try {
            const { cleanStaleRooms } = await import('../online/lobby/roomCleaner.js');
            const deleted = await cleanStaleRooms();
            if (deleted > 0) {
                console.log(`[Arena] Cleaned ${deleted} stale rooms`);
                if (currentTabId === 'rooms') {
                    const { refreshRooms } = await import('./views/roomsView.js');
                    if (refreshRooms) refreshRooms();
                }
            }
        } catch (err) {
            console.warn('[Arena] Room cleaner error:', err);
        }
    }, 10 * 60 * 1000);
}

// بدء التشغيل
init();