// src/questions/excel.js
// رفع وتصدير الأسئلة عبر Excel مع التحقق من صلاحيات الاشتراك
// يدعم: مجاني (مادة واحدة، 150 سؤال)، فضي (مادة واحدة مقفلة، 1000 سؤال)، ذهبي (جميع المواد، غير محدود)
// المطور يتجاوز جميع القيود
// ✅ تم إضافة مؤشر تقدم (Progress Bar) أثناء رفع الأسئلة
// [FIX] إزالة الاعتماد على subscriptionGuard.js (استخدام دوال safe داخلية)
// [FIX] تصحيح الاستيرادات من المسارات الصحيحة

import { loadQuestionsFromIndexedDB, saveQuestionsToIndexedDB } from '../db/indexeddb.js';
import { getDynamicGrades, refreshAllGradeSelects, saveLightData } from '../db/localstorage.js';
import { showFloatingNotification, showLoading, hideLoading, escapeHtml } from '../utils.js';
import { getCurrentUserInfo } from '../firebase/auth.js';
import { syncAllToFirebase } from '../firebase/sync.js';

// استيرادات من dataService (المسار الصحيح)
import { 
    canUploadQuestions, 
    setLockedSubject, 
    getLockedSubject, 
    getTeacherPlan, 
    updateTeacherTotalQuestions, 
    getTeacherQuestionCount,
    invalidateTeacherSubscriptionCache
} from '../services/dataService.js';

// دوال مساعدة داخلية (بديل عن checkTeacherAccess)
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

// ========== مؤشر التقدم (Progress Bar) ==========
let progressModalActive = false;
let progressBarFill = null;
let progressPercentSpan = null;
let progressMessageSpan = null;

function showProgressModal(title, initialMessage = 'جاري التحضير...') {
    if (progressModalActive) {
        Swal.close();
    }
    
    Swal.fire({
        title: title,
        html: `
            <div style="text-align: center; direction: rtl;">
                <div id="progressMessage" style="margin-bottom: 15px; font-size: 0.95rem;">${escapeHtml(initialMessage)}</div>
                <div style="background: #334155; border-radius: 10px; overflow: hidden; height: 20px; width: 100%;">
                    <div id="progressBarFill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #facc15, #eab308); border-radius: 10px; transition: width 0.3s;"></div>
                </div>
                <div id="progressPercent" style="margin-top: 8px; font-size: 0.8rem; color: #cbd5e1;">0%</div>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        background: '#0f172a',
        color: '#fff',
        customClass: {
            popup: 'rounded-2xl border border-yellow-500/30'
        }
    });
    
    progressModalActive = true;
    progressBarFill = document.getElementById('progressBarFill');
    progressPercentSpan = document.getElementById('progressPercent');
    progressMessageSpan = document.getElementById('progressMessage');
    
    window._updateUploadProgress = (percent, message) => {
        if (progressBarFill) progressBarFill.style.width = `${percent}%`;
        if (progressPercentSpan) progressPercentSpan.innerText = `${percent}%`;
        if (progressMessageSpan && message) progressMessageSpan.innerText = escapeHtml(message);
    };
    window._updateUploadProgress(0, initialMessage);
}

function hideProgressModal() {
    if (progressModalActive) {
        Swal.close();
        progressModalActive = false;
        progressBarFill = null;
        progressPercentSpan = null;
        progressMessageSpan = null;
        window._updateUploadProgress = null;
    }
}

// ===================== دوال مساعدة للبحث عن الأعمدة =====================
export function findColumnKey(obj, possibleNames) {
    const normalizedKeys = Object.keys(obj).map(k => ({ original: k, normalized: k.replace(/\s+/g, '').toLowerCase() }));
    for (let name of possibleNames) {
        const match = normalizedKeys.find(k => k.normalized === name.replace(/\s+/g, '').toLowerCase());
        if (match) return match.original;
    }
    return null;
}

export function parseAnswerToIndex(answerValue, options = null) {
    if (answerValue === undefined || answerValue === null) return 0;
    let str = String(answerValue).trim();
    if (str === '') return 0;

    let num = parseInt(str);
    if (!isNaN(num) && num >= 1 && num <= 4) {
        console.log(`✅ تحويل الإجابة: "${str}" -> ${num - 1}`);
        return num - 1;
    }

    let upper = str.toUpperCase();
    if (upper === 'أ' || upper === 'A') return 0;
    if (upper === 'ب' || upper === 'B') return 1;
    if (upper === 'ج' || upper === 'C') return 2;
    if (upper === 'د' || upper === 'D') return 3;

    let match = str.match(/\d+/);
    if (match) {
        let extracted = parseInt(match[0]);
        if (extracted >= 1 && extracted <= 4) {
            console.log(`✅ تحويل الإجابة: "${str}" -> ${extracted - 1} (باستخدام الرقم المستخرج)`);
            return extracted - 1;
        }
    }

    if (options && Array.isArray(options) && options.length === 4) {
        let normalizedAnswer = str.replace(/\s+/g, ' ').trim().toLowerCase();
        for (let i = 0; i < options.length; i++) {
            let opt = options[i] ? String(options[i]).replace(/\s+/g, ' ').trim().toLowerCase() : '';
            if (opt === normalizedAnswer) {
                console.log(`✅ تحويل الإجابة: "${str}" -> ${i} (مطابقة النص مع الخيار)`);
                return i;
            }
        }
    }

    console.warn(`⚠️ فشل تحويل الإجابة: "${str}" - سيتم اعتبار الإجابة الأولى (0) افتراضياً.`);
    return 0;
}

// ========== رفع الأسئلة من Excel (مع التحقق من الصلاحيات ومؤشر التقدم) ==========
export async function smartUploadExcel(file, targetGrade) {
    if (!file || !targetGrade) {
        showFloatingNotification('اختر ملف وصف مستهدف', 'error');
        return;
    }

    const user = await getCurrentUserInfo();
    const isAdmin = sessionStorage.getItem('is_admin') === 'true' || (user && user.isDeveloper);
    
    if (!user && !isAdmin) {
        showFloatingNotification('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    let teacherCode = null;
    if (isAdmin) {
        teacherCode = 'admin_super';
    } else if (user && user.isTeacher) {
        teacherCode = user.code || user.id;
    } else {
        showFloatingNotification('رفع الأسئلة متاح فقط للمعلمين والمطور', 'error');
        return;
    }
    
    if (!teacherCode) {
        showFloatingNotification('لا يمكن تحديد حساب المستخدم', 'error');
        return;
    }
    
    // فحص صلاحية الاشتراك للمعلمين فقط (المطور يتجاوز)
    if (!isAdmin && teacherCode !== 'admin_super') {
        const access = await checkTeacherAccessSafe(teacherCode);
        if (!access.allowed) {
            showFloatingNotification(access.message, 'error');
            return;
        }
    }
    
    showProgressModal('📤 رفع الأسئلة', 'جاري قراءة الملف...');
    
    const reader = new FileReader();
    
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            let jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            if (!jsonRows || jsonRows.length === 0) {
                hideProgressModal();
                showFloatingNotification('الملف فارغ', 'error');
                return;
            }

            const totalRows = jsonRows.length;
            let processed = 0;

            // استخراج اسم المادة
            let subject = 'عام';
            for (let row of jsonRows) {
                let subjKey = findColumnKey(row, ['المادة', 'مادة', 'subject']);
                if (subjKey && String(row[subjKey] || '').trim() !== '') {
                    subject = String(row[subjKey]).trim();
                    break;
                }
            }

            // قراءة جميع الأسئلة من الملف مع تحديث التقدم
            let newQuestions = [];
            for (let row of jsonRows) {
                let questionKey = findColumnKey(row, ['السؤال', 'سؤال', 'question', 'Question']);
                if (!questionKey) continue;
                let questionText = String(row[questionKey] || '').trim();
                if (questionText === '') continue;
                
                let options = [
                    String(row[findColumnKey(row, ['الاختيار1', 'اختيار1', 'opt1', 'خيار1'])] || '').trim() || 'خيار1',
                    String(row[findColumnKey(row, ['الاختيار2', 'اختيار2', 'opt2', 'خيار2'])] || '').trim() || 'خيار2',
                    String(row[findColumnKey(row, ['الاختيار3', 'اختيار3', 'opt3', 'خيار3'])] || '').trim() || 'خيار3',
                    String(row[findColumnKey(row, ['الاختيار4', 'اختيار4', 'opt4', 'خيار4'])] || '').trim() || 'خيار4'
                ];
                let answerKey = findColumnKey(row, ['الإجابة الصحيحة (1-4)', 'الإجابة الصحيحة', 'الإجابة', 'answer', 'Answer', 'correct']);
                let correctIndex = answerKey ? parseAnswerToIndex(row[answerKey], options) : 0;
                let lesson = findColumnKey(row, ['الدرس', 'درس', 'lesson']) ? String(row[findColumnKey(row, ['الدرس', 'درس', 'lesson'])] || '').trim() : 'درس افتراضي';
                let category = findColumnKey(row, ['التصنيف', 'نوع', 'type']) ? String(row[findColumnKey(row, ['التصنيف', 'نوع', 'type'])] || '').trim() : 'عام';
                let difficulty = findColumnKey(row, ['مستوى الصعوبة', 'صعوبة', 'difficulty']) ? String(row[findColumnKey(row, ['مستوى الصعوبة', 'صعوبة', 'difficulty'])] || '').trim() : 'متوسط';
                
                newQuestions.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random(),
                    q: questionText,
                    o: options,
                    a: correctIndex,
                    cat: category,
                    difficulty: difficulty,
                    uniqueId: `${teacherCode}_${Date.now()}_${Math.random()}`,
                    subject: subject,
                    lesson: lesson,
                    teacherId: teacherCode
                });
                
                processed++;
                if (processed % 10 === 0 || processed === totalRows) {
                    let percent = Math.floor((processed / totalRows) * 100);
                    if (window._updateUploadProgress) {
                        window._updateUploadProgress(percent, `جاري معالجة السؤال ${processed} من ${totalRows}...`);
                    }
                }
            }

            if (newQuestions.length === 0) {
                hideProgressModal();
                showFloatingNotification('لا توجد أسئلة صالحة', 'error');
                return;
            }

            // التحقق من صلاحية الرفع (للمعلمين فقط، المطور يتجاوز)
            if (!isAdmin) {
                const plan = await getTeacherPlan(teacherCode);
                const lockedSubject = await getLockedSubject(teacherCode);
                
                // 1. التحقق من المادة (للمجاني والفضي)
                if ((plan === 'free' || plan === 'silver') && lockedSubject && lockedSubject !== subject) {
                    hideProgressModal();
                    showFloatingNotification(`لا يمكنك رفع أسئلة لمادة "${subject}". الباقة ${plan === 'free' ? 'المجانية' : 'الفضية'} مقفلة على مادة "${lockedSubject}".`, 'error');
                    return;
                }
                
                // 2. التحقق من عدد الأسئلة والحدود
                const canUpload = await canUploadQuestions(teacherCode, newQuestions, subject);
                if (!canUpload.allowed) {
                    hideProgressModal();
                    showFloatingNotification(canUpload.message, 'error');
                    return;
                }
                
                // 3. إذا لم تكن هناك مادة مقفلة بعد، نقفل على المادة (للمجاني والفضي)
                if ((plan === 'free' || plan === 'silver') && !lockedSubject) {
                    await setLockedSubject(teacherCode, subject);
                    showFloatingNotification(`تم تثبيت المادة "${subject}" كالمادة الأساسية. لا يمكن تغييرها في المستقبل.`, 'info');
                }
            }

            // حفظ الأسئلة في IndexedDB
            if (window._updateUploadProgress) {
                window._updateUploadProgress(85, 'جاري حفظ الأسئلة...');
            }
            
            let existing = await loadQuestionsFromIndexedDB(targetGrade);
            let allQuestions = [...existing, ...newQuestions];
            await saveQuestionsToIndexedDB(targetGrade, allQuestions);
            
            // تحديث عدد الأسئلة في Firebase (للمعلمين فقط)
            if (!isAdmin) {
                await updateTeacherTotalQuestions(teacherCode, newQuestions.length);
                await invalidateTeacherSubscriptionCache(teacherCode);
            }
            
            // تحديث واجهة بنك الأسئلة
            if (typeof window.renderSubjectsForGrade === 'function') {
                await window.renderSubjectsForGrade(targetGrade);
            }
            
            if (window._updateUploadProgress) {
                window._updateUploadProgress(100, 'تم الرفع بنجاح!');
            }
            
            setTimeout(() => {
                hideProgressModal();
                showFloatingNotification(`✅ تم رفع ${newQuestions.length} سؤالاً بنجاح`, 'success');
            }, 500);
            
            refreshAllGradeSelects();
            
            // مزامنة مع Firebase (إذا كان المعلم)
            const teacherCodeSync = sessionStorage.getItem('peak_teacher_code');
            if (teacherCodeSync && !isAdmin) {
                syncAllToFirebase(teacherCodeSync);
            }
            
        } catch (err) {
            console.error(err);
            hideProgressModal();
            showFloatingNotification('حدث خطأ أثناء رفع الملف: ' + err.message, 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// ========== تصدير الأسئلة إلى ملف Excel ==========
export async function exportQuestionsToExcel() {
    let grade = document.getElementById('q-grade-sel')?.value;
    if (!grade) {
        showFloatingNotification('اختر صفاً أولاً', 'error');
        return;
    }
    let questions = await loadQuestionsFromIndexedDB(grade);
    const teacherId = sessionStorage.getItem('peak_teacher_code');
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    
    let filteredQuestions = questions;
    if (!isAdmin && teacherId) {
        filteredQuestions = questions.filter(q => q.teacherId === teacherId);
    }
    
    if (filteredQuestions.length === 0) {
        showFloatingNotification('لا توجد أسئلة لتصديرها', 'error');
        return;
    }
    
    let wsData = [['السؤال', 'الاختيار1', 'الاختيار2', 'الاختيار3', 'الاختيار4', 'الإجابة الصحيحة (1-4)', 'المادة', 'الدرس', 'التصنيف', 'مستوى الصعوبة']];
    filteredQuestions.forEach(q => {
        wsData.push([q.q, q.o[0], q.o[1], q.o[2], q.o[3], q.a + 1, q.subject, q.lesson, q.cat, q.difficulty]);
    });
    let ws = XLSX.utils.aoa_to_sheet(wsData);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, `questions_${grade}.xlsx`);
    showFloatingNotification('تم تصدير الأسئلة بنجاح', 'success');
}

// ========== ربط أحداث رفع وتصدير الأسئلة ==========
export function bindExcelEvents() {
    const uploadBtn = document.querySelector('[data-action="uploadExcel"]');
    const gradeSelect = document.getElementById('q-grade-sel');
    const fileInput = document.getElementById('smartExcelUpload');
    
    if (uploadBtn && gradeSelect && fileInput) {
        const newUploadBtn = uploadBtn.cloneNode(true);
        uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
        
        newUploadBtn.addEventListener('click', async () => {
            const grade = gradeSelect.value;
            if (!grade) {
                showFloatingNotification('اختر الصف أولاً', 'error');
                return;
            }
            if (!fileInput.files || !fileInput.files[0]) {
                showFloatingNotification('اختر ملف Excel أولاً', 'error');
                return;
            }
            
            newUploadBtn.disabled = true;
            newUploadBtn.innerText = 'جاري الرفع...';
            try {
                await smartUploadExcel(fileInput.files[0], grade);
                fileInput.value = '';
            } catch (err) {
                console.error(err);
            } finally {
                newUploadBtn.disabled = false;
                newUploadBtn.innerText = '✨ رفع ذكي (Excel)';
            }
        });
    }
    
    const exportBtn = document.getElementById('exportQuestionsBtn');
    if (exportBtn) {
        const newExportBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
        newExportBtn.addEventListener('click', exportQuestionsToExcel);
    }
}