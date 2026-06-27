// src/core/modes/individual/SurpriseMode.js
import { BaseMode } from '../BaseMode.js';

export class SurpriseMode extends BaseMode {
  onRaceStart() {
    // تهيئة المتغيرات المطلوبة
    const consecutiveCorrect = {};
    const surpriseCardsUsed = {};
    const usedCardIds = {}; // لمنع تكرار نفس البطاقة لنفس اللاعب

    if (this.raceData && this.raceData.players) {
      for (const player of this.raceData.players) {
        consecutiveCorrect[player.id] = 0;
        surpriseCardsUsed[player.id] = 0;
        usedCardIds[player.id] = new Set();
      }
    }

    return {
      surpriseMode: true,
      consecutiveCorrect,
      surpriseCardsUsed,
      usedCardIds,               // جديد
      processingSurprise: false,
      savedTimeLeft: 0,
      currentSurpriseCard: null,
      pendingChoice: null        // لتخزين البطاقتين المعروضتين
    };
  }

  processAnswer({ isCorrect, currentEntity, currentMember, timeSpent }) {
    // الوضع لا يغير الخطوات أو النقاط بنفسه، يتم التعامل مع البطاقات في answer.js
    return null;
  }

  onTurnStart(currentEntity, currentMember) {
    // يمكن تطبيق تأثيرات مستمرة هنا إن وجدت
  }

  // ✅ تجاوز onTimeOut لمنع تحريك pos (لأن وضع المفاجآت لا يعتمد على الخطوات)
  onTimeOut(currentEntity, currentMember) {
    // في وضع المفاجآت، انتهاء الوقت لا يغير الموقع
    // يمكن إضافة عقوبة أخرى لاحقاً إذا أردت (مثلاً خسارة نقطة)
    if (currentMember) {
      // نرسل إشعار فقط
      RaceEvents.notify('⏰ انتهى الوقت! لن تخسر خطوات، لكن لا تتوانى في المرة القادمة.', 'info', 2000);
    }
  }

  onRaceEnd() {
    // تنظيف أي بيانات مؤقتة إذا لزم الأمر
    if (this.raceData) {
      this.raceData.processingSurprise = false;
      this.raceData.pendingChoice = null;
    }
  }
}