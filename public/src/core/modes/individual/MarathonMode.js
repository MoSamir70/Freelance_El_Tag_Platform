// src/core/modes/individual/MarathonMode.js
import { BaseMode } from '../BaseMode.js';

export class MarathonMode extends BaseMode {
  onRaceStart() {
    return { allMarathonPlayers: [] };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent }) {
    // في الماراثون، لا يتغير الموقع (لا يوجد مضمار)
    // النقاط تُحتسب بناءً على الإجابات الصحيحة فقط
    let pointsDelta = isCorrect ? 1 : 0;
    
    if (!this.raceData.sessionStats) this.raceData.sessionStats = {};
    if (!this.raceData.sessionStats[currentMember.id]) {
      this.raceData.sessionStats[currentMember.id] = { correct: 0, wrong: 0, scoreGained: 0 };
    }
    
    if (isCorrect) {
      this.raceData.sessionStats[currentMember.id].correct++;
      this.raceData.sessionStats[currentMember.id].scoreGained += pointsDelta;
    } else {
      this.raceData.sessionStats[currentMember.id].wrong++;
    }

    // زيادة عداد الأسئلة التي أجاب عليها هذا اللاعب (مرة واحدة فقط لكل إجابة)
    currentEntity.marathonQuestionsAnswered = (currentEntity.marathonQuestionsAnswered || 0) + 1;

    // نعيد null للسماح للكود القديم بالتعامل مع منطق الماراثون الخاص (إدارة الأدوار)
    return null;
  }

  checkWin(entities) {
    // الفائز في الماراثون يُحدد بعد اكتمال جميع الأسئلة، وليس بالوصول إلى هدف
    return null;
  }

  onRaceEnd() {
    // منطق النهاية موجود في finishMarathon (legacy)
  }

  // ✅ إصلاح الماراثون: منع أي تأثير عند انتهاء الوقت
  onTimeOut(currentEntity, currentMember) {
    // في الماراثون، لا نقوم بتغيير الموقع (لا يوجد مضمار)
    // ولا ننقص أي خطوات. معالجة انتهاء الوقت تتم في timer.js
    return;
  }
}