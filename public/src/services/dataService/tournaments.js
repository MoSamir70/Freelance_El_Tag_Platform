// tournaments.js - البطولات (إنشاء، انضمام، تحديث)
import { 
  db, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, 
  query, where, addDoc, serverTimestamp 
} from '../../firebase/init.js';
import { getCurrentTeacherId } from './helpers.js';
import { getStudentById } from './student.js';

export async function createTournament(data) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) throw new Error('No teacher logged in');
    const tournament = { 
        ...data, 
        teacherId, 
        createdAt: serverTimestamp(), 
        status: 'waiting',
        players: data.players || [], 
        rounds: data.rounds || [], 
        currentRound: 0 
    };
    const docRef = await addDoc(collection(db, 'tournaments'), tournament);
    return { id: docRef.id, ...tournament };
}

export async function getTournamentByCode(code) {
    const q = query(collection(db, 'tournaments'), where('accessCode', '==', code));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function getTournamentById(id) {
    const snap = await getDoc(doc(db, 'tournaments', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addPlayerToTournament(tournamentId, player) {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) return false;
    const players = tournament.players || [];
    if (!players.find(p => p.id === player.id)) {
        players.push(player);
        await updateDoc(doc(db, 'tournaments', tournamentId), { players });
    }
    return true;
}

export async function updateTournament(tournamentId, updates) {
    await updateDoc(doc(db, 'tournaments', tournamentId), updates);
}

export async function deleteTournament(tournamentId) {
    await deleteDoc(doc(db, 'tournaments', tournamentId));
}

export async function getActiveTournaments() {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) return [];
    const q = query(collection(db, 'tournaments'), where('teacherId', '==', teacherId), where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getActiveTournamentsForStudent(teacherId) {
    if (!teacherId) return [];
    const q = query(collection(db, 'tournaments'), where('teacherId', '==', teacherId), where('status', '==', 'waiting'));
    const snapshot = await getDocs(q);
    const now = Date.now();
    const active = [];
    for (const docSnap of snapshot.docs) {
        const t = { id: docSnap.id, ...docSnap.data() };
        if (!t.scheduledTime || t.scheduledTime <= now) active.push(t);
    }
    return active;
}