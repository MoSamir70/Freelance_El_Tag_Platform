// src/students/studentManager/teamSetup.js
// دوال إعداد الفرق وتوزيعها (شاشة إعداد الفرق)
// [FIX] إصلاح ظهور الطلاب المضافة حديثاً في قائمة الانتظار
// [FIX] استخدام dataService بدلاً من dbLight المباشر
// [FIX] تحسين balancedTeams و shuffleTeams
// [FIX] إصلاح adjustTeamCount للحفاظ على الطلاب عند تقليل عدد الفرق
// [FIX] إضافة التحقق من وجود قائد لكل فريق قبل المتابعة

import { showFloatingNotification, escapeHtml } from '../../utils.js';
import { getStudents, getStudentById } from '../../services/dataService.js';
import { renderStudentSelect, addStudentToCurrentRace } from './studentSelect.js';
import { saveTeamTemplate, loadTeamTemplate } from './teamTemplates.js';

// ===================== عرض شاشة إعداد الفرق =====================
export async function renderTeamSetupScreen() {
    const raceSettings = window.raceSettings;
    if (!raceSettings.teams || raceSettings.teams.length === 0) {
        const selected = await getStudents();
        const filtered = selected.filter(s => raceSettings.studentIds.includes(String(s.id)));
        const numTeams = parseInt(document.getElementById('num-teams-select')?.value) || 2;
        const teams = [];
        for (let t = 0; t < numTeams; t++) teams.push({ id: t + 1, name: `فريق ${t + 1}`, members: [], pos: 0, score: 0, leader: null });
        filtered.forEach((s, idx) => teams[idx % numTeams].members.push(s));
        teams.forEach(t => { if (t.members.length) t.leader = t.members[0]; });
        raceSettings.teams = teams;
    }
    await renderTeamsUI(raceSettings.teams);
    
    const numSelect = document.getElementById('num-teams-select');
    if (numSelect) {
        numSelect.onchange = () => adjustTeamCount();
    }

    let controlsContainer = document.querySelector('#team-setup-screen .flex.justify-center.gap-4.items-center');
    if (!controlsContainer) {
        const header = document.querySelector('#team-setup-screen h2');
        if (header) {
            const div = document.createElement('div');
            div.className = 'flex flex-wrap justify-center gap-3 items-center mb-6';
            header.insertAdjacentElement('afterend', div);
            controlsContainer = div;
        }
    }
    
    function addButtonIfMissing(id, html, clickHandler) {
        let btn = document.getElementById(id);
        if (!btn && controlsContainer) {
            controlsContainer.insertAdjacentHTML('beforeend', html);
            btn = document.getElementById(id);
        }
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', clickHandler);
        }
        return btn;
    }
    
    const shuffleBtn = document.getElementById('shuffleTeamsBtn');
    if (shuffleBtn) {
        shuffleBtn.onclick = () => shuffleTeams();
    }
    
    addButtonIfMissing('balancedTeamsBtn', 
        '<button id="balancedTeamsBtn" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-full text-sm flex items-center gap-1">⚖️ توزيع متوازن</button>', 
        () => balancedTeams());
    
    addButtonIfMissing('addStudentFromTeamBtn', 
        '<button id="addStudentFromTeamBtn" class="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-sm flex items-center gap-1">➕ إضافة طالب</button>', 
        () => showAddStudentModal());
    
    addButtonIfMissing('saveTeamTemplateBtn', 
        '<button id="saveTeamTemplateBtn" class="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-full text-sm flex items-center gap-1">💾 حفظ القالب</button>', 
        () => saveTeamTemplate());
    
    addButtonIfMissing('loadTeamTemplateBtn', 
        '<button id="loadTeamTemplateBtn" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm flex items-center gap-1">📂 تحميل القالب</button>', 
        () => loadTeamTemplate());
    
    const confirmBtn = document.getElementById('confirmTeamsBtn');
    if (confirmBtn) confirmBtn.onclick = confirmTeamsAndProceed;
}

// ===================== تعديل عدد الفرق =====================
export async function adjustTeamCount() {
    const raceSettings = window.raceSettings;
    const newCount = parseInt(document.getElementById('num-teams-select').value) || 2;
    const currentTeams = raceSettings.teams || [];
    const oldCount = currentTeams.length;
    
    if (newCount > oldCount) {
        for (let i = oldCount + 1; i <= newCount; i++) {
            currentTeams.push({ id: i, name: `فريق ${i}`, members: [], pos: 0, score: 0, leader: null });
        }
    } else if (newCount < oldCount) {
        const removedTeams = currentTeams.splice(newCount);
        const unassignedStudents = [];
        for (const team of removedTeams) {
            unassignedStudents.push(...team.members);
        }
        if (unassignedStudents.length) {
            if (!raceSettings.unassignedStudents) raceSettings.unassignedStudents = [];
            raceSettings.unassignedStudents.push(...unassignedStudents);
        }
    }
    
    raceSettings.teams = currentTeams;
    await renderTeamsUI(currentTeams);
}

// ===================== عرض واجهة الفرق =====================
export async function renderTeamsUI(teams) {
    const raceSettings = window.raceSettings;
    const container = document.getElementById('teams-container');
    const unassignedContainer = document.getElementById('unassigned-students-list');
    if (!container) return;
    
    const allStudents = await getStudents();
    const assignedIds = teams.flatMap(t => t.members.map(m => String(m.id)));
    
    // جمع الطلاب غير الموزعين من مصدرين: unassignedStudents و studentIds
    const unassignedRaw = raceSettings.unassignedStudents || [];
    const unassigned = unassignedRaw.filter(s => s && s.id && !assignedIds.includes(String(s.id)));
    
    const fromStudentIds = allStudents.filter(s => 
        raceSettings.studentIds.includes(String(s.id)) && !assignedIds.includes(String(s.id))
    );
    
    // دمج القائمتين وإزالة التكرارات
    const merged = [...unassigned, ...fromStudentIds];
    const finalUnassigned = [];
    const seenIds = new Set();
    for (const s of merged) {
        if (s && s.id && !seenIds.has(s.id)) {
            seenIds.add(s.id);
            finalUnassigned.push(s);
        }
    }
    
    container.innerHTML = teams.map(team => `
        <div class="team-card" data-team-id="${team.id}">
            <div class="team-header">
                <input class="team-name-input" value="${escapeHtml(team.name)}" data-team-id="${team.id}">
                <span class="text-purple-300 text-sm">${team.members.length} أعضاء</span>
            </div>
            <div class="team-members-list">
                ${team.members.map(member => `
                    <div class="member-item" data-member-id="${member.id}">
                        <div class="flex items-center gap-2">
                            <img src="${member.img}" class="w-8 h-8 rounded-full border border-yellow-500">
                            <span>${escapeHtml(member.name)}</span>
                            ${team.leader && String(team.leader.id) === String(member.id) ? '<span class="leader-badge">🧠 قائد</span>' : ''}
                        </div>
                        <div class="flex gap-2">
                            <button class="leader-btn ${team.leader && String(team.leader.id) === String(member.id) ? 'active' : ''}" data-team-id="${team.id}" data-member-id="${member.id}" title="تعيين كقائد">👑</button>
                            <button class="remove-from-team-btn" data-team-id="${team.id}" data-member-id="${member.id}">✕</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    if (unassignedContainer) {
        if (finalUnassigned.length) {
            unassignedContainer.innerHTML = `
                <div class="text-yellow-400 text-sm mb-2 flex items-center gap-2">
                    <i class="fas fa-user-clock"></i> بانتظار التوزيع (${finalUnassigned.length})
                </div>
                ${finalUnassigned.map(s => `
                    <div class="bg-purple-700/50 rounded-full px-4 py-2 flex items-center gap-2 mb-2">
                        <img src="${s.img}" class="w-8 h-8 rounded-full">
                        <span>${escapeHtml(s.name)}</span>
                        <select class="assign-team-select bg-black/60 border-yellow-500 rounded-full px-2 py-1 text-sm ml-auto" data-student-id="${s.id}">
                            <option value="">اختر فريق</option>
                            ${teams.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
                        </select>
                    </div>
                `).join('')}
            `;
        } else {
            unassignedContainer.innerHTML = '<div class="text-gray-400 text-sm flex items-center gap-2"><i class="fas fa-check-circle text-green-400"></i> تم توزيع جميع الطلاب</div>';
        }
    }
    
    attachTeamEventListeners(teams);
}

// ===================== ربط أحداث الفرق =====================
export function attachTeamEventListeners(teams) {
    const raceSettings = window.raceSettings;
    
    document.querySelectorAll('.leader-btn').forEach(btn => {
        btn.onclick = async () => {
            const teamId = parseInt(btn.dataset.teamId);
            const memberId = String(btn.dataset.memberId);
            const team = teams.find(t => t.id === teamId);
            if (team) {
                const member = team.members.find(m => String(m.id) === memberId);
                if (member) team.leader = member;
                await renderTeamsUI(teams);
            }
        };
    });
    
    document.querySelectorAll('.remove-from-team-btn').forEach(btn => {
        btn.onclick = async () => {
            const teamId = parseInt(btn.dataset.teamId);
            const memberId = String(btn.dataset.memberId);
            const team = teams.find(t => t.id === teamId);
            if (team) {
                const member = team.members.find(m => String(m.id) === memberId);
                if (member) {
                    team.members = team.members.filter(m => String(m.id) !== memberId);
                    if (team.leader && String(team.leader.id) === memberId) {
                        team.leader = team.members[0] || null;
                    }
                    if (!raceSettings.unassignedStudents) raceSettings.unassignedStudents = [];
                    raceSettings.unassignedStudents.push(member);
                    await renderTeamsUI(teams);
                }
            }
        };
    });
    
    document.querySelectorAll('.team-name-input').forEach(inp => {
        inp.onchange = () => {
            const teamId = parseInt(inp.dataset.teamId);
            const team = teams.find(t => t.id === teamId);
            if (team && inp.value.trim()) team.name = inp.value.trim();
        };
    });
    
    document.querySelectorAll('.assign-team-select').forEach(sel => {
        sel.onchange = async () => {
            const studentId = String(sel.dataset.studentId);
            const teamId = parseInt(sel.value);
            if (!teamId) return;
            const team = teams.find(t => t.id === teamId);
            const student = await getStudentById(studentId);
            if (team && student && !team.members.some(m => String(m.id) === studentId)) {
                team.members.push(student);
                if (!team.leader) team.leader = student;
                if (raceSettings.unassignedStudents) {
                    raceSettings.unassignedStudents = raceSettings.unassignedStudents.filter(s => String(s.id) !== studentId);
                }
                await renderTeamsUI(teams);
            }
            sel.value = '';
        };
    });
}

// ===================== توزيع متوازن =====================
export async function balancedTeams() {
    const raceSettings = window.raceSettings;
    const selected = (await getStudents()).filter(s => raceSettings.studentIds.includes(String(s.id)));
    if (selected.length === 0) {
        showFloatingNotification('لا يوجد طلاب مختارون', 'error');
        return;
    }
    const numTeams = parseInt(document.getElementById('num-teams-select').value) || 2;
    if (numTeams > selected.length) {
        showFloatingNotification(`عدد الفرق (${numTeams}) أكبر من عدد الطلاب (${selected.length})`, 'error');
        return;
    }

    const studentsWithWeight = selected.map(s => ({ ...s, weight: s.score || 0 }));
    studentsWithWeight.sort((a, b) => b.weight - a.weight);

    let teams = [];
    for (let i = 0; i < numTeams; i++) {
        teams.push({ id: i + 1, name: `فريق ${i + 1}`, members: [], pos: 0, score: 0, leader: null });
    }

    let direction = 1;
    let teamIndex = 0;
    for (let i = 0; i < studentsWithWeight.length; i++) {
        teams[teamIndex].members.push(studentsWithWeight[i]);
        if (direction === 1) {
            if (teamIndex === numTeams - 1) direction = -1;
            else teamIndex++;
        } else {
            if (teamIndex === 0) direction = 1;
            else teamIndex--;
        }
    }

    teams.forEach(team => {
        if (team.members.length) {
            team.members.sort((a, b) => b.weight - a.weight);
            team.leader = team.members[0];
        }
    });

    const oldTeams = raceSettings.teams || [];
    const existingNames = oldTeams.map(t => t.name);
    for (let i = 0; i < teams.length; i++) {
        if (existingNames[i]) teams[i].name = existingNames[i];
    }
    
    raceSettings.teams = teams;
    raceSettings.studentIds = teams.flatMap(t => t.members.map(m => String(m.id)));
    raceSettings.unassignedStudents = [];
    await renderTeamsUI(teams);
    showFloatingNotification('تم توزيع متوازن للفرق بناءً على نقاط الطلاب', 'success');
}

// ===================== توزيع عشوائي =====================
export async function shuffleTeams() {
    const raceSettings = window.raceSettings;
    const selected = (await getStudents()).filter(s => raceSettings.studentIds.includes(String(s.id)));
    const numTeams = parseInt(document.getElementById('num-teams-select').value) || 2;
    
    if (selected.length === 0) {
        showFloatingNotification('لا يوجد طلاب مختارون', 'error');
        return;
    }
    
    const oldTeams = raceSettings.teams || [];
    const existingNames = oldTeams.map(t => t.name);
    
    for (let i = selected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selected[i], selected[j]] = [selected[j], selected[i]];
    }
    
    const newTeams = [];
    for (let t = 0; t < numTeams; t++) {
        const name = existingNames[t] || `فريق ${t + 1}`;
        newTeams.push({ id: t + 1, name: name, members: [], pos: 0, score: 0, leader: null });
    }
    
    selected.forEach((s, idx) => newTeams[idx % numTeams].members.push(s));
    newTeams.forEach(t => { if (t.members.length) t.leader = t.members[0]; });
    
    raceSettings.teams = newTeams;
    raceSettings.unassignedStudents = [];
    await renderTeamsUI(newTeams);
    showFloatingNotification('تم توزيع عشوائي مع الحفاظ على أسماء الفرق', 'success');
}

// ===================== نافذة إضافة طلاب للمشاركة =====================
export async function showAddStudentModal() {
    const raceSettings = window.raceSettings;
    const grade = raceSettings.grade;
    if (!grade) {
        showFloatingNotification('❌ يرجى اختيار الصف أولاً', 'error');
        return;
    }

    const allStudents = await getStudents();
    const availableStudents = allStudents.filter(s => 
        s.grade === grade && 
        !raceSettings.studentIds.includes(String(s.id))
    );

    if (availableStudents.length === 0) {
        showFloatingNotification('⚠️ لا يوجد طلاب إضافيون في هذا الصف للمشاركة', 'info');
        return;
    }

    availableStudents.sort((a, b) => b.score - a.score);

    let studentsHtml = `<div class="students-grid-container" id="multiSelectStudentsGrid">`;
    availableStudents.forEach(s => {
        studentsHtml += `
            <div class="glass-student-card-enhanced multi-select-card" data-id="${s.id}">
                <div class="check-indicator">✓</div>
                <img src="${s.img}" alt="${escapeHtml(s.name)}">
                <div class="student-name-enhanced">${escapeHtml(s.name)}</div>
                <div class="student-score-enhanced">⭐ ${s.score} نقطة</div>
                <div class="student-id-enhanced">ID: ${s.id}</div>
            </div>
        `;
    });
    studentsHtml += `</div><div class="text-center mt-3"><span class="selected-count-badge" id="selectedCountDisplay">0 مختار</span></div>`;

    let selectedStudentIds = [];

    const result = await Swal.fire({
        title: `<span style="font-size:1.6rem;">✨ إضافة طلاب للمشاركة ✨</span><br><span style="font-size:0.9rem; color:#facc15;">${escapeHtml(grade)}</span>`,
        html: studentsHtml,
        showConfirmButton: true,
        showCancelButton: true,
        confirmButtonText: `إضافة (${raceSettings.isTeam ? 'المختارين' : 'المختار'})`,
        cancelButtonText: 'إلغاء',
        background: 'transparent',
        backdrop: 'rgba(0,0,0,0.85)',
        customClass: {
            popup: 'modern-add-student-popup',
            confirmButton: 'bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-full text-sm font-bold transition',
            cancelButton: 'bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-full text-sm font-bold transition'
        },
        didOpen: () => {
            selectedStudentIds = [];
            const updateUI = () => {
                document.querySelectorAll('.multi-select-card').forEach(card => {
                    const id = card.dataset.id;
                    if (selectedStudentIds.includes(id)) {
                        card.classList.add('selected');
                    } else {
                        card.classList.remove('selected');
                    }
                });
                const countSpan = document.getElementById('selectedCountDisplay');
                if (countSpan) countSpan.innerText = `${selectedStudentIds.length} مختار`;

                const confirmBtn = Swal.getConfirmButton();
                if (confirmBtn && !raceSettings.isTeam) {
                    if (selectedStudentIds.length > 1) {
                        confirmBtn.disabled = true;
                        confirmBtn.style.opacity = '0.5';
                    } else {
                        confirmBtn.disabled = false;
                        confirmBtn.style.opacity = '1';
                    }
                }
            };

            document.querySelectorAll('.multi-select-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = card.dataset.id;
                    if (selectedStudentIds.includes(id)) {
                        selectedStudentIds = selectedStudentIds.filter(i => i !== id);
                    } else {
                        if (!raceSettings.isTeam) {
                            selectedStudentIds = [id];
                        } else {
                            selectedStudentIds.push(id);
                        }
                    }
                    updateUI();
                });
            });
            updateUI();
        },
        preConfirm: () => {
            if (selectedStudentIds.length === 0) {
                Swal.showValidationMessage('❌ الرجاء اختيار طالب واحد على الأقل');
                return false;
            }
            if (!raceSettings.isTeam && selectedStudentIds.length > 1) {
                Swal.showValidationMessage('❌ الوضع الفردي يسمح بطالب واحد فقط');
                return false;
            }
            return selectedStudentIds;
        }
    });

    if (result.value && result.value.length) {
        // إضافة الطلاب إلى raceSettings.studentIds أولاً
        for (let id of result.value) {
            if (!raceSettings.studentIds.includes(id)) {
                raceSettings.studentIds.push(id);
            }
        }
        
        if (raceSettings.isTeam) {
            // إضافة الطلاب الجدد إلى قائمة غير الموزعين
            const newStudentsData = result.value.map(id => allStudents.find(s => String(s.id) === id)).filter(s => s);
            if (!raceSettings.unassignedStudents) raceSettings.unassignedStudents = [];
            for (const student of newStudentsData) {
                if (!raceSettings.unassignedStudents.some(u => String(u.id) === String(student.id))) {
                    raceSettings.unassignedStudents.push(student);
                }
            }
            // إعادة عرض واجهة الفرق
            await renderTeamsUI(raceSettings.teams);
            const confirmBtn = document.getElementById('confirmTeamsBtn');
            if (confirmBtn) confirmBtn.disabled = false;
        } else {
            await renderStudentSelect();
        }
        
        showFloatingNotification(`✅ تم إضافة ${result.value.length} طالب بنجاح`, 'success');
        
        const nextBtn = document.getElementById('studentSelectNextBtn');
        if (nextBtn) nextBtn.disabled = false;
    }
}

// ===================== تأكيد الفرق والمتابعة =====================
export async function confirmTeamsAndProceed() {
    const raceSettings = window.raceSettings;
    const allStudents = await getStudents();
    const all = allStudents.filter(s => raceSettings.studentIds.includes(String(s.id)) && !s.isTeacher);
    const distributed = raceSettings.teams.reduce((sum, t) => sum + t.members.length, 0);
    const unassignedCount = all.length - distributed;
    
    const teamsWithoutLeader = raceSettings.teams.filter(t => t.members.length > 0 && !t.leader);
    if (teamsWithoutLeader.length > 0) {
        showFloatingNotification(`⚠️ فريق ${teamsWithoutLeader[0].name} ليس لديه قائد. يرجى تعيين قائد أولاً.`, 'error');
        return;
    }
    
    if (raceSettings.teams.some(t => t.members.length === 0)) {
        showFloatingNotification('لا يمكن أن يكون هناك فريق فارغ', 'error');
        return;
    }
    
    if (unassignedCount > 0) {
        const result = await Swal.fire({
            title: '⚠️ طلاب غير موزعين',
            html: `<p>يوجد <strong style="color:#facc15;">${unassignedCount} طالب</strong> لم يتم توزيعهم على أي فريق.</p>
                   <p>هل تريد متابعة التحدي <strong style="color:#ef4444;">دون مشاركتهم</strong>؟</p>
                   <p style="font-size:0.8rem;">(يمكنك إضافتهم لاحقاً أو توزيعهم يدوياً)</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'نعم، أكمل بدونهم',
            cancelButtonText: 'عودة للتوزيع',
            background: '#0f172a',
            color: '#fff',
            confirmButtonColor: '#facc15',
            cancelButtonColor: '#6b7280'
        });
        if (result.isConfirmed) {
            const distributedIds = raceSettings.teams.flatMap(t => t.members.map(m => String(m.id)));
            raceSettings.studentIds = distributedIds;
            window.showPage('game-settings-page');
        }
        return;
    }
    
    window.showPage('game-settings-page');
}