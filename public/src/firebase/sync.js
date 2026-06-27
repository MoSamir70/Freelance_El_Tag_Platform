// src/firebase/sync.js
// دوال المزامنة – تستخدم writeBatch لتحسين الأداء

import { db, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch } from './init.js';
import { dbLight, loadLightData, saveLightData } from '../db/localstorage.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';

// ========== مزامنة جميع بيانات المعلم إلى Firestore (مرة واحدة) ==========
export async function syncAllToFirebase(teacherCode, uid) {
    if (!teacherCode) {
        console.warn('[Sync] No teacher code provided');
        return;
    }
    console.log('[Sync] Starting one-time sync for teacher:', teacherCode);
    loadLightData();
    
    // التحقق مما إذا كانت البيانات موجودة بالفعل
    const q = query(collection(db, 'students'), where('teacherId', '==', teacherCode));
    const snap = await getDocs(q);
    if (!snap.empty) {
        console.log('[Sync] Firestore already has data, skipping sync');
        return;
    }
    
    try {
        const batch = writeBatch(db);
        
        // 1. مزامنة الطلاب
        for (const student of dbLight.students) {
            const studentRef = doc(db, 'students', student.id);
            batch.set(studentRef, { ...student, teacherId: teacherCode }, { merge: true });
        }
        
        // 2. مزامنة إحصائيات الطلاب
        for (const [studentId, stats] of Object.entries(dbLight.studentStats)) {
            const statsRef = doc(db, 'studentStats', studentId);
            batch.set(statsRef, stats, { merge: true });
        }
        
        // 3. مزامنة تاريخ المباريات
        for (const game of dbLight.gameHistory) {
            const gameId = game.id || `${game.timestamp}_${Math.random()}`;
            const gameRef = doc(db, 'gameHistory', gameId);
            batch.set(gameRef, { ...game, teacherId: teacherCode }, { merge: true });
        }
        
        // 4. مزامنة الصفوف المخصصة
        if (dbLight.customGrades && dbLight.customGrades.length > 0) {
            const gradesRef = doc(db, 'customGrades', teacherCode);
            batch.set(gradesRef, { grades: dbLight.customGrades }, { merge: true });
        }
        
        await batch.commit();
        console.log('[Sync] Sync completed successfully');
        showFloatingNotification('✅ تمت المزامنة مع السحاب', 'success');
    } catch (error) {
        console.error('[Sync] Sync error:', error);
        showFloatingNotification('❌ فشلت المزامنة: ' + error.message, 'error');
    }
}

// ========== تحميل جميع بيانات المعلم من Firestore إلى localStorage (اختياري) ==========
export async function loadAllFromFirebase(teacherCode) {
    if (!teacherCode) return;
    console.log('[Sync] Loading data from Firebase for teacher:', teacherCode);
    
    try {
        const studentsQuery = query(collection(db, 'students'), where('teacherId', '==', teacherCode));
        const studentsSnap = await getDocs(studentsQuery);
        const firestoreStudents = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const localStudentIds = new Set(dbLight.students.map(s => s.id));
        for (const student of firestoreStudents) {
            if (!localStudentIds.has(student.id)) {
                dbLight.students.push(student);
            } else {
                const index = dbLight.students.findIndex(s => s.id === student.id);
                if (index !== -1) dbLight.students[index] = { ...dbLight.students[index], ...student };
            }
        }
        
        const statsSnap = await getDocs(collection(db, 'studentStats'));
        for (const docSnap of statsSnap.docs) {
            dbLight.studentStats[docSnap.id] = docSnap.data();
        }
        
        const historyQuery = query(collection(db, 'gameHistory'), where('teacherId', '==', teacherCode));
        const historySnap = await getDocs(historyQuery);
        dbLight.gameHistory = historySnap.docs.map(doc => doc.data());
        
        const gradesRef = doc(db, 'customGrades', teacherCode);
        const gradesSnap = await getDoc(gradesRef);
        if (gradesSnap.exists()) {
            dbLight.customGrades = gradesSnap.data().grades || [];
        }
        
        saveLightData();
        console.log('[Sync] Data loaded from Firebase successfully');
        showFloatingNotification('✅ تم تحميل البيانات من السحاب', 'success');
    } catch (error) {
        console.error('[Sync] Load error:', error);
        showFloatingNotification('❌ فشل تحميل البيانات: ' + error.message, 'error');
    }
}

// ========== مزامنة عنصر واحد (مثلاً بعد إضافة طالب) ==========
export async function syncSingleStudent(student) {
    try {
        const studentRef = doc(db, 'students', student.id);
        await setDoc(studentRef, student, { merge: true });
        console.log('[Sync] Student synced:', student.id);
    } catch (error) {
        console.error('[Sync] Error syncing student:', error);
    }
}

export async function syncSingleGameHistory(game) {
    try {
        const gameRef = doc(db, 'gameHistory', game.id || `${game.timestamp}_${Math.random()}`);
        await setDoc(gameRef, game, { merge: true });
        console.log('[Sync] Game history synced');
    } catch (error) {
        console.error('[Sync] Error syncing game history:', error);
    }
}

// ========== دالة الترحيل الأولي (للتوافق) ==========
export async function migrateLocalToFirebase(teacherCode) {
    await syncAllToFirebase(teacherCode);
}

// ========== مسح localStorage بعد الترحيل (اختياري) ==========
export function clearLocalDataAfterSync() {
    localStorage.removeItem('peak_platform_light');
    console.log('[Sync] Local storage cleared');
}