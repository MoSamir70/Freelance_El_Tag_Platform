// quickRace.js - السباقات السريعة
import { 
  db, collection, doc, getDocs, getDoc, updateDoc, deleteDoc, 
  query, where, addDoc, serverTimestamp 
} from '../../firebase/init.js';
import { getCurrentTeacherId } from './helpers.js';

export async function createQuickRace(data) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) throw new Error('No teacher logged in');
    const race = { 
        ...data, 
        teacherId, 
        createdAt: serverTimestamp(), 
        status: 'waiting', 
        players: data.players || [], 
        currentQuestion: 0, 
        scores: {} 
    };
    const docRef = await addDoc(collection(db, 'quickRaces'), race);
    return { id: docRef.id, ...race };
}

export async function getQuickRaceByCode(code) {
    const q = query(collection(db, 'quickRaces'), where('accessCode', '==', code));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function getQuickRaceById(raceId) {
    const snap = await getDoc(doc(db, 'quickRaces', raceId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addPlayerToQuickRace(raceId, player) {
    const race = await getQuickRaceById(raceId);
    if (!race) return false;
    const players = race.players || [];
    if (!players.find(p => p.id === player.id)) {
        players.push(player);
        await updateDoc(doc(db, 'quickRaces', raceId), { players });
    }
    return true;
}

export async function updateQuickRace(raceId, updates) {
    await updateDoc(doc(db, 'quickRaces', raceId), updates);
}

export async function deleteQuickRace(raceId) {
    await deleteDoc(doc(db, 'quickRaces', raceId));
}