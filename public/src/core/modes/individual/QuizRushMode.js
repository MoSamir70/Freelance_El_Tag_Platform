// src/core/modes/individual/QuizRushMode.js
import { BaseMode } from '../BaseMode.js';

export class QuizRushMode extends BaseMode {
  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent }) {
    let stepsDelta = isCorrect ? 1 : 0;
    let pointsDelta = isCorrect ? 1 : -3;

    if (!isCorrect) {
      // Reset position to 0 and lose combo
      currentEntity.pos = 0;
      if (currentEntity) currentEntity.combo = 0;
      return { stepsDelta: 0, pointsDelta, shouldSkipNextPlayer: true };
    }

    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember) {
    // Treat timeout as wrong answer
    currentEntity.pos = 0;
    if (currentEntity) currentEntity.combo = 0;
  }
}