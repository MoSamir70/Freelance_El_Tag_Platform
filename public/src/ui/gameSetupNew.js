// src/ui/gameSetupNew.js
// إعدادات التحدي واختيار الوضع – نسخة معدلة لدعم خطط الاشتراك (مجاني، فضي، ذهبي، مطور)
// ✅ تم تعديل قائمة الأوضاع المسموحة لكل خطة حسب متطلبات المستخدم:
//    - مجاني: 3 أوضاع فردية فقط
//    - فضي: 6 أوضاع فردية + 3 أوضاع جماعية
//    - ذهبي/مطور: جميع الأوضاع (9 فردي + 6 جماعي)

import { raceSettings } from '../core/raceSettings.js';
import { getQuestions } from '../services/dataService.js';
import { showFloatingNotification, escapeHtml } from '../utils.js';
import { soloModes, teamModes } from '../constants.js';
import { RaceSessionManager } from '../core/raceSession.js';
import { startRaceWithSettings } from '../core/raceEngine.js';
import { getTeacherPlan, getTeacherLockedSubject } from '../services/dataService.js';

let materialDebounceTimer = null;

// ✅ قائمة الأوضاع المتاحة حسب الخطة (معدلة حسب المتطلبات)
// الأوضاع الفردية (9): solo_classic, solo_memory, solo_mined, solo_bet, solo_speedrun, solo_marathon, solo_survival, solo_quizrush, solo_surprise
// الأوضاع الجماعية (6): team_relay, team_battle, team_trophy, team_mined, team_revenge, team_penalty

const MODES_BY_PLAN = {
    // مجاني: 3 أوضاع فردية فقط
    free: [
        'solo_classic',   // الكلاسيكي
        'solo_memory',    // تحدي الذاكرة
        'solo_marathon'   // ماراثون
    ],
    // فضي: 6 فردي + 3 جماعي
    silver: {
        individual: [
            'solo_classic',
            'solo_memory',
            'solo_mined',
            'solo_speedrun',
            'solo_survival',
            'solo_quizrush'
        ],
        team: [
            'team_relay',
            'team_trophy',
            'team_penalty'
        ]
    },
    // ذهبي ومطور: جميع الأوضاع
    gold: 'all',
    developer: 'all'
};

// قائمة بجميع معرفات الأوضاع
const ALL_SOLO_IDS = soloModes.map(m => m.id);
const ALL_TEAM_IDS = teamModes.map(m => m.id);
const ALL_MODES = [...ALL_SOLO_IDS, ...ALL_TEAM_IDS];

export async function loadSettingsPage() {
    if (!raceSettings.grade) {
        showFloatingNotification('اختر صفاً أولاً', 'error');
        window.showPage('grade-choice-page');
        return;
    }

    const teacherPlan = await getTeacherPlan();
    const lockedSubject = await getTeacherLockedSubject();
    const isFreeOrSilver = (teacherPlan === 'free' || teacherPlan === 'silver');
    
    // تحميل جميع المواد من الصف المختار
    const allQuestions = await getQuestions(raceSettings.grade);
    let allSubjects = [...new Set(allQuestions.map(q => q.subject).filter(s => s && s.trim()))];
    
    if (allSubjects.length === 0) {
        showFloatingNotification('⚠️ لا توجد مواد في هذا الصف، يرجى رفع أسئلة أولاً', 'warning');
        raceSettings.mergeMode = false;
        raceSettings.mergedMaterials = [];
    } else {
        if (isFreeOrSilver && lockedSubject) {
            if (!allSubjects.includes(lockedSubject)) {
                showFloatingNotification(`⚠️ المادة المقفلة "${lockedSubject}" غير موجودة في هذا الصف. يرجى رفع أسئلة لها.`, 'error');
                return;
            }
            raceSettings.mergeMode = true;
            raceSettings.mergedMaterials = [lockedSubject];
            raceSettings.subject = null;
            raceSettings.lessons = [];
            raceSettings.accumulative = false;
            console.log(`✅ الباقة ${teacherPlan} – مقفلة على مادة "${lockedSubject}"`);
        } else {
            if (!raceSettings.mergeMode || !raceSettings.mergedMaterials || raceSettings.mergedMaterials.length === 0) {
                raceSettings.mergeMode = true;
                raceSettings.mergedMaterials = [...allSubjects];
                raceSettings.subject = null;
                raceSettings.lessons = [];
                raceSettings.accumulative = false;
            }
            console.log(`✅ المواد المحددة حالياً: ${raceSettings.mergedMaterials.join(', ')}`);
        }
    }
    
    await renderSubjectsSelector(raceSettings.grade);
    
    document.getElementById('settings-goal').value = raceSettings.goal;
    document.getElementById('settings-timer').value = raceSettings.timer;
    
    document.getElementById('chooseLessonsBtn').onclick = () => window.showLessonsModal();
    window.updateSelectedLessonsPreview();
    
    document.getElementById('settingsNextBtn').onclick = () => {
        const newGoal = parseInt(document.getElementById('settings-goal').value);
        const newTimer = parseInt(document.getElementById('settings-timer').value);
        
        if (isNaN(newGoal) || newGoal < 1) {
            showFloatingNotification('عدد خطوات الفوز غير صحيح', 'error');
            return;
        }
        if (isNaN(newTimer) || newTimer < 3) {
            showFloatingNotification('وقت الإجابة يجب أن يكون 3 ثوان على الأقل', 'error');
            return;
        }
        
        raceSettings.goal = newGoal;
        raceSettings.timer = newTimer;
        
        if (isFreeOrSilver && (!raceSettings.mergedMaterials || raceSettings.mergedMaterials.length !== 1)) {
            showFloatingNotification(`⚠️ الباقة ${teacherPlan === 'free' ? 'المجانية' : 'الفضية'} تسمح بمادة واحدة فقط.`, 'error');
            return;
        }
        
        if (!raceSettings.mergeMode || raceSettings.mergedMaterials.length === 0) {
            showFloatingNotification('⚠️ يجب اختيار مادة واحدة على الأقل', 'error');
            return;
        }
        if (!raceSettings.accumulative && raceSettings.lessons.length === 0) {
            showFloatingNotification('⚠️ اختر درساً واحداً على الأقل أو فعّل التراكمي', 'error');
            return;
        }
        
        window.showPage('game-mode-page');
    };
    
    const backBtn = document.getElementById('backFromSettings');
    if (backBtn) {
        backBtn.onclick = () => window.showPage(raceSettings.isTeam ? 'team-setup-screen' : 'student-select-page');
    }
}

async function renderSubjectsSelector(grade) {
    const container = document.getElementById('settings-subject-container');
    if (!container) return;
    
    if (!grade) {
        container.innerHTML = '<div class="text-center text-gray-400">اختر صفاً أولاً</div>';
        return;
    }
    
    const teacherPlan = await getTeacherPlan();
    const lockedSubject = await getTeacherLockedSubject();
    const isFreeOrSilver = (teacherPlan === 'free' || teacherPlan === 'silver');
    
    const questions = await getQuestions(grade);
    let allSubjects = [...new Set(questions.map(q => q.subject).filter(s => s && s.trim()))];
    
    if (allSubjects.length === 0) {
        container.innerHTML = '<div class="text-center text-yellow-400">⚠️ لا توجد مواد، حمّل أسئلة أولاً</div>';
        return;
    }
    
    if (isFreeOrSilver && lockedSubject) {
        if (!allSubjects.includes(lockedSubject)) {
            container.innerHTML = `<div class="text-center text-red-400">⚠️ المادة المقفلة "${lockedSubject}" غير موجودة في هذا الصف. يرجى رفع أسئلة لها.</div>`;
            return;
        }
        allSubjects = [lockedSubject];
        raceSettings.mergedMaterials = [lockedSubject];
        raceSettings.mergeMode = true;
    }
    
    if (!raceSettings.mergedMaterials || raceSettings.mergedMaterials.length === 0) {
        raceSettings.mergedMaterials = [...allSubjects];
        raceSettings.mergeMode = true;
    }
    
    // ✅ وضع التدريب - تصميم أنيق ومصغر
    const trainingChecked = raceSettings.isTrainingMode ? 'checked' : '';
    const trainingHtml = `
        <div class="mt-3 p-2 rounded-2xl" style="background: rgba(15,25,45,0.5); backdrop-filter: blur(8px); border: 1px solid rgba(250,204,21,0.2);" id="trainingModePanel">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="text-lg">🥋</span>
                    <div>
                        <div class="text-amber-400 font-bold text-xs md:text-sm">وضع التدريب</div>
                        <div class="text-gray-400 text-[10px] hidden sm:block">لا يؤثر على الدرجات</div>
                    </div>
                </div>
                <div class="relative flex-shrink-0">
                    <input type="checkbox" id="trainingModeToggle" class="hidden-toggle" ${trainingChecked}>
                    <label for="trainingModeToggle" class="toggle-switch block w-12 h-6 rounded-full transition-all duration-200 cursor-pointer" style="background: ${trainingChecked ? '#facc15' : '#475569'}; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                        <span class="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-all duration-200 flex items-center justify-center text-xs shadow-sm" style="left: ${trainingChecked ? '26px' : '2px'};">${trainingChecked ? '🥋' : '⚙️'}</span>
                    </label>
                </div>
            </div>
            <div id="trainingModeStatus" class="text-center text-[10px] mt-1 ${trainingChecked ? 'text-yellow-400' : 'text-gray-500'}">
                ${trainingChecked ? '🟢 نشط - النتائج غير محسوبة' : '⚪ غير نشط - سيتم حفظ النتائج'}
            </div>
        </div>
    `;

    // إضافة CSS للـ toggle (مرة واحدة فقط)
    if (!document.getElementById('toggle-switch-mini-style')) {
        const style = document.createElement('style');
        style.id = 'toggle-switch-mini-style';
        style.textContent = `
            .hidden-toggle { display: none; }
            .toggle-switch:hover { transform: scale(1.02); }
            #trainingModePanel { transition: all 0.2s; }
        `;
        document.head.appendChild(style);
    }

    let cardsHtml = `
        <div class="glass-panel p-5 rounded-[32px]" style="background: rgba(15,25,45,0.6); backdrop-filter: blur(12px);">
            <div class="text-center mb-4">
                <span class="text-yellow-400 text-xl font-bold">📚 المواد المشمولة</span>
                ${isFreeOrSilver && lockedSubject ? '<p class="text-purple-300 text-sm mt-1">🔒 الباقة ' + (teacherPlan === 'free' ? 'المجانية' : 'الفضية') + ' مقفلة على مادة واحدة</p>' : '<p class="text-gray-400 text-sm mt-1">اضغط على بطاقة المادة لإلغاء/تحديد</p>'}
            </div>
            <div class="flex flex-wrap justify-center gap-3 mb-5" id="subjectsCardsContainer">
    `;
    
    allSubjects.forEach(subject => {
        const isSelected = raceSettings.mergedMaterials.includes(subject);
        const disabled = isFreeOrSilver && lockedSubject && lockedSubject !== subject;
        cardsHtml += `
            <div class="subject-card-modern ${isSelected ? 'selected' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}" data-subject="${escapeHtml(subject)}" style="
                background: ${isSelected ? 'linear-gradient(135deg, rgba(250,204,21,0.2), rgba(168,85,247,0.2))' : 'rgba(0,0,0,0.4)'};
                border: 1px solid ${isSelected ? '#facc15' : 'rgba(250,204,21,0.3)'};
                border-radius: 48px;
                padding: 0.6rem 1.4rem;
                cursor: ${disabled ? 'not-allowed' : 'pointer'};
                transition: all 0.25s cubic-bezier(0.2,0.9,0.4,1.1);
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                backdrop-filter: blur(8px);
                box-shadow: ${isSelected ? '0 0 15px rgba(250,204,21,0.4)' : 'none'};
            ">
                <span class="subject-icon" style="font-size:1.3rem;">📘</span>
                <span class="subject-name" style="color:${isSelected ? '#facc15' : '#fff'}; font-weight:600;">${escapeHtml(subject)}</span>
                ${isSelected ? '<span class="selected-check" style="font-size:1rem;">✓</span>' : ''}
            </div>
        `;
    });
    
    cardsHtml += `
            </div>
            ${!isFreeOrSilver ? `
            <div class="flex justify-center gap-4 mt-2 flex-wrap">
                <button id="selectAllSubjectsBtnModern" class="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-5 py-2 rounded-full text-sm font-bold transition shadow-md flex items-center gap-1">✅ تحديد الكل</button>
                <button id="unselectAllSubjectsBtnModern" class="bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white px-5 py-2 rounded-full text-sm font-bold transition shadow-md flex items-center gap-1">❌ إلغاء الكل</button>
                <button id="applySubjectsBtnModern" class="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black px-6 py-2 rounded-full text-sm font-bold transition shadow-md flex items-center gap-1">✅ تطبيق المواد المختارة</button>
            </div>
            ` : ''}
            <div class="text-center text-gray-400 text-xs mt-3">⚡ ملاحظة: تغيير المواد سيؤدي إلى إعادة تعيين الدروس المختارة</div>
        </div>
        ${trainingHtml}
    `;
    
    container.innerHTML = cardsHtml;
    
    // ربط الأحداث لاختيار المواد (إذا لم تكن مقيدة)
    if (!isFreeOrSilver) {
        const cards = document.querySelectorAll('.subject-card-modern');
        cards.forEach(card => {
            if (card.classList.contains('opacity-50')) return;
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-3px) scale(1.02)';
                card.style.borderColor = '#facc15';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                if (!card.classList.contains('selected')) {
                    card.style.borderColor = 'rgba(250,204,21,0.3)';
                }
            });
            card.addEventListener('click', () => {
                if (card.classList.contains('opacity-50')) return;
                const subject = card.dataset.subject;
                const isCurrentlySelected = card.classList.contains('selected');
                if (isCurrentlySelected) {
                    card.classList.remove('selected');
                    card.style.background = 'rgba(0,0,0,0.4)';
                    card.style.borderColor = 'rgba(250,204,21,0.3)';
                    card.style.boxShadow = 'none';
                    card.querySelector('.subject-name').style.color = '#fff';
                    const checkSpan = card.querySelector('.selected-check');
                    if (checkSpan) checkSpan.remove();
                } else {
                    card.classList.add('selected');
                    card.style.background = 'linear-gradient(135deg, rgba(250,204,21,0.2), rgba(168,85,247,0.2))';
                    card.style.borderColor = '#facc15';
                    card.style.boxShadow = '0 0 15px rgba(250,204,21,0.4)';
                    card.querySelector('.subject-name').style.color = '#facc15';
                    if (!card.querySelector('.selected-check')) {
                        const checkSpan = document.createElement('span');
                        checkSpan.className = 'selected-check';
                        checkSpan.style.fontSize = '1rem';
                        checkSpan.innerText = '✓';
                        card.appendChild(checkSpan);
                    }
                }
            });
        });
        
        const selectAllBtn = document.getElementById('selectAllSubjectsBtnModern');
        const unselectAllBtn = document.getElementById('unselectAllSubjectsBtnModern');
        const applyBtn = document.getElementById('applySubjectsBtnModern');
        
        if (selectAllBtn) {
            selectAllBtn.onclick = () => {
                document.querySelectorAll('.subject-card-modern:not(.opacity-50)').forEach(card => {
                    if (!card.classList.contains('selected')) {
                        card.click();
                    }
                });
            };
        }
        if (unselectAllBtn) {
            unselectAllBtn.onclick = () => {
                document.querySelectorAll('.subject-card-modern:not(.opacity-50)').forEach(card => {
                    if (card.classList.contains('selected')) {
                        card.click();
                    }
                });
            };
        }
        if (applyBtn) {
            applyBtn.onclick = () => {
                if (materialDebounceTimer) clearTimeout(materialDebounceTimer);
                materialDebounceTimer = setTimeout(() => {
                    const selected = Array.from(document.querySelectorAll('.subject-card-modern.selected:not(.opacity-50)')).map(card => card.dataset.subject);
                    if (selected.length === 0) {
                        showFloatingNotification('⚠️ يجب اختيار مادة واحدة على الأقل', 'error');
                        return;
                    }
                    raceSettings.mergeMode = true;
                    raceSettings.mergedMaterials = selected;
                    raceSettings.subject = null;
                    raceSettings.lessons = [];
                    raceSettings.selectedLessonsWithMaterial = [];
                    raceSettings.accumulative = false;
                    window.updateSelectedLessonsPreview();
                    showFloatingNotification(`✅ تم تحديث المواد المختارة (${selected.length} مادة)`, 'success');
                    materialDebounceTimer = null;
                }, 100);
            };
        }
    }
    
    // ✅ ربط حدث مفتاح وضع التدريب
    const toggleInput = document.getElementById('trainingModeToggle');
    if (toggleInput) {
        const newToggle = toggleInput.cloneNode(true);
        toggleInput.parentNode.replaceChild(newToggle, toggleInput);
        const finalToggle = document.getElementById('trainingModeToggle');
        const finalLabel = finalToggle?.nextElementSibling;
        const finalStatus = document.getElementById('trainingModeStatus');
        const finalSpan = finalLabel?.querySelector('span');
        
        if (finalToggle) {
            finalToggle.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                raceSettings.isTrainingMode = isChecked;
                if (finalLabel) {
                    finalLabel.style.background = isChecked ? '#facc15' : '#475569';
                }
                if (finalSpan) {
                    finalSpan.style.left = isChecked ? '26px' : '2px';
                    finalSpan.innerHTML = isChecked ? '🥋' : '⚙️';
                }
                if (finalStatus) {
                    finalStatus.innerHTML = isChecked ? '🟢 نشط - النتائج غير محسوبة' : '⚪ غير نشط - سيتم حفظ النتائج';
                    finalStatus.className = `text-center text-[10px] mt-1 ${isChecked ? 'text-yellow-400' : 'text-gray-500'}`;
                }
                showFloatingNotification(isChecked ? '🥋 تم تفعيل وضع التدريب (لن تحسب النتائج)' : 'تم إلغاء وضع التدريب (سيتم الحفظ)', 'info', 1500);
            });
        }
    }
}
export async function renderModesPage() {
    const container = document.getElementById('modes-container');
    if (!container) return;
    
    let teacherPlan = await getTeacherPlan();
    if (teacherPlan === 'platinum') teacherPlan = 'gold';
    
    const isFree = teacherPlan === 'free';
    const isSilver = teacherPlan === 'silver';
    const isGoldOrDev = (teacherPlan === 'gold' || teacherPlan === 'developer');
    
    let modes = raceSettings.isTeam ? teamModes : soloModes;
    let allModes = [...modes];
    
    // فصل الأوضاع القادمة (comingSoon)
    const comingSoonModes = allModes.filter(m => m.comingSoon === true);
    const normalModes = allModes.filter(m => !m.comingSoon);
    
    let allowedIds = [];
    let lockedIds = [];
    
    if (isFree) {
        allowedIds = MODES_BY_PLAN.free;
        lockedIds = normalModes.map(m => m.id).filter(id => !allowedIds.includes(id));
    } else if (isSilver) {
        if (raceSettings.isTeam) {
            allowedIds = MODES_BY_PLAN.silver.team;
        } else {
            allowedIds = MODES_BY_PLAN.silver.individual;
        }
        lockedIds = normalModes.map(m => m.id).filter(id => !allowedIds.includes(id));
    } else if (isGoldOrDev) {
        allowedIds = normalModes.map(m => m.id);
        lockedIds = [];
    } else {
        allowedIds = normalModes.map(m => m.id);
        lockedIds = [];
    }
    
    const allowedModes = normalModes.filter(m => allowedIds.includes(m.id));
    const lockedModes = normalModes.filter(m => lockedIds.includes(m.id));
    
    document.querySelector('#game-mode-page h2').innerHTML = raceSettings.isTeam ? '👥 وضع جماعي' : '🎖️ وضع فردي';
    
    const allowedHtml = allowedModes.map(m => `
        <div class="mode-card" data-mode="${m.id}">
            <div class="mode-icon">${m.icon}</div>
            <div class="mode-title">${m.name}</div>
            <div class="mode-desc">${m.desc}</div>
        </div>
    `).join('');
    
    const lockedHtml = lockedModes.map(m => `
        <div class="mode-card locked-mode" style="opacity: 0.5; filter: grayscale(0.5); position: relative; background: rgba(0,0,0,0.4); border: 1px solid rgba(250,204,21,0.2);">
            <div class="mode-icon">${m.icon}🔒</div>
            <div class="mode-title">${m.name}</div>
            <div class="mode-desc">${m.desc}</div>
            <div class="glow-lock" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 24px; box-shadow: 0 0 15px rgba(250,204,21,0.3), inset 0 0 10px rgba(250,204,21,0.2); pointer-events: none; animation: lockPulse 1.5s infinite;"></div>
            <button class="upgrade-mode-btn action-btn" style="position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%); background: #facc15; color:#000; font-size:0.8rem; padding: 4px 12px; border-radius: 20px;" onclick="window.location.href='index.html#pricing'">🔓 ترقية</button>
        </div>
    `).join('');
    
    // الأوضاع القادمة مع شريطة (ribbon) بزاوية 45 درجة
    const comingSoonHtml = comingSoonModes.map(m => `
    <div class="mode-card coming-soon-mode" data-mode="${m.id}" style="opacity: 0.85; position: relative; background: linear-gradient(135deg, #2d1b4e, #1a1a2e); border: 2px solid #facc15; box-shadow: 0 0 15px rgba(250,204,21,0.3); cursor: default; overflow: hidden;">
        <div class="ribbon-wrapper" style="position: absolute; top: 0; right: 0; overflow: hidden; width: 100px; height: 100px; z-index: 10;">
            <div class="ribbon" style="position: absolute; top: 18px; right: -30px; transform: rotate(45deg); background: linear-gradient(135deg, #facc15, #ffd966); color: #1a1a2e; font-weight: bold; font-size: 0.75rem; padding: 4px 40px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2); white-space: nowrap; font-family: 'Cairo', sans-serif; letter-spacing: 0.5px;">
                ✨ قريباً ✨
            </div>
        </div>
        <div class="mode-icon" style="font-size: 3rem;">${m.icon}</div>
        <div class="mode-title" style="color: #facc15;">${m.name}</div>
        <div class="mode-desc" style="font-size: 0.75rem;">${m.desc}</div>
        <!-- تم حذف السطر الذي كان يعرض "حصرياً" -->
    </div>
`).join('');
    
    container.innerHTML = `
        <div class="modes-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 1rem;">
            ${allowedHtml}
            ${lockedHtml}
            ${comingSoonHtml}
        </div>
        <style>
            @keyframes lockPulse {
                0% { box-shadow: 0 0 5px rgba(250,204,21,0.2), inset 0 0 5px rgba(250,204,21,0.1); }
                50% { box-shadow: 0 0 20px rgba(250,204,21,0.6), inset 0 0 15px rgba(250,204,21,0.3); }
                100% { box-shadow: 0 0 5px rgba(250,204,21,0.2), inset 0 0 5px rgba(250,204,21,0.1); }
            }
            .locked-mode:hover .glow-lock { animation: lockPulse 0.8s infinite; }
            .coming-soon-mode {
                cursor: not-allowed !important;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .coming-soon-mode:hover {
                transform: translateY(-5px);
                box-shadow: 0 0 25px rgba(250,204,21,0.6);
            }
            .coming-soon-mode:hover .ribbon {
                filter: brightness(1.05);
                box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            }
        </style>
    `;
    
    document.getElementById('mode-settings-container').classList.add('hidden');
    document.getElementById('startRaceFromModeBtn').disabled = true;
    
    // الأوضاع المسموحة
    document.querySelectorAll('.mode-card:not(.locked-mode):not(.coming-soon-mode)').forEach(c => {
        c.addEventListener('click', () => {
            document.querySelectorAll('.mode-card').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
            raceSettings.gameMode = c.dataset.mode;
            updateModeSettings(c.dataset.mode);
            document.getElementById('startRaceFromModeBtn').disabled = false;
        });
    });
    
    // الأوضاع القادمة - منع الاختيار مع إشعار
    document.querySelectorAll('.coming-soon-mode').forEach(c => {
        c.addEventListener('click', (e) => {
            e.stopPropagation();
            showFloatingNotification('⏳ هذا الوضع قيد التطوير وسيتم إطلاقه قريباً!', 'info', 2000);
        });
    });
    
    document.getElementById('startRaceFromModeBtn').onclick = () => {
        if (!raceSettings.gameMode) return showFloatingNotification('اختر وضع اللعب', 'error');
        if (!raceSettings.mergedMaterials || raceSettings.mergedMaterials.length === 0) {
            showFloatingNotification('⚠️ لا توجد مواد محددة. عد إلى إعدادات التحدي.', 'error');
            window.showPage('game-settings-page');
            return;
        }
        const sessionId = RaceSessionManager.create();
        const session = RaceSessionManager.getSession(sessionId);
        if (session && raceSettings.isTrainingMode) {
            session.raceData.isTrainingMode = true;
        }
        RaceSessionManager.setActive(sessionId);
        startRaceWithSettings(sessionId);
    };
}
function updateModeSettings(modeId) {
    const container = document.getElementById('mode-settings-container');
    if (!container) return;
    let html = '';
    if (modeId === 'solo_memory') {
        html = '<div class="settings-card"><label>🧠 وقت الاختفاء (ثواني)</label><input type="number" id="mode-memory-time" class="setting-input" value="3" min="1" max="10"></div>';
    } else if (modeId === 'solo_mined') {
        html = `
            <div class="settings-card">
                <label style="display:block; margin-bottom:0.5rem;">💣 اختر نسبة الألغام</label>
                <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    <button class="mined-chance-btn" data-chance="20">⚡ 20%</button>
                    <button class="mined-chance-btn active" data-chance="30">⚠️ 30%</button>
                    <button class="mined-chance-btn" data-chance="50">🔥 50%</button>
                    <button class="mined-chance-btn" data-chance="70">💀 70%</button>
                </div>
            </div>`;
    } else if (modeId === 'solo_bet') {
        html = '<div class="settings-card"><label>🎲 الحد الأقصى للرهان</label><input type="number" id="mode-bet-max" class="setting-input" value="3" min="1" max="5"></div>';
    }
    if (html) {
        container.innerHTML = html;
        container.classList.remove('hidden');
        if (modeId === 'solo_mined') {
            const buttons = container.querySelectorAll('.mined-chance-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    buttons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    window.__selectedMinedChance = parseInt(btn.dataset.chance);
                });
            });
            window.__selectedMinedChance = 30;
        }
        if (modeId === 'solo_bet') {
            const betInput = document.getElementById('mode-bet-max');
            if (betInput) {
                betInput.value = raceSettings.modeSettings?.betMax || 3;
                betInput.addEventListener('change', () => {
                    raceSettings.modeSettings.betMax = parseInt(betInput.value) || 3;
                });
            }
        }
    } else {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
}