// src/core/modes/individual/SurvivalMode.js
import { BaseMode } from '../BaseMode.js';

export class SurvivalMode extends BaseMode {
  onRaceStart() {
    // تهيئة القلوب لجميع اللاعبين (إذا لم تكن موجودة)
    const survivalLives = {};
    if (this.raceData && this.raceData.players) {
      for (const player of this.raceData.players) {
        survivalLives[player.id] = 3;
      }
    }
    return { survivalLives };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent }) {
    let stepsDelta = isCorrect ? 1 : 0;
    let pointsDelta = isCorrect ? 1 : -3;

    if (!isCorrect) {
      const lives = this.raceData.survivalLives[currentMember.id] ?? 3;
      const newLives = lives - 1;
      this.raceData.survivalLives[currentMember.id] = newLives;
      if (newLives <= 0) {
        // تم استبعاد اللاعب – سيتم التعامل معه في الكود القديم
        return { stepsDelta: 0, pointsDelta, shouldSkipNextPlayer: true, extraEffects: { eliminated: true } };
      }
    }

    return { stepsDelta, pointsDelta, shouldSkipNextPlayer: false };
  }

  onTimeOut(currentEntity, currentMember) {
    // معالجة انتهاء الوقت: خسارة قلب وتراجع خطوة (إذا كان هناك مضمار)
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
    if (currentMember) {
      const lives = this.raceData.survivalLives[currentMember.id] ?? 3;
      const newLives = lives - 1;
      this.raceData.survivalLives[currentMember.id] = newLives;
    }
  }
}