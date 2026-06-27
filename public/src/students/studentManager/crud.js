// src/students/studentManager/crud.js
// إدارة الطلاب: عرض، إضافة، حذف، تعديل
// [FIX] إضافة التحقق من maxStudents حسب خطة المعلم (ذهبي/فضي/مجاني/مطور)

import { 
    getStudents, getStudentById, addStudent as addStudentToFirestore, 
    updateStudent as updateStudentInFirestore, deleteStudent as deleteStudentFromFirestore,
    getTeacherStudentCount, canAddStudent
} from '../../services/dataService.js';
import { DEFAULT_IMG } from '../../constants.js';
import { refreshAllGradeSelects, updateUIAfterScoreChange } from '../../db/localstorage.js';
import { showFloatingNotification, escapeHtml, compressImage } from '../../utils.js';
import { incrementStat } from '../../landing/sections/liveStats.js';
import { getMaxStudents, getTeacherMonthlyUsage } from '../../services/subscriptionGuard.js'; // ✅ إضافة دوال الحدود

// ===================== عرض الطلاب =====================
export async function renderStudentsEdit(filterGrade = null) {
    let container = document.getElementById('edit-list');
    if (!container) return;
    
    let students = await getStudents();
    if (filterGrade && filterGrade !== 'all') {
        students = students.filter(s => s.grade === filterGrade);
    }
    
    container.className = 'student-card-grid';
    container.innerHTML = students.map(s => `
        <div class="student-card group" data-id="${s.id}">
            <img src="${s.img || DEFAULT_IMG}" alt="${escapeHtml(s.name)}">
            <div class="student-name">${escapeHtml(s.name)}</div>
            <div class="student-grade">${escapeHtml(s.grade)}</div>
            <div class="student-score">⭐ ${s.score || 0}</div>
            <div class="flex items-center justify-center gap-1 mt-1">
                <span class="text-xs text-gray-400">ID: ${s.id}</span>
                <button class="copy-id-btn" data-id="${s.id}" title="نسخ المعرف">📋</button>
            </div>
            <div class="student-actions">
                <button class="edit-student-btn" data-id="${s.id}" title="تعديل">✏️</button>
                <button class="delete-student-btn" data-id="${s.id}" title="حذف">🗑️</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.edit-student-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditStudentModal(btn.dataset.id);
        });
    });
    container.querySelectorAll('.delete-student-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteStudent(btn.dataset.id);
        });
    });
    container.querySelectorAll('.copy-id-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            navigator.clipboard.writeText(id).then(() => {
                btn.classList.add('copied');
                btn.innerHTML = '✓ تم';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = '📋';
                }, 1500);
            }).catch(() => showFloatingNotification('تعذر النسخ', 'error'));
        });
    });
}

// ===================== حذف طالب =====================
export async function deleteStudent(id) {
    const result = await Swal.fire({ 
        title: 'تأكيد الحذف', text: 'هل أنت متأكد من حذف هذا الطالب؟ سيتم حذف جميع إحصائياته أيضاً.', 
        icon: 'warning', showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء', 
        background: '#0f172a', color: '#fff' 
    });
    if (result.isConfirmed) {
        id = String(id);
        try {
            await deleteStudentFromFirestore(id);
            
            // ✅ نقص عدد الطلاب في الإحصائيات الحية
            await incrementStat('students', -1);
            
            await renderStudentsEdit(document.getElementById('student-grade-filter')?.value);
            refreshAllGradeSelects();
            if (window.currentPage === 'hall-page' && window.renderLeaderboard) window.renderLeaderboard();
            if (window.currentPage === 'stats-page') { 
                if (window.renderAdvancedStats) window.renderAdvancedStats(); 
                if (window.updateStudentSearchList) window.updateStudentSearchList(); 
            }
            showFloatingNotification('تم حذف الطالب وإحصائياته', 'success');
        } catch (error) {
            console.error(error);
            showFloatingNotification('فشل حذف الطالب', 'error');
        }
    }
}

// ===================== تحديث نقاط الطالب =====================
export async function updateStudentScore(studentId, scoreChange) {
    try {
        const student = await getStudentById(studentId);
        if (student) {
            const newScore = Math.max(0, (student.score || 0) + scoreChange);
            await updateStudentInFirestore(studentId, { score: newScore });
            await renderStudentsEdit(document.getElementById('student-grade-filter')?.value);
            updateUIAfterScoreChange();
        }
    } catch (error) {
        console.error(error);
        showFloatingNotification('فشل تحديث النقاط', 'error');
    }
}

// ===================== متغيرات مؤقتة لإضافة طالب =====================
let tempImgBase64 = DEFAULT_IMG;
let isAddingStudent = false;

if (typeof document !== 'undefined') {
    const imgInput = document.getElementById('new-img');
    if (imgInput) {
        imgInput.onchange = async (e) => {
            if (e.target.files[0]) { 
                tempImgBase64 = await compressImage(e.target.files[0]); 
                const preview = document.getElementById('img-preview');
                if (preview) {
                    preview.src = tempImgBase64; 
                    preview.classList.remove('hidden'); 
                }
            }
        };
    }
}

// ===================== إضافة طالب (مع التحقق من maxStudents حسب الخطة) =====================
export async function addStudent() {
    if (isAddingStudent) {
        console.log('⚠️ عملية إضافة طالب قيد التنفيذ بالفعل، تم تجاهل النقرة الثانية.');
        return;
    }
    
    const lockKey = 'add_student_lock';
    if (sessionStorage.getItem(lockKey) === 'true') {
        console.log('⚠️ عملية إضافة طالب قيد التنفيذ (من جلسة أخرى)، تم التجاهل.');
        return;
    }
    sessionStorage.setItem(lockKey, 'true');
    isAddingStudent = true;
    
    const addBtn = document.querySelector('[data-action="addStudent"], #addStudentBtn, .add-student-btn');
    let originalBtnText = '';
    if (addBtn) {
        originalBtnText = addBtn.innerHTML;
        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';
    }
    
    try {
        const name = document.getElementById('new-name').value.trim();
        const grade = document.getElementById('new-grade').value;
        if (!name) {
            showFloatingNotification('الاسم مطلوب', 'error');
            return;
        }
        let id = document.getElementById('new-id').value.trim() || Date.now().toString();
        
        const existingStudent = await getStudentById(id);
        if (existingStudent) {
            showFloatingNotification('المعرف موجود مسبقاً', 'error');
            return;
        }
        
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        if (!teacherCode) {
            showFloatingNotification('يجب تسجيل الدخول كمعلم أولاً', 'error');
            return;
        }
        
        // ✅ التحقق من الحد الأقصى للطلاب حسب خطة المعلم
        const currentCount = await getTeacherStudentCount(teacherCode);
        const maxAllowed = await getMaxStudents(teacherCode);
        
        if (currentCount >= maxAllowed) {
            const plan = sessionStorage.getItem('teacher_plan') || 'free';
            const planName = plan === 'free' ? 'المجانية' : (plan === 'silver' ? 'الفضية' : 'الذهبية');
            let message = `⚠️ لقد تجاوزت الحد الأقصى للطلاب في الباقة ${planName} (${maxAllowed} طالب).`;
            if (plan === 'free') {
                message += ' يمكنك الترقية إلى الباقة الفضية أو الذهبية لإضافة المزيد من الطلاب.';
            } else if (plan === 'silver') {
                message += ' يمكنك الترقية إلى الباقة الذهبية لإضافة عدد غير محدود من الطلاب.';
            }
            showFloatingNotification(message, 'error');
            return;
        }
        
        const teacherName = sessionStorage.getItem('peak_teacher_name') || 'معلم';
        const newStudent = { 
            id, name, grade, 
            img: tempImgBase64, 
            score: 0, 
            isTeacher: false, 
            teacherName, 
            teacherId: teacherCode 
        };
        
        await addStudentToFirestore(newStudent);
        
        // ✅ زيادة عدد الطلاب
        await incrementStat('students', 1);
        
        await renderStudentsEdit(document.getElementById('student-grade-filter')?.value);
        refreshAllGradeSelects();
        
        document.getElementById('new-name').value = ''; 
        document.getElementById('new-id').value = '';
        const preview = document.getElementById('img-preview');
        if (preview) preview.classList.add('hidden'); 
        tempImgBase64 = DEFAULT_IMG;
        showFloatingNotification('تم إضافة الطالب', 'success');
        
        setTimeout(() => {
            const cards = document.querySelectorAll('#edit-list .student-card');
            if (cards.length) {
                cards[cards.length-1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                cards[cards.length-1].classList.add('highlight-new');
                setTimeout(() => cards[cards.length-1].classList.remove('highlight-new'), 2000);
            }
        }, 100);
    } catch (error) {
        console.error('Error in addStudent:', error);
        showFloatingNotification('حدث خطأ أثناء إضافة الطالب', 'error');
    } finally {
        setTimeout(() => {
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.innerHTML = originalBtnText;
            }
            isAddingStudent = false;
            sessionStorage.removeItem('add_student_lock');
        }, 1000);
    }
}

// ===================== تعديل الطالب =====================
export async function openEditStudentModal(studentId) {
    const studentIdStr = String(studentId);
    let student = null;
    
    try {
        student = await getStudentById(studentIdStr);
        console.log('[openEditStudentModal] Student found via dataService:', student);
    } catch (err) {
        console.warn('[openEditStudentModal] Error fetching student:', err);
    }
    
    if (!student) {
        try {
            const { dbLight } = await import('../../db/localstorage.js');
            student = dbLight.students?.find(s => String(s.id) === studentIdStr);
            console.log('[openEditStudentModal] Student found in dbLight:', student);
        } catch (err) {
            console.warn('[openEditStudentModal] Error reading from dbLight:', err);
        }
    }
    
    if (!student) {
        showFloatingNotification(`الطالب غير موجود (ID: ${studentIdStr})`, 'error');
        console.error('[openEditStudentModal] Student not found with ID:', studentIdStr);
        return;
    }
    
    window.currentEditStudentId = studentIdStr;
    
    document.getElementById('edit-name-student').value = student.name;
    document.getElementById('edit-grade-student').value = student.grade;
    document.getElementById('edit-student-img-preview').src = student.img || DEFAULT_IMG;
    
    const modal = document.getElementById('edit-student-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.animation = 'fadeZoom 0.3s ease-out';
        
        let scoreDisplay = modal.querySelector('.student-current-score');
        if (!scoreDisplay) {
            const targetDiv = modal.querySelector('.border-t');
            if (targetDiv) {
                const displaySpan = document.createElement('div');
                displaySpan.className = 'student-current-score text-center mb-2 text-yellow-400 font-bold';
                displaySpan.innerText = `⭐ النقاط الحالية: ${student.score || 0}`;
                targetDiv.parentNode.insertBefore(displaySpan, targetDiv);
            }
        } else {
            scoreDisplay.innerText = `⭐ النقاط الحالية: ${student.score || 0}`;
        }
        
        const adjustBtns = modal.querySelectorAll('.adjustScoreBtn');
        adjustBtns.forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                const delta = parseInt(btn.dataset.score);
                if (window.currentEditStudentId) {
                    await updateStudentScore(window.currentEditStudentId, delta);
                    const updatedStudent = await getStudentById(window.currentEditStudentId);
                    if (updatedStudent) {
                        const scoreSpan = modal.querySelector('.student-current-score');
                        if (scoreSpan) scoreSpan.innerText = `⭐ النقاط الحالية: ${updatedStudent.score}`;
                    }
                }
            };
        });
    }
    
    refreshAllGradeSelects();
}

export function closeEditModal() {
    const modal = document.getElementById('edit-student-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    window.currentEditStudentId = null;
}

// ===================== حفظ التعديلات =====================
export async function updateStudentAfterEdit() {
    const newName = document.getElementById('edit-name-student').value.trim();
    const newGrade = document.getElementById('edit-grade-student').value;
    if (!newName) return showFloatingNotification('الاسم مطلوب', 'error');
    
    const imgPreview = document.getElementById('edit-student-img-preview');
    let newImg = null;
    if (imgPreview && imgPreview.src && !imgPreview.src.includes('default')) {
        let currentStudent = null;
        try {
            currentStudent = await getStudentById(window.currentEditStudentId);
        } catch (err) { console.warn(err); }
        if (currentStudent && imgPreview.src !== currentStudent.img) {
            newImg = imgPreview.src;
        }
    }
    
    if (window.currentEditStudentId) {
        const updates = { name: newName, grade: newGrade };
        if (newImg) updates.img = newImg;
        
        try {
            await updateStudentInFirestore(window.currentEditStudentId, updates);
            await renderStudentsEdit(document.getElementById('student-grade-filter')?.value);
            refreshAllGradeSelects();
            showFloatingNotification('تم تحديث بيانات الطالب', 'success');
            closeEditModal();
        } catch (error) {
            console.error(error);
            showFloatingNotification('فشل تحديث بيانات الطالب', 'error');
        }
    }
}

// ربط أزرار تعديل الصورة
if (typeof document !== 'undefined') {
    const editImgBtn = document.getElementById('edit-upload-img-btn');
    const editImgInput = document.getElementById('edit-img-file-input');
    const editResetBtn = document.getElementById('edit-reset-img-btn');
    if (editImgBtn && editImgInput) {
        editImgBtn.addEventListener('click', () => editImgInput.click());
        editImgInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                const compressed = await compressImage(e.target.files[0]);
                document.getElementById('edit-student-img-preview').src = compressed;
                if (window.currentEditStudentId) {
                    try {
                        await updateStudentInFirestore(window.currentEditStudentId, { img: compressed });
                        await renderStudentsEdit(document.getElementById('student-grade-filter')?.value);
                    } catch (err) { console.error(err); }
                }
            }
        });
    }
    if (editResetBtn) {
        editResetBtn.addEventListener('click', async () => {
            document.getElementById('edit-student-img-preview').src = DEFAULT_IMG;
            if (window.currentEditStudentId) {
                try {
                    await updateStudentInFirestore(window.currentEditStudentId, { img: DEFAULT_IMG });
                    await renderStudentsEdit(document.getElementById('student-grade-filter')?.value);
                } catch (err) { console.error(err); }
            }
        });
    }
}