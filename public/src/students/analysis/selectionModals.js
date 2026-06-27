// selectionModals.js - نوافذ اختيار الصف والطالب
import { getStudents, getStudentStats } from '../../services/dataService.js';
import { escapeHtml, showFloatingNotification } from '../../utils.js';
import { canAccessAnalytics, getUserPlan } from '../../services/subscriptionGuard.js';
import { showAdvancedAnalysis } from './advancedModal.js';
import { DEFAULT_IMG } from '../../constants.js';

export function closeAnalysisModal() {
    const modal = document.getElementById('student-analysis-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

export async function showGradeSelectionModal() {
    const isTeacher = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    if (isTeacher) {
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        if (teacherCode) {
            const canAccess = await canAccessAnalytics(teacherCode, true);
            if (!canAccess) {
                const plan = await getUserPlan(teacherCode, true);
                let msg = 'الباقة المجانية لا تسمح بالوصول إلى التحليلات. يرجى الترقية.';
                if (plan === 'silver') {
                    msg = 'الباقة الفضية تسمح بالتحليلات الأساسية فقط. يمكنك الوصول من صفحة الإحصائيات الرئيسية.';
                }
                showFloatingNotification(msg, 'error');
                return;
            }
        }
    }

    const { getDynamicGradesDetailed } = await import('../../db/localstorage.js');
    const detailedGrades = getDynamicGradesDetailed();
    
    if (detailedGrades.length === 0) {
        showFloatingNotification('لا توجد صفوف متاحة', 'error');
        return;
    }

    const stages = {
        ابتدائي: { name: '📘 المرحلة الابتدائية', grades: [], icon: '📘', color: '#10b981' },
        إعدادي: { name: '📙 المرحلة الإعدادية', grades: [], icon: '📙', color: '#f59e0b' },
        ثانوي: { name: '📕 المرحلة الثانوية', grades: [], icon: '📕', color: '#ef4444' },
        أخرى: { name: '📓 صفوف أخرى', grades: [], icon: '📓', color: '#8b5cf6' }
    };

    detailedGrades.forEach(item => {
        const stage = item.stage;
        if (stages[stage]) {
            stages[stage].grades.push(item.name);
        } else {
            stages['أخرى'].grades.push(item.name);
        }
    });

    let html = `<div class="grade-stages-container">`;
    for (const [key, stage] of Object.entries(stages)) {
        if (stage.grades.length === 0) continue;
        html += `
            <div class="grade-stage-group">
                <div class="grade-stage-header" style="border-bottom-color: ${stage.color};">
                    <span class="stage-icon">${stage.icon}</span>
                    <span class="stage-name">${stage.name}</span>
                    <span class="stage-count">${stage.grades.length}</span>
                </div>
                <div class="grade-cards-grid">
        `;
        stage.grades.forEach(grade => {
            html += `
                <div class="grade-card-modern" data-grade="${escapeHtml(grade)}" style="--stage-color: ${stage.color};">
                    <div class="grade-card-icon">${stage.icon}</div>
                    <div class="grade-card-name">${escapeHtml(grade)}</div>
                    <div class="grade-card-hover-effect"></div>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    html += `</div>`;

    await Swal.fire({
        title: `<div class="grade-modal-title">🎓 اختر الصف الدراسي</div>`,
        html: html,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        background: 'transparent',
        backdrop: 'rgba(0,0,0,0.85)',
        customClass: {
            popup: 'grade-select-premium-popup',
            cancelButton: 'grade-modal-cancel-btn'
        },
        didOpen: () => {
            document.querySelectorAll('.grade-card-modern').forEach(card => {
                card.addEventListener('click', () => {
                    const grade = card.dataset.grade;
                    const gradeSelect = document.getElementById('analytics-grade-select');
                    if (gradeSelect) gradeSelect.value = grade;
                    Swal.close();
                    if (window.updateStudentSearchList) window.updateStudentSearchList();
                    showStudentSelectionModal();
                });
            });
        }
    });
}

export async function showStudentSelectionModal() {
    const isTeacher = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    if (isTeacher) {
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        if (teacherCode) {
            const canAccess = await canAccessAnalytics(teacherCode, true);
            if (!canAccess) {
                showFloatingNotification('لا يمكن الوصول إلى تحليلات الطلاب في خطتك الحالية.', 'error');
                return;
            }
        }
    }

    const grade = document.getElementById('analytics-grade-select')?.value;
    if (!grade) {
        showFloatingNotification('اختر صفاً أولاً', 'error');
        return;
    }

    const allStudents = await getStudents();
    const students = allStudents.filter(s => s.grade === grade && !s.isTeacher);
    if (students.length === 0) {
        showFloatingNotification('لا يوجد طلاب في هذا الصف', 'error');
        return;
    }

    students.sort((a, b) => b.score - a.score);

    let cardsHtml = `<div class="student-grid-modern" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.2rem; max-height: 65vh; overflow-y: auto; padding: 0.5rem;">`;
    for (const student of students) {
        const stats = await getStudentStats(student.id);
        const total = stats.totalAnswers || 0;
        const correct = stats.correctAnswers || 0;
        const accuracy = total ? ((correct / total) * 100).toFixed(0) : '?';
        cardsHtml += `
            <div class="student-card-glass" data-id="${student.id}" data-name="${escapeHtml(student.name)}" style="cursor: pointer;">
                <img src="${student.img || DEFAULT_IMG}" alt="${escapeHtml(student.name)}">
                <div class="student-name-glass">${escapeHtml(student.name)}</div>
                <div class="student-grade-glass">${escapeHtml(student.grade)}</div>
                <div class="student-score-glass">⭐ ${student.score} نقطة</div>
                <div class="student-accuracy-glass">🎯 دقة: ${accuracy}%</div>
            </div>
        `;
    }
    cardsHtml += `</div>`;

    await Swal.fire({
        title: `<span style="font-size:1.6rem;">✨ اختر طالباً للتحليل المتقدم ✨</span><br><span style="font-size:0.9rem; color:#facc15;">الصف: ${escapeHtml(grade)}</span>`,
        html: cardsHtml,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        background: 'transparent',
        backdrop: 'rgba(0,0,0,0.85)',
        customClass: {
            popup: 'student-select-glass-popup',
            cancelButton: 'bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-full text-sm transition'
        },
        didOpen: () => {
            document.querySelectorAll('.student-card-glass').forEach(card => {
                card.addEventListener('click', () => {
                    const studentId = card.dataset.id;
                    Swal.close();
                    showAdvancedAnalysis(studentId, 'all');
                });
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-6px) scale(1.02)';
                    card.style.borderColor = '#facc15';
                    card.style.background = 'rgba(250,204,21,0.2)';
                    card.style.boxShadow = '0 15px 30px rgba(0,0,0,0.4), 0 0 25px rgba(250,204,21,0.5)';
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
}

export function updateStudentSearchList() {
    let select = document.getElementById('studentAnalyticsSelect');
    if (select) {
        const grade = document.getElementById('analytics-grade-select')?.value;
        getStudents().then(allStudents => {
            const filtered = allStudents.filter(s => !s.isTeacher && (!grade || s.grade === grade));
            select.innerHTML = '<option value="">اختر طالباً</option>' + filtered.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.grade)})</option>`).join('');
        });
    }
}