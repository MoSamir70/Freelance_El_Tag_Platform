// src/stats/tabs/StatusTab.js
// تبويب حالة الطلاب (الترتيب – لوحة الشرف المصغرة)

import { BaseTab } from './BaseTab.js';
import { StatsCalculator } from '../core/StatsCalculator.js';

export class StatusTab extends BaseTab {
  async render() {
    const data = await this.getData();
    if (!data) {
      this.showError('فشل تحميل بيانات الطلاب');
      return;
    }

    const { students, studentStats, grades } = data;
    const topStudents = StatsCalculator.getTopStudents(students);
    const bottomStudents = StatsCalculator.getBottomStudents(students);

    const buildRankList = (list, isTop) => {
      if (!list.length) return '<div class="text-gray-400 text-center">لا توجد بيانات</div>';
      return list.map((s, idx) => {
        const accuracy = studentStats[s.id]?.correctAnswers && studentStats[s.id]?.totalAnswers
          ? Math.round((studentStats[s.id].correctAnswers / studentStats[s.id].totalAnswers) * 100)
          : 0;
        return `
          <div class="list-item" data-id="${s.id}" style="cursor:pointer;">
            <div class="flex items-center gap-3">
              <span class="text-xl font-bold ${isTop ? 'text-yellow-400' : 'text-gray-500'}">#${idx + 1}</span>
              <img src="${s.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="w-10 h-10 rounded-full border border-yellow-500 object-cover">
              <div>
                <div class="font-bold">${s.name}</div>
                <div class="text-xs text-gray-400">${s.grade}</div>
              </div>
            </div>
            <div class="text-left">
              <div class="text-yellow-400 font-bold">⭐ ${s.score || 0}</div>
              <div class="text-xs text-green-400">دقة: ${accuracy}%</div>
            </div>
          </div>
        `;
      }).join('');
    };

    this.container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-yellow-400">🏆 حالة الطلاب</h2>
        <button id="refresh-status-btn" class="action-btn"><i class="fas fa-sync-alt"></i> تحديث</button>
      </div>
      <div class="dashboard-layout" style="grid-template-columns: 1fr 1fr;">
        <div class="glass-panel p-4">
          <div class="panel-header text-green-400">🏅 أعلى الطلاب ترتيباً</div>
          <div class="interactive-list" id="top-students-list">${buildRankList(topStudents, true)}</div>
        </div>
        <div class="glass-panel p-4">
          <div class="panel-header text-red-400">⚠️ الطلاب الأقل ترتيباً</div>
          <div class="interactive-list" id="bottom-students-list">${buildRankList(bottomStudents, false)}</div>
        </div>
      </div>
    `;

    // إضافة حدث النقر على بطاقات الطلاب لعرض التحليل المتقدم
    document.querySelectorAll('#top-students-list .list-item, #bottom-students-list .list-item').forEach(item => {
      item.addEventListener('click', () => {
        const studentId = item.dataset.id;
        if (studentId && window.showAdvancedAnalysis) window.showAdvancedAnalysis(studentId, 'all');
      });
    });

    document.getElementById('refresh-status-btn').addEventListener('click', async () => {
      await this.manager.refreshData();
      await this.render();
    });
  }
}