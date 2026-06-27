// src/stats/tabs/StudentsTab.js
// تبويب أداء الطلاب (عرض قائمة الطلاب مع بطاقات)

import { BaseTab } from './BaseTab.js';
import { StudentCard } from '../components/StudentCard.js';
import { StatsCalculator } from '../core/StatsCalculator.js';

export class StudentsTab extends BaseTab {
  async render() {
    const data = await this.getData();
    if (!data) {
      this.showError('فشل تحميل بيانات الطلاب');
      return;
    }

    const { students, studentStats, grades } = data;

    // إنشاء خيارات الصف للفلتر
    const gradeOptions = grades.map(g => `<option value="${g}">${g}</option>`).join('');

    this.container.innerHTML = `
      <div class="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 class="text-2xl font-bold text-yellow-400">👥 أداء الطلاب</h2>
        <div class="flex gap-3">
          <select id="students-grade-filter" class="filter-chip bg-black/40 border border-yellow-500/30 rounded-full px-4 py-2">
            <option value="all">جميع الصفوف</option>
            ${gradeOptions}
          </select>
          <button id="refresh-students-btn" class="action-btn"><i class="fas fa-sync-alt"></i> تحديث</button>
        </div>
      </div>
      <div id="students-grid" class="students-grid"></div>
    `;

    await this.renderStudentsList(students, studentStats, 'all');

    // ربط الأحداث
    document.getElementById('students-grade-filter').addEventListener('change', async (e) => {
      await this.renderStudentsList(students, studentStats, e.target.value);
    });
    document.getElementById('refresh-students-btn').addEventListener('click', async () => {
      await this.manager.refreshData();
      await this.render();
    });
  }

  async renderStudentsList(allStudents, studentStats, gradeFilter) {
    let filtered = allStudents.filter(s => !s.isTeacher);
    if (gradeFilter !== 'all') {
      filtered = filtered.filter(s => s.grade === gradeFilter);
    }
    // ترتيب حسب النقاط تنازلياً
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0));

    const container = document.getElementById('students-grid');
    if (!filtered.length) {
      container.innerHTML = '<div class="text-center text-gray-400 py-8">لا يوجد طلاب في هذا الصف</div>';
      return;
    }

    container.innerHTML = '';
    for (const student of filtered) {
      const badges = await StatsCalculator.getStudentBadges(student.id);
      const accuracy = studentStats[student.id]?.correctAnswers && studentStats[student.id]?.totalAnswers
        ? Math.round((studentStats[student.id].correctAnswers / studentStats[student.id].totalAnswers) * 100)
        : 0;
      const card = StudentCard.create({ ...student, accuracy, badges });
      card.addEventListener('click', () => {
        if (window.showAdvancedAnalysis) window.showAdvancedAnalysis(student.id, 'all');
      });
      container.appendChild(card);
    }
  }
}