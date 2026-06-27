// src/stats/components/StudentCard.js
// مكون بطاقة طالب قابلة لإعادة الاستخدام

import { escapeHtml } from '../../utils.js';

export class StudentCard {
  /**
   * إنشاء بطاقة طالب واحدة
   * @param {Object} student - بيانات الطالب (id, name, grade, score, img, accuracy, badges)
   * @returns {HTMLElement}
   */
  static create(student) {
    const card = document.createElement('div');
    card.className = 'student-card glass-panel p-4 text-center transition-all duration-300 hover:scale-105 cursor-pointer';
    card.dataset.id = student.id;
    
    const accuracy = student.accuracy !== undefined ? student.accuracy : 0;
    const badgesHtml = (student.badges || []).slice(0, 2).map(b => 
      `<span class="inline-block text-xs bg-yellow-500/20 text-yellow-400 rounded-full px-2 py-0.5 mx-0.5" title="${escapeHtml(b.desc || '')}">${b.icon || '🏅'}</span>`
    ).join('');
    
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="text-xs text-gray-400">#${student.rank || '-'}</div>
        <div class="flex gap-1">${badgesHtml}</div>
      </div>
      <img src="${student.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" 
           class="w-20 h-20 rounded-full mx-auto border-2 border-yellow-500 object-cover mb-2">
      <div class="font-bold text-white text-base">${escapeHtml(student.name)}</div>
      <div class="text-xs text-purple-300">${escapeHtml(student.grade || '')}</div>
      <div class="text-yellow-400 font-bold mt-1">⭐ ${student.score || 0}</div>
      <div class="w-full bg-gray-700 rounded-full h-1.5 mt-2">
        <div class="bg-gradient-to-r from-yellow-500 to-yellow-400 h-1.5 rounded-full" style="width: ${accuracy}%"></div>
      </div>
      <div class="text-xs text-gray-400 mt-1">دقة: ${accuracy}%</div>
    `;
    
    return card;
  }

  /**
   * عرض شبكة من بطاقات الطلاب
   * @param {HTMLElement} container
   * @param {Array} students
   */
  static renderGrid(container, students) {
    if (!container) return;
    container.innerHTML = '';
    students.forEach(s => {
      container.appendChild(this.create(s));
    });
  }
}