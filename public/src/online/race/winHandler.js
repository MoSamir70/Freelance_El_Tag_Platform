// src/online/race/winHandler.js
// إنهاء السباق، حفظ التاريخ، تحديث النقاط، حذف المستندات
// الإصدار النهائي مع ضمانات:
// - كشف الفائز وتحديث قاعدة البيانات
// - حفظ سجل المباراة في gameHistory
// - منح نقاط إضافية للفائز والمراكز الأولى (موحدة مع win.js)
// - تنظيف مستندات activeRaces و activeRooms
// - إظهار إشعار بالفوز لجميع المشاركين

import { updateDocumentWithRetry, deleteDocumentWithRetry, getDocumentOnce } from '../core/firestoreSync.js';
import { addGameHistory, updateStudentProgress } from '../../services/dataService.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { RACE_STATUS, ROOM_STATUS } from '../constants/raceConfig.js';
import { getFinalRanking } from './answerHandler.js';

// استيراد دالة المكافآت الموحدة من win.js (مع fallback)
let awardRaceRewards;
try {
    const winModule = await import('../../core/raceEngine/win.js');
    awardRaceRewards = winModule.awardRaceRewards;
} catch (err) {
    console.warn('[WinHandler] Could not import awardRaceRewards, using fallback');
    // Fallback بسيط: منح مكافآت ثابتة (50،30،15،5)
    awardRaceRewards = async (players, rankings, isTraining) => {
        if (isTraining) return players;
        const rewards = [50, 30, 15];
        for (let i = 0; i < rankings.length; i++) {
            const player = rankings[i];
            const bonus = i < 3 ? rewards[i] : 5;
            player.finalPoints = (player.scoreGained || 0) + bonus;
            player.bonus = bonus;
            await updateStudentProgress(player.id, bonus, true, i === 0);
        }
        return rankings;
    };
}

/**
 * إنهاء السباق وإعلان الفائز
 * @param {string} sessionId 
 * @param {object} winner - { id, name, score, pos }
 * @returns {Promise<boolean>}
 */
export async function checkAndHandleWin(sessionId, winner) {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race) {
    console.error('[WinHandler] Race not found:', sessionId);
    return false;
  }
  
  // منع المعالجة المكررة
  if (race.status === RACE_STATUS.FINISHED) {
    console.log('[WinHandler] Race already finished');
    return false;
  }
  
  console.log(`[WinHandler] Winner detected: ${winner.name} (${winner.id})`);
  
  // تحديث حالة السباق إلى FINISHED
  await updateDocumentWithRetry(`activeRaces/${sessionId}`, {
    status: RACE_STATUS.FINISHED,
    finishedAt: new Date(),
    winnerId: winner.id,
    winnerName: winner.name
  });
  
  // حساب الترتيب النهائي لجميع اللاعبين باستخدام getFinalRanking
  const finalRanking = getFinalRanking(race.players);
  
  // تحويل المصفوفة إلى الشكل المتوقع في awardRaceRewards
  const rankingsWithStats = finalRanking.map((player, idx) => ({
    ...player,
    rank: idx + 1,
    scoreGained: player.score || 0,  // النقاط التي جمعها أثناء السباق
  }));
  
  const isTraining = race.isTrainingMode === true;
  
  // منح المكافآت باستخدام الدالة الموحدة
  const updatedRankings = await awardRaceRewards(rankingsWithStats, finalRanking, isTraining);
  
  // حفظ سجل المباراة في gameHistory
  const historyRecord = {
    grade: race.grade,
    gameMode: race.gameMode,
    gameSystem: race.isTeam ? 'teams' : 'individual',
    participants: race.players.map(p => ({ id: p.id, name: p.name, score: p.score, pos: p.pos })),
    winnerId: winner.id,
    winnerName: winner.name,
    finalRanking: updatedRankings.map((p, idx) => ({ ...p, rank: idx + 1 })),
    timestamp: new Date(),
    roomId: race.roomId,
    sessionId: sessionId,
    totalQuestions: race.raceQuestions?.length || 0
  };
  
  try {
    await addGameHistory(historyRecord);
    console.log('[WinHandler] Game history saved');
  } catch (err) {
    console.error('[WinHandler] Failed to save game history:', err);
  }
  
  // تنظيف المستندات: حذف السباق النشط وتحديث حالة الغرفة
  try {
    await deleteDocumentWithRetry(`activeRaces/${sessionId}`);
    console.log('[WinHandler] Active race document deleted');
  } catch (err) {
    console.error('[WinHandler] Failed to delete race document:', err);
  }
  
  // تحديث حالة الغرفة إلى FINISHED
  if (race.roomId) {
    try {
      await updateDocumentWithRetry(`activeRooms/${race.roomId}`, {
        status: ROOM_STATUS.FINISHED,
        finishedAt: new Date(),
        winnerId: winner.id,
        winnerName: winner.name
      });
      console.log('[WinHandler] Room status updated to FINISHED');
    } catch (err) {
      console.error('[WinHandler] Failed to update room status:', err);
    }
  }
  
  // إرسال إشعار إلى جميع اللاعبين (سيتم استقباله عبر الـ listeners)
  await notifyAllPlayers(race, winner);
  
  return true;
}

/**
 * إرسال إشعارات الفوز لجميع المشاركين
 * @param {object} race 
 * @param {object} winner 
 */
async function notifyAllPlayers(race, winner) {
  // إشعار عام للمضيف (سيظهر في واجهته)
  if (race.hostId) {
    showFloatingNotification(`🏆 فاز ${winner.name} بالسباق! 🏆`, 'success', 5000);
  }
  
  // يمكن إضافة إشعارات لكل لاعب عبر تحديث حقل خاص في Firestore
  // أو عبر نظام الإشعارات العام
  try {
    const { sendNotificationToUser } = await import('../../utils/helpers/notifications.js');
    for (const player of race.players) {
      if (player.id === winner.id) {
        await sendNotificationToUser(player.id, `🎉 تهانينا! لقد فزت بالسباق 🎉`, 'success');
      } else {
        const rank = race.players.findIndex(p => p.id === player.id) + 1;
        await sendNotificationToUser(player.id, `🏁 انتهى السباق. حصلت على المركز ${rank}`, 'info');
      }
    }
  } catch (err) {
    console.warn('[WinHandler] Could not send individual notifications:', err);
  }
}

/**
 * إنهاء السباق دون فائز (مثلاً لعدم وجود أسئلة أو خطأ)
 * @param {string} sessionId 
 * @param {string} reason 
 */
export async function forceFinishRace(sessionId, reason = 'Unknown error') {
  const race = await getDocumentOnce(`activeRaces/${sessionId}`);
  if (!race) return false;
  
  console.log(`[WinHandler] Force finishing race: ${reason}`);
  
  await updateDocumentWithRetry(`activeRaces/${sessionId}`, {
    status: RACE_STATUS.FINISHED,
    finishedAt: new Date(),
    winnerId: null,
    winnerName: null,
    forceFinishReason: reason
  });
  
  // تنظيف الغرفة
  if (race.roomId) {
    await updateDocumentWithRetry(`activeRooms/${race.roomId}`, {
      status: ROOM_STATUS.FINISHED,
      finishedAt: new Date()
    });
  }
  
  await deleteDocumentWithRetry(`activeRaces/${sessionId}`);
  
  showFloatingNotification(`⚠️ انتهى السباق: ${reason}`, 'warning');
  return true;
}