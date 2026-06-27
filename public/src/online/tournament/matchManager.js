// src/online/tournament/matchManager.js
// إدارة مباريات البطولة مع التحقق من صلاحية المعلم (المضيف)

import { db, doc, getDoc, updateDoc, writeBatch } from '../../firebase/init.js';
import { startRaceFromRoom } from '../race/sessionManager.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';

/**
 * بدء مباراة محددة في البطولة
 * @param {string} tournamentId 
 * @param {string} matchId 
 * @returns {Promise<{success: boolean, sessionId?: string}>}
 */
export async function startMatch(tournamentId, matchId) {
  // ✅ التحقق من أن المستخدم الحالي هو معلم بصلاحية (غير مجاني أو مطور)
  const user = await getCurrentUserInfo();
  if (!user || !user.isTeacher) {
    showFloatingNotification('غير مصرح لك ببدء المباراة', 'error');
    return { success: false };
  }
  
  const teacherPlan = sessionStorage.getItem('teacher_plan') || 'free';
  if (teacherPlan === 'free') {
    showFloatingNotification('الباقة المجانية لا تسمح بإدارة البطولات', 'error');
    return { success: false };
  }
  // الفضي والذهبي والمطور مسموح لهم

  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const tournamentSnap = await getDoc(tournamentRef);
  if (!tournamentSnap.exists()) return { success: false };

  const tournament = tournamentSnap.data();
  
  // ✅ التأكد من أن المعلم هو منشئ البطولة
  if (tournament.teacherId !== user.id && teacherPlan !== 'developer') {
    showFloatingNotification('فقط منشئ البطولة يمكنه بدء المباريات', 'error');
    return { success: false };
  }

  const matchIndex = tournament.matches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return { success: false };
  const match = tournament.matches[matchIndex];

  if (match.status !== 'pending') return { success: false };

  // إنشاء غرفة سباق مؤقتة لهذه المباراة
  const players = [];
  if (match.playerA) players.push({ id: match.playerA, name: match.playerAName, img: match.playerAImg });
  if (match.playerB) players.push({ id: match.playerB, name: match.playerBName, img: match.playerBImg });

  if (players.length < 2) {
    showFloatingNotification('لا يمكن بدء المباراة، لاعب واحد فقط', 'error');
    return { success: false };
  }

  // إنشاء غرفة سباق
  const roomData = {
    name: `مباراة البطولة: ${tournament.name}`,
    hostId: players[0].id,
    players: players,
    grade: tournament.grade,
    subject: tournament.subject,
    gameMode: 'normal',
    gameSystem: 'individual',
    goal: tournament.questionCount,
    timePerQuestion: tournament.timePerQuestion,
    isTournamentMatch: true,
    tournamentId: tournamentId,
    matchId: matchId
  };

  const { createRaceForMatch } = await import('./createMatchRace.js');
  const raceResult = await createRaceForMatch(roomData);
  
  if (!raceResult.success) {
    showFloatingNotification('فشل بدء المباراة', 'error');
    return { success: false };
  }

  // تحديث المباراة بمعرف الجلسة
  const updatedMatches = [...tournament.matches];
  updatedMatches[matchIndex] = {
    ...match,
    status: 'playing',
    sessionId: raceResult.sessionId
  };
  await updateDoc(tournamentRef, { matches: updatedMatches });

  return { success: true, sessionId: raceResult.sessionId };
}

/**
 * تسجيل نتيجة مباراة (يُستدعى بعد انتهاء السباق)
 * @param {string} tournamentId 
 * @param {string} matchId 
 * @param {string} winnerId 
 */
export async function finishMatch(tournamentId, matchId, winnerId) {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const tournamentSnap = await getDoc(tournamentRef);
  if (!tournamentSnap.exists()) return;

  const tournament = tournamentSnap.data();
  const matchIndex = tournament.matches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return;

  const match = tournament.matches[matchIndex];
  if (match.status !== 'playing') return;

  const winnerPlayer = tournament.players.find(p => p.id === winnerId);
  const winnerName = winnerPlayer ? winnerPlayer.name : winnerId;

  const updatedMatches = [...tournament.matches];
  updatedMatches[matchIndex] = {
    ...match,
    winner: winnerId,
    winnerName: winnerName,
    status: 'finished',
    finishedAt: new Date()
  };

  // إذا كانت البطولة من نوع إقصائي، نقل الفائز للدور التالي
  if (tournament.type === 'knockout') {
    await advanceWinnerInKnockout(tournamentId, matchId, winnerId, updatedMatches);
  } else if (tournament.type === 'league') {
    await updateLeagueStandings(tournamentId, winnerId, match);
  }

  await updateDoc(tournamentRef, { matches: updatedMatches });

  // التحقق من انتهاء البطولة
  await checkTournamentCompletion(tournamentId);
}

/**
 * نقل الفائز للدور التالي في نظام الإقصائي
 */
async function advanceWinnerInKnockout(tournamentId, matchId, winnerId, updatedMatches) {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const currentMatch = updatedMatches.find(m => m.id === matchId);
  const nextRound = currentMatch.round + 1;

  let nextMatch = updatedMatches.find(m => m.round === nextRound && (m.playerA === null || m.playerB === null));
  
  if (!nextMatch && updatedMatches.some(m => m.round === nextRound)) {
    const newMatchId = `m${Date.now()}_${nextRound}`;
    const newMatch = {
      id: newMatchId,
      round: nextRound,
      playerA: winnerId,
      playerAName: currentMatch.winnerName || winnerId,
      playerAImg: currentMatch.playerAImg,
      playerB: null,
      playerBName: null,
      playerBImg: null,
      winner: null,
      status: 'pending',
      sessionId: null,
      scores: {}
    };
    updatedMatches.push(newMatch);
    await updateDoc(tournamentRef, { matches: updatedMatches });
  } else if (nextMatch) {
    if (!nextMatch.playerA) {
      nextMatch.playerA = winnerId;
      nextMatch.playerAName = currentMatch.winnerName || winnerId;
    } else if (!nextMatch.playerB) {
      nextMatch.playerB = winnerId;
      nextMatch.playerBName = currentMatch.winnerName || winnerId;
    }
    const matchIndex = updatedMatches.findIndex(m => m.id === nextMatch.id);
    updatedMatches[matchIndex] = nextMatch;
    await updateDoc(tournamentRef, { matches: updatedMatches });
  }
}

async function updateLeagueStandings(tournamentId, winnerId, match) {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const snap = await getDoc(tournamentRef);
  const tournament = snap.data();
  const players = tournament.players.map(p => {
    if (p.id === winnerId) {
      return { ...p, wins: (p.wins || 0) + 1, score: (p.score || 0) + 3 };
    } else if (p.id === match.playerA && p.id !== winnerId) {
      return { ...p, score: (p.score || 0) + 0 };
    } else if (p.id === match.playerB && p.id !== winnerId) {
      return { ...p, score: (p.score || 0) + 0 };
    }
    return p;
  });
  await updateDoc(tournamentRef, { players });
}

async function checkTournamentCompletion(tournamentId) {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const snap = await getDoc(tournamentRef);
  const tournament = snap.data();

  const allFinished = tournament.matches.every(m => m.status === 'finished');
  if (!allFinished) return;

  let winnerId = null;
  let winnerName = null;

  if (tournament.type === 'knockout') {
    const finalMatches = tournament.matches.filter(m => m.round === Math.max(...tournament.matches.map(m => m.round)));
    const finalMatch = finalMatches[finalMatches.length - 1];
    winnerId = finalMatch.winner;
    winnerName = finalMatch.winnerName;
  } else if (tournament.type === 'league') {
    const sorted = [...tournament.players].sort((a,b) => (b.score || 0) - (a.score || 0));
    winnerId = sorted[0]?.id;
    winnerName = sorted[0]?.name;
  }

  await updateDoc(tournamentRef, {
    status: 'finished',
    finishedAt: new Date(),
    winnerId,
    winnerName
  });

  showFloatingNotification(`🏆 انتهت البطولة! الفائز: ${winnerName} 🏆`, 'success');
}