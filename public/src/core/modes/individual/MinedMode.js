// src/core/modes/individual/MinedMode.js
import { BaseMode } from '../BaseMode.js';

export class MinedMode extends BaseMode {
  onRaceStart() {
    return { soloMinedActive: false, soloMinedCooldown: 0 };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent, isMinedQuestion }) {
    let stepsDelta = 1;
    let pointsDelta = 1;

    if (isMinedQuestion) {
      stepsDelta = isCorrect ? 2 : -3;
      pointsDelta = stepsDelta;
      if (this.raceData) this.raceData.soloMinedActive = false;
    } else {
      stepsDelta = isCorrect ? 1 : -1;
      pointsDelta = isCorrect ? 1 : -1;
    }

    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember) {
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
  }
}