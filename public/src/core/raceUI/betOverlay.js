// src/core/raceUI/betOverlay.js
// نافذة الرهان (Bet Overlay) لوضع اللعب solo_bet
// [FIX] إزالة الاعتماد على window.raceData
// [FIX] استخدام RaceSessionManager لقراءة بيانات السباق
// [FIX] تحسين المؤقت والعد التنازلي
// [FIX] إضافة معالجة للخروج الآمن (إذا انتهت اللعبة أثناء الرهان)

const Swal = window.Swal;

export function showBetOverlay(sessionId, currentEntity, goal) {
    return new Promise((resolve) => {
        const pos = currentEntity?.pos || 0;
        const questionsRemaining = goal - pos;

        let stage = 'mid';
        if (pos < 3) {
            stage = 'early';
        } else if (questionsRemaining <= 2) {
            stage = 'late';
        }

        let winAmount = 1;
        let loseAmount = 1;

        switch (stage) {
            case 'early':
                winAmount = Math.floor(Math.random() * 4) + 3;
                loseAmount = Math.random() < 0.5 ? 2 : 1;
                break;
            case 'mid':
                winAmount = Math.floor(Math.random() * 3) + 2;
                loseAmount = Math.floor(Math.random() * 2) + 2;
                break;
            case 'late':
                winAmount = Math.floor(Math.random() * 2) + 2;
                loseAmount = Math.floor(Math.random() * 3) + 4;
                break;
        }

        let animating = false;
        let resolved = false;
        let timerInterval = null;
        let timeLeft = 15;

        const finish = (win, lose) => {
            if (resolved) return;
            resolved = true;
            if (timerInterval) clearInterval(timerInterval);
            Swal.close();
            resolve({ winAmount: win, loseAmount: lose });
        };

        const updateTimerDisplay = () => {
            const timerSpan = document.getElementById('bet-timer-number');
            if (timerSpan) timerSpan.innerText = timeLeft;
            const progressCircle = document.getElementById('bet-timer-progress');
            if (progressCircle) {
                const circumference = 2 * Math.PI * 18;
                const offset = circumference - (timeLeft / 15) * circumference;
                progressCircle.style.strokeDashoffset = offset;
            }
        };

        const html = `
            <style>
                .bet-container { font-family:'Cairo',sans-serif; text-align:center; }
                .bet-item { display:inline-block; margin:0 2rem; }
                .bet-icon { font-size:3rem; }
                .bet-number { font-size:3rem; font-weight:900; width:3rem; display:inline-block; color:#facc15; }
                .custom-bet-btn { border:none; border-radius:2.5rem; padding:10px 24px; font-weight:bold; font-size:1rem; cursor:pointer; margin:8px 5px; transition:0.2s; }
                #roll-btn { background:#facc15; color:#000; }
                #roll-btn:hover { background:#ffd966; }
                #skip-btn { background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.3); }
                #skip-btn:hover { background:rgba(255,255,255,0.2); }
                .bet-timer {
                    display: flex;
                    justify-content: center;
                    margin: 15px auto 5px;
                    position: relative;
                    width: 60px;
                    height: 60px;
                }
                .bet-timer svg {
                    width: 60px;
                    height: 60px;
                    transform: rotate(-90deg);
                }
                .bet-timer-number {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: #facc15;
                }
            </style>
            <div class="bet-container">
                <div class="bet-item">
                    <div class="bet-icon">✅</div>
                    <div><span id="win-number" class="bet-number">-</span></div>
                    <div style="font-size:0.8rem; color:#10b981;">مكسب</div>
                </div>
                <div class="bet-item">
                    <div class="bet-icon">❌</div>
                    <div><span id="lose-number" class="bet-number">-</span></div>
                    <div style="font-size:0.8rem; color:#ef4444;">خسارة</div>
                </div>
                <p style="color:#cbd5e1; font-size:0.9rem; margin-top:1rem;">
                    ${stage === 'early' ? '⚡ مرحلة البداية – فرصتك عالية' : stage === 'mid' ? '⚠️ مرحلة الوسط – متوازنة' : '🔴 مرحلة النهاية – خسارة كبيرة محتملة'}
                </p>
                <div class="bet-timer">
                    <svg viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,215,0,0.2)" stroke-width="2"/>
                        <circle id="bet-timer-progress" cx="20" cy="20" r="18" fill="none" stroke="#facc15" stroke-width="2" stroke-dasharray="113.097" stroke-dashoffset="0"/>
                    </svg>
                    <span id="bet-timer-number" class="bet-timer-number">15</span>
                </div>
                <div style="display:flex; justify-content:center; gap:10px; margin-top:0.5rem;">
                    <button id="roll-btn" class="custom-bet-btn">🎲 ابدأ الرهان</button>
                    <button id="skip-btn" class="custom-bet-btn">تخطي</button>
                </div>
            </div>
        `;

        let animationFrameId = null;

        Swal.fire({
            html,
            background: 'rgba(5, 10, 25, 0.95)',
            backdrop: 'rgba(0,0,0,0.8)',
            showConfirmButton: false,
            showCancelButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
                popup: '!rounded-[3rem] !border !border-yellow-500/30 !shadow-[0_0_30px_rgba(250,204,21,0.3)] !p-6 !backdrop-blur-xl'
            },
            didOpen: () => {
                const winSpan = document.getElementById('win-number');
                const loseSpan = document.getElementById('lose-number');
                const rollBtn = document.getElementById('roll-btn');
                const skipBtn = document.getElementById('skip-btn');

                timerInterval = setInterval(() => {
                    if (resolved) return;
                    timeLeft--;
                    updateTimerDisplay();
                    if (timeLeft <= 0) {
                        if (!animating && !resolved) {
                            clearInterval(timerInterval);
                            finish(0, 0);
                        }
                    }
                }, 1000);
                updateTimerDisplay();

                skipBtn.addEventListener('click', () => {
                    if (!animating && !resolved) {
                        clearInterval(timerInterval);
                        finish(0, 0);
                    }
                });

                rollBtn.addEventListener('click', () => {
                    if (animating || resolved) return;
                    animating = true;
                    clearInterval(timerInterval);
                    rollBtn.disabled = true;
                    skipBtn.disabled = true;
                    rollBtn.style.opacity = '0.5';
                    skipBtn.style.opacity = '0.5';

                    const duration = 2000;
                    const startTime = performance.now();
                    const winFinal = winAmount;
                    const loseFinal = loseAmount;

                    function animateNumbers(now) {
                        const elapsed = now - startTime;
                        if (elapsed < duration) {
                            winSpan.textContent = Math.floor(Math.random() * 5) + 1;
                            loseSpan.textContent = Math.floor(Math.random() * 5) + 1;
                            animationFrameId = requestAnimationFrame(animateNumbers);
                        } else {
                            winSpan.textContent = winFinal;
                            loseSpan.textContent = loseFinal;
                            winSpan.style.color = '#10b981';
                            loseSpan.style.color = '#ef4444';

                            const statusDiv = document.createElement('p');
                            statusDiv.style.cssText = 'color:#facc15; font-size:1.2rem; margin-top:1rem; font-weight:bold;';
                            statusDiv.textContent = 'استعد للإجابة...';
                            winSpan.parentElement.parentElement.parentElement.appendChild(statusDiv);

                            setTimeout(() => {
                                finish(winFinal, loseFinal);
                            }, 1500);
                        }
                    }

                    animationFrameId = requestAnimationFrame(animateNumbers);
                });
            },
            willClose: () => {
                if (!resolved) {
                    finish(0, 0);
                }
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
            }
        });
    });
}