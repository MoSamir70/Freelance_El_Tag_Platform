// src/online/constants/raceConfig.js
// ثوابت إعدادات السباق والغرفة
// كل الأرقام اللي هنا ممكن تتغير حسب احتياجك بعدين

// حدود اللاعبين والوقت
export const DEFAULT_MAX_PLAYERS = 8;
export const MIN_GOAL = 3;
export const MAX_GOAL = 30;
export const DEFAULT_GOAL = 10;
export const MIN_TIMER = 5;
export const MAX_TIMER = 45;
export const DEFAULT_TIMER = 12;

// مهلات المضيف وإعادة الاتصال
export const HOST_HEARTBEAT_INTERVAL = 5000;      // كل 5 ثواني يرسل نبضة
export const HOST_TIMEOUT_MS = 15000;             // 15 ثانية بدون نبضة = يعتبر معطلاً
export const RECONNECTION_ATTEMPTS = 3;
export const RECONNECTION_DELAY_MS = 2000;

// حالة الغرفة والسباق
export const ROOM_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

export const RACE_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

export const PLAYER_ROLE = {
  PLAYER: 'player',
  SPECTATOR: 'spectator',
  HOST: 'host'
};

// أقصى عدد من الأسئلة في السباق (لتجنب مستند كبير)
export const MAX_RACE_QUESTIONS = 50;

// إعدادات البطولة (مؤقتة)
export const TOURNAMENT_DEFAULT_QUESTION_COUNT = 10;
export const TOURNAMENT_MAX_PLAYERS = 16;

// نطاقات الرموز (PIN)
export const PIN_LENGTH = 4;
export const PIN_PATTERN = /^\d{4}$/;