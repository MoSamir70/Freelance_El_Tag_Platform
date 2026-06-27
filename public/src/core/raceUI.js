// src/core/raceUI.js
// واجهة التصدير (barrel) لوحدات واجهة السباق (للتوافق القديم)

export { renderTracks, updateSingleLane } from './raceUI/tracks.js';
export { 
    startTimerForCurrentQuestion, 
    startTimerFromValue,
    handleTimeUp, 
    clearAllRaceTimeouts, 
    updateTimerUI, 
    resetTimerBar 
} from './raceUI/timer.js';
export { startCountdown } from './raceUI/countdown.js';
export { showBetOverlay } from './raceUI/betOverlay.js';
export { showTargetSelectionOverlay, closeSurpriseOverlay } from './raceUI/surpriseOverlay.js';
export { showQuestion } from './raceUI/questionDisplay.js';