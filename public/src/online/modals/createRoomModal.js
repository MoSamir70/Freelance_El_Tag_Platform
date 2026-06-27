// src/online/modals/createRoomModal.js
// كابينة تخصيص الغرف التفاعلية - النسخة المشرقة ذات الخطوط الكبيرة والتوزيع الهندسي المتكامل
// ✅ تم إضافة رسالة الحد الشهري للمعلم الفضي (عدد الغرف المتبقية)
// ✅ تم تحسين استدعاء showLobby مع معالجة الأخطاء وإعادة المحاولة

import { createRoom } from '../lobby/createRoom.js';
import { getAllGrades, getTeacherPlan } from '../../services/dataService.js';
import { loadQuestionsFromIndexedDB } from '../../db/indexeddb.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { INDIVIDUAL_MODES, TEAM_MODES } from '../constants/gameModes.js';

// متغيرات حالة سياق الكابينة (خارج الدالة لتظل محفوظة عند إعادة البناء المتتالي)
let selectedGrade = '';
let selectedSubjects = ['كل المواد']; 
let selectedLessons = ['كل الدروس'];
let selectedSystem = 'individual';
let selectedMode = '';
let selectedModeName = '';

// متغيرات لحفظ قيم العدادات مؤقتاً حتى لا تضيع عند التنقل بين النوافذ
let currentGoal = 10;
let currentTimer = 12;
let currentMaxPlayers = 8;
let currentRoomType = 'public';
let currentPin = '';
let currentTrainingMode = false;

export async function showCreateRoomModal() {
  // 1. جلب البيانات الأساسية للتحضير
  const grades = await getAllGrades();
  if (!selectedGrade && grades.length > 0) selectedGrade = grades[0];
  if (!selectedMode && INDIVIDUAL_MODES.length > 0) {
    selectedMode = INDIVIDUAL_MODES[0].id;
    selectedModeName = `${INDIVIDUAL_MODES[0].icon} ${INDIVIDUAL_MODES[0].name}`;
  }

  // ✅ إضافة رسالة الحد الشهري للمعلم الفضي
  let silverLimitMessage = '';
  const teacherPlan = await getTeacherPlan();
  if (teacherPlan === 'silver') {
    const used = parseInt(sessionStorage.getItem('teacher_online_rooms_used') || '0');
    const remaining = Math.max(0, 10 - used);
    silverLimitMessage = `
      <div class="mb-4 p-3 rounded-xl" style="background: rgba(250,204,21,0.1); border: 1px solid rgba(250,204,21,0.3);">
        <div class="text-yellow-400 text-sm font-bold flex items-center gap-2">
          <span>📊</span> باقة فضية: تبقت لك <span class="text-white text-lg font-black mx-1">${remaining}</span> غرفة هذا الشهر (من أصل 10)
        </div>
        <div class="text-gray-400 text-xs mt-1">⚠️ بعد استنفاذ الحد، لن تتمكن من إنشاء غرف جديدة حتى بداية الشهر القادم.</div>
      </div>
    `;
  }

  // 2. دالة مساعدة لفتح النوافذ الفرعية بستايل مشرق متناسق وإعادة فتح القائمة الرئيسية
  const openSubModal = async (config) => {
    captureCurrentInputs();

    const result = await Swal.fire({
      ...config,
      background: '#ffffff linear-gradient(135deg, #f8fafc, #eff6ff)',
      color: '#1e293b',
      buttonsStyling: false,
      customClass: {
        popup: 'rounded-3xl border-4 border-blue-500 shadow-[0_20px_50px_rgba(59,130,246,0.3)] p-8 max-w-lg w-full font-sans',
        confirmButton: 'w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/20 transition-all text-base active:scale-95 cursor-pointer',
        cancelButton: 'w-full mt-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-3 rounded-2xl border-2 border-slate-200 transition-all text-sm active:scale-95 cursor-pointer'
      }
    });

    setTimeout(() => { showCreateRoomModal(); }, 60);
    return result;
  };

  // دالة التقاط القيم اللحظية من عناصر الحقول السفلية
  function captureCurrentInputs() {
    const goalEl = document.getElementById('goal');
    const timerEl = document.getElementById('timer');
    const maxPlEl = document.getElementById('max-players');
    const typeEl = document.getElementById('room-type');
    const pinEl = document.getElementById('room-pin');
    const trainEl = document.getElementById('training-mode');

    if (goalEl) currentGoal = parseInt(goalEl.value);
    if (timerEl) currentTimer = parseInt(timerEl.value);
    if (maxPlEl) currentMaxPlayers = parseInt(maxPlEl.value);
    if (typeEl) currentRoomType = typeEl.value;
    if (pinEl) currentPin = pinEl.value;
    if (trainEl) currentTrainingMode = trainEl.checked;
  }

  // 3. إطلاق الواجهة الرئيسية الكبرى
  const { value: formValues } = await Swal.fire({
    title: '⚙️ كابينة هندسة وإطلاق السباق التعليمي',
    html: `
      <div dir="rtl" class="text-right font-sans p-1 space-y-6 selection:bg-transparent text-slate-800">
        ${silverLimitMessage}
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <button id="main-btn-grade" class="w-full text-right bg-white hover:bg-purple-50/50 border-3 border-purple-400 hover:border-purple-600 p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all duration-200 transform hover:-translate-y-1 shadow-lg shadow-purple-500/5 cursor-pointer">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center text-3xl border border-purple-300">🏫</div>
              <div>
                <div class="text-[11px] font-black text-purple-600 uppercase tracking-widest">Target Class</div>
                <div class="text-xl font-black text-slate-900 mt-0.5">الصف الدراسي</div>
              </div>
            </div>
            <div class="w-full text-center text-sm font-black bg-purple-600 text-white py-2.5 rounded-xl shadow-md shadow-purple-600/20">
              ${selectedGrade || 'اضغط للتحديد'}
            </div>
          </button>

          <button id="main-btn-subject" class="w-full text-right bg-white hover:bg-blue-50/50 border-3 border-blue-400 hover:border-blue-600 p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all duration-200 transform hover:-translate-y-1 shadow-lg shadow-blue-500/5 cursor-pointer">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-3xl border border-blue-300">📚</div>
              <div>
                <div class="text-[11px] font-black text-blue-600 uppercase tracking-widest">Subject Selector</div>
                <div class="text-xl font-black text-slate-900 mt-0.5">المواد التعليمية</div>
              </div>
            </div>
            <div class="w-full text-center text-sm font-black bg-blue-600 text-white py-2.5 rounded-xl shadow-md shadow-blue-600/20 truncate px-2">
              ${selectedSubjects.join('، ')}
            </div>
          </button>

          <button id="main-btn-lessons" class="w-full text-right bg-white hover:bg-cyan-50/50 border-3 border-cyan-400 hover:border-cyan-600 p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all duration-200 transform hover:-translate-y-1 shadow-lg shadow-cyan-500/5 cursor-pointer">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-cyan-100 flex items-center justify-center text-3xl border border-cyan-300">🎯</div>
              <div>
                <div class="text-[11px] font-black text-cyan-600 uppercase tracking-widest">Lessons Filter</div>
                <div class="text-xl font-black text-slate-900 mt-0.5">الوحدات والدروس</div>
              </div>
            </div>
            <div class="w-full text-center text-sm font-black bg-cyan-600 text-white py-2.5 rounded-xl shadow-md shadow-cyan-600/20 truncate px-2">
              ${selectedLessons.join('، ')}
            </div>
          </button>

          <button id="main-btn-mode" class="w-full text-right bg-white hover:bg-emerald-50/50 border-3 border-emerald-400 hover:border-emerald-600 p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all duration-200 transform hover:-translate-y-1 shadow-lg shadow-emerald-500/5 cursor-pointer">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center text-3xl border border-emerald-300">🎮</div>
              <div>
                <div class="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Gameplay Mode</div>
                <div class="text-xl font-black text-slate-900 mt-0.5">وضع وأسلوب اللعب</div>
              </div>
            </div>
            <div class="w-full text-center text-sm font-black bg-emerald-600 text-white py-2.5 rounded-xl shadow-md shadow-emerald-600/20 truncate px-2">
              [${selectedSystem === 'individual' ? 'فردي' : 'فرق'}] ${selectedModeName}
            </div>
          </button>

        </div>

        <hr class="border-slate-200 my-4">

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 text-center shadow-inner">
            <label class="block text-sm font-black text-purple-700 mb-2">🎯 خطوات الفوز للقمة</label>
            <input type="number" id="goal" class="w-full bg-white border-2 border-slate-300 text-purple-600 text-center text-lg font-black rounded-xl py-2 outline-none focus:border-purple-500" value="${currentGoal}" min="3" max="30">
          </div>
          <div class="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 text-center shadow-inner">
            <label class="block text-sm font-black text-cyan-700 mb-2">⏱️ مؤقت السؤال (ثانية)</label>
            <input type="number" id="timer" class="w-full bg-white border-2 border-slate-300 text-cyan-600 text-center text-lg font-black rounded-xl py-2 outline-none focus:border-cyan-500" value="${currentTimer}" min="5" max="45">
          </div>
          <div class="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 text-center shadow-inner">
            <label class="block text-sm font-black text-orange-700 mb-2">👥 الحد الأقصى للاعبين</label>
            <input type="number" id="max-players" class="w-full bg-white border-2 border-slate-300 text-orange-600 text-center text-lg font-black rounded-xl py-2 outline-none focus:border-orange-500" value="${currentMaxPlayers}" min="2" max="10">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-slate-50 border-2 border-slate-200 p-4 rounded-2xl shadow-inner">
            <label class="block text-sm font-black text-amber-700 mb-2">🔒 مستوى خصوصية وأمان الساحة</label>
            <select id="room-type" class="w-full bg-white text-slate-800 font-black text-sm rounded-xl p-3 outline-none border-2 border-slate-300 cursor-pointer focus:border-amber-500">
              <option value="public" ${currentRoomType === 'public' ? 'selected' : ''}>🌍 ساحة عامة (مفتوحة لجميع الطلاب)</option>
              <option value="private" ${currentRoomType === 'private' ? 'selected' : ''}>🔑 جولة مغلقة (تتطلب رمز دخول سري)</option>
            </select>
          </div>
          <div class="bg-slate-50 border-2 border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-inner">
            <div class="flex flex-col text-right select-none">
              <span class="text-sm font-black text-rose-600">🎓 تفعيل وضع التدريب الحر</span>
              <span class="text-xs text-slate-500 font-bold mt-1">مراجعة ممتعة بدون احتساب نقاط تصنيف لوحة الصدارة</span>
            </div>
            <input type="checkbox" id="training-mode" class="w-6 " style="width:24px; height:24px; accent-color:#f43f5e;" class="cursor-pointer" ${currentTrainingMode ? 'checked' : ''}>
          </div>
        </div>

        <div id="pin-field" class="${currentRoomType === 'private' ? '' : 'hidden'} bg-amber-50 border-3 border-amber-400 p-4 rounded-2xl">
          <label class="block text-sm font-black text-amber-800 mb-2 text-center">🔢 قم بتعيين رمز القفل الخاص بالسباق (4 أرقام)</label>
          <input type="text" id="room-pin" class="w-full bg-white border-2 border-amber-300 text-amber-600 text-center text-2xl font-black font-mono tracking-widest rounded-xl p-2.5 outline-none focus:border-amber-500 shadow-md" maxlength="4" placeholder="••••" value="${currentPin}">
        </div>

      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '⚡ إطلاق الغرفة وبدء المنافسة فوراً',
    cancelButtonText: 'تراجع وإلغاء',
    width: '700px',
    background: '#ffffff linear-gradient(135deg, #f8fafc, #f1f5f9)',
    color: '#1e293b',
    customClass: {
      popup: 'rounded-3xl border-4 border-indigo-600 shadow-[0_25px_60px_rgba(0,0,0,0.15)] p-6',
      confirmButton: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-10 py-4 rounded-2xl mx-2 shadow-xl shadow-emerald-600/20 transition-all text-base active:scale-95 cursor-pointer',
      cancelButton: 'bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold px-8 py-4 rounded-2xl mx-2 border-2 border-slate-300 transition-all text-base active:scale-95 cursor-pointer'
    },
    buttonsStyling: false,
    preConfirm: () => {
      captureCurrentInputs();

      if (!selectedGrade || selectedSubjects.length === 0) {
        Swal.showValidationMessage('⚠️ يرجى أولاً ضبط وتحديد إعدادات الصف والمواد بالداخل بنجاح');
        return false;
      }
      if (currentRoomType === 'private' && (!currentPin || currentPin.length !== 4 || !/^\d+$/.test(currentPin))) {
        Swal.showValidationMessage('⚠️ رمز الغرفة الخاصة يجب أن يتكون من 4 خانات عددية تماماً');
        return false;
      }
      return { currentRoomType, currentPin, currentGoal, currentTimer, currentMaxPlayers, currentTrainingMode };
    },
    didOpen: () => {
      const roomTypeSelect = document.getElementById('room-type');
      const pinField = document.getElementById('pin-field');
      
      roomTypeSelect.addEventListener('change', () => {
        pinField.classList.toggle('hidden', roomTypeSelect.value !== 'private');
      });

      // ---- [1] منبثقة الصفوف الدراسية ----
      document.getElementById('main-btn-grade').addEventListener('click', async () => {
        await openSubModal({
          title: '🏫 اختر الصف الدراسي المستهدف للسباق',
          html: `
            <div class="grid grid-cols-2 gap-3 text-right pt-2">
              ${grades.map(g => `
                <div data-val="${g}" class="sub-grade-card cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all ${g === selectedGrade ? 'border-purple-600 bg-purple-600 text-white shadow-lg' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}">
                  ${g}
                </div>
              `).join('')}
            </div>
          `,
          showConfirmButton: true,
          confirmButtonText: 'تثبيت وحفظ الصف',
          preConfirm: () => {
            const activeCard = document.querySelector('.sub-grade-card.bg-purple-600');
            if (activeCard) {
              const newVal = activeCard.getAttribute('data-val');
              if (selectedGrade !== newVal) {
                selectedGrade = newVal;
                selectedSubjects = ['كل المواد'];
                selectedLessons = ['كل الدروس'];
              }
            }
          }
        });
      });

      // ---- [2] منبثقة المواد التعليمية ----
      document.getElementById('main-btn-subject').addEventListener('click', async () => {
        const questions = await loadQuestionsFromIndexedDB(selectedGrade);
        const subjects = [...new Set(questions.map(q => q.subject).filter(Boolean))];

        if (!subjects.length) {
          showFloatingNotification('عذراً، بنك الأسئلة الحالي فارغ من المواد لهذا الصف', 'warning');
          return;
        }

        await openSubModal({
          title: '📚 حدد مادة واحدة أو عدة مواد تعليمية',
          html: `
            <div class="space-y-3 max-h-[50vh] overflow-y-auto pr-1 text-right pt-2">
              <div id="sub-card-all" class="sub-sub-card cursor-pointer p-4 rounded-xl border-3 text-sm font-black text-center transition-all ${selectedSubjects.includes('كل المواد') ? 'border-blue-600 bg-blue-600 text-white shadow-lg' : 'border-slate-200 bg-white text-slate-600'}">
                ✨ اختيار شمول جميع المواد الدراسية معاً
              </div>
              <div class="p-0.5 border-b border-slate-200 my-1"></div>
              <div class="grid grid-cols-2 gap-3" id="sub-sub-grid">
                ${subjects.map(s => `
                  <div data-val="${s}" class="sub-sub-card item-card cursor-pointer p-3.5 rounded-xl border-3 text-center text-sm font-black transition-all ${(!selectedSubjects.includes('كل المواد') && selectedSubjects.includes(s)) ? 'border-blue-600 bg-blue-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600'}">
                    📘 ${s}
                  </div>
                `).join('')}
              </div>
            </div>
          `,
          showConfirmButton: true,
          confirmButtonText: 'تثبيت وحفظ باقة المواد',
          preConfirm: () => {
            const allCard = document.getElementById('sub-card-all');
            if (allCard && allCard.classList.contains('bg-blue-600')) {
              selectedSubjects = ['كل المواد'];
            } else {
              const selectedArr = [];
              document.querySelectorAll('.sub-sub-card.item-card.bg-blue-600').forEach(c => {
                selectedArr.push(c.getAttribute('data-val'));
              });
              selectedSubjects = selectedArr.length ? selectedArr : ['كل المواد'];
            }
            selectedLessons = ['كل الدروس'];
          }
        });
      });

      // ---- [3] منبثقة الدروس الذكية ----
      document.getElementById('main-btn-lessons').addEventListener('click', async () => {
        const questions = await loadQuestionsFromIndexedDB(selectedGrade);
        const allowedQuestions = selectedSubjects.includes('كل المواد') ? questions : questions.filter(q => selectedSubjects.includes(q.subject));
        const lessons = [...new Set(allowedQuestions.map(q => q.lesson).filter(Boolean))];

        if (!lessons.length) {
          showFloatingNotification('لم يتم رصد أي فصول مخصصة تتبع المواد التعليمية المختارة بالداخل', 'info');
          return;
        }

        await openSubModal({
          title: '🎯 تخصيص وفلترة الوحدات والدروس المطلوبة',
          html: `
            <div class="space-y-3 max-h-[50vh] overflow-y-auto pr-1 text-right pt-2">
              <div id="les-card-all" class="sub-les-card cursor-pointer p-4 rounded-xl border-3 text-sm font-black text-center transition-all ${selectedLessons.includes('كل الدروس') ? 'border-cyan-600 bg-cyan-600 text-white shadow-lg' : 'border-slate-200 bg-white text-slate-600'}">
                ✨ شمول وتضمين كافة الوحدات والدروس التعليمية
              </div>
              <div class="p-0.5 border-b border-slate-200 my-1"></div>
              <div class="grid grid-cols-1 gap-2.5" id="sub-les-grid">
                ${lessons.map(l => `
                  <div data-val="${l}" class="sub-les-card les-item-card cursor-pointer p-3.5 rounded-xl border-3 text-right text-sm font-black transition-all ${(!selectedLessons.includes('كل الدروس') && selectedLessons.includes(l)) ? 'border-cyan-600 bg-cyan-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600'}">
                    📝 ${l}
                  </div>
                `).join('')}
              </div>
            </div>
          `,
          showConfirmButton: true,
          confirmButtonText: 'اعتماد فلترة باقة الدروس',
          preConfirm: () => {
            const allLesCard = document.getElementById('les-card-all');
            if (allLesCard && allLesCard.classList.contains('bg-cyan-600')) {
              selectedLessons = ['كل الدروس'];
            } else {
              const selectedLesArr = [];
              document.querySelectorAll('.sub-les-card.les-item-card.bg-cyan-600').forEach(c => {
                selectedLesArr.push(c.getAttribute('data-val'));
              });
              selectedLessons = selectedLesArr.length ? selectedLesArr : ['كل الدروس'];
            }
          }
        });
      });

      // ---- [4] منبثقة أوضاع اللعب ----
      document.getElementById('main-btn-mode').addEventListener('click', async () => {
        await openSubModal({
          title: '⚡ تخصيص هيكل ونمط المواجهة التنافسية',
          html: `
            <div class="space-y-5 text-right pt-2">
              <label class="block text-xs font-black text-emerald-700 uppercase tracking-wider">1. طبيعة وهيكل المنافسة الأساسي</label>
              <div class="grid grid-cols-2 gap-3">
                <div id="sub-sys-individual" class="cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all ${selectedSystem === 'individual' ? 'border-emerald-600 bg-emerald-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600'}">👤 مواجهة فردية (سولو)</div>
                <div id="sub-sys-teams" class="cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all ${selectedSystem === 'teams' ? 'border-emerald-600 bg-emerald-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600'}">👥 تحدي فرق (مجموعات)</div>
              </div>
              
              <label class="block text-xs font-black text-purple-700 uppercase tracking-wider pt-1">2. نمط وأسلوب احتساب النقاط واللعب</label>
              <div class="grid grid-cols-1 gap-2.5 max-h-[35vh] overflow-y-auto pr-0.5" id="sub-modes-list-container">
                </div>
            </div>
          `,
          showConfirmButton: true,
          confirmButtonText: 'تثبيت نظام الجولة والبدء',
          didOpen: () => {
            const container = document.getElementById('sub-modes-list-container');
            const subSysInd = document.getElementById('sub-sys-individual');
            const subSysTeam = document.getElementById('sub-sys-teams');
            let tempSystem = selectedSystem;

            function renderModesList(sys) {
              const modesArr = sys === 'teams' ? TEAM_MODES : INDIVIDUAL_MODES;
              container.innerHTML = modesArr.map(m => `
                <div data-id="${m.id}" data-name="${m.icon} ${m.name}" class="sub-mode-item-card cursor-pointer p-4 rounded-xl border-3 flex items-center gap-4 transition-all ${m.id === selectedMode ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-600/20' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}">
                  <div class="text-3xl">${m.icon}</div>
                  <div class="text-right">
                    <div class="text-sm font-black text-slate-900">${m.name}</div>
                    <div class="text-xs text-slate-500 font-bold mt-1">اضغط للتحديد الفوري والتسجيل بالجولة الحالية</div>
                  </div>
                </div>
              `).join('');
            }

            renderModesList(tempSystem);

            subSysInd.addEventListener('click', () => {
              tempSystem = 'individual';
              subSysInd.className = "cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all border-emerald-600 bg-emerald-600 text-white shadow-md";
              subSysTeam.className = "cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all border-slate-200 bg-white text-slate-600";
              renderModesList('individual');
            });

            subSysTeam.addEventListener('click', () => {
              tempSystem = 'teams';
              subSysTeam.className = "cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all border-emerald-600 bg-emerald-600 text-white shadow-md";
              subSysInd.className = "cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all border-slate-200 bg-white text-slate-600";
              renderModesList('teams');
            });

            container.addEventListener('click', (e) => {
              const card = e.target.closest('.sub-mode-item-card');
              if (card) {
                document.querySelectorAll('.sub-mode-item-card').forEach(c => c.className = "sub-mode-item-card cursor-pointer p-4 rounded-xl border-3 flex items-center gap-4 transition-all border-slate-200 bg-white text-slate-600 hover:border-slate-300");
                card.className = "sub-mode-item-card cursor-pointer p-4 rounded-xl border-3 flex items-center gap-4 transition-all border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-600/20";
                selectedMode = card.getAttribute('data-id');
                selectedModeName = card.getAttribute('data-name');
                selectedSystem = tempSystem;
              }
            });
          }
        });
      });
    }
  });

  // 4. بناء الغرفة السحابية وإرسال مصفوفة الأسئلة بعد الضغط على التأكيد النهائي
  if (formValues) {
    const questions = await loadQuestionsFromIndexedDB(selectedGrade);
    
    let filteredQuestions = questions;
    if (!selectedSubjects.includes('كل المواد')) {
      filteredQuestions = filteredQuestions.filter(q => selectedSubjects.includes(q.subject));
    }
    if (!selectedLessons.includes('كل الدروس')) {
      filteredQuestions = filteredQuestions.filter(q => selectedLessons.includes(q.lesson));
    }
    
    if (filteredQuestions.length === 0) {
      showFloatingNotification('❌ لا توجد أسئلة تطابق الاختيارات الحالية. يرجى رفع أسئلة أولاً أو تغيير التصفية.', 'error');
      return;
    }
    const neededQuestions = Math.min(currentGoal + 5, filteredQuestions.length);
    const selectedQuestions = [...filteredQuestions];
    
    for (let i = selectedQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]];
    }
    const raceQuestions = selectedQuestions.slice(0, neededQuestions);

    const result = await createRoom({
      grade: selectedGrade,
      subject: selectedSubjects.join(' - '),
      gameMode: selectedMode,
      gameSystem: selectedSystem,
      isPrivate: currentRoomType === 'private',
      pin: currentRoomType === 'private' ? currentPin : null,
      goal: currentGoal,
      timePerQuestion: currentTimer,
      maxPlayers: currentMaxPlayers,
      isTrainingMode: currentTrainingMode,
      raceQuestions
    });

  if (result.success) {
  console.log('[createRoomModal] Room created successfully, roomId:', result.roomId);
  sessionStorage.setItem('current_room_id', result.roomId);
  const { showLobby } = await import('../lobby/lobbyUI.js');
  console.log('[createRoomModal] About to call showLobby with roomId:', result.roomId);
  setTimeout(async () => {
    console.log('[createRoomModal] Inside setTimeout, calling showLobby');
    await showLobby(result.roomId, { mode: 'host' });
  }, 500);
} else {
  console.error('[createRoomModal] Failed to create room:', result.error);
}
  }
}

// مستمعي إدارة التفاعل البصري الفوري للبطاقات بالداخل لضمان استقرار الأداء
document.body.addEventListener('click', (e) => {
  // تفاعل بطاقات الصفوف
  if (e.target.classList.contains('sub-grade-card')) {
    document.querySelectorAll('.sub-grade-card').forEach(c => c.className = "sub-grade-card cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all border-slate-200 bg-white text-slate-600 hover:border-slate-400");
    e.target.className = "sub-grade-card cursor-pointer p-4 rounded-xl border-3 text-center text-sm font-black transition-all border-purple-600 bg-purple-600 text-white shadow-lg";
  }
  
  // تفاعل بطاقات اختيار المواد التعليمية
  if (e.target.id === 'sub-card-all' || e.target.closest('#sub-card-all')) {
    const target = document.getElementById('sub-card-all');
    if (target) {
      target.className = "sub-sub-card cursor-pointer p-4 rounded-xl border-3 text-sm font-black text-center transition-all border-blue-600 bg-blue-600 text-white shadow-lg";
      document.querySelectorAll('.item-card').forEach(c => c.className = "sub-sub-card item-card cursor-pointer p-3.5 rounded-xl border-3 text-center text-sm font-black transition-all border-slate-200 bg-white text-slate-600");
    }
  } else if (e.target.classList.contains('item-card')) {
    const allCard = document.getElementById('sub-card-all');
    if (allCard) allCard.className = "sub-sub-card cursor-pointer p-4 rounded-xl border-3 text-sm font-black text-center transition-all border-slate-200 bg-white text-slate-600";
    
    e.target.classList.toggle('border-slate-200');
    e.target.classList.toggle('bg-white');
    e.target.classList.toggle('text-slate-600');
    e.target.classList.toggle('border-blue-600');
    e.target.classList.toggle('bg-blue-600');
    e.target.classList.toggle('text-white');
    e.target.classList.toggle('shadow-md');
  }

  // تفاعل بطاقات فلترة واختيار الدروس
  if (e.target.id === 'les-card-all' || e.target.closest('#les-card-all')) {
    const target = document.getElementById('les-card-all');
    if (target) {
      target.className = "sub-les-card cursor-pointer p-4 rounded-xl border-3 text-sm font-black text-center transition-all border-cyan-600 bg-cyan-600 text-white shadow-lg";
      document.querySelectorAll('.les-item-card').forEach(c => c.className = "sub-les-card les-item-card cursor-pointer p-3.5 rounded-xl border-3 text-right text-sm font-black transition-all border-slate-200 bg-white text-slate-600");
    }
  } else if (e.target.classList.contains('les-item-card')) {
    const allLesCard = document.getElementById('les-card-all');
    if (allLesCard) allLesCard.className = "sub-les-card cursor-pointer p-4 rounded-xl border-3 text-sm font-black text-center transition-all border-slate-200 bg-white text-slate-600";
    
    e.target.classList.toggle('border-slate-200');
    e.target.classList.toggle('bg-white');
    e.target.classList.toggle('text-slate-600');
    e.target.classList.toggle('border-cyan-600');
    e.target.classList.toggle('bg-cyan-600');
    e.target.classList.toggle('text-white');
    e.target.classList.toggle('shadow-md');
  }
});