// src/online/globalArenaMenu.js
// القائمة الرئيسية للساحة العالمية (للمعلم فقط مع صلاحيات)
// المعدلة: التحقق من خطة المعلم قبل عرض الخيارات

import { showCreateRoomModal } from './modals/createRoomModal.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';
import { getCurrentUserInfo } from '../firebase/auth.js';

export async function showGlobalArenaMenu() {
  const user = await getCurrentUserInfo();
  
  // ✅ التحقق من أن المستخدم معلم
  if (!user || !user.isTeacher) {
    showFloatingNotification('هذه القائمة متاحة للمعلمين فقط', 'error');
    return;
  }
  
  const teacherPlan = sessionStorage.getItem('teacher_plan') || 'free';
  
  // ✅ المعلم المجاني لا يرى الساحة العالمية أصلاً، لكن احتياطاً نمنعه
  if (teacherPlan === 'free') {
    showFloatingNotification('الباقة المجانية لا تسمح بدخول الساحة العالمية', 'error');
    return;
  }
  
  const isSilver = (teacherPlan === 'silver');
  const isGoldOrDev = (teacherPlan === 'gold' || teacherPlan === 'developer');
  
  await Swal.fire({
    title: '🌍 الساحة العالمية',
    html: `
      <div dir="rtl" class="flex flex-col gap-4 text-right font-sans px-1 pt-3 pb-1 selection:bg-transparent">
        
        <button id="create-room-opt" class="group w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white p-3 rounded-xl font-extrabold border border-purple-500/20 hover:border-purple-400/40 shadow-lg shadow-purple-600/10 hover:shadow-purple-500/30 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-3.5 active:scale-98">
          <div class="w-10 h-10 rounded-lg bg-black/20 backdrop-blur-sm flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300">
            🚀
          </div>
          <div class="flex-1">
            <div class="text-sm font-black text-white">إنشاء غرفة سباق جديدة</div>
            <div class="text-[11px] text-purple-200/60 font-medium mt-0.5">${isSilver ? 'المتبقي: 10 غرف شهرياً' : 'غير محدود'}</div>
          </div>
        </button>

        <button id="enter-arena-opt" class="group w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white p-3 rounded-xl font-extrabold border border-blue-500/20 hover:border-blue-400/40 shadow-lg shadow-blue-600/10 hover:shadow-blue-600/30 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-3.5 active:scale-98">
          <div class="w-10 h-10 rounded-lg bg-black/20 backdrop-blur-sm flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300">
            🏟️
          </div>
          <div class="flex-1">
            <div class="text-sm font-black text-white">دخول الساحة العامة</div>
            <div class="text-[11px] text-blue-200/60 font-medium mt-0.5">انضم إلى الغرف النشطة المتوفرة حالياً</div>
          </div>
        </button>

        ${isGoldOrDev ? `
        <button id="arena-records-opt" class="group w-full bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 p-3 rounded-xl font-bold border border-slate-800 hover:border-amber-500/30 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-3.5 active:scale-98">
          <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/10 flex items-center justify-center text-xl group-hover:bg-amber-500/20 transition-colors duration-300">
            📜
          </div>
          <div class="flex-1">
            <div class="text-sm font-black text-slate-200 group-hover:text-amber-400 transition-colors">قاعة مشاهير الأبطال</div>
            <div class="text-[11px] text-slate-400/70 font-medium mt-0.5">استعرض أعلى التقارير والنتائج التاريخية</div>
          </div>
        </button>
        ` : ''}
        
      </div>
    `,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'إغلاق النافذة',
    background: 'linear-gradient(145deg, #070a13, #110f2d)',
    color: '#fff',
    customClass: {
      popup: 'rounded-2xl border border-purple-500/15 shadow-2xl backdrop-blur-2xl w-full max-w-sm p-4',
      cancelButton: 'w-full mt-2 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-300 font-bold py-2.5 rounded-xl border border-slate-800/80 transition-all text-xs active:scale-98'
    },
    buttonsStyling: false,
    didOpen: () => {
      document.getElementById('create-room-opt')?.addEventListener('click', () => {
        Swal.close();
        showCreateRoomModal();
      });
      document.getElementById('enter-arena-opt')?.addEventListener('click', () => {
        Swal.close();
        window.location.href = 'arena.html';
      });
      const recordsBtn = document.getElementById('arena-records-opt');
      if (recordsBtn) {
        recordsBtn.addEventListener('click', () => {
          Swal.close();
          Swal.fire({
            title: '🚧 قيد التطوير',
            text: 'قاعة المشاهير وجداول ترتيب الأبطال ستكون متاحة للتصفح قريباً جداً!',
            icon: 'info',
            background: 'linear-gradient(135deg, #060912, #110e30)',
            color: '#fff',
            confirmButtonText: 'حسناً'
          });
        });
      }
    }
  });
}