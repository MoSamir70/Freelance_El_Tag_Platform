// src/stats/index.js
// واجهة التصدير العامة لنظام الإحصائيات الجديد + إعادة تصدير الدوال القديمة للتوافق مع main.js

// ========== النظام الجديد ==========
export { StatsManager } from './StatsManager.js';
export { StatsDataService } from './core/StatsDataService.js';
export { StatsCalculator } from './core/StatsCalculator.js';
export { statsCache } from './core/StatsCache.js';
export { BaseTab } from './tabs/BaseTab.js';
export { DashboardTab } from './tabs/DashboardTab.js';
export { StudentsTab } from './tabs/StudentsTab.js';
export { LessonsTab } from './tabs/LessonsTab.js';
export { StatusTab } from './tabs/StatusTab.js';
export { LiveTab } from './tabs/LiveTab.js';
export { ForecastTab } from './tabs/ForecastTab.js';
export { QuestionsTab } from './tabs/QuestionsTab.js';
export { ReportsTab } from './tabs/ReportsTab.js';
export { InfoTab } from './tabs/InfoTab.js';
export { KPICard } from './components/KPICard.js';
export { StudentCard } from './components/StudentCard.js';
export { LessonCard } from './components/LessonCard.js';
export { ChartRenderer } from './components/ChartRenderer.js';
export { TableBuilder } from './components/TableBuilder.js';
export { EmptyState } from './components/EmptyState.js';
export { chartColors } from './utils/chartColors.js';
export { formatNumber, formatPercent, formatDate, formatDuration, formatStudentName, formatScore } from './utils/formatters.js';
export { filterHistoryByPeriod, filterStudentsByGrade, filterStudentsByScore, filterStudentsBySearch, filterQuestions, getFilterOptions } from './utils/filters.js';

// ========== إعادة تصدير الدوال القديمة للتوافق مع main.js ==========
// هذه الدوال لا تزال موجودة في مجلد analytics/ (لم يتم حذفها)
export { renderAdvancedStats, updateStudentSearchList } from './analytics/uiBuilder.js';
export { exportGradeReport, exportComparisonPDF, _resetAllData } from './analytics/export.js';
export { calculateExcellenceIndex, getStudentBadges, generateInsights, getRecentEvents, getDailyActiveStudents, getTopLessons, getBottomLessons, getLessonDetails, getTopStudentsForLesson, getBottomStudentsForLesson } from './analytics/core.js';
export { showComparisonModal, renderComparison } from './analytics/comparison.js';
export { updateChart, renderStudentProgressChart, renderStudentProgressChartStatic } from './analytics/charts.js';