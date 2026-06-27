// src/core/modes/individual/ClassicMode.js
import { BaseMode } from '../BaseMode.js';

export class ClassicMode extends BaseMode {
  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent }) {
    const stepsDelta = isCorrect ? 1 : -1;
    const pointsDelta = isCorrect ? 1 : -1;
    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember) {
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
  }
}