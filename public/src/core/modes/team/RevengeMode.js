// src/core/modes/team/RevengeMode.js
import { BaseMode } from '../BaseMode.js';
import { RaceEvents } from '../../raceEvents.js';

export class RevengeMode extends BaseMode {
  onRaceStart() {
    return { lastWrongTeam: null, revengeAvailable: false, revengeExpiry: null };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent, sessionId, raceData }) {
    let stepsDelta = isCorrect ? 1 : -1;
    let pointsDelta = isCorrect ? 1 : -1;
    
    if (!isCorrect) {
      raceData.lastWrongTeam = currentEntity.id;
      raceData.revengeAvailable = true;
      raceData.revengeExpiry = Date.now() + (2 * (raceData?.timeLimit || 12) * 1000);
    } 
    else if (raceData.revengeAvailable && raceData.lastWrongTeam !== null && raceData.lastWrongTeam !== currentEntity.id) {
      stepsDelta += 1;
      const wrongTeam = raceData.teams.find(t => t.id === raceData.lastWrongTeam);
      if (wrongTeam) {
        wrongTeam.pos = Math.max(0, wrongTeam.pos - 1);
        if (sessionId && typeof RaceEvents.updateSingleLane === 'function') {
          RaceEvents.updateSingleLane(sessionId, `team_${wrongTeam.id}`);
        }
      }
      raceData.revengeAvailable = false;
      raceData.lastWrongTeam = null;
      raceData.revengeExpiry = null;
      if (sessionId && typeof RaceEvents.renderTracks === 'function') {
        RaceEvents.renderTracks(sessionId);
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