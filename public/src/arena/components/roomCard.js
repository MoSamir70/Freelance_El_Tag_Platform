// src/arena/components/roomCard.js
// بطاقة غرفة واحدة (تصميم محسن مع حالة واضحة)

import { joinRoom } from '../../online/lobby/joinRoom.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showToast } from '../helpers/showToast.js';
import { escapeHtml } from '../helpers/escapeHtml.js';

export function renderRoomCard(room, role, onRoomDeleted) {
    const isTeacher = role.isTeacher;
    const isPrivate = room.isPrivate === true;
    // الذهبي فقط يستطيع المشاهدة
    const canWatch = (isTeacher && role.plan === 'gold');
    const isWaiting = room.status === 'waiting';
    const isPlaying = room.status === 'playing';
    
    const card = document.createElement('div');
    card.className = 'bg-gradient-to-r from-white/5 to-white/3 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-lg';
    
    let statusBadge = '';
    if (isWaiting) statusBadge = '<span class="text-xs bg-green-600/30 text-green-300 px-2 py-0.5 rounded-full"><i class="fas fa-clock ml-1"></i> في انتظار اللاعبين</span>';
    if (isPlaying) statusBadge = '<span class="text-xs bg-red-600/30 text-red-300 px-2 py-0.5 rounded-full"><i class="fas fa-play ml-1"></i> جارية</span>';
    if (room.status === 'finished') statusBadge = '<span class="text-xs bg-gray-600/30 text-gray-300 px-2 py-0.5 rounded-full"><i class="fas fa-flag-checkered ml-1"></i> انتهت</span>';
    
    const lockIcon = isPrivate ? '<i class="fas fa-lock text-yellow-500 ml-1"></i>' : '';
    const teacherBadge = !isTeacher ? `<div class="text-[10px] text-gray-400 mt-1">👨‍🏫 ${escapeHtml(room.hostName)}</div>` : '';
    
    card.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between gap-3">
            <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-lg font-bold text-yellow-400">${escapeHtml(room.name || `غرفة ${room.pin || room.id.slice(-6)}`)}</h3>
                    ${lockIcon}
                    ${statusBadge}
                </div>
                <div class="text-xs text-gray-400 mt-1">📖 ${escapeHtml(room.grade)} | ${escapeHtml(room.subject)}</div>
                ${teacherBadge}
                <div class="flex items-center gap-3 mt-2 text-xs">
                    <span><i class="fas fa-users"></i> ${room.playersCount}/${room.maxPlayers}</span>
                    ${room.isPrivate ? `<span><i class="fas fa-key"></i> خاص</span>` : '<span><i class="fas fa-globe"></i> عام</span>'}
                </div>
            </div>
            <div class="flex flex-row md:flex-col gap-2 justify-end">
                ${isWaiting ? `
                    <button class="join-btn bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold transition flex items-center justify-center gap-1">
                        <i class="fas fa-sign-in-alt"></i> انضمام
                    </button>
                ` : (isPlaying && canWatch ? `
                    <button class="watch-btn bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold transition flex items-center justify-center gap-1">
                        <i class="fas fa-eye"></i> مشاهدة
                    </button>
                ` : (isPlaying && !canWatch ? `
                    <button class="disabled-btn bg-gray-600/50 text-gray-400 px-4 py-2 rounded-full text-sm font-bold cursor-not-allowed flex items-center justify-center gap-1" disabled>
                        <i class="fas fa-ban"></i> غير مسموح
                    </button>
                    
                ` : ''))}
                
                ${isTeacher && role.canDeleteRoom ? `
                    <button class="delete-room-btn bg-red-700/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-full text-xs transition flex items-center justify-center gap-1">
                        <i class="fas fa-trash-alt"></i> حذف
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    // ربط الأحداث
    const joinBtn = card.querySelector('.join-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            let pin = null;
            if (isPrivate) {
                const { value: enteredPin } = await Swal.fire({
                    
                    title: 'غرفة خاصة',
                    input: 'text',
                    inputLabel: 'أدخل رمز الدخول (4 أرقام)',
                    inputPlaceholder: '1234',
                    showCancelButton: true,
                    background: '#0f172a',
                    color: '#fff'
                });
                if (!enteredPin) return;
                pin = enteredPin;
            }
            const user = await getCurrentUserInfo();
            const result = await joinRoom(room.id, pin, 'player');
if (result.success) {
    showToast('تم الانضمام، جاري فتح اللوبي...', 'success');
    // ✅ استيراد دالة showLobbyModal ديناميكياً وعرض النافذة
    const { showLobbyModal } = await import('./lobbyModal.js');
    showLobbyModal(room.id);
}
        });
    }
    
    const watchBtn = card.querySelector('.watch-btn');
    if (watchBtn) {
        watchBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const result = await joinRoom(room.id, null, 'spectator');
            if (result.success) {
                showToast('تم الانضمام كمشاهد، جاري فتح السباق...', 'success');
                if (room.sessionId) {
                    window.location.href = `platform.html?race=spectator&sessionId=${room.sessionId}`;
                } else {
                    window.location.href = `platform.html?lobby=${room.id}&spectator=true`;
                }
            } else {
                showToast(result.message || 'فشل الانضمام كمشاهد', 'error');
            }
        });
    }
    
    const deleteBtn = card.querySelector('.delete-room-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirm = await Swal.fire({
                title: 'حذف الغرفة',
                text: `هل أنت متأكد من حذف غرفة "${room.name}"؟`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، احذف',
                cancelButtonText: 'إلغاء',
                background: '#0f172a',
                color: '#fff'
            });
            if (confirm.isConfirmed) {
                const { deleteRoom } = await import('../services/roomsService.js');
                const result = await deleteRoom(room.id);
                if (result.success) {
                    showToast('تم حذف الغرفة', 'success');
                    if (onRoomDeleted) onRoomDeleted(room.id);
                } else {
                    showToast('فشل الحذف', 'error');
                }
            }
        });
    }
    
    return card;
}