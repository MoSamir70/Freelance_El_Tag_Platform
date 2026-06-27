// src/online/race/answerHandler.js
// معالجة الإجابة: تحديث نقاط ومركز اللاعب، تطبيق العقوبات حسب وضع اللعب
// الإصدار النهائي مع ضمانات:
// - منع معالجة الإجابة المعلقة أكثر من مرة
// - حساب النقاط والمركز بدقة وفقاً لوضع اللعب
// - التحقق من الوصول إلى هدف الفوز
// - دعم أنظمة الفرق (مبدئياً) والأوضاع الخاصة

import { getDocumentOnce } from '../core/firestoreSync.js';
import { getModeDetails } from '../constants/gameModes.js';

/**
 * معالجة إجابة لاعب
 * @param {string} sessionId 
 * @param {object} pendingAnswer - { playerId, selectedIndex, isCorrect, timestamp, processed }
 * @param {boolean} isTimeout - هل انتهى الوقت؟
 * @returns {Promise<{success: boolean, winner?: object, updatedRace: object, error?: string}>}
 */
export async function processAnswer(sessionId, pendingAnswer, isTimeout = false) {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race) {
    return { success: false, updatedRace: null, error: 'Race not found' };
  }
  
  // منع المعالجة إذا كانت الإجابة قد تمت معالجتها مسبقاً
  if (race.pendingAnswer && race.pendingAnswer.processed === true) {
    console.log('[AnswerHandler] Answer already processed, skipping');
    return { success: false, updatedRace: race, error: 'Already processed' };
  }
  
  const { players, goal, gameMode, isTeam, teams, activeEntityId } = race;
  const playerId = pendingAnswer.playerId;
  
  // التأكد من أن اللاعب الذي أجاب هو نفسه اللاعب النشط (لمنع الغش)
  if (playerId !== activeEntityId) {
    console.warn(`[AnswerHandler] Player ${playerId} answered out of turn (active: ${activeEntityId})`);
    return { success: false, updatedRace: race, error: 'Not your turn' };
  }
  
  const playerIndex = players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return { success: false, updatedRace: race, error: 'Player not found' };
  }
  
  const player = players[playerIndex];
  const modeDetails = getModeDetails(gameMode);
  
  let deltaPos = 0;
  let deltaScore = 0;
  
  if (isTimeout) {
    // انتهى الوقت: إجابة خاطئة بدون اختيار
    deltaPos = -1;
    deltaScore = 0;
  } else {
    if (pendingAnswer.isCorrect) {
      deltaPos = 1;
      deltaScore = 10;
      // تطبيق مكافآت حسب الوضع
      if (modeDetails?.id === 'solo_speedrun') deltaPos += 1;
      if (modeDetails?.id === 'solo_quizrush') deltaScore += 5;
      if (modeDetails?.id === 'solo_marathon') deltaPos = 1; // الماراثون لا يتقدم بخطوة إضافية
    } else {
      deltaPos = -1;
      deltaScore = 0;
      // تطبيق عقوبات إضافية حسب الوضع
      if (modeDetails?.id === 'solo_mined') deltaPos -= 2; // خسارة خطوتين إضافيتين
      if (modeDetails?.id === 'solo_survival') {
        // وضع البقاء: الإجابة الخاطئة تطرد اللاعب؟
        // سنتركها للمستقبل
      }
    }
  }
  
  // حساب المركز الجديد (يجب ألا يقل عن 0 ولا يتجاوز الهدف)
  let newPos = Math.max(0, Math.min(goal, player.pos + deltaPos));
  let newScore = player.score + deltaScore;
  
  // في وضع الرهان (bet) قد تكون هناك معالجة خاصة
  if (modeDetails?.id === 'solo_bet' && race.betAmount) {
    if (pendingAnswer.isCorrect) {
      newScore += race.betAmount * 2; // ربح الرهان
    } else {
      newScore -= race.betAmount; // خسارة الرهان
    }
  }
  
  // تحديث اللاعب
  const updatedPlayers = [...players];
  updatedPlayers[playerIndex] = { 
    ...player, 
    pos: newPos, 
    score: newScore,
    lastAnswerCorrect: pendingAnswer.isCorrect,
    lastAnswerTime: new Date()
  };
  
  let winner = null;
  let updatedRace = { ...race, players: updatedPlayers };
  
  // إذا كان نظام فرق، تحديث نقاط الفريق أيضاً
  if (isTeam && teams) {
    const teamId = player.teamId;
    if (teamId) {
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex !== -1) {
        const updatedTeams = [...teams];
        updatedTeams[teamIndex].totalScore = (updatedTeams[teamIndex].totalScore || 0) + deltaScore;
        updatedRace.teams = updatedTeams;
      }
    }
  }
  
  // التحقق من الوصول إلى هدف الفوز
  if (newPos >= goal) {
    winner = player;
    updatedRace.winnerId = player.id;
    updatedRace.winnerName = player.name;
  }
  
  // تحديث الإجابة على أنها تمت معالجتها
  updatedRace.pendingAnswer = { ...pendingAnswer, processed: true };
  
  return {
    success: true,
    winner,
    updatedRace
  };
}

/**
 * حساب الترتيب النهائي للاعبين بعد انتهاء السباق
 * @param {Array} players 
 * @returns {Array} - مصنف حسب المركز (pos تنازلياً)
 */
export function getFinalRanking(players) {
  return [...players].sort((a, b) => {
    if (a.pos !== b.pos) return b.pos - a.pos;
    return b.score - a.score;
  });
}

/**
 * منح مكافآت إضافية للاعبين حسب مراكزهم (تُستدعى بعد انتهاء السباق)
 * @param {Array} players 
 * @returns {object} - نقاط إضافية لكل لاعب
 */
export function calculatePlacementBonuses(players) {
  const sorted = getFinalRanking(players);
  const bonuses = {};
  sorted.forEach((player, idx) => {
    if (idx === 0) bonuses[player.id] = 50;
    else if (idx === 1) bonuses[player.id] = 30;
    else if (idx === 2) bonuses[player.id] = 15;
    else bonuses[player.id] = 0;
  });
  return bonuses;
}