// src/stats/utils/chartColors.js
// ألوان المخططات حسب الثيم (فاتح/داكن)

export const chartColors = {
  // الألوان الأساسية
  primary: '#facc15',      // ذهبي
  secondary: '#3b82f6',    // أزرق
  success: '#10b981',      // أخضر
  danger: '#ef4444',       // أحمر
  warning: '#f97316',      // برتقالي
  purple: '#a855f7',       // بنفسجي
  cyan: '#06b6d4',         // سماوي
  pink: '#ec4899',         // وردي

  // ألوان المخططات المخصصة
  lineGradient: (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(250, 204, 21, 0.4)');
    gradient.addColorStop(1, 'rgba(250, 204, 21, 0.02)');
    return gradient;
  },

  barColors: ['#facc15', '#3b82f6', '#10b981', '#ef4444', '#a855f7', '#06b6d4', '#f97316'],

  // ألوان حسب مستوى الصعوبة
  difficulty: {
    easy: '#10b981',
    medium: '#facc15',
    hard: '#ef4444'
  },

  // ألوان حسب الحالة
  status: {
    active: '#10b981',
    pending: '#facc15',
    finished: '#6b7280',
    error: '#ef4444'
  },

  /**
   * الحصول على لون المخطط حسب الثيم الحالي (فاتح/داكن)
   * @returns {Object}
   */
  getThemeColors() {
    const isLight = document.body.classList.contains('light');
    return {
      text: isLight ? '#1f2937' : '#f3f4f6',
      grid: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
      background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.3)',
      tooltipBg: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)',
      tooltipBorder: isLight ? '#cbd5e1' : '#475569'
    };
  }
};