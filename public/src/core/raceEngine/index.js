// ===================== src/core/raceEngine/index.js =====================
// هذا الملف هو واجهة التصدير (barrel) لوحدات السباق المختلفة.
// يتم استيراد جميع الدوال من الملفات المنفصلة وإعادة تصديرها بنفس الأسماء
// لضمان عدم تعطيل أي استيراد قديم من '../raceEngine.js'.
// [FIX] إعادة تصدير nextPlayer و startTurn للمساعدة في الانتقال بين الأدوار

export { startRaceWithSettings, exitRaceImmediate } from './lifecycle.js';
export { startTurn, nextPlayer } from './turn.js';
export { handleAnswer } from './answer.js';
export { winGame } from './win.js';
export { withdrawEntity } from './withdraw.js';