// src/core/modes/individual/MemoryMode.js
import { BaseMode } from '../BaseMode.js';

export class MemoryMode extends BaseMode {
  // Same as classic mode, but question hiding is handled in UI
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