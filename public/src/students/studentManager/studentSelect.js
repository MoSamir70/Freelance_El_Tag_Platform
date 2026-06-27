// src/students/studentManager/studentSelect.js
// نسخة معدلة – تعتمد على dbLight (المزامن تلقائياً) والدوال العامة
// مع التحقق من وجود showPage
// [FIX] إعادة تعيين raceSettings.studentIds عند عرض الصفحة
// [FIX] تحسين معالجة أزرار تحديد الكل وإلغاء الكل
// [FIX] منع إضافة طالب مكرر
// [FIX] تحسين حالة زر "التالي"

import { showFloatingNotification, escapeHtml } from '../../utils.js';
import { dbLight } from '../../db/localstorage.js';


export async function renderStudentSelect() {
    const container = document.getElementById('student-select-grid');
    if (!container) return;

    if (!window.raceSettings) {
        showFloatingNotification('حدث خطأ، الرجاء إعادة اختيار الصف', 'error');
        if (typeof window.showPage === 'function') {
            window.showPage('grade-choice-page');
        } else {
            console.error('showPage not available, cannot navigate');
        }
        return;
    }

    const raceSettings = window.raceSettings;
    
    // ✅ إعادة تعيين قائمة الطلاب المختارين عند عرض الصفحة (لتجنب بقاء بيانات من جلسة سابقة)
    raceSettings.studentIds = [];
    
    const students = (dbLight.students || []).filter(s => s.grade === raceSettings.grade);
    const isSolo = raceSettings.raceType === 'solo';
    const nextBtn = document.getElementById('studentSelectNextBtn');
    const backBtn = document.getElementById('backFromStudentSelect');

    function updateNextButtonState() {
        if (!nextBtn) return;
        const disabled = (raceSettings.studentIds.length === 0);
        nextBtn.disabled = disabled;
        nextBtn.style.opacity = disabled ? '0.5' : '1';
        nextBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }

    if (!students.length) {
        container.innerHTML = `<div class="glass-panel p-8 text-center col-span-full" style="border-radius: 48px;">
            <div class="text-7xl mb-4">👥</div>
            <div class="text-2xl font-bold text-yellow-400 mb-2">لا يوجد طلاب في هذا الصف</div>
            <div class="text-gray-300 mb-4">يمكنك إضافة طلاب من صفحة "الطلاب" أو اختيار صف آخر</div>
            <button class="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-full transition-all" onclick="if(window.showPage) window.showPage('st-page')">➕ الذهاب لإضافة طلاب</button>
        </div>`;
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.5';
            nextBtn.style.cursor = 'not-allowed';
        }
        return;
    }

    // عرض بطاقات الطلاب
    container.innerHTML = students.map(s => `
        <div class="student-card-select" data-id="${s.id}">
            <img src="${s.img}" alt="${escapeHtml(s.name)}">
            <div class="font-bold text-lg mt-2">${escapeHtml(s.name)}</div>
            <div class="text-yellow-400 text-sm">⭐ ${s.score}</div>
        </div>
    `).join('');

    // إذا كان الوضع فردي وكان هناك طالب مختار مسبقاً (لن يحدث لأننا أعدنا التعيين، لكن احتياطاً)
    if (isSolo && raceSettings.studentIds.length > 0) {
        const selectedId = raceSettings.studentIds[0];
        const selectedCard = document.querySelector(`.student-card-select[data-id="${selectedId}"]`);
        if (selectedCard) selectedCard.classList.add('selected');
    }

    updateNextButtonState();

    // معالج النقر على البطاقات
    container.onclick = (e) => {
        const card = e.target.closest('.student-card-select');
        if (!card) return;
        const id = String(card.dataset.id);
        
        if (isSolo) {
            // فردي: نزيل التحديد عن الكل ونختار هذا فقط
            document.querySelectorAll('.student-card-select').forEach(c => c.classList.remove('selected'));
            raceSettings.studentIds = [id];
            card.classList.add('selected');
        } else {
            // جماعي: تبديل التحديد
            if (raceSettings.studentIds.includes(id)) {
                raceSettings.studentIds = raceSettings.studentIds.filter(i => i !== id);
                card.classList.remove('selected');
            } else {
                raceSettings.studentIds.push(id);
                card.classList.add('selected');
            }
        }
        updateNextButtonState();
    };

    // ========== أزرار تحديد الكل وإلغاء الكل (للوضع الجماعي فقط) ==========
    if (!isSolo) {
        // ✅ إزالة أي أزرار سابقة لتجنب التكرار
        let controlsDiv = document.querySelector('#student-select-page .selection-controls');
        if (controlsDiv) {
            controlsDiv.remove();
        }
        
        // إنشاء حاوية جديدة
        controlsDiv = document.createElement('div');
        controlsDiv.className = 'selection-controls flex justify-center gap-4 my-4';
        const gridContainer = document.getElementById('student-select-grid');
        if (gridContainer && gridContainer.parentNode) {
            gridContainer.parentNode.insertBefore(controlsDiv, gridContainer);
        }
        
        controlsDiv.innerHTML = `
            <button id="selectAllStudentsBtn" class="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-full text-sm font-bold transition shadow-md">✅ تحديد الكل</button>
            <button id="unselectAllStudentsBtn" class="bg-gray-600 hover:bg-gray-500 text-white px-5 py-2 rounded-full text-sm font-bold transition shadow-md">❌ إلغاء الكل</button>
        `;
        
        const selectAllBtn = document.getElementById('selectAllStudentsBtn');
        const unselectAllBtn = document.getElementById('unselectAllStudentsBtn');
        
        if (selectAllBtn) {
            selectAllBtn.onclick = () => {
                const allCards = document.querySelectorAll('#student-select-grid .student-card-select');
                const allIds = Array.from(allCards).map(card => card.dataset.id);
                // تجنب التكرار
                const uniqueIds = [...new Set(allIds)];
                raceSettings.studentIds = uniqueIds;
                allCards.forEach(card => card.classList.add('selected'));
                updateNextButtonState();
                showFloatingNotification(`تم تحديد ${uniqueIds.length} طالب`, 'success', 1500);
            };
        }
        if (unselectAllBtn) {
            unselectAllBtn.onclick = () => {
                raceSettings.studentIds = [];
                document.querySelectorAll('#student-select-grid .student-card-select').forEach(card => card.classList.remove('selected'));
                updateNextButtonState();
                showFloatingNotification('تم إلغاء تحديد جميع الطلاب', 'info', 1500);
            };
        }
    } else {
        // ✅ في حالة الوضع الفردي: إزالة أي أزرار متبقية
        const existingControls = document.querySelector('#student-select-page .selection-controls');
        if (existingControls) existingControls.remove();
    }

    // زر "التالي"
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (raceSettings.studentIds.length === 0) {
                showFloatingNotification('اختر طالباً واحداً على الأقل', 'error');
                return;
            }
            if (raceSettings.isTeam) {
                (async () => {
                    const selected = (dbLight.students || []).filter(s => raceSettings.studentIds.includes(String(s.id)));
                    const numTeams = parseInt(document.getElementById('num-teams-select')?.value) || 2;
                    const teams = [];
                    for (let t = 0; t < numTeams; t++) teams.push({ id: t + 1, name: `فريق ${t + 1}`, members: [], pos: 0, score: 0, leader: null });
                    selected.forEach((s, idx) => teams[idx % numTeams].members.push(s));
                    teams.forEach(t => { if (t.members.length) t.leader = t.members[0]; });
                    raceSettings.teams = teams;
                    if (typeof window.showPage === 'function') {
                        window.showPage('team-setup-screen');
                    } else {
                        console.error('showPage not available');
                    }
                })();
            } else {
                if (typeof window.showPage === 'function') {
                    window.showPage('game-settings-page');
                } else {
                    console.error('showPage not available');
                }
            }
        };
    }

    // زر "رجوع"
    if (backBtn) {
        backBtn.onclick = () => {
            if (typeof window.showPage === 'function') {
                window.showPage('grade-choice-page');
            } else {
                console.error('showPage not available');
            }
        };
    }
}
export async function addStudentToCurrentRace(studentId, silent = false) {
    const raceSettings = window.raceSettings;
    const student = (dbLight.students || []).find(s => String(s.id) === String(studentId));
    if (!student) return;

    if (raceSettings.studentIds.includes(String(student.id))) {
        if (!silent) showFloatingNotification(`⚠️ ${student.name} موجود بالفعل في المشاركين`, 'warning');
        return;
    }

    if (!raceSettings.isTeam) {
        if (raceSettings.studentIds.length > 0) {
            if (!silent) {
                Swal.fire({
                    title: '⚠️ انتباه',
                    text: `الوضع الفردي يسمح بمشارك واحد فقط. تريد استبدال المشارك الحالي بـ ${student.name}؟`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، استبدل',
                    cancelButtonText: 'إلغاء',
                    background: '#0f172a',
                    color: '#fff'
                }).then(result => {
                    if (result.isConfirmed) {
                        raceSettings.studentIds = [student.id];
                        renderStudentSelect();
                        showFloatingNotification(`✅ تم استبدال المشارك بـ ${student.name}`, 'success');
                    }
                });
            }
            return;
        }
    }

    raceSettings.studentIds.push(student.id);
    if (!silent) showFloatingNotification(`✅ تم إضافة ${student.name} إلى المشاركين`, 'success');
}