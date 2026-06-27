// src/admin/modern/students.js
// إدارة الطلاب – مع دعم صلاحيات المساعدين

import { db, collection, getDocs, doc, deleteDoc, writeBatch } from '../../firebase/init.js';
import { getTeachersList } from '../../firebase/auth.js';
import { getStudentById, updateStudent } from '../../services/dataService.js';
import { getAllStudents, showNotification, escapeHtml, showLoading, addAuditLog, EGYPT_GRADES, hasPermission, applyUIPermissions } from './utils.js';
import { renderDashboard } from './dashboard.js';

let currentStudentPage = 1;
let studentPerPage = 10;

// ========== العرض الرئيسي ==========
export async function renderStudents() {
    if (!hasPermission('students', 'view')) {
        document.getElementById('studentsPane').innerHTML = `
            <div class="glass-card p-5 text-center">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <h3 class="text-xl font-bold text-red-400">غير مصرح</h3>
                <p class="text-gray-400">ليس لديك صلاحية لعرض قائمة الطلاب.</p>
            </div>`;
        return;
    }
    showLoading('studentsPane');
    const teachers = await getTeachersList();
    const students = await getAllStudents();
    const html = `
        <div class="glass-card p-5">
            <div class="flex flex-wrap justify-between items-center mb-4">
                <h3 class="text-2xl font-bold text-yellow-400"><i class="fas fa-users ml-2"></i> قائمة الطلاب</h3>
                <button id="deleteAllStudentsBtn" class="btn-danger" data-perm="students.delete"><i class="fas fa-trash-alt"></i> حذف جميع الطلاب</button>
            </div>
            <div class="flex flex-wrap gap-3 mb-5">
                <select id="filterStudentGrade" class="filter-select"><option value="">جميع الصفوف</option>${EGYPT_GRADES.map(g => `<option value="${g}">${g}</option>`).join('')}</select>
                <select id="filterStudentTeacher" class="filter-select"><option value="">جميع المعلمين</option>${teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
                <input type="number" id="filterMinScore" class="filter-input w-28" placeholder="الحد الأدنى للنقاط">
                <input type="number" id="filterMaxScore" class="filter-input w-28" placeholder="الحد الأقصى للنقاط">
                <input type="text" id="searchStudent" class="filter-input flex-1" placeholder="🔍 بحث بالاسم أو المعرف">
                <select id="studentPerPageSelect" class="filter-select"><option value="10">10 صفوف</option><option value="20">20 صفاً</option><option value="50">50 صفاً</option></select>
                <button id="exportStudentsBtn" class="btn-secondary" data-perm="students.view"><i class="fas fa-file-excel"></i> تصدير</button>
            </div>
            <div class="overflow-x-auto"><table class="admin-table"><thead>责任<th>الصورة</th><th>الاسم</th><th>المعرف</th><th>الصف</th><th>النقاط</th><th>المعلم</th><th>الإجراءات</th></tr></thead><tbody id="studentsTableBody"></tbody></table></div>
            <div id="studentPagination" class="flex justify-center gap-2 mt-5"></div>
        </div>
    `;
    document.getElementById('studentsPane').innerHTML = html;
    applyUIPermissions();
    renderStudentsTable(students, teachers);
    document.getElementById('deleteAllStudentsBtn')?.addEventListener('click', () => confirmDeleteAllStudents());
    ['filterStudentGrade', 'filterStudentTeacher', 'filterMinScore', 'filterMaxScore', 'searchStudent', 'studentPerPageSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { currentStudentPage = 1; renderStudentsTable(students, teachers); });
        if (el && (id === 'filterMinScore' || id === 'filterMaxScore' || id === 'searchStudent')) el.addEventListener('input', () => { currentStudentPage = 1; renderStudentsTable(students, teachers); });
    });
    document.getElementById('exportStudentsBtn')?.addEventListener('click', () => exportStudentsToExcel());
}

// ========== عرض الجدول ==========
export function renderStudentsTable(allStudents, allTeachers) {
    const grade = document.getElementById('filterStudentGrade')?.value || '';
    const teacherId = document.getElementById('filterStudentTeacher')?.value || '';
    const minScore = parseInt(document.getElementById('filterMinScore')?.value) || 0;
    const maxScore = parseInt(document.getElementById('filterMaxScore')?.value) || 999999;
    const search = (document.getElementById('searchStudent')?.value || '').toLowerCase();
    const perPage = parseInt(document.getElementById('studentPerPageSelect')?.value) || 10;
    const teacherMap = Object.fromEntries(allTeachers.map(t => [t.id, t.name]));
    let filtered = allStudents.filter(s => {
        if (grade && s.grade !== grade) return false;
        if (teacherId && s.teacherId !== teacherId) return false;
        const score = s.score || 0;
        if (score < minScore || score > maxScore) return false;
        if (search && !s.name.toLowerCase().includes(search) && !s.id.toLowerCase().includes(search)) return false;
        return true;
    });
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    const totalPages = Math.ceil(filtered.length / perPage);
    const start = (currentStudentPage - 1) * perPage;
    const paginated = filtered.slice(start, start + perPage);
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
        tbody.innerHTML = paginated.map(s => {
            const hasValidImg = s.img && s.img !== 'undefined' && s.img.startsWith('data:image');
            const canEdit = hasPermission('students', 'edit');
            const canDelete = hasPermission('students', 'delete');
            return `
            <tr>
                <td>${hasValidImg ? `<img src="${s.img}" class="w-9 h-9 rounded-full object-cover border border-yellow-500 premium-avatar">` : `<div class="w-9 h-9 rounded-full border-2 border-red-500 bg-red-900/30 flex items-center justify-center text-[10px] text-red-300 font-bold" title="صورة مفقودة">!</div>`}</td>
                <td><span class="font-bold">${escapeHtml(s.name)}</span></td>
                <td>${s.id}</td>
                <td class="whitespace-nowrap">${s.grade || '-'}</td>
                <td class="text-yellow-400 font-bold">⭐ ${s.score || 0}</td>
                <td>${teacherMap[s.teacherId] || '-'}</td>
                <td>
                    ${canEdit ? `<button class="editStudentBtn text-green-400" data-id="${s.id}" title="تعديل النقاط"><i class="fas fa-edit"></i></button>` : ''}
                    ${canDelete ? `<button class="deleteStudentBtn text-red-400" data-id="${s.id}" title="حذف"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('');
    }
    const paginationDiv = document.getElementById('studentPagination');
    if (paginationDiv) {
        let btns = '';
        for (let i = 1; i <= totalPages; i++) {
            btns += `<button class="page-btn-student ${i === currentStudentPage ? 'bg-yellow-500 text-black' : 'bg-gray-700'} px-3 py-1 rounded-full mx-1" data-page="${i}">${i}</button>`;
        }
        paginationDiv.innerHTML = btns;
        document.querySelectorAll('.page-btn-student').forEach(btn => btn.addEventListener('click', (e) => {
            currentStudentPage = parseInt(e.target.dataset.page);
            renderStudentsTable(allStudents, allTeachers);
        }));
    }
    document.querySelectorAll('.editStudentBtn').forEach(btn => btn.addEventListener('click', () => editStudent(btn.dataset.id)));
    document.querySelectorAll('.deleteStudentBtn').forEach(btn => btn.addEventListener('click', () => deleteStudent(btn.dataset.id)));
    applyUIPermissions();
}

// ========== تعديل نقاط الطالب ==========
export async function editStudent(studentId) {
    if (!hasPermission('students', 'edit')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لتعديل نقاط الطالب', 'error');
        return;
    }
    const student = await getStudentById(studentId);
    if (!student) return;
    const { value: newScore } = await Swal.fire({
        title: `تعديل نقاط ${escapeHtml(student.name)}`,
        input: 'number', inputValue: student.score || 0, inputLabel: 'أدخل عدد النقاط الجديد', inputAttributes: { min: 0, step: 5 },
        showCancelButton: true, confirmButtonText: 'تحديث', background: '#0f172a', color: '#fff'
    });
    if (newScore !== undefined) {
        await updateStudent(studentId, { score: parseInt(newScore) });
        await addAuditLog('تعديل نقاط طالب', `${student.name} -> ${newScore}`);
        Swal.fire('تم التحديث', '', 'success');
        showNotification(`⭐ تم تعديل نقاط الطالب ${student.name} إلى ${newScore}`, 'success');
        await renderStudents();
    }
}

// ========== حذف طالب فردي ==========
export async function deleteStudent(studentId) {
    if (!hasPermission('students', 'delete')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لحذف الطالب', 'error');
        return;
    }
    const confirm = await Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من حذف هذا الطالب؟',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff'
    });
    if (confirm.isConfirmed) {
        await deleteDoc(doc(db, 'students', studentId));
        await deleteDoc(doc(db, 'studentStats', studentId));
        await addAuditLog('حذف طالب', studentId);
        Swal.fire('تم الحذف', '', 'success');
        showNotification(`🗑️ تم حذف الطالب`, 'success');
        await renderStudents();
        await renderDashboard();
    }
}

// ========== حذف جميع الطلاب ==========
export async function confirmDeleteAllStudents() {
    if (!hasPermission('students', 'delete')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لحذف جميع الطلاب', 'error');
        return;
    }
    const result = await Swal.fire({
        title: '⚠️ تأكيد حذف جميع الطلاب',
        text: 'سيتم حذف جميع الطلاب من جميع المعلمين. لا يمكن التراجع!',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'نعم، احذف الجميع',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff'
    });
    if (result.isConfirmed) {
        Swal.fire({ title: 'جارٍ الحذف...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const students = await getAllStudents();
        const batch = writeBatch(db);
        students.forEach(s => {
            batch.delete(doc(db, 'students', s.id));
            batch.delete(doc(db, 'studentStats', s.id));
        });
        await batch.commit();
        await addAuditLog('حذف جميع الطلاب', 'تم حذف كل الطلاب');
        Swal.fire('تم الحذف', 'تم حذف جميع الطلاب', 'success');
        showNotification('🗑️ تم حذف جميع الطلاب', 'warning');
        await renderStudents();
        await renderDashboard();
    }
}

// ========== تصدير الطلاب إلى Excel ==========
export async function exportStudentsToExcel() {
    if (!hasPermission('students', 'view')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لتصدير الطلاب', 'error');
        return;
    }
    const students = await getAllStudents();
    const teachers = await getTeachersList();
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.name]));
    const wsData = students.map(s => ({
        'الاسم': s.name, 'المعرف': s.id, 'الصف': s.grade, 'النقاط': s.score, 'المعلم': teacherMap[s.teacherId] || ''
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
    XLSX.writeFile(wb, `طلاب_المنصة.xlsx`);
    showNotification('📥 تم تصدير قائمة الطلاب إلى Excel', 'success');
}