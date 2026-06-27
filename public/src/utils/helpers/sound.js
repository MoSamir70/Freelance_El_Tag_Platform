// ===================== src/utils/helpers/sound.js =====================
// دوال الصوت: تشغيل المؤثرات الصوتية وكتم الصوت
// [FIX] تم إضافة terminateAllSounds لإيقاف جميع الأصوات فوراً

let correctSound, wrongSound, winSound, tickSound, raceStartSound;
export let isSoundMuted = false;

export function initSounds() {
    try {
        correctSound   = new Howl({ src: ['sounds/correct.mp3'], volume: 0.7 });
        wrongSound     = new Howl({ src: ['sounds/wrong.mp3'], volume: 0.6 });
        winSound       = new Howl({ src: ['sounds/win.mp3'], volume: 0.8 });
        tickSound      = new Howl({ src: ['sounds/tick.mp3'], volume: 0.2 });
        raceStartSound = new Howl({ src: ['sounds/race-start.mp3'], volume: 0.6 });
    } catch (e) { console.error('Howler.js failed to init sounds:', e); }
}

export function updateSoundButtonIcon() {
    const btn = document.getElementById('toggle-sound-btn');
    if (btn) btn.innerHTML = isSoundMuted ? '🔇' : '🔊';
}

export function toggleMute() {
    isSoundMuted = !isSoundMuted;
    updateSoundButtonIcon();
    localStorage.setItem('peak_sound_muted', isSoundMuted);
    Howler.volume(isSoundMuted ? 0 : 0.5);
    import('./notifications.js').then(({ showFloatingNotification }) => {
        showFloatingNotification(isSoundMuted ? 'تم كتم الصوت 🔇' : 'تم تشغيل الصوت 🔊', 'info', 1500);
    });
}

export function terminateAllSounds() {
    if (correctSound && correctSound.stop) correctSound.stop();
    if (wrongSound && wrongSound.stop) wrongSound.stop();
    if (winSound && winSound.stop) winSound.stop();
    if (tickSound && tickSound.stop) tickSound.stop();
    if (raceStartSound && raceStartSound.stop) raceStartSound.stop();
    console.log('🔇 تم إيقاف جميع المؤثرات الصوتية');
}

export function playCorrect() { 
    if (correctSound && !isSoundMuted) correctSound.play(); 
}
export function playWrong() {
    if (wrongSound && !isSoundMuted) wrongSound.play();
    document.body.classList.add('shake-screen');
    setTimeout(() => document.body.classList.remove('shake-screen'), 400);
}
export function playWin() { 
    if (winSound && !isSoundMuted) winSound.play(); 
}
export function playTick() { 
    if (tickSound && !isSoundMuted) tickSound.play(); 
}
export function playRaceStart() { 
    if (raceStartSound && !isSoundMuted) raceStartSound.play(); 
}