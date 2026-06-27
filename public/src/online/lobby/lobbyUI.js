// src/online/lobby/lobbyUI.js
// واجهة اللوبي المدمجة في platform.html - الإصدار المعدل النهائي
// ✅ تم إصلاح المشاكل التالية:
// - إضافة معالجة الأخطاء (try/catch) عند استدعاء listenToRoom
// - التأكد من وجود حاوية اللوبي وإعادة تعيينها بشكل صحيح
// - إظهار رسائل خطأ واضحة للمستخدم عند فشل تحميل الغرفة
// - تحسين تحديث واجهة اللاعبين وأزرار الجاهزية
// - ✅ إضافة فحص صارم لـ currentUser.id و roomId لمنع TypeError
// - ✅ إضافة رسائل console.log لتصحيح مشكلة بدء السباق

import { subscribeToDocument, updateDocumentWithRetry, getDocumentOnce } from '../core/firestoreSync.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { setPlayerReady, areAllPlayersReady, getNotReadyPlayers } from './readySystem.js';
import { leaveRoom } from './leaveRoom.js';
import { showAddStudentsModal } from '../modals/addStudentsModal.js';

// 📦 إدارة حالة اللوبي في كائن موحد
const lobbyState = {
  roomId: null,
  currentUser: null,
  roomUnsubscribe: null,
  elements: {
    list: null,
    startBtn: null,
    readyBtn: null,
    addBtn: null,
    leaveBtn: null
  }
};

/**
 * بناء وإظهار نافذة اللوبي الرئيسية
 * ✅ تم إضافة معالجة الأخطاء ورسائل واضحة للمستخدم
 * ✅ تم إضافة فحص صارم لـ currentUser.id و roomId
 */
export async function showLobby(roomId, options = { mode: 'player' }) {
  console.log('[showLobby] Called with roomId:', roomId, 'options:', options);

  // ✅ فحص roomId
  if (!roomId) {
    console.error('[showLobby] roomId is undefined or null');
    showFloatingNotification('معرف الغرفة غير صالح، يرجى المحاولة مرة أخرى', 'error');
    return;
  }

  lobbyState.roomId = roomId;
  lobbyState.currentUser = await getCurrentUserInfo();
  console.log('[showLobby] currentUser:', lobbyState.currentUser);

  // ✅ فحص صارم للمستخدم
  if (!lobbyState.currentUser || !lobbyState.currentUser.id) {
    console.error('[showLobby] currentUser missing id:', lobbyState.currentUser);
    showFloatingNotification('حدث خطأ في بيانات المستخدم، يرجى إعادة تحميل الصفحة', 'error');
    return;
  }

  // التحقق من وجود الغرفة
  let roomExists = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    roomExists = await getDocumentOnce(`activeRooms/${roomId}`);
    if (roomExists) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!roomExists) {
    showFloatingNotification('عذراً، الغرفة غير موجودة حالياً أو تم إنهاؤها', 'error');
    return;
  }

  // إخفاء كافة الواجهات النشطة الأخرى
  document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));

  // ✅ التأكد من وجود حاوية اللوبي وإعادة تعيينها (إزالة أي محتوى سابق)
  let lobbyContainer = document.getElementById('lobby-container');
  if (!lobbyContainer) {
    lobbyContainer = document.createElement('div');
    lobbyContainer.id = 'lobby-container';
    lobbyContainer.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999; background: linear-gradient(135deg, #0b0f19, #16143c); overflow-y: auto; display: none; padding-top: 3.5rem; padding-left: 1rem; padding-right: 1rem;';
    document.body.appendChild(lobbyContainer);
  } else {
    // تنظيف المحتوى القديم
    lobbyContainer.innerHTML = '';
  }
  
  lobbyContainer.classList.remove('hidden');
  lobbyContainer.style.display = 'block';
  
  // بناء الهيكل البصري للوبي
  lobbyContainer.innerHTML = `
    <div dir="rtl" class="w-full max-w-5xl mx-auto backdrop-blur-xl bg-white/[0.02] rounded-2xl p-6 shadow-2xl border border-purple-500/10 transition-all duration-300 mb-12">
      
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 pb-5 border-b border-white/5">
        <h2 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-yellow-400 to-amber-300 drop-shadow-sm flex items-center gap-2">
          <span class="text-2xl">🏟️</span> لوبي الغرفة المشتركة
        </h2>
        <div class="flex items-center gap-3 bg-slate-900/60 px-5 py-2.5 rounded-xl border border-white/5 shadow-inner">
          <span class="text-xs text-slate-400 font-medium">رمز الدخول:</span>
          <span id="lobby-pin" class="font-mono text-xl font-black text-yellow-400 tracking-widest">---</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
        
        <div class="lg:col-span-2 bg-slate-950/40 rounded-2xl p-5 border border-white/5">
          <div class="flex justify-between items-center mb-5 gap-2">
            <h3 class="text-lg font-bold text-slate-200 flex items-center gap-2">
              <span>👥</span> اللاعبون 
              <span class="text-xs bg-purple-500/10 text-purple-300 px-2.5 py-0.5 rounded-md font-mono border border-purple-500/20">
                <span id="players-count" class="font-bold">0</span> / <span id="max-players" class="font-bold">0</span>
              </span>
            </h3>
            <button id="add-students-lobby-btn" class="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:scale-[1.03] active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-purple-600/10 transition-all hidden flex items-center gap-1">
              <span>➕</span> إضافة طلاب
            </button>
          </div>
          <div id="players-list" class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto p-0.5"></div>
        </div>

        <div class="bg-slate-950/30 rounded-2xl p-5 border border-white/5 flex flex-col justify-between min-h-[320px]">
          <div>
            <h3 class="text-md font-bold text-amber-400/90 mb-5 flex items-center gap-2 pb-2 border-b border-white/5">
              <span>🎮</span> لوحة التحكم
            </h3>
            <div class="space-y-3.5">
              <button id="ready-btn" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-200">
                ✅ أنا جاهز
              </button>
              <button id="start-race-btn" class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all duration-200 hidden disabled:opacity-40 disabled:pointer-events-none">
                🏁 بدء السباق
              </button>
              <button id="leave-lobby-btn" class="w-full bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 font-bold py-2.5 rounded-xl border border-rose-500/20 hover:border-rose-500/40 transition-all duration-200 text-xs">
                🚪 مغادرة الغرفة
              </button>
            </div>
          </div>
          
          <div class="mt-6 space-y-1 bg-white/[0.01] p-3 rounded-xl border border-white/5 text-center">
            <p class="text-[11px] text-amber-300/60">⚡ يبدأ السباق تلقائياً بعد جاهزية الجميع</p>
            <p class="text-[11px] text-purple-300/60">👑 المضيف فقط يمكنه بدء السباق</p>
          </div>
        </div>

      </div>
    </div>
  `;

  // ربط العناصر
  lobbyState.elements.list = document.getElementById('players-list');
  lobbyState.elements.startBtn = document.getElementById('start-race-btn');
  lobbyState.elements.readyBtn = document.getElementById('ready-btn');
  lobbyState.elements.addBtn = document.getElementById('add-students-lobby-btn');
  lobbyState.elements.leaveBtn = document.getElementById('leave-lobby-btn');

  // تعيين الأحداث
  if (lobbyState.elements.readyBtn) lobbyState.elements.readyBtn.onclick = () => toggleReady();
  if (lobbyState.elements.startBtn) lobbyState.elements.startBtn.onclick = () => startRace();
  if (lobbyState.elements.addBtn) lobbyState.elements.addBtn.onclick = () => showAddStudentsModal(lobbyState.roomId);
  if (lobbyState.elements.leaveBtn) lobbyState.elements.leaveBtn.onclick = () => leaveLobby();

  // ✅ بدء الاستماع لتحديثات الغرفة مع معالجة الأخطاء
  try {
    const { listenToRoom } = await import('./roomListeners.js');
    lobbyState.roomUnsubscribe = await listenToRoom(
      lobbyState.roomId,
      (roomData) => {
        if (!roomData) {
          showFloatingNotification('الغرفة لم تعد متاحة', 'error');
          closeLobby();
          return;
        }
        updateLobbyUI(roomData);
      },
      (err) => {
        console.error('[Lobby Sync Error]:', err);
        showFloatingNotification('حدث خطأ في مزامنة الغرفة، حاول إعادة الدخول', 'error');
      }
    );
  } catch (err) {
    console.error('[showLobby] Failed to start room listeners:', err);
    showFloatingNotification('فشل تحميل اللوبي، يرجى تحديث الصفحة', 'error');
    // لا نغلق اللوبي تماماً، نعرض رسالة للمستخدم
    const container = document.getElementById('players-list');
    if (container) {
      container.innerHTML = '<div class="col-span-full text-center text-red-400 p-4">حدث خطأ في الاتصال. يرجى تحديث الصفحة والمحاولة مرة أخرى.</div>';
    }
  }
}

/**
 * تحديث واجهة اللوبي عند تغير بيانات الغرفة
 */
function updateLobbyUI(roomData) {
  console.log('[updateLobbyUI] Room data received:', roomData);
  const players = roomData.players || [];
  const maxPlayers = roomData.maxPlayers || 8;
  
  const playersCountSpan = document.getElementById('players-count');
  const maxPlayersSpan = document.getElementById('max-players');
  const pinSpan = document.getElementById('lobby-pin');
  
  if (playersCountSpan) playersCountSpan.innerText = players.length;
  if (maxPlayersSpan) maxPlayersSpan.innerText = maxPlayers;
  if (pinSpan) pinSpan.innerText = roomData.pin || 'عامة';

  const isHost = (lobbyState.currentUser?.id === roomData.hostId);
  const myPlayer = players.find(p => p.id === lobbyState.currentUser?.id);
  const isReady = myPlayer?.isReady || false;

  console.log('[updateLobbyUI] isHost:', isHost, 'players count:', players.length, 'maxPlayers:', maxPlayers);

  // تحديث زر الجاهزية
  if (lobbyState.elements.readyBtn) {
    lobbyState.elements.readyBtn.innerText = isReady ? '❌ إلغاء الجاهزية' : '✅ أنا جاهز';
    lobbyState.elements.readyBtn.className = isReady
      ? "w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold py-3 rounded-xl border border-slate-700 transition-all"
      : "w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-amber-500/10 transition-all";
  }

  // أزرار المضيف
  if (isHost) {
    if (lobbyState.elements.startBtn) lobbyState.elements.startBtn.classList.remove('hidden');
    if (lobbyState.elements.addBtn) lobbyState.elements.addBtn.classList.remove('hidden');
    
    const allReady = areAllPlayersReady(roomData);
    const enoughPlayers = players.length >= 2;
    console.log('[updateLobbyUI] allReady:', allReady, 'enoughPlayers:', enoughPlayers);
    if (lobbyState.elements.startBtn) {
      lobbyState.elements.startBtn.disabled = !(allReady && enoughPlayers);
      if (!allReady) {
        const notReady = getNotReadyPlayers(roomData);
        lobbyState.elements.startBtn.title = `غير جاهز: ${notReady.join(', ')}`;
        console.log('[updateLobbyUI] Not ready players:', notReady);
      } else {
        lobbyState.elements.startBtn.title = '';
      }
    }
  } else {
    if (lobbyState.elements.startBtn) lobbyState.elements.startBtn.classList.add('hidden');
    if (lobbyState.elements.addBtn) lobbyState.elements.addBtn.classList.add('hidden');
  }

  // عرض قائمة اللاعبين
  if (lobbyState.elements.list) {
    lobbyState.elements.list.innerHTML = players.map(p => {
      const readyClass = p.isReady 
        ? 'border-emerald-500/30 bg-emerald-500/[0.03]' 
        : 'border-white/5 bg-white/[0.01]';
      const avatarBorder = p.isReady ? 'border-emerald-400' : 'border-slate-700';
      const statusText = p.isReady ? '✅ جاهز' : '⏳ غير جاهز';
      const statusColor = p.isReady ? 'text-emerald-400' : 'text-slate-400';

      return `
        <div class="flex items-center justify-between rounded-xl p-3.5 border transition-all duration-300 group ${readyClass}">
          <div class="flex items-center gap-3">
            <img src="${p.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" 
                 class="w-11 h-11 rounded-full object-cover border-2 ${avatarBorder}">
            <div>
              <div class="font-bold text-slate-100 text-sm">${escapeHtml(p.name)}</div>
              <div class="text-[11px] font-semibold ${statusColor}">${statusText}</div>
            </div>
          </div>
          ${(isHost && p.id !== lobbyState.currentUser?.id) ? `
            <button class="kick-player-btn bg-rose-950/40 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold px-3 py-1 rounded-lg border border-rose-500/20 transition" data-id="${p.id}">
              طرد
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    // إضافة حدث الطرد
    document.querySelectorAll('.kick-player-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        await kickPlayer(btn.dataset.id);
      };
    });
  }
}

/**
 * تبديل حالة الجاهزية
 */
async function toggleReady() {
  console.log('[toggleReady] called, roomId:', lobbyState.roomId);
  if (!lobbyState.roomId) return;
  const room = await getDocumentOnce(`activeRooms/${lobbyState.roomId}`);
  if (!room) return;
  const myPlayer = room.players.find(p => p.id === lobbyState.currentUser?.id);
  if (myPlayer) {
    await setPlayerReady(lobbyState.roomId, !myPlayer.isReady);
  }
}

/**
 * بدء السباق (للمضيف فقط)
 */
async function startRace() {
  console.log('[startRace] called, roomId:', lobbyState.roomId);
  if (!lobbyState.roomId) {
    console.error('[startRace] No roomId');
    return;
  }
  
  console.log('[startRace] Getting room data...');
  const room = await getDocumentOnce(`activeRooms/${lobbyState.roomId}`);
  console.log('[startRace] Room data:', room);
  if (!room || room.hostId !== lobbyState.currentUser?.id) {
    console.error('[startRace] Not host or room not found');
    showFloatingNotification('أنت لست المضيف', 'error');
    return;
  }
  
  const allReady = areAllPlayersReady(room);
  const enoughPlayers = room.players.length >= 2;
  console.log('[startRace] allReady:', allReady, 'enoughPlayers:', enoughPlayers);
  if (!allReady || !enoughPlayers) {
    showFloatingNotification('يجب أن يكون الجميع جاهزاً ووجود لاعبين كاف', 'warning');
    return;
  }
  
  // ✅ المسار الصحيح لـ sessionManager.js
  console.log('[startRace] Importing sessionManager...');
  try {
    const { startRaceFromRoom } = await import('../race/sessionManager.js');
    console.log('[startRace] startRaceFromRoom imported successfully');
    const result = await startRaceFromRoom(lobbyState.roomId, 'player');
    console.log('[startRace] startRaceFromRoom result:', result);
    
    if (result.success) {
      showFloatingNotification('🏁 تم بدء السباق! جاري التحويل...', 'success');
      console.log('[startRace] Redirecting to:', `platform.html?race=participant&sessionId=${result.sessionId}`);
      window.location.href = `platform.html?race=participant&sessionId=${result.sessionId}`;
    } else {
      console.error('[startRace] startRaceFromRoom failed:', result.error);
      showFloatingNotification(result.error || 'فشل بدء السباق', 'error');
    }
  } catch (err) {
    console.error('[startRace] Failed to import sessionManager or startRace:', err);
    showFloatingNotification('حدث خطأ في بدء السباق: ' + err.message, 'error');
  }
}

/**
 * طرد لاعب
 */
async function kickPlayer(playerId) {
  if (!lobbyState.roomId) return;
  const room = await getDocumentOnce(`activeRooms/${lobbyState.roomId}`);
  if (!room || room.hostId !== lobbyState.currentUser?.id) return;
  
  const updatedPlayers = room.players.filter(p => p.id !== playerId);
  await updateDocumentWithRetry(`activeRooms/${lobbyState.roomId}`, { players: updatedPlayers });
  showFloatingNotification('تم طرد اللاعب', 'info');
}

/**
 * مغادرة الغرفة
 */
async function leaveLobby() {
  if (!lobbyState.roomId) return;
  await leaveRoom(lobbyState.roomId);
  closeLobby();
  window.location.reload();
}

/**
 * إغلاق اللوبي والعودة للصفحة الرئيسية
 */
export function closeLobby() {
  if (lobbyState.roomUnsubscribe) {
    lobbyState.roomUnsubscribe();
    lobbyState.roomUnsubscribe = null;
  }
  const lobbyContainer = document.getElementById('lobby-container');
  if (lobbyContainer) {
    lobbyContainer.classList.add('hidden');
    lobbyContainer.style.display = 'none';
  }
  document.querySelectorAll('.page').forEach(page => page.classList.remove('hidden'));
  if (typeof window.showPage === 'function') window.showPage('home');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}