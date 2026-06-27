// ===================== src/questions/lessons.js =====================
// إدارة الدروس: عرض قائمة الدروس، تفاصيل الدرس، نافذة اختيار الدروس (جميع المواد تلقائياً)

import { raceSettings } from '../core/raceSettings.js';
import { loadQuestionsFromIndexedDB } from '../db/indexeddb.js';
import { showFloatingNotification, escapeHtml } from '../utils.js';

// ✅ منع إعادة تحميل بنك الأسئلة أثناء فتح النوافذ المنبثقة
window.preventBankReload = false;

// ===================== عرض قائمة الدروس لمادة معينة (نافذة منبثقة) =====================
export async function showLessonsList(grade, subject) {
    if (window.preventBankReload) return;

    const existing = document.querySelector('.lessons-list-popup');
    if (existing) existing.remove();
    const existingOverlay = document.querySelector('.detail-overlay');
    if (existingOverlay) existingOverlay.remove();

    window.preventBankReload = true; // ⛔ منع تحديث بنك الأسئلة

    const allQuestions = await loadQuestionsFromIndexedDB(grade);
    const subjectQuestions = allQuestions.filter(q => q.subject === subject);
    
    const lessonCounts = new Map();
    subjectQuestions.forEach(q => {
        const lesson = q.lesson || 'بدون درس';
        lessonCounts.set(lesson, (lessonCounts.get(lesson) || 0) + 1);
    });

    let html = `
        <div class="detail-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:29999;"></div>
        <div class="lessons-list-popup" style="z-index:30000;">
            <button class="close-popup">✕</button>
            <h4>📖 دروس ${escapeHtml(subject)}</h4>
            <div style="display: flex; flex-direction: column; gap: 0.7rem;">
    `;

    for (let [lesson, count] of lessonCounts) {
        html += `
            <div class="lesson-list-item" data-lesson="${escapeHtml(lesson)}" data-grade="${escapeHtml(grade)}" data-subject="${escapeHtml(subject)}">
                <span class="lesson-name">📘 ${escapeHtml(lesson)}</span>
                <span class="lesson-count">${count} سؤال</span>
            </div>`;
    }

    html += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // ربط أحداث الإغلاق
    const closePopup = () => {
        document.querySelector('.lessons-list-popup')?.remove();
        document.querySelector('.detail-overlay')?.remove();
        window.preventBankReload = false;
    };

    document.querySelector('.lessons-list-popup .close-popup')?.addEventListener('click', closePopup);
    document.querySelector('.detail-overlay')?.addEventListener('click', closePopup);

    // ربط أحداث عناصر الدروس
    document.querySelectorAll('.lessons-list-popup .lesson-list-item').forEach(item => {
        item.addEventListener('click', async () => {
            const lesson = item.dataset.lesson;
            const grade = item.dataset.grade;
            const subject = item.dataset.subject;
            closePopup(); // تغلق القائمة أولاً
            await showLessonDetail(grade, subject, lesson);
        });
    });
}

// ===================== عرض تفاصيل درس معين =====================
export async function showLessonDetail(grade, subject, lesson) {
    if (window.preventBankReload) return;

    const existing = document.querySelector('.lesson-detail-popup');
    if (existing) existing.remove();
    const existingOverlay = document.querySelector('.detail-overlay');
    if (existingOverlay) existingOverlay.remove();

    window.preventBankReload = true;

    const allQuestions = await loadQuestionsFromIndexedDB(grade);
    const lessonQuestions = allQuestions.filter(q => q.subject === subject && q.lesson === lesson);

    const types = {};
    const levels = {};
    lessonQuestions.forEach(q => {
        const cat = q.cat || 'عام';
        types[cat] = (types[cat] || 0) + 1;
        const diff = q.difficulty || 'متوسط';
        levels[diff] = (levels[diff] || 0) + 1;
    });

    let html = `
        <div class="detail-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:29999;"></div>
        <div class="lesson-detail-popup" style="z-index:30000;">
            <button class="close-popup">✕</button>
            <h4>📘 ${escapeHtml(lesson)}</h4>
            <div style="text-align:center; font-size:1.2rem; color:#cbd5e1; margin-bottom:1rem;">إجمالي الأسئلة: ${lessonQuestions.length}</div>
    `;

    if (Object.keys(types).length > 0) {
        html += `<div class="stat-section"><div class="stat-section-title">📂 الأنواع</div><div class="stat-row">`;
        for (let [type, count] of Object.entries(types)) {
            let percent = Math.round((count / lessonQuestions.length) * 100);
            let colorClass = percent <= 30 ? 'low' : (percent <= 70 ? 'mid' : 'high');
            html += `
                <div class="stat-item">
                    <div class="stat-label"><span>${escapeHtml(type)}</span><span>${count}</span></div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill ${colorClass}" style="width:${percent}%"></div></div>
                </div>`;
        }
        html += `</div></div>`;
    }

    if (Object.keys(levels).length > 0) {
        html += `<div class="stat-section"><div class="stat-section-title">⚡ المستويات</div><div class="stat-row">`;
        for (let [level, count] of Object.entries(levels)) {
            let percent = Math.round((count / lessonQuestions.length) * 100);
            let colorClass = percent <= 30 ? 'low' : (percent <= 70 ? 'mid' : 'high');
            html += `
                <div class="stat-item">
                    <div class="stat-label"><span>${escapeHtml(level)}</span><span>${count}</span></div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill ${colorClass}" style="width:${percent}%"></div></div>
                </div>`;
        }
        html += `</div></div>`;
    }

    html += `</div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    const closePopup = () => {
        document.querySelector('.lesson-detail-popup')?.remove();
        document.querySelector('.detail-overlay')?.remove();
        window.preventBankReload = false;
    };

    document.querySelector('.lesson-detail-popup .close-popup')?.addEventListener('click', closePopup);
    document.querySelector('.detail-overlay')?.addEventListener('click', closePopup);
}

// ===================== نافذة اختيار الدروس (جميع المواد تلقائياً) =====================
export async function showLessonsModal() {
    const grade = raceSettings.grade;
    if (!grade) {
        showFloatingNotification('اختر الصف أولاً', 'error');
        return;
    }

    if (!raceSettings.mergeMode || !raceSettings.mergedMaterials || raceSettings.mergedMaterials.length === 0) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        const allSubjects = [...new Set(questions.map(q => q.subject).filter(s => s && s.trim()))];
        if (allSubjects.length === 0) {
            showFloatingNotification('⚠️ لا توجد مواد في هذا الصف، يرجى رفع أسئلة أولاً', 'error');
            return;
        }
        raceSettings.mergeMode = true;
        raceSettings.mergedMaterials = allSubjects;
        raceSettings.subject = null;
        raceSettings.lessons = [];
        raceSettings.accumulative = false;
    }

    const questions = await loadQuestionsFromIndexedDB(grade);
    
    const lessonsByMaterial = {};
    for (let material of raceSettings.mergedMaterials) {
        const materialLessons = [...new Set(
            questions.filter(q => q.subject === material && q.lesson && q.lesson.trim())
                     .map(q => q.lesson)
        )];
        if (materialLessons.length) lessonsByMaterial[material] = materialLessons;
    }

    if (Object.keys(lessonsByMaterial).length === 0) {
        showFloatingNotification('⚠️ لا توجد دروس في المواد المحددة.', 'error');
        return;
    }

    let html = `<div class="space-y-6" id="mergeLessonsContainer">`;
    for (const [material, lessons] of Object.entries(lessonsByMaterial)) {
        html += `
            <div class="border border-yellow-500/40 rounded-2xl p-4 bg-black/40">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-2xl font-bold text-yellow-400">📘 ${escapeHtml(material)}</h3>
                    <button class="selectMaterialBtn bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-yellow-400 transition" data-material="${escapeHtml(material)}">
                        ✅ تحديد كل دروس ${escapeHtml(material)}
                    </button>
                </div>
                <div class="grid grid-cols-2 gap-3">
        `;
        lessons.forEach(lesson => {
            const checked = (raceSettings.lessons && raceSettings.lessons.includes(lesson)) ? 'checked' : '';
            html += `
                    <label class="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-yellow-500/30 cursor-pointer transition border border-white/10">
                        <input type="checkbox" value="${escapeHtml(lesson)}" data-material="${escapeHtml(material)}" class="lesson-cb w-5 h-5 accent-yellow-400" ${checked}>
                        <span class="text-white text-lg">${escapeHtml(lesson)}</span>
                    </label>
            `;
        });
        html += `</div></div>`;
    }
    html += `</div>`;

    const result = await Swal.fire({
        title: '📖 اختيار الدروس (جميع المواد مشمولة)',
        html: `
            <div class="flex justify-center gap-3 mb-5 flex-wrap">
                <button id="globalSelectAllBtn" class="bg-green-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-green-500 transition">✅ تحديد كل الدروس (جميع المواد)</button>
                <button id="globalUnselectAllBtn" class="bg-gray-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-500 transition">❌ إلغاء الكل</button>
                <button id="accumulativeMergeBtn" class="bg-purple-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-purple-500 transition">📚 تراكمي (جميع الدروس)</button>
            </div>
            ${html}
        `,
        confirmButtonText: 'حفظ الاختيارات',
        cancelButtonText: 'إلغاء',
        showCancelButton: true,
        background: 'rgba(0, 0, 0, 0.9)',
        backdrop: 'rgba(0,0,0,0.7)',
        customClass: {
            popup: 'rounded-3xl border-2 border-yellow-500 w-full max-w-4xl',
            confirmButton: 'bg-yellow-500 text-black font-bold px-6 py-3 rounded-full text-lg',
            cancelButton: 'bg-gray-700 text-white px-6 py-3 rounded-full text-lg'
        },
        didOpen: () => {
            document.querySelectorAll('.selectMaterialBtn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const material = btn.dataset.material;
                    document.querySelectorAll(`input[data-material="${material}"]`).forEach(cb => cb.checked = true);
                };
            });
            document.getElementById('globalSelectAllBtn').onclick = () => {
                document.querySelectorAll('.lesson-cb').forEach(cb => cb.checked = true);
            };
            document.getElementById('globalUnselectAllBtn').onclick = () => {
                document.querySelectorAll('.lesson-cb').forEach(cb => cb.checked = false);
            };
            document.getElementById('accumulativeMergeBtn').onclick = () => {
                raceSettings.accumulative = true;
                raceSettings.lessons = [];
                if (typeof window.updateSelectedLessonsPreview === 'function') window.updateSelectedLessonsPreview();
                Swal.close();
                showFloatingNotification('تم تفعيل الوضع التراكمي (جميع الدروس من جميع المواد)', 'success');
            };
        },
        preConfirm: () => {
            const checked = Array.from(document.querySelectorAll('.lesson-cb:checked')).map(cb => cb.value);
            if (checked.length === 0) {
                Swal.showValidationMessage('❌ اختر درساً واحداً على الأقل أو استخدم التراكمي');
                return false;
            }
            return checked;
        }
    });

    if (result.value) {
        raceSettings.accumulative = false;
        const selectedItems = [];
        document.querySelectorAll('.lesson-cb:checked').forEach(cb => {
            selectedItems.push({
                material: cb.getAttribute('data-material'),
                lesson: cb.value
            });
        });
        raceSettings.selectedLessonsWithMaterial = selectedItems;
        raceSettings.lessons = selectedItems.map(item => item.lesson);
        if (typeof window.updateSelectedLessonsPreview === 'function') window.updateSelectedLessonsPreview();
        showFloatingNotification(`✅ تم اختيار ${selectedItems.length} درساً من ${new Set(selectedItems.map(i => i.material)).size} مادة.`, 'success');
    }
}

// ===================== تحديث معاينة الدروس المختارة =====================
export function updateSelectedLessonsPreview() {
    const preview = document.getElementById('selectedLessonsPreview');
    if (!preview) return;
    
    if (raceSettings.accumulative) {
        preview.innerHTML = '📚 تراكمي (جميع الدروس من جميع المواد)';
        preview.style.color = '#10b981';
    } else if (raceSettings.lessons.length > 0) {
        const count = raceSettings.lessons.length;
        const materialsCount = raceSettings.selectedLessonsWithMaterial ? new Set(raceSettings.selectedLessonsWithMaterial.map(i => i.material)).size : 0;
        preview.innerHTML = `✅ تم اختيار ${count} درساً من ${materialsCount} مادة`;
        preview.style.color = '#facc15';
        preview.title = raceSettings.lessons.join('، ');
    } else {
        preview.innerHTML = '⚠️ لم يتم اختيار أي درس';
        preview.style.color = '#ef4444';
        preview.title = '';
    }
}

// ===================== عرض المواد (بدون زر اختيار) =====================
export async function populateSubjectsForGrade(grade) {
    const container = document.getElementById('settings-subject-container');
    if (!container) return;

    if (!grade) {
        container.innerHTML = '<div class="text-center text-gray-400">اختر صفاً أولاً</div>';
        return;
    }

    const questions = await loadQuestionsFromIndexedDB(grade);
    const subjects = [...new Set(questions.map(q => q.subject).filter(s => s && s.trim()))];

    if (subjects.length === 0) {
        container.innerHTML = '<div class="text-center text-yellow-400">⚠️ لا توجد مواد، حمّل أسئلة أولاً</div>';
        return;
    }

    container.innerHTML = `
        <div class="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 rounded-2xl p-4 text-center border border-yellow-500/30 backdrop-blur-sm">
            <div class="text-yellow-400 font-bold mb-2 text-lg">📚 جميع المواد مشمولة تلقائياً</div>
            <div class="flex flex-wrap justify-center gap-2">
                ${subjects.map(s => `<span class="bg-black/50 px-3 py-1 rounded-full text-sm text-white">${escapeHtml(s)}</span>`).join('')}
            </div>
            <div class="text-xs text-gray-400 mt-2">يمكنك اختيار الدروس من أي مادة</div>
        </div>
    `;
}

// ===================== نافذة دمج المواد (اختياري) =====================
export async function openMergeModal() {
    const grade = raceSettings.grade;
    if (!grade) {
        showFloatingNotification('❌ يرجى اختيار الصف أولاً', 'error');
        return;
    }

    const allQuestions = await loadQuestionsFromIndexedDB(grade);
    const allMaterials = [...new Set(allQuestions.map(q => q.subject).filter(s => s && s.trim()))];
    if (allMaterials.length === 0) {
        showFloatingNotification('⚠️ لا توجد مواد في هذا الصف، يرجى رفع أسئلة أولاً.', 'error');
        return;
    }

    const currentMaterials = raceSettings.mergedMaterials || allMaterials;
    
    const materialOptions = allMaterials.map(m => `
        <label class="flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-yellow-500/30 cursor-pointer transition border border-yellow-500/50 mb-3">
            <input type="checkbox" value="${escapeHtml(m)}" class="w-6 h-6 accent-yellow-400" ${currentMaterials.includes(m) ? 'checked' : ''}>
            <span class="text-xl font-bold text-white">${escapeHtml(m)}</span>
        </label>
    `).join('');

    const { value: selectedMaterials } = await Swal.fire({
        title: '📦 تعديل المواد المشمولة (اختياري)',
        html: `<div class="max-h-96 overflow-y-auto px-2 text-right">${materialOptions}</div>`,
        confirmButtonText: 'تأكيد المواد ✅',
        cancelButtonText: 'إلغاء',
        showCancelButton: true,
        background: 'rgba(0, 0, 0, 0.85)',
        backdrop: 'rgba(0,0,0,0.7)',
        customClass: {
            popup: 'rounded-3xl border-2 border-yellow-500 w-full max-w-lg',
            confirmButton: 'bg-yellow-500 text-black font-bold px-8 py-3 rounded-full text-lg',
            cancelButton: 'bg-gray-700 text-white px-8 py-3 rounded-full text-lg'
        },
        preConfirm: () => {
            const checked = Array.from(document.querySelectorAll('.swal2-html-container input:checked')).map(cb => cb.value);
            if (checked.length === 0) {
                Swal.showValidationMessage('❌ اختر مادة واحدة على الأقل');
                return false;
            }
            return checked;
        }
    });

    if (!selectedMaterials) return;

    raceSettings.mergeMode = true;
    raceSettings.mergedMaterials = selectedMaterials;
    raceSettings.subject = null;
    raceSettings.lessons = [];
    raceSettings.accumulative = false;

    await populateSubjectsForGrade(grade);
    
    const preview = document.getElementById('selectedLessonsPreview');
    if (preview) {
        preview.innerHTML = `🔀 مواد مدمجة: ${selectedMaterials.map(escapeHtml).join(' + ')} (اختر دروسك الآن)`;
        preview.style.color = '#facc15';
    }
    showFloatingNotification('✅ تم تحديث المواد المدمجة، يمكنك الآن اختيار الدروس.', 'success');
}