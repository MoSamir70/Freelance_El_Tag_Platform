// src/arena/views/roomsView.js
// إضافة شريط للبحث بالكود والانضمام المباشر
// ✅ الإصدار النهائي الموحد للصلاحيات:
// - المطور: يرى جميع الغرف، يمكنه الإنضمام والمشاهدة بدون قيود
// - المعلم الفضي: يرى الغرف، يمكنه الإنضمام كلاعب (لا يستطيع المشاهدة)
// - المعلم الذهبي: يرى الغرف، يمكنه الإنضمام والمشاهدة
// - الطالب التابع لمعلم فضي/ذهبي: يرى الغرف المناسبة ويمكنه الإنضمام (وفقاً لصلاحيات معلمه)
// - الطالب المجاني: لا يدخل الساحة أصلاً (تم منعه في auth.js)

import { subscribeToRooms, findRoomByCode } from '../services/roomsService.js';
import { renderRoomCard } from '../components/roomCard.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { joinRoom } from '../../online/lobby/joinRoom.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { escapeHtml } from '../helpers/escapeHtml.js';

let unsubscribeRooms = null;
let currentFilter = 'teacher';

export async function render(container, currentUser, role) {
    container.innerHTML = `
        <div class="mb-4">
            <!-- شريط البحث السريع -->
            <div class="bg-white/5 rounded-xl p-3 mb-4 border border-white/10">
                <div class="flex gap-2 items-center">
                    <input type="text" id="room-code-input" placeholder="أدخل رمز الغرفة (ID أو PIN)" class="flex-1 bg-slate-800 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500">
                    <button id="join-by-code-btn" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-1">
                        <i class="fas fa-sign-in-alt"></i> انضمام
                    </button>
                </div>
                <p class="text-[10px] text-gray-500 mt-2 text-center">🔍 يمكنك الانضمام مباشرة باستخدام معرف الغرفة أو الرقم السري</p>
            </div>
            
            <!-- تبويبات التصفية -->
            <div class="flex gap-2 border-b border-white/10 pb-2">
                <button data-filter="teacher" class="filter-tab px-4 py-2 rounded-t-lg text-sm font-bold transition ${currentFilter === 'teacher' ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}">
                    👨‍🏫 ${role.isTeacher ? 'غرفي' : 'معلمي'}
                </button>
                <button data-filter="platform" class="filter-tab px-4 py-2 rounded-t-lg text-sm font-bold transition ${currentFilter === 'platform' ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}">
                    🌍 المنصة
                </button>
                <button data-filter="all" class="filter-tab px-4 py-2 rounded-t-lg text-sm font-bold transition ${currentFilter === 'all' ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}">
                    📋 الكل
                </button>
            </div>
            <div class="mt-3 flex justify-between items-center">
                <h2 class="text-lg font-bold text-yellow-400"><i class="fas fa-door-open ml-2"></i> الغرف النشطة</h2>
                ${role.canCreateRoom ? `
                    <button id="create-room-btn" class="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-full text-xs font-bold transition">
                        <i class="fas fa-plus ml-1"></i> إنشاء غرفة
                    </button>
                ` : ''}
            </div>
        </div>
        <div id="rooms-list" class="space-y-3">
            <div class="text-center text-gray-400 py-10">جاري تحميل الغرف...</div>
        </div>
    `;
    
    const roomsListDiv = document.getElementById('rooms-list');
    if (!roomsListDiv) return;
    
    // البحث والانضمام بالكود
    const joinByCodeBtn = document.getElementById('join-by-code-btn');
    const roomCodeInput = document.getElementById('room-code-input');
    
    joinByCodeBtn?.addEventListener('click', async () => {
        const code = roomCodeInput.value.trim();
        if (!code) {
            showFloatingNotification('يرجى إدخال رمز الغرفة', 'warning');
            return;
        }
        
        // البحث عن الغرفة (بالـ ID أو الـ PIN)
        const room = await findRoomByCode(code);
        if (!room) {
            showFloatingNotification('لا توجد غرفة بهذا المعرف أو الرمز', 'error');
            return;
        }
        
        // التحقق من الصلاحيات للانضمام
        const canJoin = await checkCanJoinRoom(room, role, currentUser);
        if (!canJoin.allowed) {
            showFloatingNotification(canJoin.message, 'error');
            return;
        }
        
        let pin = null;
        // إذا كانت الغرفة خاصة، نحتاج إلى PIN
        if (room.isPrivate) {
            // إذا كان الكود المدخل هو نفسه PIN الغرفة، نستخدمه
            if (room.pin && room.pin === code) {
                pin = code;
            } else {
                // وإلا نطلب من المستخدم إدخال PIN
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
        }
        
        // الانضمام
        const user = await getCurrentUserInfo();
        // تحديد الدور: لاعب أو مشاهد حسب حالة الغرفة
        let joinRole = 'player';
        if (room.status === 'playing') {
            joinRole = 'spectator';
        }
        const result = await joinRoom(room.id, pin, joinRole);
        if (result.success) {
            showFloatingNotification('تم الانضمام، جاري فتح اللوبي...', 'success');
            // ✅ التصحيح: استيراد showLobbyModal من lobbyModals.js (وليس lobbyModal.js)
            const { showLobbyModal } = await import('../components/lobbyModals.js');
            showLobbyModal(room.id);
        } else {
            showFloatingNotification(result.message || 'فشل الانضمام', 'error');
        }
    });
    
    // السماح بالضغط على Enter
    roomCodeInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinByCodeBtn?.click();
    });
    
    // دالة التحقق من صلاحية الانضمام إلى الغرفة (معدلة لدعم المطور والخطط)
    async function checkCanJoinRoom(room, role, currentUser) {
        const isDeveloper = role.plan === 'developer';
        
        // إذا كانت الغرفة في حالة سباق جارٍ
        if (room.status === 'playing') {
            // المطور يسمح له دائماً
            if (isDeveloper) return { allowed: true };
            // المشاهدة متاحة فقط للمعلم الذهبي أو الطالب التابع لمعلم ذهبي
            if (!role.isTeacher && role.plan !== 'gold') {
                return { allowed: false, message: 'السباق جاري، المشاهدة متاحة فقط للباقة الذهبية' };
            }
            if (role.isTeacher && role.plan !== 'gold') {
                return { allowed: false, message: 'السباق جاري، يمكن للمعلمين الذهبيين فقط المشاهدة' };
            }
            return { allowed: true };
        }
        
        // إذا كانت الغرفة في حالة انتظار
        if (room.status === 'waiting') {
            // التحقق من تطابق الصف للطلاب
            if (!role.isTeacher && room.grade !== role.studentGrade) {
                return { allowed: false, message: 'لا يمكنك الانضمام لهذه الغرفة لأن صفها مختلف عن صفك' };
            }
            // التحقق من المقعد الشاغر
            const playersCount = room.players?.length || 0;
            if (playersCount >= room.maxPlayers) {
                return { allowed: false, message: 'الغرفة ممتلئة' };
            }
            // للمعلم الفضي أو الذهبي أو المطور: مسموح
            // للطالب: تم فحص صلاحياته مسبقاً في joinRoom.js، هنا نسمح
            return { allowed: true };
        }
        
        return { allowed: false, message: 'لا يمكن الانضمام لهذه الغرفة في حالتها الحالية' };
    }
    
    // ربط أزرار التبويبات
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('.filter-tab').forEach(b => {
                if (b.dataset.filter === currentFilter) {
                    b.classList.add('bg-yellow-500/20', 'text-yellow-400', 'border-b-2', 'border-yellow-400');
                    b.classList.remove('text-gray-400');
                } else {
                    b.classList.remove('bg-yellow-500/20', 'text-yellow-400', 'border-b-2', 'border-yellow-400');
                    b.classList.add('text-gray-400');
                }
            });
            loadRooms();
        });
    });
    
    const createBtn = document.getElementById('create-room-btn');
    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const { showCreateRoomModal } = await import('../../online/modals/createRoomModal.js');
            await showCreateRoomModal();
        });
    }
    
    async function loadRooms() {
        if (unsubscribeRooms) unsubscribeRooms();
        roomsListDiv.innerHTML = '<div class="text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent mx-auto"></div></div>';
        unsubscribeRooms = subscribeToRooms(role, currentFilter, (rooms) => {
            if (!roomsListDiv) return;
            if (rooms.length === 0) {
                roomsListDiv.innerHTML = `
                    <div class="text-center text-gray-400 py-10 bg-white/5 rounded-xl">
                        <i class="fas fa-door-closed text-4xl mb-2 opacity-50"></i>
                        <p>لا توجد غرف نشطة</p>
                        ${role.canCreateRoom ? '<p class="text-xs mt-2">يمكنك إنشاء غرفة جديدة بالضغط على الزر أعلاه</p>' : ''}
                    </div>
                `;
                return;
            }
            roomsListDiv.innerHTML = '';
            rooms.forEach(room => {
                const card = renderRoomCard(room, role, () => {});
                roomsListDiv.appendChild(card);
            });
        });
    }
    
    await loadRooms();
}

export function destroy() {
    if (unsubscribeRooms) {
        unsubscribeRooms();
        unsubscribeRooms = null;
    }
}