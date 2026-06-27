// src/services/dataService/grades.js
// إدارة الصفوف المخصصة
import { db, doc, getDoc, setDoc } from '../../firebase/init.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { getCurrentTeacherId } from './helpers.js';
import { getStudents } from './student.js';

export async function getAllGrades() {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) return [];
    
    const gradesDoc = await getDoc(doc(db, 'customGrades', teacherId));
    let customGrades = gradesDoc.exists() ? gradesDoc.data().grades || [] : [];
    
    const students = await getStudents();
    const gradesSet = new Set(customGrades);
    students.forEach(s => { if (s.grade) gradesSet.add(s.grade); });
    
    const DEFAULT_GRADES = [
        "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
        "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
        "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
        "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"
    ];
    DEFAULT_GRADES.forEach(g => gradesSet.add(g));
    
    return Array.from(gradesSet);
}

export async function addCustomGrade(grade) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) return;
    const gradesDoc = await getDoc(doc(db, 'customGrades', teacherId));
    let grades = gradesDoc.exists() ? gradesDoc.data().grades || [] : [];
    if (!grades.includes(grade)) {
        grades.push(grade);
        await setDoc(doc(db, 'customGrades', teacherId), { grades }, { merge: true });
        showFloatingNotification(`تم إضافة الصف ${grade}`, 'success');
    }
}

export async function removeCustomGrade(grade) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) return;
    const gradesDoc = await getDoc(doc(db, 'customGrades', teacherId));
    let grades = gradesDoc.exists() ? gradesDoc.data().grades || [] : [];
    grades = grades.filter(g => g !== grade);
    await setDoc(doc(db, 'customGrades', teacherId), { grades }, { merge: true });
    showFloatingNotification(`تم حذف الصف ${grade}`, 'success');
}