import { RaceSessionManager } from '../core/raceSession.js';
import { exitRaceImmediate } from '../core/raceEngine.js';
import { _cleanupFirestoreListeners } from './firestore-listeners.js';

export function resetAllSessionData() {
    console.log('[Main] Resetting any stale session data');
    
    const activeSession = RaceSessionManager.getActive();
    if (activeSession) RaceSessionManager.destroy(activeSession.id);
    RaceSessionManager.setActive(null);
    
    const lobbyHost = document.getElementById('lobby-host-screen');
    const lobbyPlayer = document.getElementById('lobby-player-screen');
    const raceInterface = document.getElementById('race-interface');
    const navbar = document.getElementById('navbar');
    const mainContent = document.getElementById('main-content');
    
    if (lobbyHost) lobbyHost.classList.add('hidden');
    if (lobbyPlayer) lobbyPlayer.classList.add('hidden');
    if (raceInterface) raceInterface.classList.add('hidden');
    if (navbar) navbar.classList.remove('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
    
    _cleanupFirestoreListeners();
    
    document.body.classList.remove('racing');
    
    if (typeof window.showPage === 'function') window.showPage('home');
}