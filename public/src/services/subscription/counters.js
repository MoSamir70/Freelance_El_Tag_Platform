// دوال العد والزيادة وإعادة الضبط الشهري
import { db, collection, query, where, getDocs, updateDoc } from '../../firebase/init.js';
import { getTeacherDocumentByCode, getTeacherSubscription, refreshTeacherPlanIfExpired, invalidateTeacherSubscriptionCache } from './teacherData.js';
import { loadQuestionsFromIndexedDB } from '../../db/indexeddb.js';
import { getAllGrades } from '../dataService/grades.js';

// عدد الطلاب للمعلم
export async function getTeacherStudentCount(teacherId) {
    const q = query(collection(db, 'students'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    return snapshot.size;
}

// عدد الأسئلة المرفوعة من قبل المعلم (من IndexedDB)
export async function getTeacherQuestionCount(teacherId) {
    let total = 0;
    const grades = await getAllGrades();
    for (const grade of grades) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        const teacherQuestions = questions.filter(q => q.teacherId === teacherId);
        total += teacherQuestions.length;
    }
    return total;
}

// زيادة عدد الغرف المنشأة هذا الشهر (للفضي فقط)
export async function incrementTeacherRoomCount(teacherCode) {
    await refreshTeacherPlanIfExpired(teacherCode);
    const sub = await getTeacherSubscription(teacherCode);
    if (sub.plan !== 'silver') return;
    const teacherDoc = await getTeacherDocumentByCode(teacherCode);
    if (!teacherDoc) return;
    const newCount = (sub.onlineRoomsUsedThisMonth || 0) + 1;
    await updateDoc(teacherDoc.ref, { onlineRoomsUsedThisMonth: newCount });
    invalidateTeacherSubscriptionCache(teacherCode);
    sessionStorage.setItem('teacher_online_rooms_used', newCount);
}

// زيادة العدد بناءً على معرف الطالب (للاستخدام في السباقات)
export async function incrementTeacherRoomCountForStudent(studentId) {
    const { getStudentById } = await import('../dataService/student.js');
    const student = await getStudentById(studentId);
    if (!student || !student.teacherId) return;
    await incrementTeacherRoomCount(student.teacherId);
}

// مرادف للدالة السابقة
export async function incrementOnlineGameCount(teacherCode) {
    return await incrementTeacherRoomCount(teacherCode);
}

// إعادة ضبط العداد الشهري إذا لزم الأمر (تُستدعى عند التحقق من الصلاحية)
export async function resetTeacherMonthlyCountersIfNeeded(teacherId) {
    const sub = await getTeacherSubscription(teacherId);
    const now = new Date();
    const lastReset = sub.lastResetDate ? new Date(sub.lastResetDate) : null;
    if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
        const teacherDoc = await getTeacherDocumentByCode(teacherId);
        if (teacherDoc) {
            await updateDoc(teacherDoc.ref, {
                onlineRoomsUsedThisMonth: 0,
                lastResetDate: now.toISOString()
            });
            invalidateTeacherSubscriptionCache(teacherId);
            sessionStorage.setItem('teacher_online_rooms_used', '0');
        }
    }
}