// src/online/modals/joinRoomModal.js
// نافذة الانضمام إلى غرفة برمز
// ✅ تم تصحيح استيراد showLobbyModal من الملف الصحيح lobbyModals.js
// ✅ تم إضافة معالجة الأخطاء وتحسين تجربة المستخدم

import { joinRoom } from '../lobby/joinRoom.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

export async function showJoinRoomModal() {
  const { value: formValues } = await Swal.fire({
    title: '🔑 انضم إلى غرفة',
    html: `
      <div style="text-align: right;">
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">🆔 معرف الغرفة</label>
          <input id="room-id" class="swal2-input w-full" placeholder="مثال: room_1234567890">
        </div>
        <div class="mb-3">
          <label class="block text-purple-300 mb-1">🔢 رمز الدخول (للغرف الخاصة)</label>
          <input id="room-pin" class="swal2-input w-full" placeholder="4 أرقام" maxlength="4">
        </div>
        <div class="mb-3">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="as-spectator">
            <span class="text-purple-300">👁️ انضم كمشاهد (بدون مشاركة)</span>
          </label>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'انضمام',
    cancelButtonText: 'إلغاء',
    background: '#0f172a',
    color: '#fff',
    preConfirm: () => {
      const roomId = document.getElementById('room-id').value.trim();
      const pin = document.getElementById('room-pin').value.trim();
      const asSpectator = document.getElementById('as-spectator').checked;
      if (!roomId) {
        Swal.showValidationMessage('يرجى إدخال معرف الغرفة');
        return false;
      }
      return { roomId, pin: pin || null, asSpectator };
    }
  });

  if (formValues) {
    const { roomId, pin, asSpectator } = formValues;
    const role = asSpectator ? 'spectator' : 'player';
    
    // ✅ إظهار رسالة انتظار أثناء الانضمام
    Swal.fire({
      title: '⏳ جاري الانضمام...',
      text: 'يرجى الانتظار',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const result = await joinRoom(roomId, pin, role);
      Swal.close();
      
      if (result.success) {
        sessionStorage.setItem('current_room_id', roomId);
        // ✅ التصحيح: استيراد showLobbyModal من المسار الصحيح (لاحظ اسم الملف lobbyModals.js)
        const { showLobbyModal } = await import('../../arena/components/lobbyModals.js');
        await showLobbyModal(roomId);
      } else {
        showFloatingNotification(result.message || 'فشل الانضمام إلى الغرفة', 'error');
      }
    } catch (err) {
      Swal.close();
      console.error('[JoinRoomModal] Error:', err);
      showFloatingNotification('حدث خطأ أثناء محاولة الانضمام', 'error');
    }
  }
}