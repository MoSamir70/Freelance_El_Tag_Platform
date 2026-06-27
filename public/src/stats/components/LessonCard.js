// src/stats/components/LessonCard.js
// مكون بطاقة درس قابلة لإعادة الاستخدام

import { escapeHtml } from '../../utils.js';

export class LessonCard {
  /**
   * إنشاء بطاقة درس واحدة
   * @param {Object} lesson - بيانات الدرس (name, total, correct, accuracy)
   * @param {Function} onClick - دالة عند النقر على البطاقة
   * @returns {HTMLElement}
   */
  static create(lesson, onClick = null) {
    const card = document.createElement('div');
    card.className = 'glass-panel p-4 transition-all duration-300 hover:scale-105 cursor-pointer';
    card.dataset.lesson = lesson.name;
    
    const accuracyClass = lesson.accuracy >= 70 ? 'text-green-400' : (lesson.accuracy >= 40 ? 'text-yellow-400' : 'text-red-400');
    
    card.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <div class="font-bold text-white text-lg">📖 ${escapeHtml(lesson.name)}</div>
        <div class="text-xs ${accuracyClass} font-bold">${lesson.accuracy}%</div>
      </div>
      <div class="flex justify-between text-sm text-gray-400">
        <span>✅ صحيحة: ${lesson.correct}</span>
        <span>❌ خاطئة: ${lesson.wrong || lesson.total - lesson.correct}</span>
        <span>📊 المجموع: ${lesson.total}</span>
      </div>
      <div class="w-full bg-gray-700 rounded-full h-2 mt-2">
        <div class="bg-gradient-to-r from-yellow-500 to-yellow-400 h-2 rounded-full" style="width: ${lesson.accuracy}%"></div>
      </div>
    `;
    
    if (onClick) card.addEventListener('click', () => onClick(lesson));
    return card;
  }

  /**
   * عرض شبكة من بطاقات الدروس
   * @param {HTMLElement} container
   * @param {Array} lessons
   * @param {Function} onClick
   */
  static renderGrid(container, lessons, onClick = null) {
    if (!container) return;
    container.innerHTML = '';
    lessons.forEach(lesson => {
      container.appendChild(this.create(lesson, onClick));
    });
  }
}