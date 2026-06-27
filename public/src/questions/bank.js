// src/questions/bank.js
// بنك الأسئلة: عرض المواد والإحصائيات، حذف الأسئلة/الدروس/المواد، تصفير البنك
// [FIX] تصحيح استيراد getTeacherPlan و getLockedSubject من dataService
// [FIX] إزالة الاعتماد على subscriptionGuard.js (إضافة دوال مساعدة داخلية)
// [FIX] إصلاح deleteQuestion للتعامل مع الأسئلة القديمة (استخدام id كبديل)
// [FIX] إضافة معالج لأزرار التعديل
// [FIX] تحسين معالجة الأخطاء

import { getQuestions, saveQuestions, deleteQuestions } from '../services/dataService.js';
import { showFloatingNotification, escapeHtml } from '../utils.js';
import { syncAllToFirebase } from '../firebase/sync.js';
import { getCurrentUserInfo } from '../firebase/auth.js';

// ✅ استيراد getTeacherPlan و getLockedSubject من dataService (المسار الصحيح)
import { 
    getTeacherPlan, 
    getLockedSubject,
    canUploadQuestions,
    setLockedSubject,
    updateTeacherTotalQuestions,
    invalidateTeacherSubscriptionCache
} from '../services/dataService.js';

// دوال مساعدة داخلية (بديل عن subscriptionGuard.js)
async function checkTeacherAccessSafe(teacherCode) {
    try {
        const user = await getCurrentUserInfo();
        if (user && user.isDeveloper) return { allowed: true };
        const plan = await getTeacherPlan(teacherCode);
        const expiry = sessionStorage.getItem('teacher_expiry');
        if (expiry && new Date(expiry) < new Date()) {
            return { allowed: false, message: 'انتهت صلاحية الاشتراك' };
        }
        return { allowed: true };
    } catch(e) {
        console.warn('checkTeacherAccessSafe error:', e);
        return { allowed: true };
    }
}

function getMaxQuestionsSafe(teacherPlan) {
    switch(teacherPlan) {
        case 'free': return 150;
        case 'silver': return 1000;
        case 'gold': return Infinity;
        case 'developer': return Infinity;
        default: return 150;
    }
}

// استيراد incrementStat بشكل اختياري
let incrementStat = async () => {};
try {
    const statsModule = await import('../landing/sections/liveStats.js');
    if (statsModule.incrementStat) incrementStat = statsModule.incrementStat;
} catch(e) { console.warn('liveStats not available'); }

// ===================== عرض المواد والإحصائيات لصف معين =====================
export async function renderSubjectsForGrade(grade) {
    let container = document.getElementById('subjects-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10"><div class="loading-spinner"></div> جاري تحميل الإحصائيات...</div>';
    
    let questions = [];
    try {
        questions = await getQuestions(grade);
    } catch(e) {
        console.error('Failed to load questions:', e);
        container.innerHTML = '<div class="text-center text-red-400 py-10">حدث خطأ في تحميل الأسئلة</div>';
        return;
    }
    
    const totalSpan = document.getElementById('total-questions-bank');
    if (totalSpan) totalSpan.innerText = questions.length;
    
    if (questions.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد أسئلة في هذا الصف بعد. قم برفع ملف Excel.</div>';
        return;
    }

    // تجميع البيانات لكل مادة
    let subjectsMap = new Map();
    for (let q of questions) {
        let subject = q.subject || 'عام';
        let lesson = q.lesson || 'بدون درس';
        let cat = q.cat || 'عام';
        let diff = q.difficulty || 'متوسط';

        if (!subjectsMap.has(subject)) {
            subjectsMap.set(subject, { total: 0, types: {}, levels: {}, lessons: new Map() });
        }
        let subj = subjectsMap.get(subject);
        subj.total++;
        subj.types[cat] = (subj.types[cat] || 0) + 1;
        subj.levels[diff] = (subj.levels[diff] || 0) + 1;
        subj.lessons.set(lesson, (subj.lessons.get(lesson) || 0) + 1);
    }

    let teacherPlan = 'free';
    let lockedSubject = null;
    try {
        teacherPlan = await getTeacherPlan();
        lockedSubject = await getLockedSubject();
    } catch(e) { console.warn('Failed to get plan/locked:', e); }
    
    const isFreeOrSilver = (teacherPlan === 'free' || teacherPlan === 'silver');
    
    let html = '';
    for (let [subject, data] of subjectsMap) {
        let typesHtml = '';
        for (let [type, count] of Object.entries(data.types)) {
            let percent = Math.round((count / data.total) * 100);
            let colorClass = percent <= 30 ? 'low' : (percent <= 70 ? 'mid' : 'high');
            typesHtml += `
                <div class="stat-item">
                    <div class="stat-label"><span>${escapeHtml(type)}</span><span>${count}</span></div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill ${colorClass}" data-width="${percent}%" style="width:0%"></div></div>
                </div>`;
        }
        let levelsHtml = '';
        for (let [level, count] of Object.entries(data.levels)) {
            let percent = Math.round((count / data.total) * 100);
            let colorClass = percent <= 30 ? 'low' : (percent <= 70 ? 'mid' : 'high');
            levelsHtml += `
                <div class="stat-item">
                    <div class="stat-label"><span>${escapeHtml(level)}</span><span>${count}</span></div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill ${colorClass}" data-width="${percent}%" style="width:0%"></div></div>
                </div>`;
        }
        let lessonsHtml = `<div class="lesson-chip" data-grade="${escapeHtml(grade)}" data-subject="${escapeHtml(subject)}" style="cursor:pointer;">📖 الدروس (${data.lessons.size})</div>`;

        const showDeleteBtn = (!isFreeOrSilver || (isFreeOrSilver && lockedSubject === subject));
        const deleteButtonHtml = showDeleteBtn 
            ? `<button data-action="deleteSubject" data-grade="${escapeHtml(grade)}" data-subject="${escapeHtml(subject)}" class="delete-subject-btn bg-red-700/60 px-3 py-1 rounded-full text-xs hover:bg-red-600 transition">❌ حذف المادة</button>`
            : '<span class="text-gray-500 text-xs">🔒 لا يمكن حذف المادة الأساسية</span>';

        html += `
            <div class="subject-stats-card">
                <div class="subject-card-header">
                    <h3>📚 ${escapeHtml(subject)} <span style="font-size:1rem;color:#94a3b8;">(${data.total} سؤال)</span></h3>
                    ${deleteButtonHtml}
                </div>
                <div class="stat-section">
                    <div class="stat-section-title">📂 الأنواع</div>
                    <div class="stat-row">${typesHtml}</div>
                </div>
                <div class="stat-section">
                    <div class="stat-section-title">⚡ المستويات</div>
                    <div class="stat-row">${levelsHtml}</div>
                </div>
                <div class="stat-section">
                    <div class="stat-section-title">📖 الدروس</div>
                    <div class="lessons-chips">${lessonsHtml}</div>
                </div>
            </div>`;
    }
    container.innerHTML = html;

    // ✅ ربط الأحداث مباشرة بعد إدراج HTML (الحل الجذري)
    container.querySelectorAll('.delete-subject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const grade = btn.dataset.grade;
            const subject = btn.dataset.subject;
            if (grade && subject) {
                await deleteSubject(grade, subject);
            } else {
                showFloatingNotification('بيانات غير مكتملة للحذف', 'error');
            }
        });
    });

    // ربط أحداث الدروس
    container.querySelectorAll('.lesson-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            let g = chip.dataset.grade;
            let s = chip.dataset.subject;
            if (window.showLessonsList) window.showLessonsList(g, s);
        });
    });

    requestAnimationFrame(() => {
        document.querySelectorAll('.stat-bar-fill').forEach(bar => {
            const targetWidth = bar.getAttribute('data-width');
            if (targetWidth) bar.style.width = targetWidth;
        });
    });
}

// ===================== حذف سؤال فردي =====================
export async function deleteQuestion(grade, qid) {
    const result = await Swal.fire({ 
        title: 'تأكيد الحذف', 
        text: 'هل أنت متأكد من حذف هذا السؤال؟', 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonText: 'نعم', 
        cancelButtonText: 'إلغاء', 
        background: '#0f172a', 
        color: '#fff' 
    });
    if (result.isConfirmed) {
        try {
            let questions = await getQuestions(grade);
            // محاولة الحذف باستخدام uniqueId أو id
            const filtered = questions.filter(q => {
                const qIdentifier = q.uniqueId || q.id;
                return String(qIdentifier) !== String(qid);
            });
            if (filtered.length === questions.length) {
                showFloatingNotification('السؤال غير موجود', 'error');
                return;
            }
            await saveQuestions(grade, filtered);
            
            try { await incrementStat('questions', -1); } catch(e) {}
            
            await renderSubjectsForGrade(grade);
            showFloatingNotification('تم حذف السؤال', 'info');
            
            const teacherCode = sessionStorage.getItem('peak_teacher_code');
            if (teacherCode) syncAllToFirebase(teacherCode);
        } catch (error) {
            console.error(error);
            showFloatingNotification('فشل حذف السؤال', 'error');
        }
    }
}

// ===================== حذف درس كامل =====================
export async function deleteLesson(grade, subject, lesson) {
    const result = await Swal.fire({ 
        title: 'تأكيد الحذف', 
        text: `هل أنت متأكد من حذف الدرس "${lesson}" بالكامل؟`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonText: 'نعم', 
        cancelButtonText: 'إلغاء', 
        background: '#0f172a', 
        color: '#fff' 
    });
    if (result.isConfirmed) {
        try {
            let questions = await getQuestions(grade);
            const originalCount = questions.length;
            const filtered = questions.filter(q => !(q.subject === subject && q.lesson === lesson));
            const deletedCount = originalCount - filtered.length;
            await saveQuestions(grade, filtered);
            
            if (deletedCount > 0) try { await incrementStat('questions', -deletedCount); } catch(e) {}
            
            await renderSubjectsForGrade(grade);
            showFloatingNotification('تم حذف الدرس', 'info');
            
            const teacherCode = sessionStorage.getItem('peak_teacher_code');
            if (teacherCode) syncAllToFirebase(teacherCode);
        } catch (error) {
            console.error(error);
            showFloatingNotification('فشل حذف الدرس', 'error');
        }
    }
}

// ===================== حذف مادة كاملة =====================
export async function deleteSubject(grade, subject) {
        console.log('[deleteSubject] Called with:', { grade, subject });

    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    if (teacherCode) {
        const access = await checkTeacherAccessSafe(teacherCode);
        if (!access.allowed) {
            showFloatingNotification(access.message, 'error');
            return;
        }
    }
      let teacherPlan = 'free';
    let lockedSubject = null;
    try {
        teacherPlan = await getTeacherPlan();
        lockedSubject = await getLockedSubject();
        console.log('[deleteSubject] plan:', teacherPlan, 'lockedSubject:', lockedSubject);
    } catch(e) {
        console.error('[deleteSubject] Error getting plan/locked:', e);
    }
    
    if ((teacherPlan === 'free' || teacherPlan === 'silver') && lockedSubject === subject) {
        console.log('[deleteSubject] Cannot delete locked subject');
        showFloatingNotification('لا يمكن حذف المادة الأساسية المقفلة. للترقية للذهبية.', 'error');
        return;
    }
    
    const result = await Swal.fire({ 
        title: 'تأكيد الحذف', 
        text: `هل أنت متأكد من حذف المادة "${subject}" بالكامل؟`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonText: 'نعم', 
        cancelButtonText: 'إلغاء', 
        background: '#0f172a', 
        color: '#fff' 
    });
    if (result.isConfirmed) {
        try {
            let questions = await getQuestions(grade);
            const originalCount = questions.length;
            const filtered = questions.filter(q => q.subject !== subject);
            const deletedCount = originalCount - filtered.length;
            await saveQuestions(grade, filtered);
              
            if (deletedCount > 0) try { await incrementStat('questions', -deletedCount); } catch(e) {}
            
            await renderSubjectsForGrade(grade);
            showFloatingNotification('تم حذف المادة', 'info');
            
            const teacherCode = sessionStorage.getItem('peak_teacher_code');
            if (teacherCode) syncAllToFirebase(teacherCode);
        } catch (error) {
            console.error(error);
            showFloatingNotification('فشل حذف المادة', 'error');
        }
    }
}

// ===================== تصفير بنك الأسئلة بالكامل لصف معين =====================
export async function resetBank(grade) {
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    if (teacherCode) {
        const access = await checkTeacherAccessSafe(teacherCode);
        if (!access.allowed) {
            showFloatingNotification(access.message, 'error');
            return;
        }
    }
    const result = await Swal.fire({
        title: 'تصفير بنك الأسئلة',
        html: `
            <div style="text-align: center; padding: 0.5rem;">
                <p style="font-size: 1.1rem; color: #fca5a5; margin-bottom: 0.8rem;">
                    سيتم حذف <strong>جميع أسئلة</strong> هذا الصف نهائياً.
                </p>
                <p style="color: #facc15; font-size: 1rem; font-weight: bold;">
                    "${escapeHtml(grade)}"
                </p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'تأكيد المسح',
        cancelButtonText: 'إلغاء',
        background: 'rgba(10, 15, 30, 0.95)',
        backdrop: 'rgba(0,0,0,0.7)',
        width: '34rem',
        padding: '1.5rem',
        customClass: {
            popup: 'rounded-[2.5rem] border-2 border-red-500/50 backdrop-blur-xl',
            confirmButton: '!bg-red-600 !text-white !rounded-2xl !px-6 !py-2 !text-sm',
            cancelButton: '!bg-gray-700 !text-white !rounded-2xl !px-6 !py-2 !text-sm'
        }
    });
    
    if (result.isConfirmed) {
        try {
            let questions = await getQuestions(grade);
            const deletedCount = questions.length;
            await saveQuestions(grade, []); 
            await renderSubjectsForGrade(grade);
            const teacherCode = sessionStorage.getItem('peak_teacher_code');
            if (teacherCode) await syncAllToFirebase(teacherCode);
            if (deletedCount > 0) try { await incrementStat('questions', -deletedCount); } catch(e) {}
            showFloatingNotification('✅ تم تصفير جميع الأسئلة', 'success');
        } catch (error) {
            console.error(error);
            showFloatingNotification('فشل تصفير الأسئلة', 'error');
        }
    }
}

// ===================== نافذة إضافة سؤال يدوي =====================
export async function showAddQuestionModal(grade) {
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    if (!teacherId) {
        showFloatingNotification('يجب تسجيل الدخول كمعلم', 'error');
        return;
    }
    
    // التحقق من الحد الأقصى للأسئلة
    let teacherPlan = 'free';
    try {
        teacherPlan = await getTeacherPlan();
    } catch(e) {}
    const maxAllowed = getMaxQuestionsSafe(teacherPlan);
    const currentQuestions = await getQuestions(grade);
    if (currentQuestions.length >= maxAllowed) {
        let upgradeMsg = '';
        if (teacherPlan === 'free') {
            upgradeMsg = 'يمكنك الترقية إلى الباقة الفضية (1000 سؤال) أو الذهبية (غير محدود).';
        } else if (teacherPlan === 'silver') {
            upgradeMsg = 'يمكنك الترقية إلى الباقة الذهبية للحصول على أسئلة غير محدودة.';
        }
        showFloatingNotification(`❌ لقد بلغت الحد الأقصى للأسئلة في خطتك (${maxAllowed} سؤال). ${upgradeMsg}`, 'error');
        return;
    }
    
    const lockedSubject = await getLockedSubject().catch(() => null);
    const isLocked = (teacherPlan === 'free' || teacherPlan === 'silver') && lockedSubject;
    const defaultSubject = isLocked ? lockedSubject : '';
    const subjectDisabled = isLocked;
    
    const { value: form } = await Swal.fire({
        title: '➕ إضافة سؤال جديد',
        html: `
            <div style="text-align: right;">
                <textarea id="new-question-text" class="swal2-textarea" placeholder="نص السؤال" rows="3" required></textarea>
                <input id="new-opt1" class="swal2-input" placeholder="الخيار 1" required>
                <input id="new-opt2" class="swal2-input" placeholder="الخيار 2" required>
                <input id="new-opt3" class="swal2-input" placeholder="الخيار 3" required>
                <input id="new-opt4" class="swal2-input" placeholder="الخيار 4" required>
                <select id="new-correct" class="swal2-select"><option value="0">الخيار 1</option><option value="1">الخيار 2</option><option value="2">الخيار 3</option><option value="3">الخيار 4</option></select>
                <input id="new-subject" class="swal2-input" placeholder="المادة" value="${defaultSubject}" ${subjectDisabled ? 'disabled' : ''}>
                <input id="new-lesson" class="swal2-input" placeholder="الدرس (اختياري)">
                <select id="new-difficulty" class="swal2-select"><option value="سهل">سهل</option><option value="متوسط" selected>متوسط</option><option value="صعب">صعب</option></select>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'إضافة',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            const q = document.getElementById('new-question-text').value.trim();
            const o1 = document.getElementById('new-opt1').value.trim();
            const o2 = document.getElementById('new-opt2').value.trim();
            const o3 = document.getElementById('new-opt3').value.trim();
            const o4 = document.getElementById('new-opt4').value.trim();
            const correct = parseInt(document.getElementById('new-correct').value);
            let subject = document.getElementById('new-subject').value.trim();
            const lesson = document.getElementById('new-lesson').value.trim();
            const difficulty = document.getElementById('new-difficulty').value;
            
            if (!q || !o1 || !o2 || !o3 || !o4) {
                Swal.showValidationMessage('يرجى ملء جميع الحقول المطلوبة');
                return false;
            }
            if (isLocked && !subject) subject = lockedSubject;
            if (!subject) {
                Swal.showValidationMessage('المادة مطلوبة');
                return false;
            }
            return { q, o: [o1, o2, o3, o4], a: correct, subject, lesson, difficulty };
        }
    });
    
    if (form) {
        const newQuestionObj = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            q: form.q,
            o: form.o,
            a: form.a,
            subject: form.subject,
            lesson: form.lesson,
            difficulty: form.difficulty,
            cat: form.subject,
            teacherId: teacherId,
            uniqueId: `${teacherId}_${Date.now()}_${Math.random()}`
        };
        
        try {
            const existing = await getQuestions(grade);
            existing.push(newQuestionObj);
            await saveQuestions(grade, existing);
            try { await incrementStat('questions', 1); } catch(e) {}
            
            showFloatingNotification('تم إضافة السؤال', 'success');
            await renderSubjectsForGrade(grade);
        } catch (error) {
            console.error(error);
            showFloatingNotification('فشل إضافة السؤال', 'error');
        }
    }
}

// ===================== نافذة تعديل سؤال =====================
export async function showEditQuestionModal(question, grade) {
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    let teacherPlan = 'free';
    let lockedSubject = null;
    try {
        teacherPlan = await getTeacherPlan();
        lockedSubject = await getLockedSubject();
    } catch(e) {}
    const isLocked = (teacherPlan === 'free' || teacherPlan === 'silver') && lockedSubject;
    const subjectDisabled = isLocked;
    
    const { value: form } = await Swal.fire({
        title: '✏️ تعديل السؤال',
        html: `
            <div style="text-align: right;">
                <textarea id="edit-question-text" class="swal2-textarea" rows="3">${escapeHtml(question.q)}</textarea>
                <input id="edit-opt1" class="swal2-input" value="${escapeHtml(question.o[0])}">
                <input id="edit-opt2" class="swal2-input" value="${escapeHtml(question.o[1])}">
                <input id="edit-opt3" class="swal2-input" value="${escapeHtml(question.o[2])}">
                <input id="edit-opt4" class="swal2-input" value="${escapeHtml(question.o[3])}">
                <select id="edit-correct" class="swal2-select">
                    <option value="0" ${question.a === 0 ? 'selected' : ''}>الخيار 1</option>
                    <option value="1" ${question.a === 1 ? 'selected' : ''}>الخيار 2</option>
                    <option value="2" ${question.a === 2 ? 'selected' : ''}>الخيار 3</option>
                    <option value="3" ${question.a === 3 ? 'selected' : ''}>الخيار 4</option>
                </select>
                <input id="edit-subject" class="swal2-input" value="${escapeHtml(question.subject)}" ${subjectDisabled ? 'disabled' : ''}>
                <input id="edit-lesson" class="swal2-input" value="${escapeHtml(question.lesson || '')}">
                <select id="edit-difficulty" class="swal2-select">
                    <option value="سهل" ${question.difficulty === 'سهل' ? 'selected' : ''}>سهل</option>
                    <option value="متوسط" ${question.difficulty === 'متوسط' ? 'selected' : ''}>متوسط</option>
                    <option value="صعب" ${question.difficulty === 'صعب' ? 'selected' : ''}>صعب</option>
                </select>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'حفظ التغييرات',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            const q = document.getElementById('edit-question-text').value.trim();
            const o1 = document.getElementById('edit-opt1').value.trim();
            const o2 = document.getElementById('edit-opt2').value.trim();
            const o3 = document.getElementById('edit-opt3').value.trim();
            const o4 = document.getElementById('edit-opt4').value.trim();
            const correct = parseInt(document.getElementById('edit-correct').value);
            let subject = document.getElementById('edit-subject').value.trim();
            const lesson = document.getElementById('edit-lesson').value.trim();
            const difficulty = document.getElementById('edit-difficulty').value;
            
            if (!q || !o1 || !o2 || !o3 || !o4) {
                Swal.showValidationMessage('يرجى ملء جميع الحقول');
                return false;
            }
            if (isLocked && !subject) subject = lockedSubject;
            if (!subject) {
                Swal.showValidationMessage('المادة مطلوبة');
                return false;
            }
            if (isLocked && subject !== lockedSubject) {
                Swal.showValidationMessage(`لا يمكن تغيير المادة في الباقة ${teacherPlan === 'free' ? 'المجانية' : 'الفضية'}.`);
                return false;
            }
            return { q, o: [o1, o2, o3, o4], a: correct, subject, lesson, difficulty };
        }
    });
    
    if (form) {
        const updatedQuestion = { ...question, ...form };
        // الحفاظ على uniqueId القديم
        if (question.uniqueId) updatedQuestion.uniqueId = question.uniqueId;
        try {
            const questions = await getQuestions(grade);
            const index = questions.findIndex(q => (q.uniqueId || q.id) === (question.uniqueId || question.id));
            if (index !== -1) {
                questions[index] = updatedQuestion;
                await saveQuestions(grade, questions);
                showFloatingNotification('تم تحديث السؤال', 'success');
                await renderSubjectsForGrade(grade);
            } else {
                showFloatingNotification('السؤال غير موجود', 'error');
            }
        } catch (error) {
            console.error(error);
            showFloatingNotification('فشل تحديث السؤال', 'error');
        }
    }
}
// ===================== ربط أحداث بنك الأسئلة =====================
export function bindQuestionBankEvents() {
    // تغيير الصف
    const gradeSelect = document.getElementById('q-grade-sel');
    if (gradeSelect) {
        gradeSelect.addEventListener('change', async function() {
            if (this.value) await renderSubjectsForGrade(this.value);
        });
    }
    
    // زر تصفير البنك
    const resetBtn = document.querySelector('[data-action="resetBank"]');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const grade = gradeSelect?.value;
            if (grade) await resetBank(grade);
            else showFloatingNotification('اختر الصف أولاً', 'error');
        });
    }
    
    // ✅ مستمع خاص لأزرار حذف المادة (الحل الأكثر أماناً)
    document.body.addEventListener('click', async (e) => {
        const deleteSubjectBtn = e.target.closest('[data-action="deleteSubject"]');
        if (deleteSubjectBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const grade = deleteSubjectBtn.dataset.grade;
            const subject = deleteSubjectBtn.dataset.subject;
            
            console.log('[Delete Subject] Button clicked:', { grade, subject });
            
            if (!grade || !subject) {
                console.error('[Delete Subject] Missing grade or subject', deleteSubjectBtn.dataset);
                showFloatingNotification('بيانات غير مكتملة للحذف', 'error');
                return;
            }
            
            try {
                await deleteSubject(grade, subject);
            } catch (error) {
                console.error('[Delete Subject] Error:', error);
                showFloatingNotification('حدث خطأ أثناء حذف المادة', 'error');
            }
            return;
        }
        
        // ✅ حذف درس
        const deleteLessonBtn = e.target.closest('[data-action="deleteLesson"]');
        if (deleteLessonBtn) {
            e.preventDefault();
            e.stopPropagation();
            const grade = deleteLessonBtn.dataset.grade;
            const subject = deleteLessonBtn.dataset.subject;
            const lesson = deleteLessonBtn.dataset.lesson;
            if (grade && subject && lesson) {
                await deleteLesson(grade, subject, lesson);
            } else {
                showFloatingNotification('بيانات غير مكتملة لحذف الدرس', 'error');
            }
            return;
        }
        
        // ✅ حذف سؤال
        const deleteQuestionBtn = e.target.closest('[data-action="deleteQuestion"]');
        if (deleteQuestionBtn) {
            e.preventDefault();
            e.stopPropagation();
            const grade = deleteQuestionBtn.dataset.grade;
            const qid = deleteQuestionBtn.dataset.qid;
            if (grade && qid) {
                await deleteQuestion(grade, qid);
            } else {
                showFloatingNotification('بيانات غير مكتملة لحذف السؤال', 'error');
            }
            return;
        }
    });
    
    // مستمع لأزرار التعديل (مع تحسين جلب grade)
    document.body.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-question-btn');
        if (!editBtn) return;
        e.preventDefault();
        e.stopPropagation();
        
        // جلب grade من الزر أولاً، ثم من القائمة المنسدلة
        let grade = editBtn.dataset.grade;
        if (!grade && gradeSelect) {
            grade = gradeSelect.value;
        }
        if (!grade) {
            showFloatingNotification('اختر الصف أولاً', 'error');
            return;
        }
        const qid = editBtn.dataset.qid;
        if (!qid) return;
        
        const questions = await getQuestions(grade);
        const question = questions.find(q => (q.uniqueId || q.id) === qid);
        if (question) {
            await showEditQuestionModal(question, grade);
        } else {
            showFloatingNotification('السؤال غير موجود', 'error');
        }
    });
    
    // ربط زر إضافة سؤال يدوي
    initManualAddButton();
} 