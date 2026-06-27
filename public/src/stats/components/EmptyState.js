// src/stats/components/EmptyState.js
// مكون عرض حالة عدم وجود بيانات

export class EmptyState {
  /**
   * إنشاء عنصر EmptyState
   * @param {string} message - نص الرسالة
   * @param {string} icon - أيقونة (رمز تعبيري أو HTML)
   * @param {string} actionText - نص زر الإجراء (اختياري)
   * @param {Function} onAction - دالة عند النقر على الزر
   * @returns {HTMLElement}
   */
  static create(message = 'لا توجد بيانات', icon = '📭', actionText = null, onAction = null) {
    const div = document.createElement('div');
    div.className = 'glass-panel p-8 text-center';
    div.innerHTML = `
      <div class="text-6xl mb-4">${icon}</div>
      <p class="text-gray-400 text-lg mb-4">${message}</p>
      ${actionText ? `<button class="action-btn" id="empty-state-action">${actionText}</button>` : ''}
    `;
    if (actionText && onAction) {
      const btn = div.querySelector('#empty-state-action');
      if (btn) btn.addEventListener('click', onAction);
    }
    return div;
  }

  /**
   * عرض EmptyState داخل حاوية (يمسح محتواها)
   * @param {HTMLElement} container
   * @param {string} message
   * @param {string} icon
   * @param {string} actionText
   * @param {Function} onAction
   */
  static render(container, message, icon = '📭', actionText = null, onAction = null) {
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(this.create(message, icon, actionText, onAction));
  }
}