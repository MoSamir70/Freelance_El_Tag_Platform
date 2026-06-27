// src/online/constants/gameModes.js
// قائمة أوضاع اللعب (فردي وجماعي)

export const INDIVIDUAL_MODES = [
  { id: 'normal', name: 'كلاسيكي', icon: '⚡', desc: 'تقدم بخطوة عند الإجابة الصحيحة', needTarget: false },
  { id: 'solo_memory', name: 'الذاكرة', icon: '🧠', desc: 'يختفي السؤال بعد ثوانٍ', needTarget: false },
  { id: 'solo_mined', name: 'ملغوم', icon: '💣', desc: 'إجابة خاطئة تنقص 3 خطوات', needTarget: false },
  { id: 'solo_bet', name: 'مراهنة', icon: '🎲', desc: 'راهن بخطواتك', needTarget: true },
  { id: 'solo_speedrun', name: 'سرعة', icon: '⏱️', desc: 'وقت أقل لكل سؤال', needTarget: false },
  { id: 'solo_survival', name: 'بقاء', icon: '🛡️', desc: '3 قلوب فقط', needTarget: false },
  { id: 'solo_quizrush', name: 'هجمة', icon: '💥', desc: 'الصح بنقطة، الخطأ يرجع للصفر', needTarget: false },
  { id: 'solo_surprise', name: 'مفاجآت', icon: '🃏', desc: 'بطاقات عشوائية', needTarget: false }
];

export const TEAM_MODES = [
  { id: 'team_relay', name: 'تتابع', icon: '🏃', desc: 'أعضاء الفريق يتناوبون', needTarget: false },
  { id: 'team_battle', name: 'حرب', icon: '⚔️', desc: 'الخطأ يعطي نقطة للخصم', needTarget: false },
  { id: 'team_revenge', name: 'ثأر', icon: '🔥', desc: 'سرقة نقاط', needTarget: false },
  { id: 'team_mined', name: 'حقل ألغام', icon: '💣', desc: 'ألغام تخصم 4 نقاط', needTarget: false },
  { id: 'team_penalty', name: 'عقوبات', icon: '⚖️', desc: 'الخطأ يعطي الجميع نقطة', needTarget: false },
  { id: 'team_trophy', name: 'الكأس المتجول', icon: '🏆', desc: 'الكأس ينتقل', needTarget: false }
];

/**
 * الحصول على تفاصيل وضع لعب معين
 * @param {string} modeId 
 * @returns {object|undefined}
 */
export function getModeDetails(modeId) {
  return [...INDIVIDUAL_MODES, ...TEAM_MODES].find(m => m.id === modeId);
}

/**
 * هل هذا الوضع جماعي؟
 * @param {string} modeId 
 * @returns {boolean}
 */
export function isTeamMode(modeId) {
  return TEAM_MODES.some(m => m.id === modeId);
}

/**
 * هل هذا الوضع فردي؟
 * @param {string} modeId 
 * @returns {boolean}
 */
export function isIndividualMode(modeId) {
  return INDIVIDUAL_MODES.some(m => m.id === modeId);
}