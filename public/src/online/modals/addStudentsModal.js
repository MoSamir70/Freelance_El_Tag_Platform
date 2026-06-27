// src/online/modals/addStudentsModal.js
// نافذة إضافة طلاب من حساب المعلم إلى الغرفة

import { addStudentsToRoom } from '../lobby/addStudents.js';
import { getStudents } from '../../services/dataService.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

export async function showAddStudentsModal(roomId) {
  const students = await getStudents();
  if (students.length === 0) {
    showFloatingNotification('لا يوجد طلاب لإضافتهم', 'warning');
    return;
  }

  // توليد قائمة الطلاب بتصميم عصري ومتوافق بالكامل مع اتجاه RTL
  const studentCheckboxes = students.map(s => `
    <label class="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-900/40 hover:bg-purple-600/10 border border-slate-800 hover:border-purple-500/30 cursor-pointer transition-all duration-200 group selection:bg-transparent">
      <div class="flex items-center gap-3">
        <img src="${s.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" 
             class="w-10 h-10 rounded-full object-cover border border-white/10 group-hover:border-purple-500/30 transition-all duration-200">
        <div class="flex-1 text-right">
          <div class="font-bold text-slate-100 text-sm group-hover:text-purple-300 transition-colors">${s.name}</div>
          <div class="text-xs text-purple-300/60 font-medium mt-0.5">${s.grade || 'بدون صف'}</div>
        </div>
      </div>
      
      <div class="relative flex items-center justify-center">
        <input type="checkbox" value="${s.id}" class="student-cb peer appearance-none w-5 h-5 rounded-md border-2 border-slate-600 checked:border-purple-500 checked:bg-purple-500 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/40">
        <svg class="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
    </label>
  `).join('');

  const { value: selectedIds } = await Swal.fire({
    title: '👥 إضافة طلاب إلى الغرفة',
    html: `
      <div dir="rtl" class="text-right font-sans px-1">
        <div class="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
          <button id="select-all-btn" type="button" class="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-md shadow-purple-600/10 hover:shadow-purple-600/20 transition-all active:scale-95 flex items-center gap-1">
            <span>✅</span> تحديد الكل
          </button>
          <button id="unselect-all-btn" type="button" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1">
            <span>❌</span> إلغاء الكل
          </button>
        </div>
        
        <div id="students-list" class="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-500/20 scrollbar-track-transparent">
          ${studentCheckboxes}
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'إضافة المحددين',
    cancelButtonText: 'إلغاء',
    background: 'linear-gradient(135deg, #0b0f19, #16143c)',
    color: '#fff',
    customClass: {
      popup: 'rounded-2xl border border-purple-500/20 shadow-2xl backdrop-blur-xl',
      confirmButton: 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold px-8 py-2.5 rounded-xl mx-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-98',
      cancelButton: 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-bold px-6 py-2.5 rounded-xl border border-slate-700 mx-2 transition-all active:scale-98'
    },
    buttonsStyling: false,
    didOpen: () => {
      // مستمعات الأحداث لأزرار التحكم الجماعي
      document.getElementById('select-all-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.student-cb').forEach(cb => cb.checked = true);
      });
      document.getElementById('unselect-all-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.student-cb').forEach(cb => cb.checked = false);
      });
    },
    preConfirm: () => {
      const checked = Array.from(document.querySelectorAll('.student-cb:checked')).map(cb => cb.value);
      if (checked.length === 0) {
        Swal.showValidationMessage('⚠️ الرجاء اختيار طالباً واحداً على الأقل');
        return false;
      }
      return checked;
    }
  });

  // معالجة البيانات بعد التأكيد والمنطق المتبع كما هو دون تغيير
  if (selectedIds && selectedIds.length) {
    const result = await addStudentsToRoom(roomId, selectedIds);
    if (result.success) {
      showFloatingNotification(`تمت إضافة ${result.added} طالب بنجاح`, 'success');
    }
  }
}