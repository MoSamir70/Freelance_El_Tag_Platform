// src/core/modes/index.js
export { BaseMode } from './BaseMode.js';
export { createMode, registerAllModes, registerMode, isModeRegistered, getRegisteredModes } from './ModeRegistry.js';

// Export individual modes if needed
export { ClassicMode } from './individual/ClassicMode.js';
export { SpeedrunMode } from './individual/SpeedrunMode.js';
export { MemoryMode } from './individual/MemoryMode.js';
export { MinedMode } from './individual/MinedMode.js';
export { BetMode } from './individual/BetMode.js';
export { MarathonMode } from './individual/MarathonMode.js';
export { SurvivalMode } from './individual/SurvivalMode.js';
export { QuizRushMode } from './individual/QuizRushMode.js';
export { SurpriseMode } from './individual/SurpriseMode.js';