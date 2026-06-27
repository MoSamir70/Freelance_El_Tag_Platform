import { 
    db, collection, doc, getDocs, addDoc, setDoc, deleteDoc, writeBatch, query, where 
} from '../firebase/init.js';
import { loadQuestionsFromIndexedDB, saveQuestionsToIndexedDB } from '../db/indexeddb.js';
import { showLoading, hideLoading } from '../utils/helpers/loader.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';

const studentsCollection = collection(db, 'students');
const gameHistoryCollection = collection(db, 'gameHistory');
const customGradesCollection = collection(db, 'customGrades');
const teacherSubscriptionsCollection = collection(db, 'teacherSubscriptions');

export async function exportBackup() {
    showLoading();
    try {
        const teacherId = sessionStorage.getItem('peak_teacher_code');
        const backupData = {
            version: '1.0',
            timestamp: Date.now(),
            students: (await getDocs(query(studentsCollection, where('teacherId', '==', teacherId)))).docs.map(d => d.data()),
            gameHistory: (await getDocs(query(gameHistoryCollection, where('teacherId', '==', teacherId)))).docs.map(d => d.data()),
            customGrades: (await getDocs(customGradesCollection)).docs.map(d => d.data().name),
            teacherSubscriptions: (await getDocs(teacherSubscriptionsCollection)).docs.reduce((acc, d) => { acc[d.id] = d.data(); return acc; }, {}),
            questions: {}
        };
        const grades = [...new Set(backupData.customGrades.concat(backupData.students.map(s => s.grade)))];
        for (const grade of grades) {
            const questions = await loadQuestionsFromIndexedDB(grade);
            if (questions.length) backupData.questions[grade] = questions;
        }
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `platform_backup_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        hideLoading();
        showFloatingNotification('✅ تم تصدير النسخة الاحتياطية', 'success');
    } catch (error) {
        hideLoading();
        console.error(error);
        showFloatingNotification('❌ فشل التصدير', 'error');
    }
}

export async function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const result = await Swal.fire({
        title: '⚠️ تحذير',
        html: '<p style="color:#fca5a5;">سيتم استبدال جميع البيانات الحالية بالبيانات الموجودة في الملف.</p><p style="color:#facc15;">هل أنت متأكد؟</p>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، استيراد',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) { event.target.value = ''; return; }
    showLoading();
    try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (!backup.version || !backup.students) throw new Error('ملف غير صالح');
        const teacherId = sessionStorage.getItem('peak_teacher_code');
        const existingStudents = await getDocs(query(studentsCollection, where('teacherId', '==', teacherId)));
        const batch = writeBatch(db);
        existingStudents.forEach(d => batch.delete(d.ref));
        await batch.commit();
        for (const student of backup.students) {
            await setDoc(doc(studentsCollection, student.id), { ...student, teacherId });
        }
        for (const hist of backup.gameHistory) {
            await addDoc(gameHistoryCollection, { ...hist, teacherId });
        }
        const existingGrades = await getDocs(customGradesCollection);
        for (const g of existingGrades.docs) await deleteDoc(g.ref);
        for (const grade of backup.customGrades) {
            await addDoc(customGradesCollection, { name: grade });
        }
        if (backup.questions) {
            for (const [grade, questions] of Object.entries(backup.questions)) {
                await saveQuestionsToIndexedDB(grade, questions);
            }
        }
        hideLoading();
        showFloatingNotification('✅ تم الاستيراد، سيتم إعادة التحميل', 'success');
        setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
        hideLoading();
        showFloatingNotification('❌ فشل الاستيراد: ' + error.message, 'error');
    }
    event.target.value = '';
}