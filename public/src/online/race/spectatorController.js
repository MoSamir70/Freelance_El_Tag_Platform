// src/online/race/spectatorController.js
// المشاهد: يشاهد السؤال الحالي فقط، لا يستطيع الإجابة

import { subscribeToDocument } from '../core/firestoreSync.js';

let spectatorUnsubscribe = null;

export function startSpectatorController(sessionId, onQuestionUpdate, onPlayersUpdate) {
  if (spectatorUnsubscribe) spectatorUnsubscribe();
  
  spectatorUnsubscribe = subscribeToDocument('activeRaces', sessionId, (race) => {
    if (!race) return;
    if (race.currentQuestion) {
      onQuestionUpdate(race.currentQuestion);
    }
    if (onPlayersUpdate) {
      onPlayersUpdate(race.players, race.activeEntityId);
    }
  });
}

export function stopSpectatorController() {
  if (spectatorUnsubscribe) {
    spectatorUnsubscribe();
    spectatorUnsubscribe = null;
  }
}