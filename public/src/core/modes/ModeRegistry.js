// src/core/modes/ModeRegistry.js
// سجل جميع أوضاع اللعب (9 فردية + 6 جماعية)
// تم تسجيلها لاستخدامها في نظام السباق (raceEngine)

// استيرادات الأوضاع الفردية (9)
import { ClassicMode } from './individual/ClassicMode.js';
import { SpeedrunMode } from './individual/SpeedrunMode.js';
import { MemoryMode } from './individual/MemoryMode.js';
import { MinedMode } from './individual/MinedMode.js';
import { BetMode } from './individual/BetMode.js';
import { MarathonMode } from './individual/MarathonMode.js';
import { SurvivalMode } from './individual/SurvivalMode.js';
import { QuizRushMode } from './individual/QuizRushMode.js';
import { SurpriseMode } from './individual/SurpriseMode.js';

// استيرادات الأوضاع الجماعية (6)
import { RelayMode } from './team/RelayMode.js';
import { BattleMode } from './team/BattleMode.js';
import { RevengeMode } from './team/RevengeMode.js';
import { TrophyMode } from './team/TrophyMode.js';
import { MinedTeamMode } from './team/MinedTeamMode.js';
import { PenaltyMode } from './team/PenaltyMode.js';

// الخريطة التي تربط معرف الوضع (modeId) بكلاسه
const modeMap = new Map();

/**
 * تسجيل وضع جديد في النظام
 * @param {string} modeId - معرف الوضع (مثل 'solo_classic', 'team_battle')
 * @param {Class} ModeClass - الكلاس الذي يمدد BaseMode
 */
export function registerMode(modeId, ModeClass) {
  modeMap.set(modeId, ModeClass);
}

/**
 * إنشاء كائن وضع بناءً على المعرف
 * @param {string} modeId - معرف الوضع
 * @param {Object} raceData - بيانات السباق الحالية
 * @param {string} sessionId - معرف جلسة السباق
 * @returns {BaseMode|null} - كائن الوضع أو null إذا لم يتم العثور عليه
 */
export function createMode(modeId, raceData, sessionId) {
  const ModeClass = modeMap.get(modeId);
  if (!ModeClass) {
    console.warn(`⚠️ Mode "${modeId}" غير مسجل. سيتم استخدام السلوك الافتراضي.`);
    return null;
  }
  return new ModeClass(raceData, sessionId);
}

/**
 * تسجيل جميع أوضاع اللعب (يُستدعى مرة واحدة عند بدء التشغيل)
 */
export function registerAllModes() {
  // ========== الأوضاع الفردية (9) ==========
  registerMode('solo_classic', ClassicMode);
  registerMode('solo_speedrun', SpeedrunMode);
  registerMode('solo_memory', MemoryMode);
  registerMode('solo_mined', MinedMode);
  registerMode('solo_bet', BetMode);
  registerMode('solo_marathon', MarathonMode);
  registerMode('solo_survival', SurvivalMode);
  registerMode('solo_quizrush', QuizRushMode);
  registerMode('solo_surprise', SurpriseMode);

  // ========== الأوضاع الجماعية (6) ==========
  registerMode('team_relay', RelayMode);
  registerMode('team_battle', BattleMode);
  registerMode('team_revenge', RevengeMode);
  registerMode('team_trophy', TrophyMode);
  registerMode('team_mined', MinedTeamMode);
  registerMode('team_penalty', PenaltyMode);

  console.log(`✅ تم تسجيل ${modeMap.size} وضع لعب (${modeMap.size} mode)`);
}

/**
 * التحقق مما إذا كان الوضع مسجلاً
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeRegistered(modeId) {
  return modeMap.has(modeId);
}

/**
 * الحصول على قائمة بجميع معرفات الأوضاع المسجلة
 * @returns {string[]}
 */
export function getRegisteredModes() {
  return Array.from(modeMap.keys());
}