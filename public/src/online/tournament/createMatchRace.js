// src/online/tournament/createMatchRace.js
// إنشاء سباق مؤقت لمباراة بطولة (دون تخزين دائم في activeRooms)

import { createDocumentWithRetry } from '../core/firestoreSync.js';
import { createRaceObject } from '../core/raceState.js';
import { RACE_STATUS } from '../constants/raceConfig.js';

/**
 * إنشاء سباق لمباراة بطولة
 * @param {Object} roomData - بيانات الغرفة المؤقتة
 * @returns {Promise<{success: boolean, sessionId?: string}>}
 */
export async function createRaceForMatch(roomData) {
  const sessionId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  // تحويل بيانات الغرفة إلى كائن سباق
  const raceObj = {
    sessionId,
    roomId: sessionId, // لا توجد غرفة دائمة
    hostId: roomData.hostId,
    players: roomData.players.map(p => ({ ...p, isReady: true, score: 0, pos: 0 })),
    spectators: [],
    isTeam: false,
    goal: roomData.goal,
    timePerQuestion: roomData.timePerQuestion,
    gameMode: roomData.gameMode,
    grade: roomData.grade,
    status: RACE_STATUS.WAITING,
    currentQuestion: null,
    currentQuestionIndex: 0,
    raceQuestions: [], // سيتم جلب الأسئلة لاحقاً من بنك الأسئلة
    globalUsedIds: [],
    questionStartTime: null,
    pendingAnswer: null,
    activeEntityId: roomData.players[0]?.id,
    winnerId: null,
    winnerName: null,
    mode: 'player',
    tournamentId: roomData.tournamentId,
    matchId: roomData.matchId,
    createdAt: new Date()
  };

  const result = await createDocumentWithRetry('activeRaces', raceObj);
  if (result.success) {
    return { success: true, sessionId };
  }
  return { success: false };
}