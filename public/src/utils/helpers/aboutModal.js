// ===================== src/utils/helpers/aboutModal.js =====================
// دوال نافذة "عن المنصة" (About Modal)

export function openAboutModal() {
    const modal = document.getElementById('about-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

export function closeAboutModal() {
    const modal = document.getElementById('about-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

export function initAboutModal() {
    const aboutBtnLogin = document.getElementById('about-btn-login');
    const aboutBtnNav = document.getElementById('about-btn-nav');
    const closeBtn = document.getElementById('close-about-modal');
    if (aboutBtnLogin) aboutBtnLogin.onclick = openAboutModal;
    if (aboutBtnNav) aboutBtnNav.onclick = openAboutModal;
    if (closeBtn) closeBtn.onclick = closeAboutModal;
}