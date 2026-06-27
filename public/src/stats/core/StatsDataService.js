// src/stats/core/StatsDataService.js
// مسؤول عن جلب جميع البيانات المطلوبة للإحصائيات من Firebase و IndexedDB

import { getStudents, getGameHistory, getStudentStats, getAllGrades, getQuestions } from '../../services/dataService.js';
import { statsCache } from './StatsCache.js';

export class StatsDataService {
  constructor() {
    this.cacheKey = 'stats_core_data';
  }

  /**
   * جلب جميع البيانات الأساسية مرة واحدة
   * @param {boolean} forceRefresh - تجاهل التخزين المؤقت وإجبار التحديث
   * @returns {Promise<Object>}
   */
  async fetchAllData(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = statsCache.get(this.cacheKey);
      if (cached) return cached;
    }

    console.log('[StatsDataService] جلب البيانات من Firestore و IndexedDB...');

    // جلب البيانات بالتوازي لتحسين الأداء
    const [students, history, grades] = await Promise.all([
      getStudents(),
      getGameHistory(),
      getAllGrades()
    ]);

    // جلب عدد الأسئلة لكل صف من IndexedDB
    const allQuestions = {};
    for (const grade of grades) {
      const questions = await getQuestions(grade);
      allQuestions[grade] = questions.length;
    }

    // جلب إحصائيات الطلاب لكل طالب على حدة
    const studentStats = {};
    for (const student of students) {
      studentStats[student.id] = await getStudentStats(student.id);
    }

    // حساب إحصائيات إضافية (مثلاً عدد المباريات حسب اليوم)
    const activityByDate = {};
    history.forEach(game => {
      const date = new Date(game.timestamp).toLocaleDateString('en-CA');
      activityByDate[date] = (activityByDate[date] || 0) + 1;
    });

    const data = {
      students,
      history,
      grades,
      allQuestions,
      studentStats,
      activityByDate,
      lastUpdated: Date.now()
    };

    statsCache.set(this.cacheKey, data);
    return data;
  }

  /**
   * تحديث البيانات (مسح الكاش وجلب جديد)
   * @returns {Promise<Object>}
   */
  async refresh() {
    statsCache.invalidate(this.cacheKey);
    return this.fetchAllData(true);
  }

  /**
   * الحصول على إحصائيات المباريات حسب النطاق الزمني
   * @param {Array} history - تاريخ المباريات
   * @param {string} period - 'day', 'week', 'month', 'all'
   * @returns {Array}
   */
  static filterHistoryByPeriod(history, period) {
    if (period === 'all') return history;
    const now = Date.now();
    let startTime;
    switch (period) {
      case 'day': startTime = now - 24 * 60 * 60 * 1000; break;
      case 'week': startTime = now - 7 * 24 * 60 * 60 * 1000; break;
      case 'month': startTime = now - 30 * 24 * 60 * 60 * 1000; break;
      default: return history;
    }
    return history.filter(game => game.timestamp >= startTime);
  }
}