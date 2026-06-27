// student.js - دوال الطلاب (CRUD، إحصائيات، قوائم)
import { 
  db, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, serverTimestamp 
} from '../../firebase/init.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { getCurrentTeacherId, ensureFirestoreHasData } from './helpers.js';
import { invalidateGlobalCache } from './cache.js';

// ========== دوال الطلاب ==========
export async function getStudents(filterGrade = null) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) {
        console.warn('[getStudents] No teacher ID found');
        return [];
    }
    await ensureFirestoreHasData(teacherId);
    
    let q = query(collection(db, 'students'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    let students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (filterGrade && filterGrade !== 'all') {
        students = students.filter(s => s.grade === filterGrade);
    }
    return students;
}

export async function getAllStudentsGlobal() {
    const snapshot = await getDocs(collection(db, 'students'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getStudentsByTeacher(teacherId) {
    if (!teacherId) return [];
    const q = query(collection(db, 'students'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getGlobalLeaderboard(limitCount = 20) {
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, orderBy('score', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getStudentById(id) {
    const snap = await getDoc(doc(db, 'students', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addStudent(studentData) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) throw new Error('No teacher logged in');
    const newId = studentData.id || Date.now().toString();
    const fullData = { ...studentData, teacherId };
    await setDoc(doc(db, 'students', newId), fullData);
    showFloatingNotification(`تم إضافة الطالب ${studentData.name}`, 'success');
    invalidateGlobalCache();
    return fullData;
}

export async function updateStudent(id, updates) {
    await updateDoc(doc(db, 'students', id), updates);
    invalidateGlobalCache();
    showFloatingNotification('تم تحديث بيانات الطالب', 'success');
}

export async function deleteStudent(id) {
    await deleteDoc(doc(db, 'students', id));
    await deleteDoc(doc(db, 'studentStats', id));
    invalidateGlobalCache();
    showFloatingNotification('تم حذف الطالب', 'success');
}

// ========== إحصائيات الطلاب ==========
export async function getStudentStats(studentId) {
    const teacherId = getCurrentTeacherId();
    if (teacherId) await ensureFirestoreHasData(teacherId);
    
    const snap = await getDoc(doc(db, 'studentStats', studentId));
    if (snap.exists()) return snap.data();
    return { 
        totalAnswers: 0, 
        correctAnswers: 0, 
        speedAvg: 0, 
        categoryStats: {}, 
        correctByCategory: {}, 
        difficultyStats: {}, 
        withdrawCount: 0,
        lastActive: null,
        streak: 0
    };
}

export async function updateStudentStats(studentId, statsUpdate) {
    await setDoc(doc(db, 'studentStats', studentId), statsUpdate, { merge: true });
}

// ========== تاريخ المباريات ==========
export async function getGameHistory(filters = {}) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) return [];
    await ensureFirestoreHasData(teacherId);
    
    let constraints = [where('teacherId', '==', teacherId)];
    if (filters.startDate) constraints.push(where('timestamp', '>=', filters.startDate));
    if (filters.endDate) constraints.push(where('timestamp', '<=', filters.endDate));
    let q = query(collection(db, 'gameHistory'), ...constraints);
    const snapshot = await getDocs(q);
    let history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (filters.grade) history = history.filter(g => g.grade === filters.grade);
    if (filters.studentId) history = history.filter(g => g.participants?.includes(filters.studentId));
    return history;
}

export async function addGameHistory(gameRecord) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) throw new Error('No teacher logged in');
    const newRecord = { ...gameRecord, teacherId, timestamp: Date.now() };
    const docRef = await addDoc(collection(db, 'gameHistory'), newRecord);
    newRecord.id = docRef.id;
    invalidateGlobalCache();
    return newRecord;
}

// تحديث تقدم الطالب (نقاط، إجابات، انتصارات)
export async function updateStudentProgress(studentId, deltaScore = 0, isCorrect = false, isWin = false) {
    const studentStatsRef = doc(db, 'studentStats', studentId);
    const studentStatsSnap = await getDoc(studentStatsRef);
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    
    if (studentStatsSnap.exists()) {
        const current = studentStatsSnap.data();
        const updates = {
            score: (current.score || 0) + deltaScore,
            correctAnswers: (current.correctAnswers || 0) + (isCorrect ? 1 : 0),
            totalAnswers: (current.totalAnswers || 0) + 1,
            wins: (current.wins || 0) + (isWin ? 1 : 0),
            lastPlayed: serverTimestamp()
        };
        await updateDoc(studentStatsRef, updates);
    } else {
        await setDoc(studentStatsRef, {
            studentId: studentId,
            score: deltaScore,
            correctAnswers: isCorrect ? 1 : 0,
            totalAnswers: 1,
            wins: isWin ? 1 : 0,
            createdAt: serverTimestamp(),
            lastPlayed: serverTimestamp()
        });
    }
    
    if (studentSnap.exists()) {
        await updateDoc(studentRef, { score: (studentSnap.data().score || 0) + deltaScore });
    }
    invalidateGlobalCache();
}