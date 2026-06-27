// src/online/modals/tournamentModal.js
// نافذة إنشاء بطولة جديدة

import { createTournament } from '../tournament/createTournament.js';
import { getAllGrades } from '../../services/dataService.js';
import { loadQuestionsFromIndexedDB } from '../../db/indexeddb.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

export async function showCreateTournamentModal() {
  const grades = await getAllGrades();
  const gradesOptions = grades.map(g => `<option value="${g}">${g}</option>`).join('');

  const { value: formValues } = await Swal.fire({
    title: '🏆 إنشاء بطولة جديدة',
    html: `
      <div style="text-align: right;">
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">🏷️ اسم البطولة</label>
          <input id="tournament-name" class="swal2-input w-full" placeholder="مثال: بطولة التحدي الكبرى">
        </div>
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">🏫 الصف الدراسي</label>
          <select id="tournament-grade" class="swal2-input w-full">${gradesOptions}</select>
        </div>
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">📚 المادة</label>
          <select id="tournament-subject" class="swal2-input w-full" disabled>
            <option value="">اختر صفاً أولاً</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">🎮 نوع البطولة</label>
          <select id="tournament-type" class="swal2-input w-full">
            <option value="knockout">🏆 إقصائي (خروج المغلوب)</option>
            <option value="league">📋 دوري (كل ضد كل)</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">🎯 عدد الأسئلة لكل مباراة</label>
          <input type="number" id="question-count" class="swal2-input w-full" value="10" min="3" max="30">
        </div>
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">⏱️ وقت الإجابة (ثانية)</label>
          <input type="number" id="time-per-question" class="swal2-input w-full" value="12" min="5" max="45">
        </div>
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">👥 الحد الأقصى للاعبين</label>
          <input type="number" id="max-players" class="swal2-input w-full" value="16" min="2" max="32">
        </div>
        <div class="mb-3">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="is-private">
            <span class="text-purple-300">🔒 بطولة خاصة (برمز دخول)</span>
          </label>
        </div>
        <div id="private-code-field" class="mb-3 hidden">
          <label class="block text-purple-300 mb-1">🔢 رمز الدخول (4-6 أرقام)</label>
          <input type="text" id="access-code" class="swal2-input w-full" maxlength="6" placeholder="1234">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'إنشاء البطولة',
    cancelButtonText: 'إلغاء',
    width: '550px',
    background: '#0f172a',
    color: '#fff',
    preConfirm: () => {
      const name = document.getElementById('tournament-name').value.trim();
      const grade = document.getElementById('tournament-grade').value;
      const subject = document.getElementById('tournament-subject').value;
      const type = document.getElementById('tournament-type').value;
      const questionCount = parseInt(document.getElementById('question-count').value);
      const timePerQuestion = parseInt(document.getElementById('time-per-question').value);
      const maxPlayers = parseInt(document.getElementById('max-players').value);
      const isPrivate = document.getElementById('is-private').checked;
      const accessCode = document.getElementById('access-code').value.trim();

      if (!name) {
        Swal.showValidationMessage('اسم البطولة مطلوب');
        return false;
      }
      if (!grade || !subject) {
        Swal.showValidationMessage('اختر الصف والمادة');
        return false;
      }
      if (isPrivate && (!accessCode || accessCode.length < 4)) {
        Swal.showValidationMessage('رمز الدخول يجب أن يكون 4-6 أرقام');
        return false;
      }
      return { name, grade, subject, type, questionCount, timePerQuestion, maxPlayers, isPrivate, accessCode };
    },
    didOpen: async () => {
      const gradeSelect = document.getElementById('tournament-grade');
      const subjectSelect = document.getElementById('tournament-subject');
      const privateCheck = document.getElementById('is-private');
      const codeField = document.getElementById('private-code-field');

      async function loadSubjects(grade) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        const subjects = [...new Set(questions.map(q => q.subject).filter(s => s))];
        subjectSelect.innerHTML = subjects.length ? subjects.map(s => `<option value="${s}">${s}</option>`).join('') : '<option value="">لا توجد مواد</option>';
        subjectSelect.disabled = subjects.length === 0;
      }

      gradeSelect.addEventListener('change', async () => {
        if (gradeSelect.value) await loadSubjects(gradeSelect.value);
      });
      if (gradeSelect.value) await loadSubjects(gradeSelect.value);

      privateCheck.addEventListener('change', () => {
        codeField.classList.toggle('hidden', !privateCheck.checked);
      });
    }
  });

  if (formValues) {
    const { name, grade, subject, type, questionCount, timePerQuestion, maxPlayers, isPrivate, accessCode } = formValues;
    const result = await createTournament({
      name,
      grade,
      subject,
      type,
      questionCount,
      timePerQuestion,
      maxPlayers,
      accessCode: isPrivate ? accessCode : null
    });
    if (result.success) {
      showFloatingNotification(`تم إنشاء البطولة "${name}" بنجاح`, 'success');
      // يمكن توجيه المستخدم إلى صفحة إدارة البطولة
    }
  }
}