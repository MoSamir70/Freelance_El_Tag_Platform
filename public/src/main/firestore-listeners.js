import { 
    db, collection, doc, query, where, orderBy, onSnapshot 
} from '../firebase/init.js';
import { dbLight, saveLightData } from '../db/localstorage.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';

// مراجع المجموعات
const studentsCollection = collection(db, 'students');
const gameHistoryCollection = collection(db, 'gameHistory');
const customGradesCollection = collection(db, 'customGrades');
const teacherSubscriptionsCollection = collection(db, 'teacherSubscriptions');
const studentStatsCollection = collection(db, 'studentStats');

// متغيرات المستمعات الحية
let studentsUnsubscribe = null;
let gameHistoryUnsubscribe = null;
let customGradesUnsubscribe = null;
let teacherSubscriptionsUnsubscribe = null;
let studentStatsUnsubscribe = null;

// دالة تنظيف جميع المستمعات
export function _cleanupFirestoreListeners() {
    if (studentsUnsubscribe) {
        studentsUnsubscribe();
        studentsUnsubscribe = null;
    }
    if (gameHistoryUnsubscribe) {
        gameHistoryUnsubscribe();
        gameHistoryUnsubscribe = null;
    }
    if (customGradesUnsubscribe) {
        customGradesUnsubscribe();
        customGradesUnsubscribe = null;
    }
    if (teacherSubscriptionsUnsubscribe) {
        teacherSubscriptionsUnsubscribe();
        teacherSubscriptionsUnsubscribe = null;
    }
    if (studentStatsUnsubscribe) {
        studentStatsUnsubscribe();
        studentStatsUnsubscribe = null;
    }
    console.log('[Firestore] All listeners cleaned up');
}

// إعداد مستمعات Firestore الحية للمعلم
export function setupFirestoreListeners(teacherId = null) {
    _cleanupFirestoreListeners();
    if (!teacherId) return;
    
    const qStudents = query(studentsCollection, where('teacherId', '==', teacherId));
    studentsUnsubscribe = onSnapshot(qStudents, (snapshot) => {
        const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLight.students = students;
        saveLightData();
        if (typeof renderStudentsEdit === 'function') {
            const filter = document.getElementById('student-grade-filter');
            renderStudentsEdit(filter?.value);
        }
        if (typeof renderLeaderboard === 'function') renderLeaderboard();
        if (typeof renderAdvancedStatsRedirect === 'function' && document.getElementById('teacher-stats')) {
            renderAdvancedStatsRedirect();
        }
        if (typeof renderStudentSelect === 'function') renderStudentSelect();
        console.log('[Firestore] Students updated:', students.length);
    }, (error) => {
        console.error('[Firestore] Students listener error:', error);
        showFloatingNotification('خطأ في مزامنة الطلاب: ' + error.message, 'error');
    });
    
    studentStatsUnsubscribe = onSnapshot(studentStatsCollection, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            const stats = change.doc.data();
            dbLight.studentStats[change.doc.id] = stats;
        });
        saveLightData();
        if (typeof renderLeaderboard === 'function') renderLeaderboard();
        if (typeof renderAdvancedStatsRedirect === 'function' && document.getElementById('teacher-stats')) {
            renderAdvancedStatsRedirect();
        }
    }, (error) => {
        console.error('[Firestore] StudentStats listener error:', error);
    });
    
    const qHist = query(gameHistoryCollection, where('teacherId', '==', teacherId), orderBy('timestamp', 'desc'));
    gameHistoryUnsubscribe = onSnapshot(qHist, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLight.gameHistory = history;
        saveLightData();
        if (typeof renderAdvancedStatsRedirect === 'function' && document.getElementById('teacher-stats')) {
            renderAdvancedStatsRedirect();
        }
        if (typeof renderLeaderboard === 'function') renderLeaderboard();
    }, (error) => {
        console.error('[Firestore] GameHistory listener error:', error);
    });
    
    customGradesUnsubscribe = onSnapshot(customGradesCollection, (snapshot) => {
        const customGrades = snapshot.docs.map(doc => doc.data().name);
        dbLight.customGrades = customGrades;
        saveLightData();
        refreshAllGradeSelects();
        if (typeof renderGradesManagement === 'function') renderGradesManagement();
    }, (error) => {
        console.error('[Firestore] CustomGrades listener error:', error);
    });
    
    const subDoc = doc(teacherSubscriptionsCollection, teacherId);
    teacherSubscriptionsUnsubscribe = onSnapshot(subDoc, (docSnap) => {
        if (!dbLight.teacherSubscriptions) dbLight.teacherSubscriptions = {};
        dbLight.teacherSubscriptions[teacherId] = docSnap.data();
        saveLightData();
        if (typeof renderSubscriptionCard === 'function') renderSubscriptionCard(teacherId);
    }, (error) => {
        console.error('[Firestore] TeacherSubscriptions listener error:', error);
    });
}

// مستمع إحصائيات الطالب (للوحة الطالب)
export function setupStudentStatsListener(studentId) {
    if (studentStatsUnsubscribe) studentStatsUnsubscribe();
    if (!studentId) return;
    const statsRef = doc(studentStatsCollection, studentId);
    studentStatsUnsubscribe = onSnapshot(statsRef, (docSnap) => {
        if (docSnap.exists()) {
            const stats = docSnap.data();
            if (typeof window.updateStudentDashboard === 'function') {
                window.updateStudentDashboard(studentId, stats);
            }
            dbLight.studentStats[studentId] = stats;
            saveLightData();
            console.log('[Firestore] Student stats updated for', studentId);
        }
    }, (error) => {
        console.error('[Firestore] StudentStats listener error:', error);
    });
}

// استيرادات للدوال المستخدمة ولكنها معرفة في مكان آخر (سيتم ربطها لاحقاً)
import { refreshAllGradeSelects } from '../db/localstorage.js';
// هذه الدوال سيتم توفيرها من registration.js أو من خلال window
// لكننا نستخدمها داخل onSnapshot، لذا سنفترض وجودها
function renderStudentsEdit() {}
function renderLeaderboard() {}
function renderAdvancedStatsRedirect() {}
function renderStudentSelect() {}
function renderGradesManagement() {}
function renderSubscriptionCard() {}