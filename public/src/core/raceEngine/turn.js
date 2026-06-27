// src/core/raceEngine/turn.js
// دوال إدارة الأدوار في السباق: startTurn و nextPlayer
// [FIX] إزالة الاعتماد على window.raceData واستخدام RaceSessionManager
// [FIX] تجنب خطأ "turn-overlay not found" بالتحقق من وجود العنصر
// [FIX] تصفية اللاعبين النشطين (غير الم eliminated) في nextPlayer
// [FIX] استدعاء onTurnStart للوضع الحالي
// [FIX] إلغاء أي timeout سابق قبل تعيين timeout جديد
// [FIX] تحسين إدارة الأقفال لمنع التكرار
// ✅ [المرحلة الرابعة] مزامنة الموقع والنقاط مع Firestore عبر updateRacePosition و updateRaceScore

import { RaceSessionManager } from '../raceSession.js';
import { RaceEvents } from '../raceEvents.js';
import { updateSingleLane } from '../raceUI/tracks.js';
import { showQuestion } from '../raceUI/questionDisplay.js';
import { DEFAULT_IMG } from '../../constants.js';

// دالة مساعدة داخلية لتقليل العدادات المؤقتة للاعب
function decrementPlayerTempCounters(sessionId, player) {
    if (!player) return;
    const session = RaceSessionManager.getSession(sessionId);
    if (!session) return;
    const raceData = session.raceData;
    
    if (player._skipTurns > 0) player._skipTurns--;
    if (player._freezeTurns > 0) player._freezeTurns--;
    if (player._poisonRemaining > 0) player._poisonRemaining--;
    if (player._shieldRemaining > 0) player._shieldRemaining--;
    if (player._doubleStepsRemaining > 0) player._doubleStepsRemaining--;
    if (player._silenceRemaining > 0) player._silenceRemaining--;
    if (player._forcedWrong > 0) player._forcedWrong--;
    if (player._blurScreen > 0) player._blurScreen--;
    
    if (player._doubleCardChance) player._doubleCardChance = false;
    if (player._revealAnswer) player._revealAnswer = false;
    if (player._secondChance) player._secondChance = false;
    if (player._doublePointsNext) player._doublePointsNext = false;
    if (player._forcedWrongNext) player._forcedWrongNext = false;
    if (player._currentAutoWrong) player._currentAutoWrong = false;
    if (player._zeroStepNext) player._zeroStepNext = false;
    if (player._blurOptions) player._blurOptions = false;
    if (player._invertAnswer) player._invertAnswer = false;
    if (player._glitchUI) player._glitchUI = false;
    if (player._hideOptions) player._hideOptions = false;
    if (player._shuffleOptions) player._shuffleOptions = false;
    if (player._skipCurrentTurn) player._skipCurrentTurn = false;
    
    if (player._maxStep) delete player._maxStep;
    if (player._customTimeLimit) delete player._customTimeLimit;
    if (player._timeReduction) delete player._timeReduction;
    if (player._freezeTimer) delete player._freezeTimer;
    if (player._nextStepMultiplier) delete player._nextStepMultiplier;
    if (player._bankedPoints) delete player._bankedPoints;
    if (player._delayedLoss) delete player._delayedLoss;
    if (player._reclaimCard) delete player._reclaimCard;
    
    RaceSessionManager.updateSession(sessionId, { raceData });
}

// ===================== بدء الدور =====================
export function startTurn(sessionId) {
    let session = RaceSessionManager.getSession(sessionId);
    if (!session) {
        console.warn('startTurn: no session, creating new one');
        sessionId = RaceSessionManager.create();
        session = RaceSessionManager.getSession(sessionId);
        RaceSessionManager.setActive(sessionId);
    }
    let raceData = session.raceData;
    
    if (raceData._gameEnded) {
        console.log('startTurn: اللعبة انتهت، تجاهل');
        return;
    }
    
    if (!RaceSessionManager.acquireLock(sessionId)) {
        setTimeout(() => startTurn(sessionId), 100);
        return;
    }
    
    try {
        const currentEntityId = raceData.activeEntityId;
        if (currentEntityId) {
            updateSingleLane(sessionId, String(currentEntityId));
        }
        
        let ov = document.getElementById('turn-overlay');
        if (!ov) {
            console.warn('startTurn: turn-overlay not found, skipping overlay and proceeding to question');
            RaceSessionManager.releaseLock(sessionId);
            showQuestion(sessionId);
            return;
        }
        
        let entities = raceData.isTeam ? raceData.teams : raceData.players;
        let currentEntity = entities.find(e => String(e.id) === String(raceData.activeEntityId) || `team_${e.id}` === String(raceData.activeEntityId));
        if (!currentEntity) {
            RaceSessionManager.releaseLock(sessionId);
            return;
        }

        let currentPlayerForEffects = null;
        if (raceData.isTeam) {
            if (raceData.gameMode === 'team_relay') {
                currentPlayerForEffects = currentEntity.members[currentEntity.currentMemberIndex];
            } else if (raceData.allPlayers && raceData.allPlayers.length > 0) {
                currentPlayerForEffects = raceData.allPlayers[raceData.activePlayerIndex];
            } else {
                currentPlayerForEffects = currentEntity;
            }
        } else {
            currentPlayerForEffects = currentEntity;
        }
        decrementPlayerTempCounters(sessionId, currentPlayerForEffects);

        if (raceData.currentMode) {
            raceData.currentMode.onTurnStart(currentEntity, currentPlayerForEffects);
        }

        if (!raceData.isTeam) {
            const player = currentEntity;
            let shouldSkip = false;
            let skipReason = '';

            if (player._skipTurns > 0) {
                player._skipTurns--;
                skipReason = `⏸️ ${player.name} يتخطى دوره (متبقي ${player._skipTurns})`;
                shouldSkip = true;
            } else if (player._freezeTurns > 0) {
                player._freezeTurns--;
                skipReason = `❄️ ${player.name} مجمد (متبقي ${player._freezeTurns})`;
                shouldSkip = true;
            } else if (player._skipCurrentTurn) {
                player._skipCurrentTurn = false;
                skipReason = `😵 ${player.name} يخسر دوره الحالي!`;
                shouldSkip = true;
            }

            if (shouldSkip) {
                RaceEvents.notify(skipReason, 'info', 1500);
                RaceSessionManager.releaseLock(sessionId);
                nextPlayer(sessionId);
                return;
            }
        }

        let activePlayerForDisplay = null;
        if (raceData.isTeam) {
            if (raceData.gameMode === 'team_relay') {
                activePlayerForDisplay = currentEntity.members[currentEntity.currentMemberIndex];
            } else if (raceData.allPlayers && raceData.allPlayers.length > 0 && raceData.activePlayerIndex !== undefined) {
                activePlayerForDisplay = raceData.allPlayers[raceData.activePlayerIndex];
            } else {
                activePlayerForDisplay = currentEntity.members[0];
            }
        } else {
            activePlayerForDisplay = currentEntity;
        }

        let displayImg = DEFAULT_IMG;
        let playerName = '';
        let teamName = '';
        if (raceData.isTeam) {
            if (raceData.gameMode === 'team_relay') {
                const currentMember = currentEntity.members[currentEntity.currentMemberIndex];
                displayImg = currentMember?.img || DEFAULT_IMG;
                playerName = currentMember?.name || '';
                teamName = currentEntity.name;
            } else {
                if (raceData.allPlayers && raceData.allPlayers.length > 0 && raceData.activePlayerIndex !== undefined) {
                    const currentPlayer = raceData.allPlayers[raceData.activePlayerIndex];
                    if (currentPlayer) {
                        displayImg = currentPlayer.img || DEFAULT_IMG;
                        playerName = currentPlayer.name;
                        const team = raceData.teams.find(t => t.id === currentPlayer.teamId);
                        teamName = team ? team.name : '';
                    } else {
                        displayImg = currentEntity.members[0]?.img || DEFAULT_IMG;
                        playerName = currentEntity.members[0]?.name || '';
                        teamName = currentEntity.name;
                    }
                } else {
                    displayImg = currentEntity.members[0]?.img || DEFAULT_IMG;
                    playerName = currentEntity.members[0]?.name || '';
                    teamName = currentEntity.name;
                }
            }
        } else {
            displayImg = currentEntity.img;
            playerName = currentEntity.name;
            teamName = '';
        }
        const imgEl = document.getElementById('overlay-img');
        if (imgEl) imgEl.src = displayImg;
        const playerNameEl = document.getElementById('overlay-player-name');
        if (playerNameEl) playerNameEl.innerText = playerName;
        const teamNameEl = document.getElementById('overlay-team-name');
        if (teamNameEl) {
            if (teamName) {
                teamNameEl.innerText = `فريق ${teamName}`;
                teamNameEl.style.display = 'block';
            } else {
                teamNameEl.style.display = 'none';
            }
        }
        ov.classList.remove('hidden');
        ov.classList.add('flex');
        setTimeout(() => {
            ov.classList.add('hidden');
            ov.classList.remove('flex');
            showQuestion(sessionId);
        }, 3000);
    } finally {
        RaceSessionManager.releaseLock(sessionId);
    }
}

// ===================== الانتقال إلى اللاعب التالي =====================
export function nextPlayer(sessionId) {
    let session = RaceSessionManager.getSession(sessionId);
    if (!session) return;
    let raceData = session.raceData;
    
    if (raceData._gameEnded) {
        console.log('nextPlayer: اللعبة انتهت، تجاهل');
        if (window._pendingNextPlayerTimeout) {
            clearTimeout(window._pendingNextPlayerTimeout);
            window._pendingNextPlayerTimeout = null;
        }
        return;
    }
    
    let entities = raceData.isTeam ? raceData.teams : raceData.players;
    
    if (!raceData.isTeam && raceData.gameMode === 'solo_survival') {
        entities = entities.filter(p => (raceData.survivalLives[p.id] || 0) > 0);
        if (entities.length !== raceData.players.length) {
            raceData.players = entities;
        }
    }
    
    if (entities.length === 0) {
        if (typeof window.exitRaceImmediate === 'function') window.exitRaceImmediate(sessionId);
        return;
    }
    
    let oldActiveId = raceData.activeEntityId;
    
    // المنطق الأصلي للانتقال إلى اللاعب التالي
    if (raceData.gameMode === 'team_relay') {
        let currentTeam = entities.find(e => `team_${e.id}` === raceData.activeEntityId || String(e.id) === String(raceData.activeEntityId));
        if (currentTeam && currentTeam.members.length > 0) {
            currentTeam.currentMemberIndex = ((currentTeam.currentMemberIndex || 0) + 1) % currentTeam.members.length;
        }
        let currentIndex = entities.findIndex(e => `team_${e.id}` === raceData.activeEntityId || String(e.id) === String(raceData.activeEntityId));
        let nextIndex = (currentIndex + 1) % entities.length;
        raceData.activeEntityId = `team_${entities[nextIndex].id}`;
        raceData.turn = nextIndex;
    } else {
        if (raceData.isTeam && raceData.allPlayers && raceData.allPlayers.length) {
            raceData.activePlayerIndex = (raceData.activePlayerIndex + 1) % raceData.allPlayers.length;
            const nextPlayerObj = raceData.allPlayers[raceData.activePlayerIndex];
            raceData.activeEntityId = `team_${nextPlayerObj.teamId}`;
        } else if (!raceData.isTeam) {
            let currentIndex = raceData.players.findIndex(p => p.id === raceData.activeEntityId);
            let nextIndex = (currentIndex + 1) % raceData.players.length;
            raceData.activeEntityId = raceData.players[nextIndex].id;
        }
    }
    
    RaceEvents.clearIntervals();
    if (oldActiveId) updateSingleLane(sessionId, String(oldActiveId));
    if (raceData.activeEntityId) updateSingleLane(sessionId, String(raceData.activeEntityId));
    
    // ✅ مزامنة الموقع والنقاط بعد تغيير الدور (للتأكد من صحة البيانات في Firestore)
    (async () => {
        try {
            if (!raceData.isTeam) {
                for (const player of raceData.players) {
                    await updateRacePosition(sessionId, player.id, player.pos, false);
                    await updateRaceScore(sessionId, player.id, player.score || 0, false);
                }
            } else {
                for (const team of raceData.teams) {
                    await updateRacePosition(sessionId, team.id, team.pos, true);
                    await updateRaceScore(sessionId, team.id, team.score || 0, true);
                }
            }
        } catch (err) {
            console.warn('[turn] فشلت مزامنة الموقع/النقاط مع Firestore:', err);
        }
    })();
    
    if (window._pendingNextPlayerTimeout) clearTimeout(window._pendingNextPlayerTimeout);
    
    window._pendingNextPlayerTimeout = setTimeout(() => {
        const currentSession = RaceSessionManager.getSession(sessionId);
        if (currentSession && !currentSession.raceData._gameEnded) {
            startTurn(sessionId);
        } else {
            console.log('nextPlayer: timeout cancelled because game ended');
        }
        window._pendingNextPlayerTimeout = null;
    }, 2000);
}