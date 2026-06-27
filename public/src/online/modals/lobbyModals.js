// src/arena/components/lobbyModal.js
import { subscribeToDocument } from '../../online/core/firestoreSync.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { setPlayerReady } from '../../online/lobby/readySystem.js';
import { leaveRoom } from '../../online/lobby/leaveRoom.js';
import { showToast } from '../helpers/showToast.js';
import { escapeHtml } from '../helpers/escapeHtml.js';

let currentRoomId = null;
let currentUser = null;
let roomUnsubscribe = null;
let modalContainer = null;

export async function showLobbyModal(roomId) {
    // تنظيف أي مودال سابق
    closeLobbyModal();
    
    currentRoomId = roomId;
    currentUser = await getCurrentUserInfo();
    if (!currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    // إنشاء نافذة المودال
    modalContainer = document.createElement('div');
    modalContainer.id = 'lobby-modal-container';
    modalContainer.className = 'fixed inset-0 z-[100000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4';
    modalContainer.onclick = (e) => { if (e.target === modalContainer) closeLobbyModal(); };

    modalContainer.innerHTML = `
        <div class="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-yellow-500/30 flex flex-col">
            <div class="flex justify-between items-center p-4 border-b border-white/10 bg-slate-800/50">
                <h2 class="text-xl font-bold text-yellow-400">🎮 لوبي الغرفة</h2>
                <button id="close-lobby-modal-btn" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <div class="bg-white/5 p-3 rounded-xl text-sm">
                    <div class="flex justify-between"><span class="text-gray-400">اسم الغرفة:</span><span id="room-name" class="font-bold">...</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">المضيف:</span><span id="room-host" class="font-bold">...</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">اللاعبون:</span><span id="players-count">0</span> / <span id="max-players">0</span></div>
                </div>
                <div>
                    <h3 class="text-md font-bold text-amber-400 mb-2">👥 اللاعبون</h3>
                    <div id="players-list" class="space-y-2 max-h-64 overflow-y-auto"></div>
                </div>
            </div>
            <div class="p-4 border-t border-white/10 flex gap-3 justify-between">
                <button id="ready-btn" class="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-full font-bold">✅ أنا جاهز</button>
                <button id="leave-lobby-btn" class="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-full font-bold">🚪 مغادرة</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalContainer);

    // ربط الأحداث
    document.getElementById('close-lobby-modal-btn')?.addEventListener('click', closeLobbyModal);
    document.getElementById('leave-lobby-btn')?.addEventListener('click', async () => {
        await leaveRoom(currentRoomId);
        closeLobbyModal();
        showToast('تم مغادرة الغرفة', 'info');
    });
    
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        readyBtn.addEventListener('click', async () => {
            await setPlayerReady(currentRoomId, true);
        });
    }

    // بدء الاستماع لتحديثات الغرفة
    await startRoomListening();
}

async function startRoomListening() {
    if (!currentRoomId) return;
    roomUnsubscribe = subscribeToDocument('activeRooms', currentRoomId, (room) => {
        if (!room) {
            closeLobbyModal();
            showToast('الغرفة غير موجودة', 'error');
            return;
        }
        updateRoomUI(room);
        // إذا بدأ السباق، انتقل إلى واجهة السباق
        if (room.status === 'playing' && room.sessionId) {
            closeLobbyModal();
            window.location.href = `platform.html?race=participant&sessionId=${room.sessionId}`;
        }
    });
}

function updateRoomUI(room) {
    document.getElementById('room-name').innerText = room.name || `غرفة ${room.pin || room.id.slice(-4)}`;
    document.getElementById('room-host').innerText = room.hostName || room.hostId;
    document.getElementById('players-count').innerText = room.players?.length || 0;
    document.getElementById('max-players').innerText = room.maxPlayers || 8;

    const playersList = document.getElementById('players-list');
    if (!playersList) return;
    const myPlayer = room.players?.find(p => p.id === currentUser.id);
    const isReady = myPlayer?.isReady || false;

    // تحديث زر الجاهزية
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        if (isReady) {
            readyBtn.innerText = '❌ إلغاء الجاهزية';
            readyBtn.classList.remove('bg-green-600', 'hover:bg-green-500');
            readyBtn.classList.add('bg-gray-600', 'hover:bg-gray-500');
            readyBtn.onclick = () => setPlayerReady(currentRoomId, false);
        } else {
            readyBtn.innerText = '✅ أنا جاهز';
            readyBtn.classList.remove('bg-gray-600', 'hover:bg-gray-500');
            readyBtn.classList.add('bg-green-600', 'hover:bg-green-500');
            readyBtn.onclick = () => setPlayerReady(currentRoomId, true);
        }
    }

    // عرض قائمة اللاعبين
    playersList.innerHTML = (room.players || []).map(p => `
        <div class="flex items-center justify-between p-2 rounded-xl bg-white/5 ${p.id === currentUser.id ? 'border border-yellow-500/50' : ''}">
            <div class="flex items-center gap-2">
                <img src="${p.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="w-8 h-8 rounded-full object-cover">
                <div class="font-bold text-sm">${escapeHtml(p.name)}</div>
                <div class="text-xs ${p.isReady ? 'text-green-400' : 'text-gray-400'}">${p.isReady ? '✅ جاهز' : '⏳ غير جاهز'}</div>
            </div>
            ${p.id === currentUser.id ? '<span class="text-yellow-400 text-xs ml-2">أنت</span>' : ''}
        </div>
    `).join('');
}

export function closeLobbyModal() {
    if (roomUnsubscribe) {
        roomUnsubscribe();
        roomUnsubscribe = null;
    }
    if (modalContainer?.parentNode) {
        modalContainer.remove();
        modalContainer = null;
    }
    currentRoomId = null;
}