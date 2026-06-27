// src/online/core/raceState.js
// تعريف هيكل الحالة للغرفة والسباق، مع دوال للتحقق من صحة البيانات

import { ROOM_STATUS, RACE_STATUS, DEFAULT_GOAL, DEFAULT_TIMER, DEFAULT_MAX_PLAYERS } from '../constants/raceConfig.js';

/**
 * التحقق من صحة كائن الغرفة قبل الكتابة في Firestore
 * @param {object} roomData
 * @returns {{valid: boolean, error?: string}}
 */
export function validateRoom(roomData) {
  const required = ['roomId', 'hostId', 'teacherId', 'grade', 'gameMode', 'gameSystem'];
  for (const field of required) {
    if (!roomData[field]) return { valid: false, error: `${field} مطلوب` };
  }
  if (roomData.maxPlayers && (roomData.maxPlayers < 2 || roomData.maxPlayers > 10)) {
    return { valid: false, error: 'عدد اللاعبين بين 2 و 10' };
  }
  if (!Object.values(ROOM_STATUS).includes(roomData.status)) {
    return { valid: false, error: 'حالة الغرفة غير صالحة' };
  }
  if (roomData.goal && (roomData.goal < 3 || roomData.goal > 30)) {
    return { valid: false, error: 'عدد خطوات الفوز بين 3 و 30' };
  }
  return { valid: true };
}

/**
 * إنشاء كائن غرفة جديد بالبيانات الافتراضية
 * @param {object} params
 * @returns {object}
 */
export function createRoomObject({
  roomId,
  hostId,
  hostName,
  teacherId,
  grade,
  subject,
  gameMode,
  gameSystem,
  isPrivate,
  pin,
  maxPlayers = DEFAULT_MAX_PLAYERS,
  goal = DEFAULT_GOAL,
  timePerQuestion = DEFAULT_TIMER,
  raceSettingsBackup = null
}) {
  const now = new Date();
  return {
    roomId,
    pin,
    accessCode: isPrivate ? pin : null,
    name: `غرفة ${hostName}`,
    hostId,
    hostName,
    teacherId,
    grade,
    subject,
    gameMode,
    gameSystem,
    maxPlayers,
    players: [{ id: hostId, name: hostName, img: '', isReady: false, score: 0, pos: 0 }],
    spectators: [],
    isPrivate,
    status: ROOM_STATUS.WAITING,
    createdAt: now,
    raceSettingsBackup,
    goal,
    timePerQuestion,
    lastActivity: now
  };
}

/**
 * التحقق من صحة كائن السباق
 * @param {object} raceData
 * @returns {{valid: boolean, error?: string}}
 */
export function validateRace(raceData) {
  if (!raceData.sessionId || !raceData.roomId || !raceData.hostId) {
    return { valid: false, error: 'بيانات السباق ناقصة' };
  }
  if (!raceData.players || raceData.players.length < 1) {
    return { valid: false, error: 'لا يوجد لاعبين' };
  }
  if (raceData.currentQuestion && typeof raceData.currentQuestion !== 'object') {
    return { valid: false, error: 'السؤال الحالي غير صالح' };
  }
  if (!Object.values(RACE_STATUS).includes(raceData.status)) {
    return { valid: false, error: 'حالة السباق غير صالحة' };
  }
  return { valid: true };
}

/**
 * إنشاء كائن سباق جديد من بيانات الغرفة
 * @param {object} room - كائن الغرفة (من Firestore)
 * @param {string} sessionId - معرف الجلسة الجديد
 * @param {string} hostId - معرف المضيف (قد يكون نفس hostId الغرفة أو من نقل)
 * @param {string} mode - 'player' أو 'spectator' (وضع المضيف)
 * @returns {object}
 */
export function createRaceObject(room, sessionId, hostId, mode = 'player') {
  const now = new Date();
  return {
    sessionId,
    roomId: room.roomId,
    hostId,
    migrationCount: 0,
    lastPing: now,
    players: room.players.map(p => ({ ...p, isDisconnected: false })),
    teams: room.teams || null,
    spectators: room.spectators || [],
    isTeam: room.gameSystem === 'teams',
    goal: room.goal,
    timePerQuestion: room.timePerQuestion,
    gameMode: room.gameMode,
    grade: room.grade,
    status: RACE_STATUS.WAITING,
    currentQuestion: null,
    currentQuestionIndex: 0,
    raceQuestions: room.raceSettingsBackup?.raceQuestions || [],
    globalUsedIds: [],
    questionStartTime: null,
    pendingAnswer: null,
    activeEntityId: room.players[0]?.id || null,
    winnerId: null,
    winnerName: null,
    mode,
    createdAt: now,
    startedAt: null,
    finishedAt: null
  };
}