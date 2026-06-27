// ===================== src/core/raceUI/tracks.js =====================
// دوال رسم وتحديث مضامير السباق (اللاعبين والفرق)
// [FIX] تحسين الأداء: استخدام DocumentFragment لتقليل إعادة الرسم
// [FIX] تحديث جزئي للعناصر عند تغيير موقع لاعب واحد
// [FIX] إضافة معرف الجلسة (sessionId) في زر الانسحاب
// [NEW] إضافة أيقونة تدريب 🥋 عند تفعيل وضع التدريب
// ✅ [المرحلة الرابعة] إضافة مستمع حي (onSnapshot) لمزامنة المضمار مع Firestore

import { RaceSessionManager } from '../raceSession.js';
import { DEFAULT_IMG } from '../../constants.js';
import { escapeHtml } from '../../utils.js';
import { db, doc, onSnapshot } from '../../firebase/init.js';

let lastTrackVersion = new Map();
let activeListeners = new Map(); // sessionId -> unsubscribe function

/**
 * بدء مستمع حي لتحديثات السباق من Firestore
 * @param {string} sessionId - معرف جلسة السباق
 */
export function startRaceListener(sessionId) {
    // إلغاء أي مستمع سابق لنفس الجلسة
    if (activeListeners.has(sessionId)) {
        activeListeners.get(sessionId)();
        activeListeners.delete(sessionId);
    }

    const raceRef = doc(db, 'activeRaces', sessionId);
    const unsubscribe = onSnapshot(raceRef, (snap) => {
        if (!snap.exists()) {
            console.log(`[raceUI] السباق ${sessionId} لم يعد موجوداً`);
            return;
        }

        const firestoreData = snap.data();
        const session = RaceSessionManager.getSession(sessionId);
        if (!session) return;

        let raceData = session.raceData;
        let updated = false;

        // مزامنة اللاعبين (المواقع والنقاط) من Firestore إلى RaceSessionManager
        if (firestoreData.players && raceData.players) {
            for (const fbPlayer of firestoreData.players) {
                const localPlayer = raceData.players.find(p => String(p.id) === String(fbPlayer.id));
                if (localPlayer) {
                    if (localPlayer.pos !== fbPlayer.pos) {
                        localPlayer.pos = fbPlayer.pos;
                        updated = true;
                    }
                    if ((localPlayer.score || 0) !== (fbPlayer.score || 0)) {
                        localPlayer.score = fbPlayer.score;
                        updated = true;
                    }
                    // مزامنة أي حقول أخرى مهمة (مثل combo, survivalLives)
                    if (fbPlayer.combo !== undefined) localPlayer.combo = fbPlayer.combo;
                }
            }
        }

        // مزامنة الفرق (المواقع والنقاط)
        if (firestoreData.teams && raceData.teams) {
            for (const fbTeam of firestoreData.teams) {
                const localTeam = raceData.teams.find(t => String(t.id) === String(fbTeam.id));
                if (localTeam) {
                    if (localTeam.pos !== fbTeam.pos) {
                        localTeam.pos = fbTeam.pos;
                        updated = true;
                    }
                    if ((localTeam.score || 0) !== (fbTeam.score || 0)) {
                        localTeam.score = fbTeam.score;
                        updated = true;
                    }
                    // مزامنة currentMemberIndex في وضع التتابع
                    if (fbTeam.currentMemberIndex !== undefined) {
                        localTeam.currentMemberIndex = fbTeam.currentMemberIndex;
                        updated = true;
                    }
                }
            }
        }

        // مزامنة activeEntityId (الدور الحالي)
        if (firestoreData.activeEntityId && raceData.activeEntityId !== firestoreData.activeEntityId) {
            raceData.activeEntityId = firestoreData.activeEntityId;
            updated = true;
        }

        // مزامنة الوقت المتبقي إذا كان موجوداً
        if (firestoreData.currentTimeLeft !== undefined && raceData.timeLeft !== firestoreData.currentTimeLeft) {
            raceData.timeLeft = firestoreData.currentTimeLeft;
            updated = true;
            // تحديث واجهة المؤقت
            const timerText = document.getElementById('timer-text');
            if (timerText) timerText.innerText = Math.ceil(firestoreData.currentTimeLeft);
        }

        if (updated) {
            RaceSessionManager.updateSession(sessionId, { raceData });
            // إعادة رسم المضمار بالكامل أو تحديث الحارات المتغيرة
            renderTracks(sessionId);
            // تحديث الحارات النشطة (اللاعب صاحب الدور)
            if (raceData.activeEntityId) {
                updateSingleLane(sessionId, String(raceData.activeEntityId));
            }
        }
    }, (error) => {
        console.error(`[raceUI] خطأ في مستمع السباق ${sessionId}:`, error);
    });

    activeListeners.set(sessionId, unsubscribe);
}

/**
 * إيقاف المستمع الحي لسباق معين
 * @param {string} sessionId
 */
export function stopRaceListener(sessionId) {
    if (activeListeners.has(sessionId)) {
        activeListeners.get(sessionId)();
        activeListeners.delete(sessionId);
    }
}

export function updateSingleLane(sessionId, entityId) {
    const session = RaceSessionManager.getSession(sessionId);
    if (!session) return;
    const raceData = session.raceData;
    const isTraining = raceData.isTrainingMode === true;

    // البحث عن الكيان (لاعب أو فريق)
    const entity = raceData.isTeam
        ? raceData.teams.find(t => String(t.id) === String(entityId) || `team_${t.id}` === entityId)
        : raceData.players.find(p => String(p.id) === entityId);
    if (!entity) return;

    const laneDiv = document.getElementById(`lane-${entityId}`);
    if (!laneDiv) return;

    // حساب التقدم (نسبة مئوية ونص)
    let percent, progressText;
    if (raceData.gameMode === 'solo_marathon') {
        const answered = entity.marathonQuestionsAnswered || 0;
        const total = entity.marathonTotalQuestions || raceData.goal || 1;
        percent = Math.min(100, (answered / total) * 100);
        progressText = `${answered}/${total} سؤال`;
    } else {
        percent = Math.min(100, (entity.pos / raceData.goal) * 100);
        progressText = `${Math.floor(entity.pos)}/${raceData.goal} خطوة`;
    }

    // تحديث موقع الصورة المتحركة
    const movingAvatar = laneDiv.querySelector('.moving-avatar');
    if (movingAvatar) movingAvatar.style.left = `${percent}%`;

    // تحديث نص التقدم
    const progressDiv = laneDiv.querySelector('.text-sm.w-10.text-center');
    if (progressDiv) progressDiv.innerText = progressText;

    // ========== عرض القلوب في وضع البقاء للأقوى (solo_survival) ==========
    if (!raceData.isTeam && raceData.gameMode === 'solo_survival') {
        const teamNameSpan = laneDiv.querySelector('.team-name');
        // الحصول على عدد القلوب (افتراضي 3)
        let lives = 3;
        if (raceData.survivalLives) {
            const livesValue = raceData.survivalLives[String(entity.id)];
            if (livesValue !== undefined) lives = livesValue;
        }
        const heartsHtml = '❤️'.repeat(lives) + (lives === 0 ? '💀' : '');

        // البحث عن عنصر القلوب الموجود
        let heartsSpan = laneDiv.querySelector('.hearts');
        if (heartsSpan) {
            // تحديث النص
            heartsSpan.innerText = heartsHtml;
        } else if (teamNameSpan) {
            // إنشاء عنصر القلوب إذا لم يكن موجوداً
            heartsSpan = document.createElement('span');
            heartsSpan.className = 'hearts';
            heartsSpan.style.marginLeft = '8px';
            heartsSpan.style.fontSize = '1.2rem';
            heartsSpan.innerText = heartsHtml;
            teamNameSpan.appendChild(heartsSpan);
        }
    }
    // ========== نهاية عرض القلوب ==========

    // في وضع التتابع الجماعي، إبراز العضو النشط
    if (raceData.isTeam && raceData.gameMode === 'team_relay' && entity.currentMemberIndex !== undefined) {
        const avatarsDiv = laneDiv.querySelector('.team-avatars-container');
        if (avatarsDiv) {
            const imgs = avatarsDiv.querySelectorAll('img');
            imgs.forEach((img, idx) => {
                if (idx === entity.currentMemberIndex) img.classList.add('active-member');
                else img.classList.remove('active-member');
            });
        }
    }

    // إبراز الحارة إذا كان هذا الكيان هو صاحب الدور الحالي
    const isActive = raceData.isTeam
        ? (`team_${entity.id}` === String(raceData.activeEntityId) || String(entity.id) === String(raceData.activeEntityId))
        : (String(entity.id) === String(raceData.activeEntityId));

    if (laneDiv) {
        if (isActive) laneDiv.classList.add('active-turn');
        else laneDiv.classList.remove('active-turn');
    }

    // تلوين اسم اللاعب النشط
    const teamNameSpan = laneDiv.querySelector('.team-name');
    if (teamNameSpan) {
        if (isActive) teamNameSpan.classList.add('active-player-name');
        else teamNameSpan.classList.remove('active-player-name');
    }

    // أيقونة وضع التدريب
    const trainingIconSpan = laneDiv.querySelector('.training-icon');
    if (trainingIconSpan) {
        trainingIconSpan.style.display = isTraining ? 'inline-block' : 'none';
    }
}
export function renderTracks(sessionId) {
    let container = document.getElementById('race-tracks-container');
    if (!container) return;
    
    const session = RaceSessionManager.getSession(sessionId);
    if (!session) return;
    let raceData = session.raceData;
    const isTraining = raceData.isTrainingMode === true;
    let entities = raceData.isTeam ? [...raceData.teams] : [...raceData.players];
    
    const currentEntityIds = entities.map(e => raceData.isTeam ? `team_${e.id}` : e.id).sort();
    const previousEntityIds = lastTrackVersion.get(sessionId) || [];
    
    const needsFullRebuild = (currentEntityIds.length !== previousEntityIds.length) ||
        !currentEntityIds.every((id, idx) => id === previousEntityIds[idx]);
    
    if (needsFullRebuild) {
        const fragment = buildTracksFragment(sessionId, raceData, entities, isTraining);
        container.innerHTML = '';
        container.appendChild(fragment);
        lastTrackVersion.set(sessionId, currentEntityIds);
    } else {
        entities.forEach(entity => {
            const entityId = raceData.isTeam ? `team_${entity.id}` : entity.id;
            updateSingleLane(sessionId, entityId);
        });
    }
}

function buildTracksFragment(sessionId, raceData, entities, isTraining) {
    const fragment = document.createDocumentFragment();

    let activePlayerId = null;
    let activePlayerName = '';
    if (raceData.isTeam && raceData.gameMode !== 'team_relay' && raceData.allPlayers && raceData.allPlayers.length) {
        const activePlayer = raceData.allPlayers[raceData.activePlayerIndex];
        if (activePlayer) {
            activePlayerId = activePlayer.id;
            activePlayerName = activePlayer.name;
        }
    }

    // ترتيب الكيانات حسب الموقع (تنازلياً) ثم النقاط
    entities.sort((a, b) => {
        if (b.pos !== a.pos) return b.pos - a.pos;
        return (b.score || 0) - (a.score || 0);
    });

    entities.forEach((entity) => {
        const entityId = raceData.isTeam ? `team_${entity.id}` : entity.id;
        let isActive = raceData.isTeam
            ? (`team_${entity.id}` === String(raceData.activeEntityId) || String(entity.id) === String(raceData.activeEntityId))
            : (String(entity.id) === String(raceData.activeEntityId));

        let onFireClass = '';
        if (!raceData.isTeam && entity.combo && entity.combo >= 3) {
            onFireClass = 'on-fire';
        }

        let percent, progressText;
        if (raceData.gameMode === 'solo_marathon') {
            const answered = entity.marathonQuestionsAnswered || 0;
            const total = entity.marathonTotalQuestions || raceData.goal || 1;
            percent = Math.min(100, (answered / total) * 100);
            progressText = `${answered}/${total} سؤال`;
        } else {
            percent = Math.min(100, (entity.pos / raceData.goal) * 100);
            progressText = `${Math.floor(entity.pos)}/${raceData.goal} خطوة`;
        }

        let displayName = raceData.isTeam ? entity.name : entity.name;
        let displayImg = raceData.isTeam ? (entity.members[0]?.img || DEFAULT_IMG) : entity.img;

        // ========== عرض القلوب في وضع البقاء للأقوى (معدل) ==========
        let heartsHtml = '';
        if (!raceData.isTeam && raceData.gameMode === 'solo_survival') {
            // الحصول على عدد القلوب، القيمة الافتراضية 3
            let lives = 3;
            if (raceData.survivalLives) {
                const livesValue = raceData.survivalLives[String(entity.id)];
                if (livesValue !== undefined) lives = livesValue;
            }
            heartsHtml = '<span class="hearts" style="margin-left:8px;font-size:1.2rem;">' + '❤️'.repeat(lives) + (lives === 0 ? '💀' : '') + '</span>';
        }
        // ========== نهاية عرض القلوب ==========

        let avatarsHtml = '';
        if (raceData.isTeam) {
            if (raceData.gameMode === 'team_relay') {
                let activeMemberIndex = (entity.currentMemberIndex || 0) % entity.members.length;
                entity.members.forEach((member, idx) => {
                    const isCurrent = (idx === activeMemberIndex);
                    avatarsHtml += `<img src="${member.img || DEFAULT_IMG}"
                        class="team-member-avatar ${isCurrent ? 'active-member' : ''}"
                        title="${escapeHtml(member.name)}"
                        style="width:32px; height:32px; border-radius:50%; border:2px solid #facc15; margin:0 2px;">`;
                });
            } else {
                entity.members.forEach((member) => {
                    const isCurrent = (member.id === activePlayerId);
                    avatarsHtml += `<img src="${member.img || DEFAULT_IMG}"
                        class="team-member-avatar ${isCurrent ? 'active-member' : ''}"
                        title="${escapeHtml(member.name)}"
                        style="width:32px; height:32px; border-radius:50%; border:2px solid #facc15; margin:0 2px;">`;
                });
            }
        }

        let activeMemberDisplay = '';
        if (raceData.isTeam && raceData.gameMode !== 'team_relay' && activePlayerName && entity.members.some(m => m.id === activePlayerId)) {
            activeMemberDisplay = `<span class="active-member-name"> (${escapeHtml(activePlayerName)})</span>`;
        }

        const laneDiv = document.createElement('div');
        laneDiv.className = `race-lane ${isActive ? 'active-turn' : ''}`;
        laneDiv.id = `lane-${entityId}`;
        const trainingIcon = isTraining ? '<span class="training-icon" style="margin-right: 8px; font-size: 1.2rem;" title="وضع التدريب">🥋</span>' : '<span class="training-icon" style="display:none;"></span>';
        laneDiv.innerHTML = `
            <div class="team-avatars-container" style="display:flex; gap:4px; align-items:center; min-width:100px;">
                ${raceData.isTeam ? avatarsHtml : `<img src="${displayImg}" class="w-8 h-8 rounded-full border ml-1 object-cover">`}
            </div>
            <div class="flex items-center gap-2 min-w-[100px]">
                ${trainingIcon}
                <span class="team-name ${isActive ? 'active-player-name' : ''}">${escapeHtml(displayName)}${activeMemberDisplay}${heartsHtml}</span>
            </div>
            <div class="lane-track relative flex-1">
                <img src="${displayImg}" class="moving-avatar absolute ${onFireClass}" style="left: ${percent}%;">
            </div>
            <div class="text-sm w-10 text-center">${progressText}</div>
            <button data-action="withdrawRace" data-session-id="${sessionId}" data-entity-id="${entityId}" data-is-team="${raceData.isTeam}" class="withdraw-btn">انسحاب</button>
        `;
        fragment.appendChild(laneDiv);
    });

    return fragment;
}
export function clearTrackCache(sessionId) {
    lastTrackVersion.delete(sessionId);
    if (activeListeners.has(sessionId)) {
        activeListeners.get(sessionId)();
        activeListeners.delete(sessionId);
    }
}