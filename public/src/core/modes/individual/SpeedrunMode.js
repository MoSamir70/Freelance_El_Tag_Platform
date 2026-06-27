// src/core/modes/individual/SpeedrunMode.js
import { BaseMode } from '../BaseMode.js';

export class SpeedrunMode extends BaseMode {
  onRaceStart() {
    return { speedrunTimePenalty: 3 };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent }) {
    let stepsDelta = isCorrect ? 1 : -1;
    let pointsDelta = isCorrect ? 1 : -1;

    if (!isCorrect && currentMember) {
      // Mark that time should be reduced (handled in timer or next turn)
      currentMember._needsTimeReduction = true;
    }

    if (currentMember && currentMember._doublePointsNext && isCorrect) {
      pointsDelta *= 2;
      delete currentMember._doublePointsNext;
    }

    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember) {
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
    if (currentMember) {
      currentMember._needsTimeReduction = true;
    }
  }
}