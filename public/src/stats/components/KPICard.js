// src/stats/components/KPICard.js
// مكون بطاقة إحصائية (KPI) قابلة لإعادة الاستخدام

export class KPICard {
  /**
   * إنشاء بطاقة KPI واحدة
   * @param {Object} data - { icon, value, label, change, color, onClick }
   * @returns {HTMLElement}
   */
  static create(data) {
    const card = document.createElement('div');
    card.className = 'kpi-card glass-panel p-4 text-center transition-all duration-300 hover:scale-105 cursor-pointer';
    
    const changeHtml = data.change ? 
      `<div class="text-xs mt-1 ${data.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}">${data.change}</div>` : '';
    
    card.innerHTML = `
      <div class="text-4xl mb-2">${data.icon}</div>
      <div class="text-3xl font-bold text-yellow-400">${data.value}</div>
      <div class="text-gray-400 text-sm">${data.label}</div>
      ${changeHtml}
    `;
    
    if (data.onClick) card.addEventListener('click', data.onClick);
    return card;
  }

  /**
   * عرض شبكة من بطاقات KPI في حاوية
   * @param {HTMLElement} container - العنصر الأب
   * @param {Array} items - مصفوفة من بيانات البطاقات
   */
  static renderGrid(container, items) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach(item => {
      container.appendChild(this.create(item));
    });
  }
}