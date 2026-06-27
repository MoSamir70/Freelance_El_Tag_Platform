// src/core/modes/team/BattleMode.js
import { BaseMode } from '../BaseMode.js';
import { RaceEvents } from '../../raceEvents.js';

export class BattleMode extends BaseMode {
  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent, betAmount, isMinedQuestion, sessionId, raceData }) {
    let stepsDelta = 0;
    let pointsDelta = 0;
    
    if (isCorrect) {
      stepsDelta = 1;
      pointsDelta = 1;
    } else {
      stepsDelta = 0;
      pointsDelta = -1;
      // عند الخطأ، تتقدم الفرق الأخرى خطوة
      if (raceData && raceData.teams) {
        raceData.teams.forEach(t => {
          if (t.id !== currentEntity.id) {
            t.pos += 1;
          }
        });
        // إعادة رسم جميع المضامير بعد تغيير مواقع الفرق الأخرى
        if (sessionId && typeof RaceEvents.renderTracks === 'function') {
          RaceEvents.renderTracks(sessionId);
        }
      }
    }
    
    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember, raceData, sessionId) {
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
    if (raceData && raceData.teams && sessionId) {
      raceData.teams.forEach(t => {
        if (t.id !== currentEntity.id) {
          t.pos += 1;
        }
      });
      if (typeof RaceEvents.renderTracks === 'function') {
        RaceEvents.renderTracks(sessionId);
      }
    }
  }
}