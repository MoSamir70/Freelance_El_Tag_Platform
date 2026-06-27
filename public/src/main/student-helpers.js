import { 
    db, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
    addDoc, serverTimestamp 
} from '../firebase/init.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';

const studentsCollection = collection(db, 'students');
const studentStatsCollection = collection(db, 'studentStats');
const gameHistoryCollection = collection(db, 'gameHistory');

export async function updateStudentProgress(studentId, deltaScore = 0, isCorrect = false, isWin = false) {
    const statsRef = doc(studentStatsCollection, studentId);
    const docSnap = await getDoc(statsRef);
    if (docSnap.exists()) {
        const current = docSnap.data();
        const updates = {
            score: (current.score || 0) + deltaScore,
            correct: (current.correct || 0) + (isCorrect ? 1 : 0),
            wrong: (current.wrong || 0) + (!isCorrect ? 1 : 0),
            wins: (current.wins || 0) + (isWin ? 1 : 0),
            lastPlayed: serverTimestamp()
        };
        await updateDoc(statsRef, updates);
    } else {
        await setDoc(statsRef, {
            studentId: studentId,
            score: deltaScore,
            correct: isCorrect ? 1 : 0,
            wrong: !isCorrect ? 1 : 0,
            wins: isWin ? 1 : 0,
            createdAt: serverTimestamp(),
            lastPlayed: serverTimestamp()
        });
    }
    const studentDocRef = doc(studentsCollection, studentId);
    const studentSnap = await getDoc(studentDocRef);
    if (studentSnap.exists()) {
        await updateDoc(studentDocRef, { score: (studentSnap.data().score || 0) + deltaScore });
    }
    showFloatingNotification(isCorrect ? '✅ إجابة صحيحة! +' + deltaScore : '❌ إجابة خاطئة', isCorrect ? 'success' : 'error');
}

export async function getStudentStats(studentId) {
    const statsRef = doc(studentStatsCollection, studentId);
    const docSnap = await getDoc(statsRef);
    return docSnap.exists() ? docSnap.data() : { score: 0, correct: 0, wrong: 0, wins: 0 };
}

export async function addGameHistoryRecord(teacherId, studentId, gameData) {
    await addDoc(gameHistoryCollection, {
        teacherId, studentId, ...gameData, timestamp: serverTimestamp()
    });
}

export async function addStudentToFirestore(student) {
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    if (!teacherId) return false;
    try {
        await setDoc(doc(studentsCollection, student.id), { ...student, teacherId });
        await setDoc(doc(studentStatsCollection, student.id), {
            studentId: student.id,
            score: 0, correct: 0, wrong: 0, wins: 0,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export async function updateStudentInFirestore(studentId, updates) {
    try {
        await updateDoc(doc(studentsCollection, studentId), updates);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export async function deleteStudentFromFirestore(studentId) {
    try {
        await deleteDoc(doc(studentsCollection, studentId));
        await deleteDoc(doc(studentStatsCollection, studentId));
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}