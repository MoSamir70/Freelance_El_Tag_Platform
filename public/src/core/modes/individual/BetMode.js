// src/core/modes/individual/BetMode.js
import { BaseMode } from '../BaseMode.js';

export class BetMode extends BaseMode {
  onRaceStart() {
    return { forceBetActive: true };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent, betAmount }) {
    let stepsDelta = isCorrect ? 1 : -1;
    let pointsDelta = isCorrect ? 1 : -1;

    if (betAmount > 0) {
      const loseAmt = window.__currentLoseAmount || betAmount;
      if (isCorrect) {
        stepsDelta = betAmount;
        pointsDelta = betAmount;
      } else {
        stepsDelta = -loseAmt;
        pointsDelta = -loseAmt;
      }
      delete window.__currentLoseAmount;
      window.__currentBetAmount = null;
    }

    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember) {
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
  }
}