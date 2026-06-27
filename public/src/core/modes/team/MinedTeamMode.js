// src/core/modes/team/MinedTeamMode.js
import { BaseMode } from '../BaseMode.js';

export class MinedTeamMode extends BaseMode {
  onRaceStart() {
    return {
      minedQuestionsRemaining: 5,
      minedQuestionsTotal: 5,
      minedQuestionActive: false,
      minedQuestionCooldown: 0
    };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent, isMinedQuestion }) {
    let stepsDelta = isCorrect ? 1 : -1;
    let pointsDelta = isCorrect ? 1 : -1;

    if (isMinedQuestion) {
      stepsDelta = isCorrect ? 1 : -4;
      pointsDelta = stepsDelta;
      if (this.raceData) this.raceData.minedQuestionActive = false;
    }

    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember) {
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
  }
}