// ===================== src/students/studentManager/teamTemplates.js =====================
// حفظ وتحميل قوالب الفرق (Team Templates) من Firebase
// تم استخراج هذه الدوال من ملف studentManager.js الأصلي

import { showFloatingNotification, escapeHtml } from '../../utils.js';
import { getStudents, getStudentById } from '../../services/dataService.js';
import { dbLight } from '../../db/localstorage.js';
import { renderTeamsUI } from './teamSetup.js';

// ===================== حفظ قالب الفرق =====================
export async function saveTeamTemplate() {
    const raceSettings = window.raceSettings;
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    if (!teacherCode) {
        showFloatingNotification('❌ يجب تسجيل الدخول كمعلم أولاً', 'error');
        return;
    }
    const grade = raceSettings.grade;
    if (!grade) {
        showFloatingNotification('❌ اختر الصف أولاً', 'error');
        return;
    }
    if (!raceSettings.teams || raceSettings.teams.length === 0) {
        showFloatingNotification('⚠️ لا توجد فرق لحفظها', 'error');
        return;
    }

    const { value: templateName } = await Swal.fire({
        title: '💾 حفظ قالب الفرق',
        input: 'text',
        inputPlaceholder: 'أدخل اسم القالب (مثال: فريق أ-ب)',
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        cancelButtonText: 'إلغاء',
        background: '#0f172a',
        color: '#fff',
        inputValidator: (value) => {
            if (!value) return 'الرجاء إدخال اسم للقالب';
            if (value.length < 2) return 'الاسم قصير جداً';
            return null;
        }
    });
    if (!templateName) return;

    const templateKey = `${teacherCode}_${grade}_${templateName}`;
    const templateData = {
        teacherId: teacherCode,
        grade: grade,
        name: templateName,
        teams: raceSettings.teams.map(team => ({
            id: team.id,
            name: team.name,
            memberIds: team.members.map(m => m.id),
            leaderId: team.leader ? team.leader.id : null
        })),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const db = window.db;
        await db.collection('teamTemplates').doc(templateKey).set(templateData, { merge: true });
        showFloatingNotification(`✅ تم حفظ القالب "${templateName}" بنجاح`, 'success');
    } catch (error) {
        console.error(error);
        showFloatingNotification('❌ فشل حفظ القالب: ' + error.message, 'error');
    }
}

// ===================== تحميل قالب الفرق (نافذة اختيار) =====================
export async function loadTeamTemplate() {
    const raceSettings = window.raceSettings;
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    if (!teacherCode) {
        showFloatingNotification('❌ يجب تسجيل الدخول كمعلم أولاً', 'error');
        return;
    }
    const grade = raceSettings.grade;
    if (!grade) {
        showFloatingNotification('❌ اختر الصف أولاً', 'error');
        return;
    }

    try {
        const db = window.db;
        const snapshot = await db.collection('teamTemplates')
            .where('teacherId', '==', teacherCode)
            .where('grade', '==', grade)
            .get();

        if (snapshot.empty) {
            showFloatingNotification('⚠️ لا توجد قوالب محفوظة لهذا الصف', 'info');
            return;
        }

        const templates = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            templates.push({
                id: doc.id,
                name: data.name,
                teams: data.teams,
                teamsCount: data.teams.length,
                membersCount: data.teams.reduce((sum, t) => sum + (t.memberIds?.length || 0), 0)
            });
        });

        let templatesHtml = `<div class="students-grid-container" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.2rem;">`;
        templates.forEach(template => {
            let previewHtml = '';
            const teamsToShow = template.teams.slice(0, 3);
            teamsToShow.forEach(team => {
                const memberIds = team.memberIds || [];
                const membersToShow = memberIds.slice(0, 3);
                const membersImages = membersToShow.map(id => {
                    const student = dbLight.students.find(s => String(s.id) === String(id));
                    return student ? `<img src="${student.img}" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #facc15; margin: 0 2px;" title="${escapeHtml(student.name)}">` : '';
                }).join('');
                const extraCount = memberIds.length - membersToShow.length;
                previewHtml += `
                    <div style="display: flex; align-items: center; gap: 0.3rem; background: rgba(0,0,0,0.3); border-radius: 40px; padding: 0.2rem 0.8rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.7rem; color: #facc15;">${escapeHtml(team.name)}</span>
                        <div style="display: flex; align-items: center;">${membersImages}</div>
                        ${extraCount > 0 ? `<span style="font-size: 0.6rem; color: #aaa;">+${extraCount}</span>` : ''}
                    </div>
                `;
            });
            if (template.teams.length > 3) {
                previewHtml += `<div style="font-size: 0.65rem; color: #aaa; text-align: center;">+ ${template.teams.length - 3} فرق أخرى</div>`;
            }

            templatesHtml += `
                <div class="glass-student-card-enhanced template-select-card" data-id="${template.id}" data-name="${escapeHtml(template.name)}" style="cursor: pointer; text-align: right; padding: 1rem; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <div style="font-weight: bold; color: #facc15; font-size: 1.1rem;">📁 ${escapeHtml(template.name)}</div>
                        <div style="font-size: 0.65rem; background: rgba(0,0,0,0.5); padding: 0.2rem 0.5rem; border-radius: 30px;">${template.teamsCount} فرق | ${template.membersCount} لاعب</div>
                    </div>
                    <div style="margin-top: 0.3rem; max-height: 150px; overflow-y: auto; padding-left: 0.2rem;">
                        ${previewHtml}
                    </div>
                </div>
            `;
        });
        templatesHtml += `</div>`;

        await Swal.fire({
            title: `<span style="font-size:1.6rem;">📂 اختيار قالب الفرق</span><br><span style="font-size:0.9rem; color:#facc15;">${escapeHtml(grade)}</span>`,
            html: templatesHtml,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'إغلاق',
            background: 'transparent',
            backdrop: 'rgba(0,0,0,0.85)',
            customClass: {
                popup: 'modern-add-student-popup',
                cancelButton: 'bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-full text-sm transition'
            },
            didOpen: () => {
                document.querySelectorAll('.template-select-card').forEach(card => {
                    card.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const templateId = card.dataset.id;
                        const templateName = card.dataset.name;
                        Swal.close();
                        await loadSelectedTemplate(templateId, templateName);
                    });
                    card.addEventListener('mouseenter', () => {
                        card.style.transform = 'translateY(-4px)';
                        card.style.borderColor = '#facc15';
                        card.style.background = 'rgba(250,204,21,0.15)';
                        card.style.boxShadow = '0 15px 30px rgba(0,0,0,0.3), 0 0 20px rgba(250,204,21,0.3)';
                    });
                    card.addEventListener('mouseleave', () => {
                        card.style.transform = '';
                        card.style.borderColor = '';
                        card.style.background = '';
                        card.style.boxShadow = '';
                    });
                });
            }
        });
    } catch (error) {
        console.error(error);
        showFloatingNotification('❌ فشل تحميل القوالب: ' + error.message, 'error');
    }
}

// ===================== تحميل قالب محدد وتطبيقه =====================
async function loadSelectedTemplate(templateId, templateName) {
    try {
        const db = window.db;
        const doc = await db.collection('teamTemplates').doc(templateId).get();
        if (!doc.exists) {
            showFloatingNotification('⚠️ القالب غير موجود', 'error');
            return;
        }

        const data = doc.data();
        const savedTeams = data.teams;
        if (!savedTeams || savedTeams.length === 0) {
            showFloatingNotification('⚠️ القالب فارغ', 'error');
            return;
        }

        const allStudents = await getStudents();
        const studentsMap = new Map();
        allStudents.forEach(s => studentsMap.set(String(s.id), s));

        const restoredTeams = savedTeams.map(savedTeam => {
            const members = savedTeam.memberIds.map(id => {
                const student = studentsMap.get(String(id));
                if (!student) return null;
                return { ...student };
            }).filter(m => m !== null);
            const leader = savedTeam.leaderId ? studentsMap.get(String(savedTeam.leaderId)) : null;
            return {
                id: savedTeam.id,
                name: savedTeam.name,
                members: members,
                pos: 0,
                score: 0,
                leader: leader || (members.length ? members[0] : null)
            };
        }).filter(t => t.members.length > 0);

        if (restoredTeams.length === 0) {
            showFloatingNotification('⚠️ لا يمكن استعادة الفرق (ربما تم حذف بعض الطلاب)', 'warning');
            return;
        }

        const raceSettings = window.raceSettings;
        raceSettings.teams = restoredTeams;
        await renderTeamsUI(restoredTeams);
        
        const allMemberIds = restoredTeams.flatMap(t => t.members.map(m => String(m.id)));
        raceSettings.studentIds = [...new Set(allMemberIds)];
        
        const confirmBtn = document.getElementById('confirmTeamsBtn');
        if (confirmBtn) confirmBtn.disabled = false;
        
        showFloatingNotification(`✅ تم تحميل القالب "${templateName || data.name}" (${restoredTeams.length} فريق)`, 'success');
    } catch (error) {
        console.error(error);
        showFloatingNotification('❌ فشل تحميل القالب: ' + error.message, 'error');
    }
}