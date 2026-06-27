// src/stats/StatsManager.js
// المدير الرئيسي لنظام الإحصائيات – يدير التبويبات، البيانات، والحالة العامة

import { StatsDataService } from './core/StatsDataService.js';
import { statsCache } from './core/StatsCache.js';

export class StatsManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Element #${containerId} not found`);
    
    this.tabs = new Map();        // tabId -> { instance, config }
    this.activeTabId = null;
    this.dataService = new StatsDataService();
    this.rawData = null;
    this.derivedData = null;
    this.isLoading = false;
    this.eventListeners = [];
  }

  registerTab(tabId, TabClass, config = {}) {
    if (this.tabs.has(tabId)) {
      console.warn(`Tab ${tabId} مسجل مسبقاً، سيتم استبداله.`);
    }
    const instance = new TabClass(this, { ...config, id: tabId });
    this.tabs.set(tabId, { instance, config });
    console.log(`[StatsManager] تم تسجيل التبويب: ${tabId}`);
  }

  async loadData(forceRefresh = false) {
    if (this.isLoading) return this.derivedData;
    this.isLoading = true;
    try {
      this.rawData = await this.dataService.fetchAllData(forceRefresh);
      this.derivedData = this.calculateDerivedData();
      return this.derivedData;
    } catch (error) {
      console.error('[StatsManager] فشل تحميل البيانات:', error);
      this.showGlobalError(error.message);
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  calculateDerivedData() {
    const { students, history, grades, allQuestions, studentStats } = this.rawData;
    let totalCorrect = 0, totalAnswers = 0;
    for (const s of students) {
      const st = studentStats[s.id] || {};
      totalCorrect += st.correctAnswers || 0;
      totalAnswers += st.totalAnswers || 0;
    }
    const avgAccuracy = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
    const totalMatches = history.length;
    const totalStudents = students.filter(s => !s.isTeacher).length;
    
    return {
      students,
      history,
      grades,
      allQuestions,
      studentStats,
      avgAccuracy,
      totalMatches,
      totalStudents,
      totalCorrect,
      totalAnswers,
      totalWrong: totalAnswers - totalCorrect
    };
  }

  async getData() {
    if (!this.derivedData) {
      await this.loadData();
    }
    return this.derivedData;
  }

  async refreshData() {
    await this.loadData(true);
    if (this.activeTabId) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) await tab.instance.refresh();
    }
  }

  async switchTab(tabId) {
    if (!this.tabs.has(tabId)) {
      console.warn(`Tab ${tabId} غير موجود. التبويبات المسجلة:`, Array.from(this.tabs.keys()));
      return;
    }

    if (this.activeTabId) {
      const current = this.tabs.get(this.activeTabId);
      if (current) current.instance.deactivate();
    }

    this.activeTabId = tabId;
    const { instance } = this.tabs.get(tabId);
    
    this.container.innerHTML = '';
    await instance.activate(this.container);
  }

  /** ✅ دالة جديدة لتحديث التبويب الحالي */
  async refreshCurrentTab() {
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) await tab.instance.refresh();
    } else {
      console.warn('[StatsManager] لا يوجد تبويب نشط لتحديثه');
    }
  }

  showGlobalError(message) {
    this.container.innerHTML = `
      <div class="glass-panel p-8 text-center">
        <div class="text-red-400 text-2xl mb-4">⚠️ خطأ في تحميل البيانات</div>
        <p class="text-gray-400 mb-4">${message}</p>
        <button class="action-btn" id="stats-retry-btn">إعادة المحاولة</button>
      </div>
    `;
    const retryBtn = document.getElementById('stats-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        await this.loadData(true);
        if (this.activeTabId) await this.switchTab(this.activeTabId);
      });
    }
  }

  async init(initialTab = 'dashboard') {
    await this.loadData();
    // التأكد من أن التبويب الأول موجود قبل التبديل
    if (this.tabs.has(initialTab)) {
      await this.switchTab(initialTab);
    } else if (this.tabs.size > 0) {
      const firstTab = Array.from(this.tabs.keys())[0];
      await this.switchTab(firstTab);
    } else {
      console.error('[StatsManager] لا توجد تبويبات مسجلة');
    }
  }

  destroy() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    if (this.activeTabId) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) tab.instance.deactivate();
    }
  }
}