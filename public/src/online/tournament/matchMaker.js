// src/online/tournament/matchMaker.js
// توليد المباريات حسب نوع البطولة (إقصائي / دوري)

import { db, doc, updateDoc, writeBatch } from '../../firebase/init.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

/**
 * توليد مباريات بنظام الإقصائي (Knockout)
 * @param {Array} players - قائمة اللاعبين (كل لاعب {id, name, img})
 * @returns {Array} - قائمة المباريات
 */
export function generateKnockoutMatches(players) {
  // خلط عشوائي للاعبين
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const matches = [];
  let matchId = 1;
  let round = 1;

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      matches.push({
        id: `m${matchId++}`,
        round: round,
        playerA: shuffled[i].id,
        playerAName: shuffled[i].name,
        playerAImg: shuffled[i].img,
        playerB: shuffled[i+1].id,
        playerBName: shuffled[i+1].name,
        playerBImg: shuffled[i+1].img,
        winner: null,
        status: 'pending', // pending, playing, finished
        sessionId: null,
        scores: {}
      });
    } else {
      // لاعب واحد يتأهل تلقائياً (bye)
      matches.push({
        id: `m${matchId++}`,
        round: round,
        playerA: shuffled[i].id,
        playerAName: shuffled[i].name,
        playerAImg: shuffled[i].img,
        playerB: null,
        playerBName: null,
        playerBImg: null,
        winner: shuffled[i].id,
        status: 'finished',
        sessionId: null,
        scores: {},
        bye: true
      });
    }
  }
  return matches;
}

/**
 * توليد مباريات بنظام الدوري (League - كل مع كل)
 * @param {Array} players - قائمة اللاعبين
 * @returns {Array} - قائمة المباريات
 */
export function generateLeagueMatches(players) {
  const matches = [];
  let matchId = 1;
  const round = 1; // دور واحد فقط (يمكن توسيعه لذهاب وإياب)

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matches.push({
        id: `m${matchId++}`,
        round: round,
        playerA: players[i].id,
        playerAName: players[i].name,
        playerAImg: players[i].img,
        playerB: players[j].id,
        playerBName: players[j].name,
        playerBImg: players[j].img,
        winner: null,
        status: 'pending',
        sessionId: null,
        scores: {}
      });
    }
  }
  return matches;
}

/**
 * بدء البطولة (توليد المباريات وتحديث الحالة)
 * @param {string} tournamentId 
 * @param {Object} tournament - بيانات البطولة الحالية
 * @returns {Promise<boolean>}
 */
export async function startTournament(tournamentId, tournament) {
  if (tournament.players.length < 2) {
    showFloatingNotification('يجب وجود لاعبين على الأقل لبدء البطولة', 'error');
    return false;
  }

  let matches = [];
  if (tournament.type === 'knockout') {
    matches = generateKnockoutMatches(tournament.players);
  } else if (tournament.type === 'league') {
    matches = generateLeagueMatches(tournament.players);
  } else {
    return false;
  }

  const tournamentRef = doc(db, 'tournaments', tournamentId);
  await updateDoc(tournamentRef, {
    matches: matches,
    status: 'active',
    startedAt: new Date()
  });

  showFloatingNotification('تم بدء البطولة!', 'success');
  return true;
}