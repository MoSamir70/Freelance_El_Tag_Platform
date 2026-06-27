// src/core/raceUI/index.js
// واجهة التصدير (barrel) لوحدات واجهة السباق

export { renderTracks, updateSingleLane } from './tracks.js';
export { 
    startTimerForCurrentQuestion, 
    startTimerFromValue,
    handleTimeUp, 
    clearAllRaceTimeouts, 
    updateTimerUI, 
    resetTimerBar 
} from './timer.js';
export { startCountdown } from './countdown.js';
export { showBetOverlay } from './betOverlay.js';
export { showTargetSelectionOverlay, closeSurpriseOverlay } from './surpriseOverlay.js';
export { showQuestion } from './questionDisplay.js';