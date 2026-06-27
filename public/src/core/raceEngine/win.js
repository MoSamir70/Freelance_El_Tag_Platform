// src/core/raceEngine/win.js
// دالة الفوز (winGame) – تُستدعى عندما يصل لاعب أو فريق إلى خط النهاية
// [FIX] إضافة علامة _gameEnded ومنع أي استدعاءات لاحقة
// [FIX] إزالة الاعتماد على window.raceData واستخدام RaceSessionManager
// [FIX] تحسين تنظيف المؤقتات ومنع تسرب الذاكرة
// [FIX] إضافة تحديث البطولة تلقائياً عند انتهاء المباراة
// [FIX] إضافة تحديث Firestore (activeRaces) عند انتهاء السباق
// [FIX] دعم نظام الأوضاع الجديد – استدعاء onRaceEnd و checkWin للوضع الحالي
// [FIX] استخدام DEFAULT_IMG من الثوابت
// [NEW] دعم وضع التدريب – لا يتم حفظ التاريخ ولا تحديث الإحصائيات
// [NEW] دالة مركزية awardRaceRewards لتوحيد مكافآت الترتيب بين جميع أنواع السباقات

import { RaceSessionManager } from '../raceSession.js';
import { RaceEvents } from '../raceEvents.js';
import { clearAllRaceTimeouts } from '../raceUI.js';
import { raceSettings } from '../raceSettings.js';
import { DEFAULT_IMG } from '../../constants.js';
import { dbLight, save, updateUIAfterScoreChange } from '../../db/localstorage.js';
import { getStudentById, updateStudent, addGameHistory, updateStudentProgress } from '../../services/dataService.js';
import { escapeHtml, getRandomWinnerMessage, playWin as playWinSound } from '../../utils.js';
import { db, doc, updateDoc } from '../../firebase/init.js';

const Swal = window.Swal;

/**
 * دالة مركزية لمنح مكافآت الترتيب لجميع المشاركين في السباق
 * @param {Array} participants - قائمة المشاركين (كل عنصر: { entity, pos, isTeam })
 * @param {boolean} isTraining - هل هو سباق تدريبي؟ (إذا كان true لا يتم منح مكافآت)
 * @param {Object} raceData - بيانات السباق (للوصول إلى sessionStats إن وجد)
 * @returns {Promise<Object>} - تعهد بحفظ المكافآت
 */
export async function awardRaceRewards(participants, isTraining, raceData = {}) {
    if (isTraining) {
        console.log('[awardRaceRewards] سباق تدريبي، لن يتم منح مكافآت.');
        return;
    }
    
    const rewards = [50, 30, 15]; // للمراكز 1 و 2 و 3
    const updatePromises = [];
    
    for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        let reward = (i < 3) ? rewards[i] : 5;
        
        if (p.isTeam) {
            for (const member of p.entity.members) {
                const stats = raceData.sessionStats?.[member.id] || { scoreGained: 0 };
                const matchPoints = stats.scoreGained || 0;
                const totalPoints = matchPoints + reward;
                updatePromises.push(
                    updateStudent(member.id, { score: (member.score || 0) + reward })
                        .catch(err => console.warn(`[awardRaceRewards] فشل تحديث نقاط الطالب ${member.id}:`, err))
                );
                // يمكن تحديث إحصائيات إضافية هنا إذا لزم الأمر
            }
        } else {
            const stats = raceData.sessionStats?.[p.entity.id] || { scoreGained: 0 };
            const matchPoints = stats.scoreGained || 0;
            const totalPoints = matchPoints + reward;
            updatePromises.push(
                updateStudent(p.entity.id, { score: (p.entity.score || 0) + reward })
                    .catch(err => console.warn(`[awardRaceRewards] فشل تحديث نقاط الطالب ${p.entity.id}:`, err))
            );
        }
    }
    
    await Promise.all(updatePromises);
    save();
    
    // مزامنة مع Firebase إذا كان هناك معلم
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    if (teacherCode && window.syncAllToFirebase) {
        window.syncAllToFirebase(teacherCode).catch(err => console.warn('[awardRaceRewards] فشل مزامنة Firebase:', err));
    }
    
    console.log('[awardRaceRewards] تم منح مكافآت الترتيب بنجاح');
}

export async function winGame(sessionId, winnerEntity, winningMember) {
    clearAllRaceTimeouts(sessionId);
    RaceEvents.clearIntervals();
    
    const session = RaceSessionManager.getSession(sessionId);
    if (!session) {
        console.error('winGame: الجلسة غير موجودة');
        return;
    }
    
    const raceData = session.raceData;
    const isTraining = raceData.isTrainingMode === true;
    
    if (raceData.memoryTimeout) {
        clearTimeout(raceData.memoryTimeout);
        raceData.memoryTimeout = null;
    }
    
    let finalWinnerEntity = winnerEntity;
    let finalWinnerMember = winningMember;
    if (raceData.currentMode && typeof raceData.currentMode.checkWin === 'function') {
        const modeWinner = raceData.currentMode.checkWin(raceData.isTeam ? raceData.teams : raceData.players);
        if (modeWinner) {
            finalWinnerEntity = modeWinner;
            if (raceData.isTeam && modeWinner.members && modeWinner.members.length) {
                finalWinnerMember = modeWinner.members[0];
            } else {
                finalWinnerMember = modeWinner;
            }
        }
    }
    
    raceData._gameEnded = true;
    
    if (window._pendingNextPlayerTimeout) {
        clearTimeout(window._pendingNextPlayerTimeout);
        window._pendingNextPlayerTimeout = null;
    }
    
    RaceSessionManager.releaseLock(sessionId);
    
    const raceUI = document.getElementById('race-interface');
    if (raceUI) {
        raceUI.classList.add('hidden');
        raceUI.style.display = 'none';
    }
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.remove('hidden');
    document.body.classList.remove('racing');
    
    let winnerName = raceData.isTeam ? finalWinnerEntity.name : finalWinnerEntity.name;
    let winnerImg = raceData.isTeam ? (finalWinnerEntity.members[0]?.img || DEFAULT_IMG) : finalWinnerEntity.img;
    let winnerId = raceData.isTeam ? null : finalWinnerEntity.id;
    
    const participantsScores = [];
    if (raceData.isTeam) {
        for (const team of raceData.teams) {
            for (const member of team.members) {
                participantsScores.push({ id: member.id, name: member.name, score: member.score });
            }
        }
    } else {
        for (const player of raceData.players) {
            participantsScores.push({ id: player.id, name: player.name, score: player.score });
        }
    }
    
    // ✅ فقط إذا لم يكن وضع تدريب نقوم بحفظ التاريخ وتحديث الإحصائيات
    if (!isTraining) {
        await addGameHistory({
            timestamp: Date.now(),
            winnerId,
            winnerName,
            teamId: raceData.isTeam ? finalWinnerEntity.id : null,
            grade: raceSettings.grade,
            participants: participantsScores.map(p => p.id),
            mode: raceData.gameMode,
            scores: participantsScores
        });
        
        if (raceData.tournamentId && raceData.matchId && !raceData.isTeam) {
            try {
                const { getTournamentById, updateTournament } = await import('../../services/dataService.js');
                const tournament = await getTournamentById(raceData.tournamentId);
                if (tournament) {
                    const match = tournament.matches?.find(m => m.id === raceData.matchId);
                    if (match && match.status !== 'finished') {
                        match.winner = winnerId;
                        match.status = 'finished';
                        match.endTime = Date.now();
                        await updateTournament(tournament.id, { matches: tournament.matches });
                        console.log(`[Tournament] تم تحديث المباراة ${raceData.matchId} بالفائز ${winnerId}`);
                    }
                }
            } catch (err) {
                console.warn('[Tournament] فشل تحديث البطولة:', err);
            }
        }
        
        try {
            const raceRef = doc(db, 'activeRaces', sessionId);
            await updateDoc(raceRef, {
                status: 'finished',
                winnerId: winnerId,
                winnerName: winnerName,
                finishedAt: new Date().toISOString()
            });
            console.log(`[winGame] Updated activeRaces in Firestore: ${sessionId} finished`);
        } catch (err) {
            console.warn('[winGame] Could not update Firestore (race might not exist in activeRaces):', err);
        }
    }
    
    // ========== منح المكافآت باستخدام الدالة المركزية ==========
    let participants = [];
    if (raceData.isTeam) {
        raceData.teams.forEach(team => { participants.push({ entity: team, pos: team.pos, isTeam: true }); });
    } else {
        raceData.players.forEach(p => { participants.push({ entity: p, pos: p.pos, isTeam: false }); });
    }
    participants.sort((a, b) => b.pos - a.pos);
    
    await awardRaceRewards(participants, isTraining, raceData);
    
    try { 
        if (typeof canvasConfetti === 'function' && !window.isSoundMuted) { 
            canvasConfetti({ particleCount: 300, spread: 120, origin: { y: 0.6 } }); 
            setTimeout(() => canvasConfetti({ particleCount: 500, spread: 150, origin: { y: 0.5 } }), 200);
        }
        playWinSound();
    } catch (e) { console.warn('Confetti/Sound failed:', e); }
    
    // عرض نافذة الفوز (للمستخدم)
    if (raceData.isTeam && finalWinnerEntity.members.length > 1) {
        const teamIndex = participants.findIndex(p => p.isTeam && p.entity.id === finalWinnerEntity.id);
        const teamReward = (!isTraining && teamIndex !== -1) ? [50,30,15][teamIndex] || 5 : 5;
        let teamPopup = document.getElementById('team-win-popup');
        if (!teamPopup) {
            teamPopup = document.createElement('div');
            teamPopup.id = 'team-win-popup';
            teamPopup.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(20px); z-index:100001; display:none; align-items:center; justify-content:center; overflow-y:auto; padding:20px;';
            teamPopup.innerHTML = `<div class="team-winner-container" style="background:linear-gradient(145deg,#1e293b,#0f172a); border:4px solid #facc15; border-radius:60px; padding:2rem; max-width:800px; width:90%; text-align:center; box-shadow:0 0 80px rgba(250,204,21,0.7);"><div class="text-7xl mb-4">🏆👑🏆</div><h2 class="text-3xl font-bold text-yellow-400 mb-2">فوز فريق <span id="team-win-name"></span></h2><div id="team-winners-list" style="display:flex; flex-wrap:wrap; justify-content:center; gap:1.5rem; margin:1.5rem 0;"></div><button id="close-team-win-btn" style="background:#facc15; color:#000; border:none; border-radius:60px; padding:0.8rem 2rem; font-weight:bold; font-size:1.2rem; cursor:pointer; transition:0.2s; box-shadow:0 5px 0 #b45309;">🏅 العودة إلى المنصة</button></div>`;
            document.body.appendChild(teamPopup);
        }
        document.getElementById('team-win-name').innerText = escapeHtml(finalWinnerEntity.name);
        let membersHtml = '';
        finalWinnerEntity.members.forEach((member, index) => {
            const stats = raceData.sessionStats?.[member.id] || { correct: 0, wrong: 0, scoreGained: 0 };
            const matchPoints = stats.scoreGained;
            const totalPoints = (!isTraining) ? matchPoints + teamReward : matchPoints;
            membersHtml += `<div class="winner-member-card" style="background: rgba(0,0,0,0.55); border-radius: 36px; padding: 1.5rem 1rem; width: 200px; text-align: center; border: 1px solid rgba(250,204,21,0.4); box-shadow: 0 8px 20px rgba(0,0,0,0.3); transition: all 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1); animation: popIn 0.5s ease-out ${index * 0.1}s both; cursor: default;">
                <img src="${member.img || DEFAULT_IMG}" style="width: 110px; height: 110px; border-radius: 50%; border: 3px solid #facc15; object-fit: cover; display: block; margin: 0 auto 0.8rem; box-shadow: 0 0 15px rgba(250,204,21,0.5);">
                <div style="font-weight: bold; color: #facc15; font-size: 1.1rem; margin-bottom: 0.5rem;">${escapeHtml(member.name)}</div>
                <div style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.6;">
                    <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 0.2rem;">
                        <span style="color: #10b981;">✅ ${stats.correct}</span>
                        <span style="color: #ef4444;">❌ ${stats.wrong}</span>
                    </div>
                    <div>🎮 نقاط المباراة: <span style="color: #facc15;">+${matchPoints}</span></div>
                    ${!isTraining ? `<div>🏆 مكافأة المركز: <span style="color: #facc15;">+${teamReward}</span></div>` : ''}
                    <div style="font-weight: bold; color: #facc15; margin-top: 0.2rem; font-size: 1rem;">⭐ الإجمالي: ${totalPoints}</div>
                </div>
            </div>`;
        });
        document.getElementById('team-winners-list').innerHTML = membersHtml;
        if (isTraining) {
            const trainingNote = document.createElement('div');
            trainingNote.className = 'text-center text-yellow-400 mt-3';
            trainingNote.innerText = '🥋 هذا سباق تدريبي – النتائج غير محسوبة';
            document.querySelector('#team-win-popup .team-winner-container').appendChild(trainingNote);
        }
        teamPopup.style.display = 'flex';
        const closeBtn = document.getElementById('close-team-win-btn');
        if (closeBtn) {
            const newClose = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newClose, closeBtn);
            newClose.addEventListener('click', () => {
                teamPopup.style.display = 'none';
                window.showPage('home');
            });
        }
    } else {
        const winnerIndex = participants.findIndex(p => !p.isTeam && String(p.entity.id) === String(finalWinnerEntity.id));
        const winnerReward = (!isTraining && [50,30,15][winnerIndex] !== undefined) ? [50,30,15][winnerIndex] : 5;
        const matchPoints = raceData.sessionStats?.[finalWinnerEntity.id]?.scoreGained || 0;
        const totalPoints = (!isTraining) ? matchPoints + winnerReward : matchPoints;
        
        const rewardEl = document.getElementById('popup-winner-reward');
        if (rewardEl) {
            if (!isTraining) {
                rewardEl.innerText = `⭐ نقاط المباراة: ${matchPoints} + مكافأة: ${winnerReward} = ${totalPoints}`;
            } else {
                rewardEl.innerText = `🥋 تدريب: نقاط المباراة (غير محسوبة) = ${totalPoints}`;
            }
        }
        const popup = document.getElementById('custom-win-popup');
        const msg = getRandomWinnerMessage();
        const fallback = () => Swal.fire({ 
            title: `${isTraining ? '🥋 تدريب - ' : '🏆'} الفائز: ${winnerName}`, 
            html: `<img src="${winnerImg}" style="width:100px;height:100px;border-radius:50%;border:3px solid gold"><br>⭐ مجموع النقاط: ${totalPoints}${isTraining ? '<br><span class="text-yellow-400">🥋 هذا سباق تدريبي – النتائج غير محسوبة</span>' : ''}`, 
            icon: 'success', background: '#0f172a', color: '#fff', confirmButtonColor: '#facc15', confirmButtonText: '🏅 العودة', allowOutsideClick: false 
        }).then(() => window.showPage('home'));
        if (popup) {
            try {
                document.getElementById('popup-winner-img').src = winnerImg;
                document.getElementById('popup-winner-name').innerText = winnerName;
                document.getElementById('popup-winner-message').innerText = msg;
                if (isTraining) {
                    const msgDiv = document.getElementById('popup-winner-message');
                    if (msgDiv) msgDiv.innerHTML = '🥋 ' + msgDiv.innerText + ' (سباق تدريبي)';
                }
                popup.style.display = 'flex';
                const newBtn = document.getElementById('close-popup-btn').cloneNode(true);
                document.getElementById('close-popup-btn').parentNode.replaceChild(newBtn, document.getElementById('close-popup-btn'));
                newBtn.addEventListener('click', () => { popup.style.display = 'none'; window.showPage('home'); });
                setTimeout(() => { if (popup.style.display !== 'flex') fallback(); }, 100);
            } catch (e) { fallback(); }
        } else fallback();
    }
    
    if (raceData.currentMode && typeof raceData.currentMode.onRaceEnd === 'function') {
        raceData.currentMode.onRaceEnd();
    }
    
    if (RaceSessionManager.activeId === sessionId) RaceSessionManager.setActive(null);
    RaceSessionManager.destroy(sessionId);
    
    setTimeout(() => { updateUIAfterScoreChange(); }, 300);
}