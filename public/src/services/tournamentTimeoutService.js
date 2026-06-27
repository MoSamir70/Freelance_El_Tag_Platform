// src/services/tournamentTimeoutService.js
// خدمة إدارة المهلة الزمنية للبطولات وفوز الانسحاب (Forfeit)
// يتم استدعاؤها عند بدء مباراة وعند فحص المباريات المعلقة.

import { db, doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from '../firebase/init.js';
import { addAuditLog } from './auditLog.js';

const DEFAULT_MATCH_TIMEOUT_MINUTES = 5;
const CHECK_INTERVAL_MS = 60 * 1000;

export async function startMatchTimeout(tournamentId, matchId, timeoutMinutes = DEFAULT_MATCH_TIMEOUT_MINUTES) {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) return;

    const tournament = tournamentSnap.data();
    const match = tournament.matches?.find(m => m.id === matchId);
    if (!match || match.status !== 'pending') return;

    const expiryTime = Date.now() + (timeoutMinutes * 60 * 1000);
    const timeoutData = {
        tournamentId,
        matchId,
        expiryTime,
        playerA: match.playerA,
        playerB: match.playerB,
        resolved: false
    };

    const timeoutRef = doc(db, 'tournamentTimeouts', `${tournamentId}_${matchId}`);
    await updateDoc(timeoutRef, timeoutData, { merge: true });

    console.log(`[Timeout] بدء مهلة للمباراة ${matchId} في البطولة ${tournamentId}، تنتهي في ${new Date(expiryTime).toLocaleString()}`);
}

export async function checkExpiredTimeouts() {
    const now = Date.now();
    const timeoutsRef = collection(db, 'tournamentTimeouts');
    const q = query(timeoutsRef, where('resolved', '==', false));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let updatesCount = 0;

    for (const docSnap of snapshot.docs) {
        const timeout = docSnap.data();
        if (timeout.expiryTime <= now) {
            const result = await applyForfeit(timeout.tournamentId, timeout.matchId, timeout.playerA, timeout.playerB);
            if (result.success) {
                batch.update(docSnap.ref, { resolved: true, resolvedAt: serverTimestamp() });
                updatesCount++;
            }
        }
    }

    if (updatesCount > 0) {
        await batch.commit();
        console.log(`[Timeout] تم تطبيق فوز الانسحاب على ${updatesCount} مباراة`);
    }
}

async function applyForfeit(tournamentId, matchId, playerAId, playerBId) {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) return { success: false, winnerId: null };

    const tournament = tournamentSnap.data();
    const match = tournament.matches?.find(m => m.id === matchId);
    if (!match || match.status !== 'pending') return { success: false, winnerId: null };

    const playerA = tournament.players.find(p => p.id === playerAId);
    const playerB = tournament.players.find(p => p.id === playerBId);

    const { checkPlayerLastSeen } = await import('./presenceCheck.js'); // سننشئها لاحقاً (وظيفة افتراضية)
    const isPlayerAActive = playerA ? await checkPlayerLastSeen(playerA.id, 5 * 60 * 1000) : false;
    const isPlayerBActive = playerB ? await checkPlayerLastSeen(playerB.id, 5 * 60 * 1000) : false;

    let winnerId = null;
    let winnerName = null;
    let reason = '';

    if (isPlayerAActive && !isPlayerBActive) {
        winnerId = playerA.id;
        winnerName = playerA.name;
        reason = `فوز بالانسحاب (اللاعب ${playerB?.name} غائب)`;
    } else if (!isPlayerAActive && isPlayerBActive) {
        winnerId = playerB.id;
        winnerName = playerB.name;
        reason = `فوز بالانسحاب (اللاعب ${playerA?.name} غائب)`;
    } else if (!isPlayerAActive && !isPlayerBActive) {
        winnerId = null;
        winnerName = null;
        reason = `استبعاد الطرفين لغيابهما`;
    } else {
        return { success: false, winnerId: null };
    }

    const updatedMatches = tournament.matches.map(m => {
        if (m.id === matchId) {
            return { ...m, winner: winnerId, status: 'finished', forfeitReason: reason, finishedAt: serverTimestamp() };
        }
        return m;
    });

    await updateDoc(tournamentRef, { matches: updatedMatches });
    await addAuditLog('فوز بالانسحاب (تلقائي)', `البطولة: ${tournament.name} (${tournamentId})، المباراة: ${matchId}، السبب: ${reason}`);

    if (winnerId) {
        await advanceWinnerInBracket(tournamentId, matchId, winnerId);
    }

    return { success: true, winnerId, winnerName, reason };
}

async function advanceWinnerInBracket(tournamentId, matchId, winnerId) {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) return;

    const tournament = tournamentSnap.data();
    if (tournament.type !== 'knockout') return;

    const currentMatch = tournament.matches.find(m => m.id === matchId);
    if (!currentMatch) return;

    const nextRound = currentMatch.round + 1;
    let nextMatch = tournament.matches.find(m =>
        m.round === nextRound && (m.playerA === null || m.playerB === null) && m.status === 'pending'
    );

    if (!nextMatch && tournament.matches.some(m => m.round === nextRound)) {
        const newMatchId = `m_${Date.now()}_${nextRound}`;
        const newMatch = {
            id: newMatchId,
            round: nextRound,
            playerA: winnerId,
            playerB: null,
            winner: null,
            status: 'pending',
            sessionId: null
        };
        const updatedMatches = [...tournament.matches, newMatch];
        await updateDoc(tournamentRef, { matches: updatedMatches });
    } else if (nextMatch) {
        if (!nextMatch.playerA) nextMatch.playerA = winnerId;
        else if (!nextMatch.playerB) nextMatch.playerB = winnerId;
        const updatedMatches = tournament.matches.map(m => m.id === nextMatch.id ? nextMatch : m);
        await updateDoc(tournamentRef, { matches: updatedMatches });
    }
}

let timeoutInterval = null;
export function startTimeoutService() {
    if (timeoutInterval) clearInterval(timeoutInterval);
    timeoutInterval = setInterval(() => {
        checkExpiredTimeouts().catch(err => console.error('[TimeoutService] Error:', err));
    }, CHECK_INTERVAL_MS);
    console.log('[TimeoutService] بدأت خدمة مراقبة مهلة البطولات');
}

export function stopTimeoutService() {
    if (timeoutInterval) {
        clearInterval(timeoutInterval);
        timeoutInterval = null;
    }
}