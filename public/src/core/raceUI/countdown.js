// src/core/raceUI/countdown.js
// شاشة العد التنازلي (Countdown) التي تظهر قبل بدء السباق
// [FIX] تحسين دقة العد التنازلي باستخدام requestAnimationFrame بدلاً من setInterval
// [FIX] إضافة تأثيرات بصرية وتحسين التوافق مع الثيمات
// [FIX] استخدام RaceSessionManager بدلاً من window.raceData
// [FIX] تنظيف المتغيرات العالمية بشكل صحيح عند الخروج
// [FIX] إضافة معالجة للأخطاء وإلغاء العد التنازلي إذا انتهت اللعبة

import { RaceSessionManager } from '../raceSession.js';
import { DEFAULT_IMG } from '../../constants.js';
import { escapeHtml, playTick, playRaceStart } from '../../utils.js';

// ===================== العد التنازلي لبدء السباق (محسّن) =====================
export async function startCountdown(sessionId) {
    return new Promise(async (resolve) => {
        let overlay = document.getElementById('countdown-overlay');
        if (!overlay) {
            console.warn('Countdown overlay not found');
            resolve();
            return;
        }
        overlay.style.display = 'flex';
        
        const session = RaceSessionManager.getSession(sessionId);
        if (!session) { resolve(); return; }
        let raceData = session.raceData;
        
        let playersHTML = '';
        
        if (raceData.isTeam) {
            let teamsHtml = raceData.teams.map(team => {
                let membersHtml = team.members.map(member => `
                    <div class="countdown-player-item">
                        <img src="${member.img || DEFAULT_IMG}" alt="${escapeHtml(member.name)}">
                        <div class="countdown-player-name">${escapeHtml(member.name)}</div>
                    </div>
                `).join('');
                return `
                    <div class="countdown-team-block">
                        <div class="countdown-team-title">${escapeHtml(team.name)}</div>
                        <div class="countdown-members-row">${membersHtml}</div>
                    </div>
                `;
            });
            const vsIcon = '<div class="countdown-vs">⚔️</div>';
            playersHTML = `<div class="countdown-teams-row">${teamsHtml.join(vsIcon)}</div>`;
        } else {
            let playersList = raceData.players.map(p => ({
                name: p.name,
                img: p.img || DEFAULT_IMG
            }));
            playersHTML = '<div class="countdown-players-row">';
            for (let i = 0; i < playersList.length; i++) {
                const p = playersList[i];
                playersHTML += `
                    <div class="countdown-player-item">
                        <img src="${p.img}" alt="${escapeHtml(p.name)}">
                        <div class="countdown-player-name">${escapeHtml(p.name)}</div>
                    </div>
                `;
                if (i < playersList.length - 1) {
                    playersHTML += '<div class="countdown-vs-sword">⚔️</div>';
                }
            }
            playersHTML += '</div>';
        }
        
        overlay.innerHTML = `
            <div class="countdown-title">⚔️ استعدوا للمنافسة ⚔️</div>
            ${playersHTML}
            <div class="countdown-number-area" id="cd-number-area"></div>
        `;
        
        const numberArea = document.getElementById('cd-number-area');
        
        try {
            // إلغاء أي مؤقت سابق (للحماية من التكرار)
            if (window.countdownRaf) cancelAnimationFrame(window.countdownRaf);
            if (window.countdownTimeout) clearTimeout(window.countdownTimeout);
            if (window.countdownInterval) clearInterval(window.countdownInterval);
            
            // بدء العد التنازلي
            const startDelay = setTimeout(() => {
                let count = 3;
                let lastTimestamp = null;
                const startTime = performance.now();
                
                // دالة تحديث العد باستخدام requestAnimationFrame
                const updateCountdown = (now) => {
                    // التحقق من أن اللعبة لم تنته بعد
                    const currentSession = RaceSessionManager.getSession(sessionId);
                    if (!currentSession || currentSession.raceData._gameEnded) {
                        if (window.countdownRaf) cancelAnimationFrame(window.countdownRaf);
                        window.countdownRaf = null;
                        overlay.style.display = 'none';
                        resolve();
                        return;
                    }
                    
                    if (!lastTimestamp) lastTimestamp = now;
                    const elapsed = now - startTime;
                    const newCount = Math.max(0, 3 - Math.floor(elapsed / 1000));
                    
                    if (newCount !== count && newCount >= 0) {
                        count = newCount;
                        if (count > 0) {
                            numberArea.innerHTML = `<div class="countdown-number">${count}</div>`;
                            playTick();
                        } else if (count === 0) {
                            numberArea.innerHTML = '<div class="countdown-go-text">🚀 انطلق!</div>';
                            playRaceStart();
                            cancelAnimationFrame(window.countdownRaf);
                            window.countdownRaf = null;
                            window.countdownTimeout = setTimeout(() => {
                                overlay.style.display = 'none';
                                resolve();
                            }, 900);
                            return;
                        }
                    }
                    
                    if (count > 0 && elapsed < 3000) {
                        window.countdownRaf = requestAnimationFrame(updateCountdown);
                    }
                };
                
                window.countdownRaf = requestAnimationFrame(updateCountdown);
            }, 500);
            window.countdownTimeout = startDelay;
        } catch (e) {
            console.error('Countdown failed:', e);
            overlay.style.display = 'none';
            resolve();
        }
    });
}