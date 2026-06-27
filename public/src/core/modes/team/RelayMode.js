// src/core/modes/team/RelayMode.js
import { BaseMode } from '../BaseMode.js';

export class RelayMode extends BaseMode {
  onRaceStart() {
    // إعدادات خاصة بسباق التتابع
    return {};
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent }) {
    // في التتابع، كل عضو يجيب بمفرده
    const stepsDelta = isCorrect ? 1 : -1;
    const pointsDelta = isCorrect ? 1 : -1;
    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTurnStart(currentEntity, currentMember) {
    // يمكن إضافة منطق خاص ببدء دور العضو في الفريق
  }

  onTimeOut(currentEntity, currentMember) {
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
  }
}