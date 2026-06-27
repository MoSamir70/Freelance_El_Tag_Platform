// src/online/presence/presenceUI.js
// دوال مساعدة لعرض المتصلين في واجهة المستخدم

import { subscribeToOnlineUsers, getOnlineUsers } from './presenceManager.js';

let unsubscribe = null;

/**
 * عرض قائمة المتصلين في عنصر HTML محدد
 * @param {string} containerId - id العنصر الذي سيعرض فيه المتصلون
 */
export function initOnlineUsersDisplay(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const render = (users) => {
    if (users.length === 0) {
      container.innerHTML = '<div class="text-gray-500 text-center">لا يوجد متصلون حالياً</div>';
      return;
    }
    const html = users.map(user => `
      <div class="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition">
        <img src="${user.img}" class="w-10 h-10 rounded-full object-cover">
        <div class="flex-1">
          <div class="font-bold text-sm">${user.name}</div>
          <div class="text-xs text-green-400">● متصل</div>
          ${user.role === 'teacher' ? '<span class="text-xs bg-purple-600 px-1 rounded">معلم</span>' : ''}
        </div>
        <div class="status-dot w-2 h-2 bg-green-500 rounded-full"></div>
      </div>
    `).join('');
    container.innerHTML = html;
  };

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToOnlineUsers(render);
  // جلب أول مرة
  getOnlineUsers().then(render);
}

export function stopOnlineUsersDisplay() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}