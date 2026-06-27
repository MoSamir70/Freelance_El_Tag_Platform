// src/teacher/grades.js
// إدارة الصفوف الدراسية (إضافة، حذف، إعادة تسمية) – معدلة لاستخدام dataService و Firebase
// ✅ تم إزالة الاستدعاءات اليدوية refreshAllGradeSelects و renderGradesManagement
//   لأن المستمع الحي في main.js (onSnapshot) يقوم بتحديث الواجهة تلقائياً.
// [FIX] إزالة التعديل المباشر على dbLight – استخدام دوال dataService
// [FIX] إضافة مزامنة مع Firebase بعد كل عملية
// [FIX] حذف الأسئلة المرتبطة بالصف عند حذف الصف
// [FIX] تحديث الطلاب والصفوف المخصصة بشكل صحيح

import { getStudents, getAllGrades, getQuestions, saveQuestions, deleteQuestions, addCustomGrade, removeCustomGrade, updateStudent, deleteStudent } from '../services/dataService.js';
import { showFloatingNotification } from '../utils.js';
import { renderLeaderboard } from '../students/leaderboard.js';
import { DEFAULT_GRADES } from '../constants.js';
import { raceSettings } from '../core/raceSettings.js';
import { syncAllToFirebase } from '../firebase/sync.js';
import { refreshAllGradeSelects } from '../db/localstorage.js';

export async function renderGradesManagement() {
    let container = document.getElementById('grades-management-list');
    if (!container) return;
    const grades = await getAllGrades();
    container.innerHTML = grades.length === 0 
        ? '<div class="text-gray-400 text-center">لا توجد صفوف مسجلة</div>' 
        : grades.map(g => `
            <div class="grade-manager-item glass-panel p-3 flex justify-between items-center">
                <span class="text-lg font-bold text-yellow-400">${g}</span>
                <div class="flex gap-2">
                    <button data-action="renameGrade" data-grade="${g}" class="bg-blue-600 px-4 py-1 rounded-full text-sm">✏️ تغيير الاسم</button>
                    <button data-action="deleteGrade" data-grade="${g}" class="bg-red-700 px-4 py-1 rounded-full text-sm">🗑️ حذف الصف</button>
                </div>
            </div>
        `).join('');
}


export async function addNewGrade() {
    const input = document.getElementById('new-grade-name');
    const name = input ? input.value.trim() : '';
    if (!name) return showFloatingNotification('الرجاء إدخال اسم الصف', 'error');
    const grades = await getAllGrades();
    if (grades.includes(name)) return showFloatingNotification(`الصف "${name}" موجود بالفعل`, 'error');
    
    // ✅ إضافة الصف إلى Firestore فقط (المستمع الحي سيقوم بتحديث localStorage والواجهة)
    await addCustomGrade(name);
    
    // إنشاء مخزن أسئلة فارغ للصف الجديد في IndexedDB
    await saveQuestions(name, []);
    
    // ✅ إزالة التحديث اليدوي: refreshAllGradeSelects() و renderGradesManagement() محذوفان
    // لأن onSnapshot في main.js يقوم بتحديث القوائم تلقائياً
    
    showFloatingNotification(`تم إضافة الصف "${name}"`, 'success');
    input.value = '';
    
    // مزامنة مع Firebase (اختياري)
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    if (teacherCode) await syncAllToFirebase(teacherCode);
}

export async function renameGrade(oldName, newName) {
    if (oldName === newName || !newName.trim()) return showFloatingNotification('الاسم الجديد لا يمكن أن يكون فارغاً', 'error');
    const grades = await getAllGrades();
    if (grades.includes(newName)) return showFloatingNotification(`اسم الصف "${newName}" موجود بالفعل.`, 'error');

    // 1. تحديث الطلاب
    const students = await getStudents();
    for (const s of students) {
        if (s.grade === oldName) {
            await updateStudent(s.id, { grade: newName });
        }
    }

    // 2. تحديث customGrades في Firebase: إزالة القديم وإضافة الجديد
    await removeCustomGrade(oldName);
    await addCustomGrade(newName);

    // 3. نقل الأسئلة من IndexedDB
    const oldQuestions = await getQuestions(oldName);
    await saveQuestions(newName, oldQuestions);
    await deleteQuestions(oldName);

    // 4. تحديث raceSettings إذا كان الصف نشطاً
    if (raceSettings && raceSettings.grade === oldName) {
        raceSettings.grade = newName;
    }

    // 5. مزامنة مع Firebase
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    if (teacherCode) await syncAllToFirebase(teacherCode);

    // ✅ إزالة التحديثات اليدوية: refreshAllGradeSelects(), renderGradesManagement(), renderLeaderboard()، إلخ.
    // (المستمع الحي سيقوم بتحديث القوائم وعناصر الواجهة المعتمدة على الصفوف)
    
    showFloatingNotification(`تم تغيير مسمى الصف إلى "${newName}"`, 'success');
}

export async function deleteGrade(grade) {
    // منع حذف الصفوف الافتراضية
    if (DEFAULT_GRADES.includes(grade)) {
        showFloatingNotification(`لا يمكن حذف الصف "${grade}" لأنه من الصفوف الافتراضية للمنصة.`, 'error');
        return;
    }
    const result = await Swal.fire({
        title: `حذف الصف "${grade}"`,
        text: "سيتم حذف جميع الطلاب والأسئلة المرتبطة بهذا الصف. هل أنت متأكد؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff'
    });
    if (result.isConfirmed) {
        // 1. حذف الطلاب المرتبطين بهذا الصف
        const students = await getStudents();
        const studentsToDelete = students.filter(s => s.grade === grade);
        for (const s of studentsToDelete) {
            await deleteStudent(s.id);
        }

        // 2. إزالة الصف من customGrades في Firebase
        await removeCustomGrade(grade);

        // 3. حذف الأسئلة الخاصة بهذا الصف من IndexedDB و Firestore
        await deleteQuestions(grade);

        // 4. مزامنة التغييرات مع Firebase
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        if (teacherCode) await syncAllToFirebase(teacherCode);

        // ✅ إزالة التحديثات اليدوية للواجهة (كلها تُحدث تلقائياً عبر onSnapshot)
        
        showFloatingNotification(`تم حذف الصف "${grade}" بنجاح`, 'success');
    }
}