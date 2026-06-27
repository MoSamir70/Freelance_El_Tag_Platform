// src/core/modes/BaseMode.js
/**
 * Base class for all game modes (individual and team).
 * All modes must extend this class and implement required methods.
 */
export class BaseMode {
  constructor(raceData, sessionId) {
    this.raceData = raceData;
    this.sessionId = sessionId;
  }

  /**
   * Called once when the race starts (in lifecycle.js)
   * Use this to add mode-specific fields to raceData.
   * @returns {Object} Additional properties to merge into raceData
   */
  onRaceStart() {
    return {};
  }

  /**
   * Process a student's answer.
   * @param {Object} params
   * @param {boolean} params.isCorrect
   * @param {Object} params.currentEntity - team or player
   * @param {Object} params.currentMember - actual student (player or team member)
   * @param {number} params.timeSpent
   * @param {number} params.betAmount - only for solo_bet
   * @param {boolean} params.isMinedQuestion - only for mined modes
   * @returns {Object|null} { stepsDelta, pointsDelta, shouldSkipNextPlayer, extraEffects } or null to use legacy code
   */
  processAnswer(params) {
    // Default: return null to let legacy code handle it
    return null;
  }

  /**
   * Called at the beginning of a turn (in turn.js)
   * @param {Object} currentEntity
   * @param {Object} currentMember
   */
  onTurnStart(currentEntity, currentMember) {
    // optional: decrement temporary counters, apply effects, etc.
  }

  /**
   * Called when time runs out for the current question (in timer.js)
   * @param {Object} currentEntity
   * @param {Object} currentMember
   */
  onTimeOut(currentEntity, currentMember) {
    // default: move back 1 step
    if (currentEntity) {
      currentEntity.pos = Math.max(0, (currentEntity.pos || 0) - 1);
    }
  }

  /**
   * Custom win condition (if different from reaching goal)
   * @param {Array} entities - players or teams
   * @returns {Object|null} winner entity or null
   */
  checkWin(entities) {
    return null; // use default goal-based win
  }

  /**
   * Called when race ends (win or force exit)
   */
  onRaceEnd() {}
}