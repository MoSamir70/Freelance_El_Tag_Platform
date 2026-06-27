// src/stats/tabs/QuestionsTab.js
// تبويب تحليل الأسئلة (الصعوبة، التوزيع)

import { BaseTab } from './BaseTab.js';
import { ChartRenderer } from '../components/ChartRenderer.js';
import { StatsCalculator } from '../core/StatsCalculator.js';

export class QuestionsTab extends BaseTab {
  async render() {
    const data = await this.getData();
    if (!data) {
      this.showError('فشل تحميل بيانات الأسئلة');
      return;
    }

    const { students, studentStats, allQuestions, grades } = data;
    const difficultyDist = await StatsCalculator.getDifficultyDistribution(allQuestions);
    const totals = StatsCalculator.getTotals(students, studentStats);
    const avgAccuracy = StatsCalculator.getAverageAccuracy(students, studentStats);

    // حساب عدد الأسئلة حسب الصف
    const gradeStats = grades.map(grade => ({
      grade,
      count: allQuestions[grade] || 0
    }));

    this.container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-yellow-400">🧠 تحليل الأسئلة المتقدم</h2>
        <button id="refresh-questions-btn" class="action-btn"><i class="fas fa-sync-alt"></i> تحديث</button>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="glass-panel p-4">
          <div class="panel-header">🍩 توزيع صعوبة الأسئلة</div>
          <div id="difficulty-pie" style="height: 300px;"></div>
        </div>
        <div class="glass-panel p-4">
          <div class="panel-header">📊 الإجابات الصحيحة مقابل الخاطئة</div>
          <div id="answers-bar" style="height: 300px;"></div>
        </div>
      </div>
      <div class="glass-panel p-4">
        <div class="panel-header">📚 توزيع الأسئلة حسب الصف</div>
        <div id="grade-bar" style="height: 300px;"></div>
      </div>
    `;

    ChartRenderer.pie('difficulty-pie', difficultyDist.labels, difficultyDist.values);
    ChartRenderer.bar('answers-bar', ['صحيحة', 'خاطئة'], [totals.correct, totals.wrong]);
    
    const gradeLabels = gradeStats.map(g => g.grade);
    const gradeValues = gradeStats.map(g => g.count);
    ChartRenderer.bar('grade-bar', gradeLabels, gradeValues);

    document.getElementById('refresh-questions-btn').addEventListener('click', async () => {
      await this.manager.refreshData();
      await this.render();
    });
  }
}