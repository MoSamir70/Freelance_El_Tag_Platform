// src/core/modes/team/PenaltyMode.js
import { BaseMode } from '../BaseMode.js';
import { RaceEvents } from '../../raceEvents.js';

export class PenaltyMode extends BaseMode {
  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent, sessionId, raceData }) {
    let stepsDelta = 0;
    let pointsDelta = 0;
    
    if (isCorrect) {
      stepsDelta = 1;
      pointsDelta = 1;
    } else {
      stepsDelta = 0;
      pointsDelta = -1;
      if (raceData && raceData.teams) {
        raceData.teams.forEach(t => {
          if (t.id !== currentEntity.id) {
            t.pos += 1;
          }
        });
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
  }
}