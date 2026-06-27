// src/admin/modern/questions.js
// بنك الأسئلة – مع دعم صلاحيات المساعدين (نسخة كاملة غير مختصرة)

import { db, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from '../../firebase/init.js';
import { getTeachersList } from '../../firebase/auth.js';
import { loadQuestionsFromIndexedDB, saveQuestionsToIndexedDB } from '../../db/indexeddb.js';
import { getAllStudents, showNotification, escapeHtml, showLoading, addAuditLog, EGYPT_GRADES, EGYPT_SUBJECTS, hasPermission, applyUIPermissions } from './utils.js';

// ========== العرض الرئيسي ==========
export async function renderQuestions() {
    if (!hasPermission('questions', 'view')) {
        document.getElementById('questionsPane').innerHTML = `
            <div class="glass-card p-5 text-center">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <h3 class="text-xl font-bold text-red-400">غير مصرح</h3>
                <p class="text-gray-400">ليس لديك صلاحية لعرض بنك الأسئلة.</p>
            </div>`;
        return;
    }
    showLoading('questionsPane', 'جاري تحميل بيانات المعلمين والأسئلة...');
    const teachers = await getTeachersList();
    const teacherQuestionsCount = {};
    const allGrades = EGYPT_GRADES;
    const allSubjectsSet = new Set();
    for (const grade of allGrades) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        for (const q of questions) {
            const teacherId = q.teacherId;
            if (teacherId) teacherQuestionsCount[teacherId] = (teacherQuestionsCount[teacherId] || 0) + 1;
            if (q.subject) allSubjectsSet.add(q.subject);
        }
    }
    const allSubjectsList = Array.from(allSubjectsSet).sort();
    const filterBarHtml = `
        <div class="glass-card p-3 mb-4 border border-yellow-500/30">
            <div class="flex flex-wrap items-end gap-3">
                <div class="flex-1 min-w-[150px]"><label class="text-xs text-gray-400 block mb-1">الخطة</label><select id="filterTeacherPlanQ" class="filter-select text-sm py-1"><option value="all">جميع الخطط</option><option value="free">مجاني</option><option value="silver">فضي</option><option value="gold">ذهبي</option></select></div>
                <div class="flex-1 min-w-[150px]"><label class="text-xs text-gray-400 block mb-1">الصف</label><select id="filterTeacherGradeQ" class="filter-select text-sm py-1"><option value="all">جميع الصفوف</option>${EGYPT_GRADES.map(g => `<option value="${g}">${g}</option>`).join('')}</select></div>
                <div class="flex-1 min-w-[150px]"><label class="text-xs text-gray-400 block mb-1">المادة</label><select id="filterTeacherSubjectQ" class="filter-select text-sm py-1"><option value="all">جميع المواد</option>${allSubjectsList.map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>
                <div class="flex-1 min-w-[180px]"><input type="text" id="searchTeacherQ" class="filter-input text-sm py-1 w-full" placeholder="🔍 بحث بالاسم أو الكود"></div>
                <div><button id="resetTeacherFiltersQ" class="btn-secondary text-xs px-3 py-1.5">إعادة تعيين</button></div>
            </div>
        </div>
    `;
    const distributionHtml = `
        <div class="glass-card p-3 mb-5 border-2 border-yellow-500/40">
            <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2"><i class="fas fa-share-alt text-yellow-400 text-lg"></i><span class="font-bold text-yellow-400 text-sm">توزيع أسئلة مركزية</span></div>
                <div class="flex-1 min-w-[180px]"><input type="file" id="centralUploadExcel" accept=".xlsx, .xls" class="filter-input text-sm py-1 w-full"></div>
                <div class="w-36"><select id="distributeTargetType" class="filter-select text-sm py-1 w-full"><option value="all">جميع المعلمين</option><option value="plan">حسب الخطة</option><option value="specific">معلمين محددين</option><option value="grade">حسب الصف</option></select></div>
                <div id="distributePlanContainer" class="w-32 hidden"><select id="distributePlan" class="filter-select text-sm py-1 w-full"><option value="free">مجاني</option><option value="silver">فضي</option><option value="gold">ذهبي</option></select></div>
                <div id="distributeTeachersContainer" class="w-48 hidden"><select id="distributeTeachers" multiple class="filter-select text-sm py-1 w-full h-20">${teachers.map(t => `<option value="${t.code || t.id}">${escapeHtml(t.name)} (${t.plan})</option>`).join('')}</select></div>
                <div id="distributeGradeContainer" class="w-40 hidden"><select id="distributeGrade" class="filter-select text-sm py-1 w-full">${EGYPT_GRADES.map(g => `<option value="${g}">${g}</option>`).join('')}</select></div>
                <div><button id="startDistributionBtn" class="btn-primary text-sm py-1.5 px-3" data-perm="questions.upload"><i class="fas fa-paper-plane"></i> توزيع</button></div>
            </div>
            <div class="text-[11px] text-gray-400 mt-2">⚠️ تضاف الأسئلة إلى بنك كل معلم مستلم (لا تُحذف أسئلتهم الحالية).</div>
        </div>
    `;
    const teachersGridContainer = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="questionsTeachersGrid"></div>`;
    const footerNote = `<div class="mt-6 text-center text-gray-500 text-sm">⚠️ نقل الأسئلة أو حذفها يتم بشكل نهائي. لا يمكن التراجع.</div>`;
    document.getElementById('questionsPane').innerHTML = filterBarHtml + distributionHtml + teachersGridContainer + footerNote;
    applyUIPermissions();

    const filterPlan = document.getElementById('filterTeacherPlanQ');
    const filterGrade = document.getElementById('filterTeacherGradeQ');
    const filterSubject = document.getElementById('filterTeacherSubjectQ');
    const searchInput = document.getElementById('searchTeacherQ');
    const resetBtn = document.getElementById('resetTeacherFiltersQ');

    const renderTeacherCards = async () => {
        const planVal = filterPlan.value;
        const gradeVal = filterGrade.value;
        const subjectVal = filterSubject.value;
        const searchVal = searchInput.value.toLowerCase();
        let filtered = [...teachers];
        if (planVal !== 'all') filtered = filtered.filter(t => t.plan === planVal);
        if (gradeVal !== 'all') {
            const teacherHasGrade = {};
            for (const t of filtered) {
                const teacherCode = t.code || t.id;
                const students = await getAllStudents();
                const hasGrade = students.some(s => s.teacherId === teacherCode && s.grade === gradeVal);
                teacherHasGrade[t.code || t.id] = hasGrade;
            }
            filtered = filtered.filter(t => teacherHasGrade[t.code || t.id]);
        }
        if (subjectVal !== 'all') {
            const teacherHasSubject = {};
            for (const t of filtered) {
                const teacherCode = t.code || t.id;
                let hasSubject = false;
                for (const grade of EGYPT_GRADES) {
                    const questions = await loadQuestionsFromIndexedDB(grade);
                    if (questions.some(q => q.teacherId === teacherCode && q.subject === subjectVal)) {
                        hasSubject = true;
                        break;
                    }
                }
                teacherHasSubject[teacherCode] = hasSubject;
            }
            filtered = filtered.filter(t => teacherHasSubject[t.code || t.id]);
        }
        if (searchVal) filtered = filtered.filter(t => t.name.toLowerCase().includes(searchVal) || (t.code || t.id).toLowerCase().includes(searchVal));
        filtered = filtered.map(t => ({ ...t, questionsCount: teacherQuestionsCount[t.code || t.id] || 0 })).sort((a, b) => b.questionsCount - a.questionsCount);
        const container = document.getElementById('questionsTeachersGrid');
        if (!container) return;
        if (filtered.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">لا يوجد معلمون يطابقون الفلتر</div>';
            return;
        }
        container.innerHTML = filtered.map(t => {
            const teacherCode = t.code || t.id;
            const count = t.questionsCount;
            let planClass = '', planText = '';
            if (t.plan === 'free') { planClass = 'badge-free'; planText = 'مجاني'; }
            else if (t.plan === 'silver') { planClass = 'badge-silver'; planText = 'فضي'; }
            else { planClass = 'badge-gold'; planText = 'ذهبي'; }
            const hasValidImg = t.img && t.img !== 'undefined' && t.img.startsWith('data:image');
            const imgHtml = hasValidImg ? `<img src="${t.img}" class="w-12 h-12 rounded-full object-cover border border-yellow-500 premium-avatar">` : `<div class="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white text-xl">${t.name.charAt(0)}</div>`;
            const canTransfer = hasPermission('questions', 'edit');
            const canExport = hasPermission('questions', 'view');
            const canDelete = hasPermission('questions', 'delete');
            return `
                <div class="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-yellow-500/40 transition">
                    <div class="flex items-center gap-3 mb-3">
                        ${imgHtml}
                        <div class="flex-1">
                            <div class="font-bold text-white">${escapeHtml(t.name)}</div>
                            <div class="text-xs text-gray-400">${teacherCode}</div>
                        </div>
                        <span class="${planClass} text-xs px-2 py-1 rounded-full">${planText}</span>
                    </div>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-yellow-400 font-bold">📚 ${count} سؤال</span>
                        <span class="text-gray-400 text-xs">${t.expiryDate ? new Date(t.expiryDate).toLocaleDateString('ar-EG') : 'لا تاريخ'}</span>
                    </div>
                    <div class="flex gap-2">
                        ${canTransfer ? `<button class="transfer-questions-btn flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm transition" data-code="${teacherCode}" data-name="${escapeHtml(t.name)}"><i class="fas fa-exchange-alt"></i> نقل</button>` : ''}
                        ${canExport ? `<button class="export-teacher-questions-btn flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm transition" data-code="${teacherCode}" data-name="${escapeHtml(t.name)}"><i class="fas fa-file-excel"></i> تصدير</button>` : ''}
                        ${canDelete ? `<button class="delete-teacher-questions-btn flex-1 bg-red-600/70 hover:bg-red-600 text-white py-2 rounded-lg text-sm transition" data-code="${teacherCode}" data-name="${escapeHtml(t.name)}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        bindCardButtons();
        applyUIPermissions();
    };

    const bindCardButtons = () => {
        document.querySelectorAll('.transfer-questions-btn').forEach(btn => {
            btn.removeEventListener('click', transferHandler);
            btn.addEventListener('click', transferHandler);
        });
        document.querySelectorAll('.export-teacher-questions-btn').forEach(btn => {
            btn.removeEventListener('click', exportHandler);
            btn.addEventListener('click', exportHandler);
        });
        document.querySelectorAll('.delete-teacher-questions-btn').forEach(btn => {
            btn.removeEventListener('click', deleteHandler);
            btn.addEventListener('click', deleteHandler);
        });
    };

    const transferHandler = (e) => {
        const btn = e.currentTarget;
        const sourceCode = btn.dataset.code;
        const sourceName = btn.dataset.name;
        showTransferQuestionsModal(sourceCode, sourceName);
    };
    const exportHandler = (e) => {
        const btn = e.currentTarget;
        const teacherCode = btn.dataset.code;
        const teacherName = btn.dataset.name;
        exportTeacherQuestionsToExcel(teacherCode, teacherName);
    };
    const deleteHandler = async (e) => {
        const btn = e.currentTarget;
        const teacherCode = btn.dataset.code;
        const teacherName = btn.dataset.name;
        await confirmDeleteTeacherQuestions(teacherCode, teacherName);
    };

    filterPlan.addEventListener('change', renderTeacherCards);
    filterGrade.addEventListener('change', renderTeacherCards);
    filterSubject.addEventListener('change', renderTeacherCards);
    searchInput.addEventListener('input', renderTeacherCards);
    resetBtn.addEventListener('click', () => {
        filterPlan.value = 'all';
        filterGrade.value = 'all';
        filterSubject.value = 'all';
        searchInput.value = '';
        renderTeacherCards();
    });

    // ربط أحداث التوزيع
    const targetTypeSelect = document.getElementById('distributeTargetType');
    const planContainer = document.getElementById('distributePlanContainer');
    const teachersContainer = document.getElementById('distributeTeachersContainer');
    const gradeContainer = document.getElementById('distributeGradeContainer');
    if (targetTypeSelect) {
        targetTypeSelect.addEventListener('change', () => {
            const val = targetTypeSelect.value;
            planContainer.classList.add('hidden');
            teachersContainer.classList.add('hidden');
            gradeContainer.classList.add('hidden');
            if (val === 'plan') planContainer.classList.remove('hidden');
            else if (val === 'specific') teachersContainer.classList.remove('hidden');
            else if (val === 'grade') gradeContainer.classList.remove('hidden');
        });
    }
    const startBtn = document.getElementById('startDistributionBtn');
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (!hasPermission('questions', 'upload')) {
                Swal.fire('غير مصرح', 'ليس لديك صلاحية لرفع وتوزيع الأسئلة', 'error');
                return;
            }
            const fileInput = document.getElementById('centralUploadExcel');
            if (!fileInput.files || !fileInput.files[0]) {
                Swal.fire('خطأ', 'اختر ملف Excel أولاً', 'error');
                return;
            }
            const file = fileInput.files[0];
            const targetType = targetTypeSelect.value;
            const plan = document.getElementById('distributePlan')?.value;
            const selectedTeachers = Array.from(document.querySelectorAll('#distributeTeachers option:checked')).map(opt => opt.value);
            const gradeFilter = document.getElementById('distributeGrade')?.value;
            Swal.fire({ title: 'جاري تحليل الملف...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            let parsedQuestions = [];
            let fileStats = { subjects: {}, lessons: {}, grades: {}, total: 0 };
            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                let json = XLSX.utils.sheet_to_json(sheet, { defval: null, blankrows: false });
                if (!json.length) json = XLSX.utils.sheet_to_json(sheet, { defval: null });
                if (!json.length) throw new Error('الملف لا يحتوي على بيانات');
                const normalizeKey = (str) => str?.trim().replace(/[\s\u200B]+/g, ' ').replace(/[()]/g, '') || '';
                const firstRow = json[0];
                const actualKeys = Object.keys(firstRow);
                const normalizedKeys = actualKeys.map(k => normalizeKey(k));
                const findColumn = (possibleNames) => {
                    for (let name of possibleNames) {
                        const idx = normalizedKeys.findIndex(k => k === normalizeKey(name));
                        if (idx !== -1) return actualKeys[idx];
                    }
                    return null;
                };
                const questionCol = findColumn(['السؤال', 'سؤال', 'question']);
                const opt1Col = findColumn(['الاختيار 1', 'اختيار 1', 'الخيار1', 'option1']);
                const opt2Col = findColumn(['الاختيار 2', 'اختيار 2', 'الخيار2', 'option2']);
                const opt3Col = findColumn(['الاختيار 3', 'اختيار 3', 'الخيار3', 'option3']);
                const opt4Col = findColumn(['الاختيار 4', 'اختيار 4', 'الخيار4', 'option4']);
                const correctCol = findColumn(['الإجابة الصحيحة (1-4)', 'الإجابة الصحيحة', 'الإجابة', 'correct']);
                const subjectCol = findColumn(['المادة', 'مادة', 'subject']);
                const lessonCol = findColumn(['الدرس', 'درس', 'lesson']);
                const difficultyCol = findColumn(['مستوى الصعوبة', 'صعوبة', 'difficulty']);
                const gradeCol = findColumn(['الصف', 'صف', 'grade']);
                if (!questionCol || !opt1Col || !opt2Col || !opt3Col || !opt4Col || !correctCol) throw new Error('الملف لا يحتوي على الأعمدة المطلوبة');
                for (const row of json) {
                    const qText = row[questionCol] ? String(row[questionCol]).trim() : '';
                    if (!qText) continue;
                    const opt1 = row[opt1Col] ? String(row[opt1Col]).trim() : '';
                    const opt2 = row[opt2Col] ? String(row[opt2Col]).trim() : '';
                    const opt3 = row[opt3Col] ? String(row[opt3Col]).trim() : '';
                    const opt4 = row[opt4Col] ? String(row[opt4Col]).trim() : '';
                    if (!opt1 || !opt2 || !opt3 || !opt4) continue;
                    let correctIdx = 0;
                    const rawCorrect = row[correctCol];
                    if (rawCorrect !== undefined && rawCorrect !== '') {
                        const num = parseInt(rawCorrect);
                        if (!isNaN(num) && num >= 1 && num <= 4) correctIdx = num - 1;
                    }
                    const subject = subjectCol ? (row[subjectCol] ? String(row[subjectCol]).trim() : 'عام') : 'عام';
                    const lesson = lessonCol ? (row[lessonCol] ? String(row[lessonCol]).trim() : '') : '';
                    const difficulty = difficultyCol ? (row[difficultyCol] ? String(row[difficultyCol]).trim() : 'متوسط') : 'متوسط';
                    const rowGrade = gradeCol ? (row[gradeCol] ? String(row[gradeCol]).trim() : '') : '';
                    parsedQuestions.push({ q: qText, o: [opt1, opt2, opt3, opt4], a: correctIdx, subject, lesson, difficulty, originalGrade: rowGrade });
                    fileStats.subjects[subject] = (fileStats.subjects[subject] || 0) + 1;
                    if (lesson) fileStats.lessons[lesson] = (fileStats.lessons[lesson] || 0) + 1;
                    if (rowGrade) fileStats.grades[rowGrade] = (fileStats.grades[rowGrade] || 0) + 1;
                    fileStats.total++;
                }
            } catch (err) {
                Swal.fire('خطأ في قراءة الملف', err.message, 'error');
                return;
            }
            if (parsedQuestions.length === 0) {
                Swal.fire('تنبيه', 'الملف لا يحتوي على أسئلة صالحة', 'error');
                return;
            }
            const sampleQuestions = parsedQuestions.slice(0, 3);
            let sampleHtml = '';
            if (sampleQuestions.length > 0) {
                sampleHtml = `
                    <div class="mt-4 pt-3 border-t border-yellow-500/20">
                        <div class="flex items-center gap-2 mb-3"><i class="fas fa-clipboard-list text-cyan-400"></i><span class="text-sm font-bold text-white">📋 عينة من الأسئلة (أول 3 أسئلة)</span></div>
                        <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                            ${sampleQuestions.map((q, idx) => `
                                <div class="bg-slate-800/40 rounded-xl p-3 border border-slate-700 hover:border-yellow-500/30 transition">
                                    <div class="flex items-start gap-2"><span class="text-yellow-400 font-bold text-sm ml-1">${idx + 1}.</span><span class="text-gray-200 text-sm line-clamp-2">${escapeHtml(q.q.substring(0, 100))}${q.q.length > 100 ? '...' : ''}</span></div>
                                    <div class="flex flex-wrap gap-3 mt-2 text-xs"><span class="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">📘 ${escapeHtml(q.subject)}</span><span class="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">📖 ${escapeHtml(q.lesson || 'بدون درس')}</span><span class="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">⚡ ${q.difficulty || 'متوسط'}</span></div>
                                </div>
                            `).join('')}
                        </div>
                        ${parsedQuestions.length > 3 ? '<div class="text-center text-xs text-gray-500 mt-2">... و ' + (parsedQuestions.length - 3) + ' أسئلة أخرى</div>' : ''}
                    </div>
                `;
            }
            const { value: previewResult } = await Swal.fire({
                title: `<div class="flex items-center justify-center gap-3 text-2xl font-black text-yellow-400"><i class="fas fa-eye text-3xl"></i> معاينة الأسئلة</div>`,
                html: `<div class="text-right space-y-4 max-h-[70vh] overflow-y-auto" dir="rtl" style="font-family: 'Cairo', sans-serif;">
                    <div class="bg-gradient-to-r from-yellow-500/20 to-amber-500/10 rounded-2xl p-4 flex items-center justify-between border border-yellow-500/30"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-2xl">📊</div><div><div class="text-xs text-gray-400">إجمالي الأسئلة المستخرجة</div><div class="text-3xl font-black text-yellow-400">${fileStats.total}</div></div></div><div class="text-4xl opacity-50">📚</div></div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4"><div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700 hover:border-cyan-500/30 transition"><div class="flex items-center gap-2 mb-2 text-cyan-400"><i class="fas fa-tag"></i><span class="font-bold">المواد</span></div><div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">${Object.entries(fileStats.subjects).map(([k, v]) => `<span class="bg-cyan-500/10 text-cyan-300 px-2 py-1 rounded-full text-xs">${escapeHtml(k)} (${v})</span>`).join('') || '<span class="text-gray-500 text-sm">لا توجد مواد</span>'}</div></div><div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700 hover:border-emerald-500/30 transition"><div class="flex items-center gap-2 mb-2 text-emerald-400"><i class="fas fa-book"></i><span class="font-bold">الدروس</span></div><div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">${Object.entries(fileStats.lessons).slice(0, 8).map(([k, v]) => `<span class="bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded-full text-xs">${escapeHtml(k)} (${v})</span>`).join('') || '<span class="text-gray-500 text-sm">لا توجد دروس</span>'}${Object.keys(fileStats.lessons).length > 8 ? `<span class="text-gray-500 text-xs">+${Object.keys(fileStats.lessons).length - 8} أخرى</span>` : ''}</div></div><div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700 hover:border-purple-500/30 transition"><div class="flex items-center gap-2 mb-2 text-purple-400"><i class="fas fa-graduation-cap"></i><span class="font-bold">الصفوف (في الملف)</span></div><div class="flex flex-wrap gap-2">${Object.entries(fileStats.grades).map(([k, v]) => `<span class="bg-purple-500/10 text-purple-300 px-2 py-1 rounded-full text-xs">${escapeHtml(k)} (${v})</span>`).join('') || '<span class="text-gray-500 text-sm">غير محدد</span>'}</div></div></div>
                    ${sampleHtml}
                    <div class="bg-black/40 rounded-2xl p-5 border border-yellow-500/30 mt-2"><div class="flex items-center gap-2 mb-4"><i class="fas fa-map-marker-alt text-yellow-400 text-lg"></i><span class="font-bold text-white text-base">🎯 خيارات الوجهة (اختياري)</span></div><div class="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label class="block text-xs text-gray-400 mb-1"><i class="fas fa-layer-group ml-1"></i> الصف المستهدف (تغيير كل الأسئلة)</label><select id="targetGradeSelect" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-2.5 text-white text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition"><option value="">(نفس الصف الأصلي)</option>${EGYPT_GRADES.map(g => `<option value="${g}">${g}</option>`).join('')}</select></div><div><label class="block text-xs text-gray-400 mb-1"><i class="fas fa-tag ml-1"></i> المادة المستهدفة (تغيير كل الأسئلة)</label><input type="text" id="targetSubjectInput" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-2.5 text-white text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition" placeholder="اترك فارغاً للإبقاء على المادة الأصلية"></div></div><div class="flex items-center gap-2 mt-4 text-xs text-amber-400 bg-amber-500/10 p-2 rounded-lg"><i class="fas fa-info-circle"></i><span>⚠️ إذا حددت صفاً مستهدفاً، ستُضاف الأسئلة إلى هذا الصف فقط. إذا حددت مادة، ستُستبدل مادة كل سؤال.</span></div></div>
                </div>`,
                showCancelButton: true, confirmButtonText: '📤 توزيع الآن', cancelButtonText: 'إلغاء', confirmButtonColor: '#facc15', background: '#0f172a', color: '#fff', width: '900px',
                customClass: { popup: 'rounded-3xl border border-yellow-500/40 shadow-2xl', confirmButton: '!bg-gradient-to-r !from-yellow-500 !to-amber-600 !text-black !font-bold !px-6 !py-2 !rounded-full !text-base !shadow-lg hover:!shadow-yellow-500/50 transition', cancelButton: '!bg-gray-700 !text-white !rounded-full !px-5 !py-2' },
                preConfirm: () => {
                    const targetGrade = document.getElementById('targetGradeSelect').value;
                    const targetSubject = document.getElementById('targetSubjectInput').value.trim();
                    return { targetGrade: targetGrade || null, targetSubject: targetSubject || null };
                }
            });
            await distributeQuestionsToTeachers(parsedQuestions, { targetType, plan, selectedTeachers, gradeFilter, targetGrade: previewResult?.targetGrade, targetSubject: previewResult?.targetSubject, sourceFileName: file.name });
        });
    }
    await renderTeacherCards();
}

// ========== دالة التوزيع ==========
export async function distributeQuestionsToTeachers(questionsArray, options) {
    if (!hasPermission('questions', 'upload')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لتوزيع الأسئلة', 'error');
        return;
    }
    const { targetType, plan, selectedTeachers, gradeFilter, targetGrade, targetSubject } = options;
    Swal.fire({ title: 'جاري التوزيع...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let newQuestions = questionsArray.map(q => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random(),
        q: q.q, o: q.o, a: q.a, subject: targetSubject || q.subject, lesson: q.lesson, difficulty: q.difficulty, cat: q.cat || 'عام',
        uniqueId: `central_${Date.now()}_${Math.random()}`, teacherId: null
    }));
    let teachers = await getTeachersList();
    let targetTeachers = [];
    if (targetType === 'all') targetTeachers = teachers;
    else if (targetType === 'plan') targetTeachers = teachers.filter(t => t.plan === plan);
    else if (targetType === 'specific') targetTeachers = teachers.filter(t => selectedTeachers.includes(t.code || t.id));
    else if (targetType === 'grade') {
        const allStudents = await getAllStudents();
        const teacherIdsWithGrade = new Set();
        allStudents.forEach(s => { if (s.grade === gradeFilter && s.teacherId) teacherIdsWithGrade.add(s.teacherId); });
        targetTeachers = teachers.filter(t => teacherIdsWithGrade.has(t.code || t.id));
    }
    if (targetTeachers.length === 0) {
        Swal.fire('تنبيه', 'لا يوجد معلمون يستوفون الشروط المحددة', 'info');
        return;
    }
    const confirm = await Swal.fire({
        title: `توزيع ${newQuestions.length} سؤال`, html: `<p>سيتم توزيع الأسئلة على <strong>${targetTeachers.length} معلم</strong>.</p>${targetGrade ? `<p>📘 سيتم تغيير الصف إلى: <strong>${targetGrade}</strong></p>` : ''}${targetSubject ? `<p>📖 سيتم تغيير المادة إلى: <strong>${targetSubject}</strong></p>` : ''}<p class="text-yellow-400">هل أنت متأكد؟</p>`,
        icon: 'question', showCancelButton: true, confirmButtonText: 'نعم، وزع', cancelButtonText: 'إلغاء', background: '#0f172a', color: '#fff'
    });
    if (!confirm.isConfirmed) return;
    Swal.fire({ title: 'جاري التوزيع...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let successCount = 0, skippedTeachers = [];
    for (const teacher of targetTeachers) {
        const teacherCode = teacher.code || teacher.id;
        let gradesToUse = [];
        if (targetGrade) gradesToUse = [targetGrade];
        else {
            const students = await getAllStudents();
            const teacherGrades = new Set();
            students.forEach(s => { if (s.teacherId === teacherCode && s.grade) teacherGrades.add(s.grade); });
            gradesToUse = Array.from(teacherGrades);
        }
        if (gradesToUse.length === 0) {
            skippedTeachers.push(teacher.name);
            continue;
        }
        for (const grade of gradesToUse) {
            let existing = await loadQuestionsFromIndexedDB(grade);
            const newOnes = newQuestions.map(q => ({ ...q, teacherId: teacherCode, uniqueId: `${teacherCode}_${Date.now()}_${Math.random()}`, grade }));
            await saveQuestionsToIndexedDB(grade, [...existing, ...newOnes]);
        }
        successCount++;
    }
    let resultMessage = `تم توزيع ${newQuestions.length} سؤال على ${successCount} معلم بنجاح.`;
    if (skippedTeachers.length) resultMessage += `<br><span class="text-red-400">⚠️ تم تخطي ${skippedTeachers.length} معلم (ليس لديهم طلاب ولا صف مستهدف): ${skippedTeachers.join(', ')}</span><br><span class="text-yellow-400">💡 نصيحة: يمكنك إضافة طلاب لهؤلاء المعلمين أولاً، أو تحديد "صف مستهدف" عند التوزيع.</span>`;
    await addAuditLog('توزيع أسئلة مركزية', `تم توزيع ${newQuestions.length} سؤال على ${successCount} معلم (تخطى ${skippedTeachers.length})`);
    Swal.fire({ icon: 'success', title: 'تم التوزيع', html: resultMessage, background: '#0f172a', color: '#fff' });
    await renderQuestions();
}

// ========== تصدير أسئلة معلم ==========
export async function exportTeacherQuestionsToExcel(teacherCode, teacherName) {
    if (!hasPermission('questions', 'view')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لتصدير الأسئلة', 'error');
        return;
    }
    Swal.fire({ title: 'جاري التحميل...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const allGrades = EGYPT_GRADES;
        let allQuestions = [];
        for (const grade of allGrades) {
            const questions = await loadQuestionsFromIndexedDB(grade);
            const teacherQuestions = questions.filter(q => q.teacherId === teacherCode);
            allQuestions.push(...teacherQuestions.map(q => ({ ...q, grade })));
        }
        if (allQuestions.length === 0) {
            Swal.fire('تنبيه', `لا توجد أسئلة للمعلم ${escapeHtml(teacherName)}`, 'info');
            return;
        }
        const wsData = allQuestions.map(q => ({
            'المادة': q.subject || '', 'الدرس': q.lesson || '', 'السؤال': q.q,
            'الاختيار 1': q.o[0], 'الاختيار 2': q.o[1], 'الاختيار 3': q.o[2], 'الاختيار 4': q.o[3],
            'الإجابة الصحيحة (1-4)': q.a + 1, 'التصنيف': q.cat || '', 'مستوى الصعوبة': q.difficulty || 'متوسط'
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 50 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'الأسئلة');
        XLSX.writeFile(wb, `اسئلة_المعلم_${teacherCode}_${new Date().toISOString().slice(0, 19)}.xlsx`);
        Swal.fire('تم التصدير', `تم تصدير ${allQuestions.length} سؤال للمعلم ${escapeHtml(teacherName)}`, 'success');
    } catch (error) {
        console.error(error);
        Swal.fire('خطأ', 'فشل تصدير الأسئلة: ' + error.message, 'error');
    }
}

// ========== نقل الأسئلة بين المعلمين ==========
export async function showTransferQuestionsModal(sourceCode, sourceName) {
    if (!hasPermission('questions', 'edit')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لنقل الأسئلة', 'error');
        return;
    }
    let sourceQuestions = [];
    for (const grade of EGYPT_GRADES) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        const teacherQuestions = questions.filter(q => q.teacherId === sourceCode);
        sourceQuestions.push(...teacherQuestions.map(q => ({ ...q, grade })));
    }
    if (sourceQuestions.length === 0) {
        Swal.fire({ icon: 'info', title: 'لا توجد أسئلة', text: `المعلم ${escapeHtml(sourceName)} لا يمتلك أي أسئلة لنقلها`, background: '#0f172a', color: '#fff', confirmButtonColor: '#facc15' });
        return;
    }
    const treeMap = new Map();
    for (const q of sourceQuestions) {
        const subject = q.subject || 'بدون مادة';
        const grade = q.grade;
        const lesson = q.lesson || 'بدون درس';
        const key = `${subject}||${grade}`;
        if (!treeMap.has(key)) treeMap.set(key, { subject, grade, lessons: new Map() });
        const node = treeMap.get(key);
        node.lessons.set(lesson, (node.lessons.get(lesson) || 0) + 1);
    }
    const treeArray = Array.from(treeMap.values()).sort((a, b) => a.subject.localeCompare(b.subject) || a.grade.localeCompare(b.grade));
    let counter = 0;
    let html = `<div class="transfer-tree-container" style="max-height:55vh; overflow-y:auto; padding:0.5rem;"><div class="transfer-summary mb-4 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20 text-center"><span class="text-yellow-400 font-bold">📚 إجمالي الأسئلة: ${sourceQuestions.length}</span><span class="text-gray-400 mx-2">|</span><span class="text-cyan-400" id="selectedQuestionsCount">0</span><span class="text-gray-400"> سؤال محدد</span></div>`;
    for (const node of treeArray) {
        const subjectId = `subj_${counter++}`;
        const gradeId = `grade_${counter++}`;
        const totalQuestions = Array.from(node.lessons.values()).reduce((s, c) => s + c, 0);
        html += `<div class="tree-node mb-3 border border-slate-700 rounded-xl bg-slate-800/30 overflow-hidden"><div class="tree-node-header flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/50 transition-colors" onclick="document.getElementById('${subjectId}').classList.toggle('hidden'); this.querySelector('.toggle-icon').classList.toggle('fa-chevron-down'); this.querySelector('.toggle-icon').classList.toggle('fa-chevron-left');"><div class="flex items-center gap-3"><i class="fas fa-folder-open text-yellow-500"></i><span class="font-bold text-white">📘 ${escapeHtml(node.subject)}</span><span class="text-xs text-gray-400">🎓 ${escapeHtml(node.grade)}</span><span class="text-xs bg-slate-700 px-2 py-0.5 rounded-full">${totalQuestions} سؤال</span></div><div class="flex items-center gap-3"><input type="checkbox" class="subject-select w-4 h-4 accent-yellow-500" data-subject="${escapeHtml(node.subject)}" data-grade="${escapeHtml(node.grade)}"><i class="fas fa-chevron-left toggle-icon text-gray-400 transition-transform"></i></div></div><div id="${subjectId}" class="tree-children hidden pl-6 border-r-2 border-dashed border-slate-600 ml-4"><div class="tree-node-header flex items-center justify-between p-2 cursor-pointer hover:bg-slate-700/30" onclick="document.getElementById('${gradeId}').classList.toggle('hidden');"><div class="flex items-center gap-3"><i class="fas fa-folder text-cyan-400"></i><span class="font-bold text-cyan-300">🎓 ${escapeHtml(node.grade)}</span><span class="text-xs bg-slate-700 px-2 py-0.5 rounded-full">${totalQuestions} سؤال</span></div><input type="checkbox" class="grade-select w-4 h-4 accent-cyan-500" data-subject="${escapeHtml(node.subject)}" data-grade="${escapeHtml(node.grade)}"></div><div id="${gradeId}" class="tree-children hidden pl-4 mt-1 space-y-1">`;
        for (let [lesson, count] of node.lessons.entries()) {
            html += `<div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/40 transition-colors"><div class="flex items-center gap-2"><i class="fas fa-file-alt text-emerald-400"></i><span class="text-white">📖 ${escapeHtml(lesson)}</span><span class="text-xs text-gray-400">(${count})</span></div><input type="checkbox" class="lesson-select w-4 h-4 accent-emerald-500" data-subject="${escapeHtml(node.subject)}" data-grade="${escapeHtml(node.grade)}" data-lesson="${escapeHtml(lesson)}"></div>`;
        }
        html += `</div></div></div>`;
    }
    html += `</div><div class="flex justify-center mt-4"><button id="nextSelectionBtn" class="btn-primary px-8 py-2 text-lg"><i class="fas fa-arrow-left ml-2"></i> متابعة اختيار المستلمين</button></div>`;
    await Swal.fire({
        title: `<div class="flex items-center justify-center gap-3 text-2xl font-black text-yellow-400"><i class="fas fa-exchange-alt"></i> نقل أسئلة: ${escapeHtml(sourceName)}</div>`,
        html: `<div class="text-right" dir="rtl"><div class="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 p-3 rounded-xl mb-3"><div class="text-white">📤 من المعلم: <strong>${escapeHtml(sourceName)}</strong> (${sourceCode})</div><div class="text-yellow-400 text-sm">📚 إجمالي الأسئلة: ${sourceQuestions.length}</div></div>${html}</div>`,
        showConfirmButton: false, showCancelButton: true, cancelButtonText: 'إلغاء', background: '#0f172a', color: '#fff', width: '900px',
        customClass: { popup: 'rounded-3xl border border-yellow-500/30 shadow-2xl', cancelButton: '!bg-gray-700 !text-white !rounded-full !px-6 !py-2' },
        didOpen: () => {
            const container = document.querySelector('.transfer-tree-container');
            if (!container) return;
            const updateSelectedCount = () => {
                const checked = document.querySelectorAll('.lesson-select:checked').length;
                const countSpan = document.getElementById('selectedQuestionsCount');
                if (countSpan) countSpan.innerText = checked;
            };
            const updateGradeCheckbox = (subject, grade) => {
                const gradeCb = document.querySelector(`.grade-select[data-subject="${subject}"][data-grade="${grade}"]`);
                if (!gradeCb) return;
                const lessonCbs = document.querySelectorAll(`.lesson-select[data-subject="${subject}"][data-grade="${grade}"]`);
                const allChecked = Array.from(lessonCbs).every(cb => cb.checked);
                gradeCb.checked = allChecked;
                gradeCb.indeterminate = !allChecked && Array.from(lessonCbs).some(cb => cb.checked);
                updateSelectedCount();
            };
            const updateSubjectCheckbox = (subject, grade) => {
                const subjCb = document.querySelector(`.subject-select[data-subject="${subject}"][data-grade="${grade}"]`);
                if (!subjCb) return;
                const gradeCbs = document.querySelectorAll(`.grade-select[data-subject="${subject}"][data-grade="${grade}"]`);
                const allChecked = Array.from(gradeCbs).every(cb => cb.checked);
                subjCb.checked = allChecked;
                subjCb.indeterminate = !allChecked && Array.from(gradeCbs).some(cb => cb.checked);
                updateSelectedCount();
            };
            document.querySelectorAll('.lesson-select').forEach(cb => {
                cb.addEventListener('change', () => {
                    const subject = cb.dataset.subject, grade = cb.dataset.grade;
                    updateGradeCheckbox(subject, grade);
                    updateSubjectCheckbox(subject, grade);
                });
            });
            document.querySelectorAll('.grade-select').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const subject = cb.dataset.subject, grade = cb.dataset.grade;
                    const isChecked = e.target.checked;
                    document.querySelectorAll(`.lesson-select[data-subject="${subject}"][data-grade="${grade}"]`).forEach(l => l.checked = isChecked);
                    updateGradeCheckbox(subject, grade);
                    updateSubjectCheckbox(subject, grade);
                });
            });
            document.querySelectorAll('.subject-select').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const subject = cb.dataset.subject, grade = cb.dataset.grade;
                    const isChecked = e.target.checked;
                    document.querySelectorAll(`.grade-select[data-subject="${subject}"][data-grade="${grade}"]`).forEach(g => g.checked = isChecked);
                    document.querySelectorAll(`.lesson-select[data-subject="${subject}"][data-grade="${grade}"]`).forEach(l => l.checked = isChecked);
                    updateGradeCheckbox(subject, grade);
                    updateSubjectCheckbox(subject, grade);
                });
            });
            const nextBtn = document.getElementById('nextSelectionBtn');
            if (nextBtn) {
                nextBtn.onclick = () => {
                    const selectedLessons = [];
                    document.querySelectorAll('.lesson-select:checked').forEach(cb => selectedLessons.push({ subject: cb.dataset.subject, grade: cb.dataset.grade, lesson: cb.dataset.lesson }));
                    if (selectedLessons.length === 0) { Swal.fire('تنبيه', 'لم تختر أي أسئلة لنقلها', 'info'); return; }
                    const questionsToTransfer = sourceQuestions.filter(q => selectedLessons.some(sel => sel.subject === (q.subject || 'بدون مادة') && sel.grade === q.grade && sel.lesson === (q.lesson || 'بدون درس')));
                    if (questionsToTransfer.length === 0) { Swal.fire('خطأ', 'لا توجد أسئلة تطابق اختياراتك', 'error'); return; }
                    Swal.close();
                    openRecipientsModal(sourceCode, sourceName, questionsToTransfer);
                };
            }
        }
    });
}

export async function openRecipientsModal(sourceCode, sourceName, questionsToTransfer) {
    if (!hasPermission('questions', 'edit')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لنقل الأسئلة', 'error');
        return;
    }
    const teachers = await getTeachersList();
    const targetOptions = teachers.filter(t => (t.code || t.id) !== sourceCode).map(t => `<option value="${t.code || t.id}">${escapeHtml(t.name)} (${t.code || t.id}) - ${t.plan === 'free' ? 'مجاني' : (t.plan === 'silver' ? 'فضي' : 'ذهبي')}</option>`);
    if (targetOptions.length === 0) {
        Swal.fire('تنبيه', 'لا يوجد معلم آخر لنقل الأسئلة إليه', 'info');
        return;
    }
    const { value: destOptions } = await Swal.fire({
        title: `<div class="flex items-center justify-center gap-3 text-2xl font-black text-yellow-400"><i class="fas fa-users"></i> اختر المستلمين والوجهة</div>`,
        html: `<div class="text-right space-y-5 max-h-[70vh] overflow-y-auto" dir="rtl">
            <div class="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-3 text-center border border-purple-500/30"><span class="text-yellow-400 font-bold">📦 عدد الأسئلة المراد نقلها: ${questionsToTransfer.length}</span></div>
            <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700"><div class="flex items-center gap-2 mb-3 text-cyan-400"><i class="fas fa-filter"></i><span class="font-bold">📥 تصفية المستلمين</span></div><select id="destType" class="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white mb-4 focus:border-yellow-500 transition"><option value="all">جميع المعلمين (ما عدا المصدر)</option><option value="plan">حسب الخطة (فضي/ذهبي)</option><option value="specific">معلمين محددين (اختيار متعدد)</option><option value="grade">حسب الصف (الذين لديهم طلاب في صف معين)</option></select>
                <div id="destPlanContainer" class="hidden"><label class="block text-sm text-gray-400 mb-1">اختر الخطة</label><select id="destPlan" class="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white"><option value="silver">فضي</option><option value="gold">ذهبي</option></select></div>
                <div id="destTeachersContainer" class="hidden"><label class="block text-sm text-gray-400 mb-1">اختر المعلمين (يمكن اختيار عدة)</label><div class="max-h-52 overflow-y-auto border border-slate-600 rounded-xl p-2 bg-slate-900/50">${targetOptions.map(opt => `<label class="flex items-center gap-2 p-2 hover:bg-slate-700 rounded-lg cursor-pointer"><input type="checkbox" value="${opt.match(/value="([^"]+)"/)[1]}" class="dest-teacher-checkbox accent-yellow-500"> ${opt.replace(/<[^>]*>/g, '')}</label>`).join('')}</div><div class="text-xs text-gray-400 mt-1">✓ يمكنك اختيار أكثر من معلم</div></div>
                <div id="destGradeContainer" class="hidden"><label class="block text-sm text-gray-400 mb-1">اختر الصف الدراسي</label><select id="destGrade" class="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white">${EGYPT_GRADES.map(g => `<option value="${g}">${g}</option>`).join('')}</select></div>
            </div>
            <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700"><div class="flex items-center gap-2 mb-3 text-emerald-400"><i class="fas fa-map-marker-alt"></i><span class="font-bold">🎯 خيارات الوجهة (اختياري)</span></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="block text-sm text-gray-400 mb-1">الصف المستهدف (تغيير صف الأسئلة)</label><select id="targetGradeSelect" class="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white"><option value="">(نفس الصف الأصلي)</option>${EGYPT_GRADES.map(g => `<option value="${g}">${g}</option>`).join('')}</select></div><div><label class="block text-sm text-gray-400 mb-1">المادة المستهدفة (تغيير مادة الأسئلة)</label><input type="text" id="targetSubjectInput" class="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white" placeholder="اترك فارغاً للإبقاء"></div></div></div>
            <div class="bg-black/30 rounded-xl p-3 border border-dashed border-gray-600" id="recipientsPreview"><div class="text-xs text-gray-400 text-center">سيتم عرض عدد المستلمين هنا تلقائياً</div></div>
        </div>`,
        showCancelButton: true, confirmButtonText: '🚀 نقل الأسئلة الآن', cancelButtonText: 'إلغاء', confirmButtonColor: '#facc15', background: '#0f172a', color: '#fff', width: '850px',
        customClass: { popup: 'rounded-3xl border border-yellow-500/30 shadow-2xl', confirmButton: '!bg-gradient-to-r !from-yellow-500 !to-amber-600 !text-black !font-bold !px-6 !py-2 !rounded-full !text-base', cancelButton: '!bg-gray-700 !text-white !rounded-full !px-5 !py-2' },
        didOpen: () => {
            const typeSelect = document.getElementById('destType');
            const planDiv = document.getElementById('destPlanContainer');
            const teachersDiv = document.getElementById('destTeachersContainer');
            const gradeDiv = document.getElementById('destGradeContainer');
            const previewDiv = document.getElementById('recipientsPreview');
            const updatePreview = () => {
                const type = typeSelect.value;
                let count = 0;
                if (type === 'all') count = teachers.filter(t => (t.code || t.id) !== sourceCode).length;
                else if (type === 'plan') { const plan = document.getElementById('destPlan').value; count = teachers.filter(t => t.plan === plan && (t.code || t.id) !== sourceCode).length; previewDiv.innerHTML = `<div class="text-center text-sm"><span class="text-emerald-400">${count}</span> معلم سيتم نقل الأسئلة إليهم</div>`; return; }
                else if (type === 'specific') count = document.querySelectorAll('.dest-teacher-checkbox:checked').length;
                else if (type === 'grade') {
                    const grade = document.getElementById('destGrade').value;
                    (async () => {
                        const allStudents = await getAllStudents();
                        const teacherIdsWithGrade = new Set();
                        allStudents.forEach(s => { if (s.grade === grade && s.teacherId) teacherIdsWithGrade.add(s.teacherId); });
                        const validTeachers = teachers.filter(t => teacherIdsWithGrade.has(t.code || t.id) && (t.code || t.id) !== sourceCode);
                        previewDiv.innerHTML = `<div class="text-center text-sm"><span class="text-emerald-400">${validTeachers.length}</span> معلم سيتم نقل الأسئلة إليهم</div>`;
                    })().catch(console.error);
                    return;
                }
                previewDiv.innerHTML = `<div class="text-center text-sm"><span class="text-emerald-400">${count}</span> معلم سيتم نقل الأسئلة إليهم</div>`;
            };
            const updateVisibility = () => {
                planDiv.classList.add('hidden'); teachersDiv.classList.add('hidden'); gradeDiv.classList.add('hidden');
                if (typeSelect.value === 'plan') planDiv.classList.remove('hidden');
                else if (typeSelect.value === 'specific') teachersDiv.classList.remove('hidden');
                else if (typeSelect.value === 'grade') gradeDiv.classList.remove('hidden');
                updatePreview();
            };
            typeSelect.addEventListener('change', updateVisibility);
            document.getElementById('destPlan')?.addEventListener('change', updatePreview);
            document.getElementById('destGrade')?.addEventListener('change', updatePreview);
            if (teachersDiv) document.querySelectorAll('.dest-teacher-checkbox').forEach(cb => cb.addEventListener('change', updatePreview));
            updateVisibility();
        },
        preConfirm: () => {
            const destType = document.getElementById('destType').value;
            let recipients;
            if (destType === 'all') recipients = 'all';
            else if (destType === 'plan') recipients = { type: 'plan', plan: document.getElementById('destPlan').value };
            else if (destType === 'specific') {
                const selected = Array.from(document.querySelectorAll('.dest-teacher-checkbox:checked')).map(cb => cb.value);
                if (selected.length === 0) { Swal.showValidationMessage('❌ يرجى اختيار معلم واحد على الأقل'); return false; }
                recipients = { type: 'specific', teachers: selected };
            } else if (destType === 'grade') recipients = { type: 'grade', grade: document.getElementById('destGrade').value };
            const targetGrade = document.getElementById('targetGradeSelect').value || null;
            const targetSubject = document.getElementById('targetSubjectInput').value.trim() || null;
            return { recipients, targetGrade, targetSubject };
        }
    });
    if (!destOptions) return;
    let targetTeachers = [];
    if (destOptions.recipients === 'all') targetTeachers = teachers.filter(t => (t.code || t.id) !== sourceCode);
    else if (destOptions.recipients.type === 'plan') targetTeachers = teachers.filter(t => t.plan === destOptions.recipients.plan && (t.code || t.id) !== sourceCode);
    else if (destOptions.recipients.type === 'specific') targetTeachers = teachers.filter(t => destOptions.recipients.teachers.includes(t.code || t.id));
    else if (destOptions.recipients.type === 'grade') {
        const allStudents = await getAllStudents();
        const teacherIdsWithGrade = new Set();
        allStudents.forEach(s => { if (s.grade === destOptions.recipients.grade && s.teacherId) teacherIdsWithGrade.add(s.teacherId); });
        targetTeachers = teachers.filter(t => teacherIdsWithGrade.has(t.code || t.id) && (t.code || t.id) !== sourceCode);
    }
    if (targetTeachers.length === 0) { Swal.fire('تنبيه', 'لا يوجد معلمون يستوفون الشروط', 'info'); return; }
    Swal.fire({ title: 'جاري النقل...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let successCount = 0;
    for (const teacher of targetTeachers) {
        const teacherCode = teacher.code || teacher.id;
        const gradesSet = new Set(questionsToTransfer.map(q => q.grade));
        for (const grade of gradesSet) {
            let existing = await loadQuestionsFromIndexedDB(grade);
            const filtered = existing.filter(q => !questionsToTransfer.some(tq => tq.id === q.id));
            const newOnes = questionsToTransfer.filter(q => q.grade === grade).map(q => ({ ...q, teacherId: teacherCode, uniqueId: `${teacherCode}_${Date.now()}_${Math.random()}` }));
            await saveQuestionsToIndexedDB(grade, [...filtered, ...newOnes]);
        }
        successCount++;
    }
    const sourceGradesSet = new Set(questionsToTransfer.map(q => q.grade));
    for (const grade of sourceGradesSet) {
        let existing = await loadQuestionsFromIndexedDB(grade);
        const remaining = existing.filter(q => !questionsToTransfer.some(tq => tq.id === q.id));
        await saveQuestionsToIndexedDB(grade, remaining);
    }
    await addAuditLog('نقل أسئلة', `من ${sourceName} (${sourceCode}) إلى ${successCount} معلم`);
    Swal.fire('تم النقل', `تم نقل ${questionsToTransfer.length} سؤال بنجاح`, 'success');
    await renderQuestions();
}

// ========== حذف جميع أسئلة معلم ==========
export async function confirmDeleteTeacherQuestions(teacherCode, teacherName) {
    if (!hasPermission('questions', 'delete')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لحذف أسئلة المعلم', 'error');
        return;
    }
    const result = await Swal.fire({
        title: 'حذف أسئلة المعلم', html: `<p>هل أنت متأكد من حذف جميع أسئلة المعلم <strong>${escapeHtml(teacherName)}</strong>؟</p><p class="text-red-400">هذا الإجراء نهائي ولا يمكن التراجع عنه.</p>`,
        icon: 'warning', showCancelButton: true, confirmButtonText: 'نعم، احذف الكل', cancelButtonText: 'إلغاء', background: '#0f172a', color: '#fff'
    });
    if (!result.isConfirmed) return;
    Swal.fire({ title: 'جارٍ الحذف...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        for (const grade of EGYPT_GRADES) {
            let questions = await loadQuestionsFromIndexedDB(grade);
            const filtered = questions.filter(q => q.teacherId !== teacherCode);
            await saveQuestionsToIndexedDB(grade, filtered);
        }
        await addAuditLog('حذف أسئلة معلم (من المطور)', `${teacherName} (${teacherCode})`);
        Swal.fire('تم الحذف', `تم حذف جميع أسئلة ${teacherName}`, 'success');
        await renderQuestions();
    } catch (error) {
        console.error(error);
        Swal.fire('خطأ', 'فشل حذف الأسئلة: ' + error.message, 'error');
    }
}

// ========== حذف سؤال فردي ==========
export async function deleteQuestion(grade, questionId) {
    if (!hasPermission('questions', 'delete')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لحذف السؤال', 'error');
        return;
    }
    const confirm = await Swal.fire({ title: 'تأكيد الحذف', text: 'هل أنت متأكد؟', icon: 'warning', showCancelButton: true, background: '#0f172a', color: '#fff' });
    if (confirm.isConfirmed) {
        let questions = await loadQuestionsFromIndexedDB(grade);
        questions = questions.filter(q => q.id !== questionId);
        await saveQuestionsToIndexedDB(grade, questions);
        await addAuditLog('حذف سؤال', `سؤال من الصف ${grade}`);
        Swal.fire('تم الحذف', '', 'success');
        showNotification(`🗑️ تم حذف السؤال ${questionId} من الصف ${grade}`, 'info');
        await renderQuestions();
    }
}

// ========== حذف جميع الأسئلة (من كل الصفوف) ==========
export async function confirmDeleteAllQuestions() {
    if (!hasPermission('questions', 'delete')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لحذف جميع الأسئلة', 'error');
        return;
    }
    const result = await Swal.fire({
        title: '⚠️ تأكيد حذف جميع الأسئلة', text: 'سيتم حذف جميع الأسئلة من جميع الصفوف والمعلمين. لا يمكن التراجع!',
        icon: 'warning', showCancelButton: true, confirmButtonText: 'نعم، احذف الجميع', cancelButtonText: 'إلغاء', background: '#0f172a', color: '#fff'
    });
    if (result.isConfirmed) {
        Swal.fire({ title: 'جارٍ الحذف...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        for (const grade of EGYPT_GRADES) await saveQuestionsToIndexedDB(grade, []);
        await addAuditLog('حذف جميع الأسئلة', 'تم حذف كل الأسئلة من المنصة');
        Swal.fire('تم الحذف', 'تم حذف جميع الأسئلة', 'success');
        showNotification('🗑️ تم حذف جميع الأسئلة من جميع الصفوف', 'warning');
        await renderQuestions();
    }
}