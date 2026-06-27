// src/stats/tabs/DashboardTab.js
// تبويب لوحة القيادة الرئيسية

import { BaseTab } from './BaseTab.js';
import { KPICard } from '../components/KPICard.js';
import { ChartRenderer } from '../components/ChartRenderer.js';
import { StatsCalculator } from '../core/StatsCalculator.js';

export class DashboardTab extends BaseTab {
  constructor(manager, config) {
    super(manager, config);
    this.period = 'all'; // 'day', 'week', 'month', 'all'
    this.charts = {};
  }

  async render() {
    const data = await this.getData();
    if (!data) {
      this.showError('فشل تحميل البيانات');
      return;
    }

    const { students, history, studentStats } = data;
    const kpis = await StatsCalculator.getDashboardKPIs(data);
    const dailyActivity = StatsCalculator.getDailyActivity(history, 7);
    const difficultyDist = await StatsCalculator.getDifficultyDistribution(data.allQuestions);
    const recentEvents = StatsCalculator.getRecentEvents(history, students);

    this.container.innerHTML = `
      <div class="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 class="text-2xl font-bold text-yellow-400">📊 لوحة القيادة</h2>
        <div class="time-filter flex gap-2" id="dashboard-time-filter">
          <button data-period="day" class="filter-chip">اليوم</button>
          <button data-period="week" class="filter-chip">الأسبوع</button>
          <button data-period="month" class="filter-chip">الشهر</button>
          <button data-period="all" class="filter-chip active">الكل</button>
        </div>
      </div>
      <div id="dashboard-kpi-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"></div>
      <div class="dashboard-layout">
        <div class="glass-panel p-4">
          <div class="panel-header text-lg font-bold text-yellow-400 mb-3">📈 النشاط اليومي</div>
          <div id="daily-chart" style="height: 320px;"></div>
        </div>
        <div class="glass-panel p-4">
          <div class="panel-header text-lg font-bold text-yellow-400 mb-3">🍩 توزيع صعوبة الأسئلة</div>
          <div id="difficulty-chart" style="height: 320px;"></div>
        </div>
      </div>
      <div class="glass-panel p-4 mt-6">
        <div class="panel-header">📡 آخر الأحداث</div>
        <div class="interactive-list" id="recent-events-list">
          ${recentEvents.map(e => `<div class="list-item"><span>${e}</span></div>`).join('')}
        </div>
      </div>
    `;

    // عرض بطاقات KPI
    const kpiContainer = document.getElementById('dashboard-kpi-grid');
    KPICard.renderGrid(kpiContainer, [
      { icon: '👥', value: kpis.totalStudents, label: 'إجمالي الطلاب', change: null },
      { icon: '🎮', value: kpis.totalMatches, label: 'إجمالي المباريات', change: null },
      { icon: '🎯', value: kpis.avgAccuracy + '%', label: 'متوسط الدقة', change: null },
      { icon: '🏆', value: kpis.avgIndex, label: 'مؤشر التاج', change: null }
    ]);

    // رسم المخططات
    ChartRenderer.line('daily-chart', dailyActivity.labels, dailyActivity.values, 'عدد المباريات');
    ChartRenderer.pie('difficulty-chart', difficultyDist.labels, difficultyDist.values);

    this.attachFilterEvents();
  }

  attachFilterEvents() {
    const filters = this.container.querySelectorAll('#dashboard-time-filter .filter-chip');
    filters.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        filters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const period = btn.dataset.period;
        this.period = period;

        const data = await this.getData();
        let filteredHistory = data.history;
        if (period !== 'all') {
          const now = Date.now();
          let startTime;
          switch (period) {
            case 'day': startTime = now - 24 * 60 * 60 * 1000; break;
            case 'week': startTime = now - 7 * 24 * 60 * 60 * 1000; break;
            case 'month': startTime = now - 30 * 24 * 60 * 60 * 1000; break;
            default: startTime = 0;
          }
          filteredHistory = data.history.filter(g => g.timestamp >= startTime);
        }
        const dailyActivity = StatsCalculator.getDailyActivity(filteredHistory, 7);
        ChartRenderer.updateLine('daily-chart', dailyActivity.labels, dailyActivity.values);
      });
    });
  }

  deactivate() {
    if (this.charts) {
      Object.values(this.charts).forEach(chart => {
        if (chart && chart.dispose) chart.dispose();
      });
    }
  }
}