// src/stats/tabs/LiveTab.js
// تبويب الأحداث الحية والتوصيات الذكية

import { BaseTab } from './BaseTab.js';
import { StatsCalculator } from '../core/StatsCalculator.js';

export class LiveTab extends BaseTab {
  constructor(manager, config) {
    super(manager, config);
    this.refreshInterval = null;
  }

  async render() {
    const data = await this.getData();
    if (!data) {
      this.showError('فشل تحميل الأحداث الحية');
      return;
    }

    const { students, history } = data;
    const recentEvents = StatsCalculator.getRecentEvents(history, students);

    this.container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-yellow-400">⚡ الأحداث الحية والتوصيات</h2>
        <div class="flex gap-3">
          <button id="refresh-live-btn" class="action-btn"><i class="fas fa-sync-alt"></i> تحديث</button>
          <button id="auto-refresh-toggle" class="action-btn">⏸️ إيقاف التحديث التلقائي</button>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="glass-panel p-4">
          <div class="panel-header text-green-400">📡 آخر الأحداث</div>
          <div id="live-events-list" class="interactive-list">
            ${recentEvents.map(e => `<div class="list-item"><i class="fas fa-circle text-green-400 text-xs ml-2"></i> ${e}</div>`).join('')}
          </div>
        </div>
        <div class="glass-panel p-4">
          <div class="panel-header text-purple-400">🧠 توصيات الذكاء الاصطناعي</div>
          <div id="ai-insights-list" class="interactive-list">
            <div class="list-item">جاري تحميل التوصيات...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadInsights();

    // ربط الأحداث
    const refreshBtn = document.getElementById('refresh-live-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.manager.refreshData();
        await this.render();
      });
    }

    const toggleBtn = document.getElementById('auto-refresh-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (this.refreshInterval) {
          clearInterval(this.refreshInterval);
          this.refreshInterval = null;
          toggleBtn.innerHTML = '▶️ تشغيل التحديث التلقائي';
        } else {
          this.startAutoRefresh();
          toggleBtn.innerHTML = '⏸️ إيقاف التحديث التلقائي';
        }
      });
    }

    this.startAutoRefresh();
  }

  async loadInsights() {
    const container = document.getElementById('ai-insights-list');
    if (!container) return;

    try {
      // استيراد دالة generateInsights من analytics/core.js القديمة
      const { generateInsights } = await import('../analytics/core.js');
      const insights = await generateInsights();
      container.innerHTML = insights.map(i => `<div class="list-item"><i class="fas fa-lightbulb text-yellow-400 ml-2"></i> ${i}</div>`).join('');
    } catch (error) {
      console.error('فشل تحميل التوصيات:', error);
      container.innerHTML = '<div class="list-item text-red-400">فشل تحميل التوصيات</div>';
    }
  }

  startAutoRefresh() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(async () => {
      if (this.isActive) {
        await this.loadInsights();
        // تحديث الأحداث أيضاً
        const data = await this.getData();
        if (data) {
          const { students, history } = data;
          const recentEvents = StatsCalculator.getRecentEvents(history, students);
          const eventsContainer = document.getElementById('live-events-list');
          if (eventsContainer) {
            eventsContainer.innerHTML = recentEvents.map(e => `<div class="list-item"><i class="fas fa-circle text-green-400 text-xs ml-2"></i> ${e}</div>`).join('');
          }
        }
      }
    }, 30000); // تحديث كل 30 ثانية
  }

  deactivate() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}