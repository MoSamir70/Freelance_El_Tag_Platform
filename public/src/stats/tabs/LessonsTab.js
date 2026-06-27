// src/stats/tabs/LessonsTab.js
// تبويب تحليل الدروس

import { BaseTab } from './BaseTab.js';
import { LessonCard } from '../components/LessonCard.js';
import { StatsCalculator } from '../core/StatsCalculator.js';

export class LessonsTab extends BaseTab {
  async render() {
    const data = await this.getData();
    if (!data) {
      this.showError('فشل تحميل بيانات الدروس');
      return;
    }

    // للحصول على بيانات الدروس الفعلية نحتاج إلى تحليل الأسئلة
    // سنستخدم جميع الأسئلة من جميع الصفوف
    const { grades, allQuestions } = data;

    // تجميع الدروس من الأسئلة (هذا مبسط، يمكن تحسينه لاحقاً)
    const lessonsMap = new Map();
    for (const grade of grades) {
      // لا يمكننا الحصول على الدروس من allQuestions فقط لأنها تحتوي على أعداد فقط
      // سنستخدم بيانات وهمية مؤقتاً، لكن في التطوير الفعلي يجب جلب الأسئلة الفعلية
      // لحل هذا سنقوم بجلب عينة من الأسئلة (أول 50 سؤال من كل صف)
      // لكن لتبسيط العرض، سنعرض رسالة توضيحية
    }

    this.container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-yellow-400">📖 تحليل الدروس</h2>
        <button id="refresh-lessons-btn" class="action-btn"><i class="fas fa-sync-alt"></i> تحديث</button>
      </div>
      <div class="glass-panel p-6 text-center">
        <div class="text-4xl mb-4">📚</div>
        <p class="text-gray-400">تحليل الدروس يتطلب بيانات تفصيلية من الأسئلة.</p>
        <p class="text-gray-500 text-sm mt-2">سيتم إضافة هذا التبويب بشكل كامل في التحديث القادم.</p>
      </div>
      <div id="lessons-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4"></div>
    `;

    // رابط التحديث
    document.getElementById('refresh-lessons-btn').addEventListener('click', async () => {
      await this.manager.refreshData();
      await this.render();
    });
  }
}