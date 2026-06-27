// src/core/modes/team/TrophyMode.js
import { BaseMode } from '../BaseMode.js';
import { RaceEvents } from '../../raceEvents.js';

export class TrophyMode extends BaseMode {
  onRaceStart() {
    return { wanderingTrophyTeam: null, wanderingTrophyCount: 0 };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent, sessionId, raceData }) {
    let stepsDelta = isCorrect ? 1 : -1;
    let pointsDelta = isCorrect ? 1 : -1;
    
    if (raceData.wanderingTrophyTeam === currentEntity.id) {
      if (isCorrect) {
        raceData.wanderingTrophyCount = (raceData.wanderingTrophyCount || 0) + 1;
        if (raceData.wanderingTrophyCount >= 3) {
          stepsDelta += 5;
          raceData.wanderingTrophyTeam = null;
          raceData.wanderingTrophyCount = 0;
        }
      } else {
        raceData.wanderingTrophyTeam = null;
        raceData.wanderingTrophyCount = 0;
      }
    } 
    else if (isCorrect && (raceData.wanderingTrophyTeam === null || raceData.wanderingTrophyTeam === undefined)) {
      raceData.wanderingTrophyTeam = currentEntity.id;
      raceData.wanderingTrophyCount = 1;
    }
    
    if (sessionId && typeof RaceEvents.updateSingleLane === 'function') {
      RaceEvents.updateSingleLane(sessionId, String(currentEntity.id));
    }
    
    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember, raceData, sessionId) {
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
  }
}