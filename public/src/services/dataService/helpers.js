// helpers.js - دوال مساعدة وأساسية
import { 
  db, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, 
  query, where, addDoc, serverTimestamp, writeBatch 
} from '../../firebase/init.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

// ========== دوال مساعدة ==========
export function getCurrentTeacherId() {
    return sessionStorage.getItem('peak_teacher_code');
}

let migrationDone = false;

export async function ensureFirestoreHasData(teacherId) {
    if (migrationDone) return;
    if (!teacherId) return;
    
    const q = query(collection(db, 'students'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        migrationDone = true;
        return;
    }
    
    let localStudents = [];
    let localStudentStats = {};
    let localGameHistory = [];
    let localCustomGrades = [];
    
    try {
        const stored = localStorage.getItem('peak_platform_light');
        if (stored) {
            const data = JSON.parse(stored);
            localStudents = data.students || [];
            localStudentStats = data.studentStats || {};
            localGameHistory = data.gameHistory || [];
            localCustomGrades = data.customGrades || [];
        }
    } catch(e) {}
    
    if (localStudents.length === 0) {
        migrationDone = true;
        return;
    }
    
    console.log(`[dataService] Migrating ${localStudents.length} students to Firestore for teacher ${teacherId}`);
    
    const batch = writeBatch(db);
    for (const student of localStudents) {
        const studentData = { ...student, teacherId };
        batch.set(doc(db, 'students', student.id), studentData, { merge: true });
    }
    for (const [sid, stats] of Object.entries(localStudentStats)) {
        batch.set(doc(db, 'studentStats', sid), stats, { merge: true });
    }
    for (const game of localGameHistory) {
        const gameId = game.id || `${game.timestamp}_${Math.random()}`;
        batch.set(doc(db, 'gameHistory', gameId), { ...game, teacherId }, { merge: true });
    }
    if (localCustomGrades.length) {
        batch.set(doc(db, 'customGrades', teacherId), { grades: localCustomGrades }, { merge: true });
    }
    await batch.commit();
    migrationDone = true;
    showFloatingNotification('تم ترحيل البيانات القديمة إلى السحاب', 'success');
}

export async function getTeacherDocumentByCode(teacherCode) {
    const q = query(collection(db, 'teachers'), where('code', '==', teacherCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { ref: docSnap.ref, data: docSnap.data() };
}

// دوال التوافق القديم (غير مستخدمة لكن نحتفظ بها)
export function getCurrentTeacherCode() {
    return sessionStorage.getItem('peak_teacher_code');
}

export function getTeacherPlan() {
    return sessionStorage.getItem('teacher_plan') || 'free';
}

export function getTeacherLockedSubject() {
    return sessionStorage.getItem('teacher_locked_subject') || null;
}

export function getTeacherTotalQuestions() {
    return parseInt(sessionStorage.getItem('teacher_total_questions') || '0');
}

export function getTeacherOnlineRoomsUsed() {
    return parseInt(sessionStorage.getItem('teacher_online_rooms_used') || '0');
}

export function updateTeacherPlanInSession(plan) {
    sessionStorage.setItem('teacher_plan', plan);
}

export function updateTeacherLockedSubjectInSession(subject) {
    sessionStorage.setItem('teacher_locked_subject', subject || '');
}

export function updateTeacherTotalQuestionsInSession(count) {
    sessionStorage.setItem('teacher_total_questions', count);
}

export function updateTeacherOnlineRoomsUsedInSession(count) {
    sessionStorage.setItem('teacher_online_rooms_used', count);
}

export function saveAllData() {
    console.log('[dataService] saveAllData called - no action needed (Firestore is source of truth)');
}

export function reloadData() {
    console.log('[dataService] reloadData called');
}

export function save() {
    console.log('[dataService] save called');
}