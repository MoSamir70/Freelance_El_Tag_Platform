// src/student/dashboard.js
// النسخة النهائية – تعرض زملاء الصف تلقائياً، الصورة، البطولات، التصنيف العالمي
// ✅ تحسينات: دقة بيانات الطلاب باستخدام onSnapshot، تحسين الأداء، إصلاح الدردشة، توافق الهواتف
// ✅ إضافة بحث في لوحة الصدارة
// ✅ تمييز ترتيب الطالب الحالي بلون مميز
// ✅ إعادة محاولة تلقائية للبيانات


import { getStudents, getStudentStats, getGameHistory, getAllStudentsGlobal, getTeacherSubscription, sendFriendRequest as sendFriendRequestService, acceptFriendRequest as acceptFriendRequestService, rejectFriendRequest as rejectFriendRequestService, getFriendsList, getFriendRequests, getGlobalLeaderboard, getSentFriendRequests, removeFriend, getStudentById } from '../services/dataService.js';
import { getDynamicGrades } from '../db/localstorage.js';
import { getLevelDisplay } from '../students/studentStats.js';
import { escapeHtml, showFloatingNotification } from '../utils.js';
import { getCurrentUserInfo } from '../firebase/auth.js';
import { DEFAULT_IMG } from '../constants.js';
// [تعطيل مؤقت] استيرادات الأونلاين القديمة محذوفة
// TODO: سيتم ربطها بالنظام الجديد لاحقاً
const joinRoom = async () => { console.warn('Join room disabled temporarily'); };
const getActiveRooms = async () => [];
const getAvailableTournaments = async () => [];
const joinTournament = async () => {};
const openRoomLobby = async () => {};
import { db, collection, query, where, orderBy, limit, onSnapshot, doc, addDoc, serverTimestamp, getDocs, updateDoc } from '../firebase/init.js';

// ===================== المتغيرات العامة =====================
let currentStudentId = null;
let currentStudentGrade = null;
let currentTeacherCode = null;
let currentStudentName = null;
let currentStudentImg = null;
let currentFriendsList = [];

let leaderboardUnsubscribe = null;
let currentLeaderboardType = 'global';
let isRedirecting = false;

let currentSideTab = 'classmates';
let onlineUsersUnsubscribe = null;
let allStudentsCache = { classmates: [], allstudents: [] };
let currentSearchTerm = '';

let currentChatRecipientId = null;
let currentChatUnsubscribe = null;
let unreadMessagesCount = 0;
let unreadMessagesListener = null;

// متغيرات لوحة الصدارة
let currentLeaderboardStudents = []; // تخزين الطلاب المعروضين حالياً للبحث

// متغيرات المراقبة المباشرة لبيانات الطالب
let studentProfileUnsubscribe = null;
let studentStatsUnsubscribe = null;

// ===================== التهيئة الرئيسية =====================
export async function initStudentDashboard() {
    console.log('[initStudentDashboard] بدء التهيئة المحسّنة');
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('race') === 'participant') {
        console.log('[initStudentDashboard] وضع السباق، لن نعيد تهيئة الواجهة');
        return;
    }
    
    const user = await getCurrentUserInfo();
    if (!user || user.isTeacher) {
        window.location.href = 'index.html';
        return;
    }
    currentStudentId = user.id;
    currentStudentGrade = user.grade;
    currentTeacherCode = user.teacherId;
    currentStudentName = user.name;
    currentStudentImg = user.img || DEFAULT_IMG;
    
    // إعداد المستمعات المباشرة لبيانات الطالب
    setupRealtimeStudentData(currentStudentId);
    
    await updateFriendsList();
    await updateStudentDashboard(currentStudentId);
    
    // ربط الأحداث
    document.getElementById('createOnlineGameStudentBtn')?.addEventListener('click', () => openCreateRoomModalForStudent());
    document.getElementById('refresh-public-rooms-btn')?.addEventListener('click', () => refreshPublicRoomsSimulated());
    document.getElementById('refresh-online-users-btn')?.addEventListener('click', () => loadOnlineUsers(currentSideTab));
    document.getElementById('search-friends-input')?.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        applySearchFilter();
    });
    document.getElementById('global-msg-icon')?.addEventListener('click', () => openGlobalMessagesModal());
    
    // إضافة مستمع لخانة البحث في لوحة الصدارة (إذا وجدت)
    const leaderboardSearch = document.getElementById('leaderboard-search-input');
    if (leaderboardSearch) {
        leaderboardSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            filterLeaderboard(term);
        });
    }
    
    document.querySelectorAll('.student-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchStudentTab(btn.dataset.tab));
    });
    
    const leaderboardGlobalBtn = document.getElementById('leaderboardGlobalBtn');
    const leaderboardTeacherBtn = document.getElementById('leaderboardTeacherBtn');
    const leaderboardGradeBtn = document.getElementById('leaderboardGradeBtn');
    if (leaderboardGlobalBtn) leaderboardGlobalBtn.addEventListener('click', () => loadLeaderboard('global'));
    if (leaderboardTeacherBtn) leaderboardTeacherBtn.addEventListener('click', () => loadLeaderboard('teacher'));
    if (leaderboardGradeBtn) leaderboardGradeBtn.addEventListener('click', () => loadLeaderboard('grade'));
    
    const jumpBtn = document.getElementById('jump-to-my-rank-btn');
    if (jumpBtn) jumpBtn.addEventListener('click', () => jumpToMyRank());
    
    const sideTabs = document.querySelectorAll('.side-tab-btn');
    sideTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            sideTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSideTab = tab.dataset.sideTab;
            document.getElementById('side-tab-title').innerText = (currentSideTab === 'classmates') ? 'زملاء الكتيبة' : 'كل المقاتلين';
            loadOnlineUsers(currentSideTab);
        });
    });
    
    await switchStudentTab('profile');
    startWatchingActiveRaces();
    await setupFriendRequestsListener();
    await loadLeaderboard('global');
    await loadOnlineUsers('classmates');
    startUnreadMessagesListener();
}

// ===================== مراقبة مباشرة لبيانات الطالب (دقة عالية) =====================
function setupRealtimeStudentData(studentId) {
    if (studentProfileUnsubscribe) studentProfileUnsubscribe();
    const studentRef = doc(db, 'students', studentId);
    studentProfileUnsubscribe = onSnapshot(studentRef, async (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            currentStudentGrade = data.grade;
            currentStudentName = data.name;
            currentStudentImg = data.img || DEFAULT_IMG;
            // تحديث الواجهة المباشرة
            const imgEl = document.getElementById('student-dashboard-img');
            if (imgEl) imgEl.src = currentStudentImg;
            const nameEl = document.getElementById('student-dashboard-name');
            if (nameEl) nameEl.innerText = currentStudentName;
            const gradeEl = document.getElementById('student-dashboard-grade');
            if (gradeEl) gradeEl.innerText = currentStudentGrade;
            const scoreEl = document.getElementById('student-dashboard-score');
            if (scoreEl) scoreEl.innerText = data.score || 0;
            
            // تحديث الرأس العلوي
            const topScore = document.getElementById('student-top-score');
            if (topScore) topScore.innerText = data.score || 0;
            
            // تحديث المستوى وشريط التقدم
            const level = getLevelDisplay({ score: data.score || 0 });
            const levelSpan = document.getElementById('student-level-name');
            if (levelSpan) levelSpan.innerText = level;
            // حساب نسبة التقدم (مثال بسيط)
            const maxScoreForLevel = 5000; // يمكن تحسينه
            const progress = Math.min(100, ((data.score || 0) / maxScoreForLevel) * 100);
            const progressFill = document.getElementById('level-progress');
            if (progressFill) progressFill.style.width = `${progress}%`;
        }
    }, (err) => console.error('Error in student profile listener:', err));
    
    // مراقبة الإحصائيات (الصحيحة، الخاطئة، الانتصارات)
    if (studentStatsUnsubscribe) studentStatsUnsubscribe();
    const statsRef = doc(db, 'studentStats', studentId);
    studentStatsUnsubscribe = onSnapshot(statsRef, async (snap) => {
        if (snap.exists()) {
            const stats = snap.data();
            const correct = stats.correctAnswers || 0;
            const total = stats.totalAnswers || 0;
            const wrong = total - correct;
            const wins = stats.wins || 0;
            const accuracy = total ? ((correct / total) * 100).toFixed(1) : 0;
            const bestStreak = stats.bestStreak || 0;
            const avgSpeed = stats.speedAvg || 0;
            const totalMatches = stats.totalMatches || 0;
            
            document.getElementById('student-correct').innerText = correct;
            document.getElementById('student-wrong').innerText = wrong;
            document.getElementById('student-wins').innerText = wins;
            document.getElementById('student-accuracy').innerText = accuracy;
            document.getElementById('student-total-matches').innerText = totalMatches;
            document.getElementById('student-best-streak').innerText = bestStreak;
            document.getElementById('student-avg-speed').innerText = avgSpeed;
            
            // تحديث الرأس العلوي بالانتصارات
            const topWins = document.getElementById('student-top-wins');
            if (topWins) topWins.innerText = wins;
        }
    }, (err) => console.error('Error in student stats listener:', err));
}

// ========== البحث والتصفية ==========
function applySearchFilter() {
    const container = document.getElementById('online-users-list');
    if (!container) return;
    const users = Array.from(container.querySelectorAll('.online-user-card, .online-user'));
    users.forEach(userDiv => {
        const nameElem = userDiv.querySelector('.font-medium');
        const name = nameElem ? nameElem.innerText.toLowerCase() : '';
        userDiv.style.display = name.includes(currentSearchTerm) ? 'flex' : 'none';
    });
}

// ========== تصفية لوحة الصدارة ==========
function filterLeaderboard(term) {
    const container = document.getElementById('global-leaderboard-container');
    if (!container) return;
    const rows = container.querySelectorAll('.leaderboard-row, .podium-card');
    rows.forEach(row => {
        const nameElem = row.querySelector('.student-name');
        const name = nameElem ? nameElem.innerText.toLowerCase() : '';
        row.style.display = name.includes(term) ? '' : 'none';
    });
}

// ========== تحسين "آخر ظهور" ==========
function formatLastSeen(date) {
    if (!date) return 'غير معروف';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    return date.toLocaleDateString('ar-EG');
}

// ========== تحميل المتصلين ==========
async function loadOnlineUsers(tabType = 'classmates') {
    const container = document.getElementById('online-users-list');
    if (!container) return;
    if (onlineUsersUnsubscribe) onlineUsersUnsubscribe();
    
    if (!currentStudentId) {
        container.innerHTML = '<div class="text-red-400 text-center text-xs">خطأ: لم يتم تسجيل الدخول</div>';
        return;
    }
    
    try {
        let studentsList = [];
        if (tabType === 'classmates') {
            const { getStudentsByTeacher } = await import('../services/dataService.js');
            if (!currentTeacherCode) {
                container.innerHTML = '<div class="text-red-400 text-center text-xs">خطأ: لم يتم تحديد المعلم</div>';
                return;
            }
            studentsList = await getStudentsByTeacher(currentTeacherCode);
            studentsList = studentsList.filter(s => s.grade === currentStudentGrade && s.id !== currentStudentId);
        } else {
            studentsList = await getAllStudentsGlobal();
            studentsList = studentsList.filter(s => s.id !== currentStudentId);
        }
        allStudentsCache[tabType] = studentsList;
        
        if (studentsList.length === 0) {
            container.innerHTML = '<div class="text-gray-400 text-center text-xs">لا يوجد طلاب للعرض</div>';
            return;
        }
        
        const presenceRef = collection(db, 'userPresence');
        const presenceQuery = query(presenceRef, where('online', '==', true));
        
        onlineUsersUnsubscribe = onSnapshot(presenceQuery, (snapshot) => {
            const presenceMap = new Map();
            snapshot.forEach(doc => {
                const data = doc.data();
                presenceMap.set(doc.id, {
                    online: data.online === true,
                    lastSeen: data.lastSeen?.toDate ? data.lastSeen.toDate() : (data.lastSeen ? new Date(data.lastSeen) : null)
                });
            });
            
            const usersWithStatus = studentsList.map(student => {
                const presence = presenceMap.get(student.id);
                const isOnline = presence?.online === true;
                let lastSeen = presence?.lastSeen || null;
                return {
                    id: student.id,
                    name: student.name,
                    img: student.img || DEFAULT_IMG,
                    grade: student.grade,
                    online: isOnline,
                    lastSeen: lastSeen
                };
            });
            
            usersWithStatus.sort((a, b) => {
                if (a.online === b.online) {
                    if (!a.online && a.lastSeen && b.lastSeen) return b.lastSeen - a.lastSeen;
                    return 0;
                }
                return a.online ? -1 : 1;
            });
            
            container.innerHTML = usersWithStatus.map(u => `
                <div class="online-user-card p-2 rounded-xl flex items-center gap-2 mb-1.5 cursor-pointer hover:bg-amber-500/10 transition" onclick="window.viewStudentStats('${u.id}', '${escapeHtml(u.name)}')">
                    <img src="${u.img}" class="w-8 h-8 rounded-full border ${u.online ? 'border-green-500' : 'border-gray-500'} object-cover flex-shrink-0" loading="lazy">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-xs text-white truncate">${escapeHtml(u.name)}</div>
                        <div class="text-[10px] text-gray-400 truncate">${escapeHtml(u.grade)}</div>
                        <div class="text-[9px] ${u.online ? 'text-green-400' : 'text-gray-500'}">
                            ${u.online ? '🟢 متصل الآن' : `📅 آخر ظهور: ${formatLastSeen(u.lastSeen)}`}
                        </div>
                    </div>
                    <i class="fa-regular fa-message msg-icon text-blue-400 text-sm cursor-pointer hover:text-yellow-400" data-id="${u.id}" data-name="${escapeHtml(u.name)}"></i>
                </div>
            `).join('');
            
            if (currentSearchTerm) applySearchFilter();
            
            document.querySelectorAll('.msg-icon').forEach(icon => {
                icon.removeEventListener('click', handleMessageIconClick);
                icon.addEventListener('click', handleMessageIconClick);
            });
        });
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="text-red-400 text-center text-xs">حدث خطأ في تحميل القائمة</div>';
    }
}

// ========== نافذة المحادثة (تم إصلاح الإغلاق) ==========
async function showPrivateMessageModal(recipientId, recipientName) {
    if (currentChatUnsubscribe) currentChatUnsubscribe();
    currentChatRecipientId = recipientId;
    
    const messagesRef = collection(db, 'privateMessages');
    const q = query(messagesRef, where('fromId', 'in', [currentStudentId, recipientId]), where('toId', 'in', [currentStudentId, recipientId]));
    const snapshot = await getDocs(q);
    let messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    messages.sort((a,b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
    
    const unreadMessages = messages.filter(m => m.toId === currentStudentId && !m.read);
    for (const msg of unreadMessages) {
        const msgRef = doc(db, 'privateMessages', msg.id);
        await updateDoc(msgRef, { read: true });
    }
    
    const messagesHtml = messages.map(msg => `
        <div class="mb-2 ${msg.fromId === currentStudentId ? 'text-left' : 'text-right'}">
            <div class="inline-block max-w-[80%] rounded-xl p-1.5 text-xs ${msg.fromId === currentStudentId ? 'bg-purple-600/50' : 'bg-slate-700/80'}">
                <div class="text-[9px] text-gray-300">${msg.fromId === currentStudentId ? 'أنت' : msg.fromName}</div>
                <div class="text-xs break-words">${escapeHtml(msg.content)}</div>
                <div class="text-[9px] text-gray-400 mt-0.5">${msg.timestamp?.toDate ? formatLastSeen(msg.timestamp.toDate()) : ''}</div>
            </div>
        </div>
    `).join('');
    
    const { value: form } = await Swal.fire({
        title: `💬 محادثة مع ${recipientName}`,
        html: `
            <div id="chat-messages-container" style="height: 250px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 12px; padding: 8px; margin-bottom: 8px; font-size: 12px;">
                ${messagesHtml || '<div class="text-center text-gray-500">لا توجد رسائل بعد</div>'}
            </div>
            <div class="flex gap-2">
                <input type="text" id="chat-input-field" class="flex-1 bg-slate-800 border border-slate-600 rounded-full px-3 py-1.5 text-sm" placeholder="اكتب رسالتك...">
                <button id="send-chat-btn" class="bg-yellow-600 hover:bg-yellow-500 text-black px-3 py-1.5 rounded-full text-xs font-bold">إرسال</button>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        background: '#0f172a',
        color: '#fff',
        didOpen: () => {
            const container = document.getElementById('chat-messages-container');
            const input = document.getElementById('chat-input-field');
            const sendBtn = document.getElementById('send-chat-btn');
            const scrollToBottom = () => { if (container) container.scrollTop = container.scrollHeight; };
            scrollToBottom();
            
            const liveQ = query(messagesRef, where('fromId', 'in', [currentStudentId, recipientId]), where('toId', 'in', [currentStudentId, recipientId]), orderBy('timestamp', 'asc'));
            currentChatUnsubscribe = onSnapshot(liveQ, (snap) => {
                let newMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                newMessages.sort((a,b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
                const newHtml = newMessages.map(msg => `
                    <div class="mb-2 ${msg.fromId === currentStudentId ? 'text-left' : 'text-right'}">
                        <div class="inline-block max-w-[80%] rounded-xl p-1.5 text-xs ${msg.fromId === currentStudentId ? 'bg-purple-600/50' : 'bg-slate-700/80'}">
                            <div class="text-[9px] text-gray-300">${msg.fromId === currentStudentId ? 'أنت' : msg.fromName}</div>
                            <div class="text-xs break-words">${escapeHtml(msg.content)}</div>
                            <div class="text-[9px] text-gray-400 mt-0.5">${msg.timestamp?.toDate ? formatLastSeen(msg.timestamp.toDate()) : ''}</div>
                        </div>
                    </div>
                `).join('');
                if (container) {
                    container.innerHTML = newHtml || '<div class="text-center text-gray-500">لا توجد رسائل بعد</div>';
                    scrollToBottom();
                }
                const newUnread = newMessages.filter(m => m.toId === currentStudentId && !m.read);
                newUnread.forEach(async (msg) => {
                    const msgRef = doc(db, 'privateMessages', msg.id);
                    await updateDoc(msgRef, { read: true });
                });
            });
            
            const sendMessage = async () => {
                const text = input.value.trim();
                if (!text) return;
                try {
                    await addDoc(messagesRef, {
                        fromId: currentStudentId,
                        fromName: currentStudentName,
                        toId: recipientId,
                        toName: recipientName,
                        content: text,
                        timestamp: serverTimestamp(),
                        read: false
                    });
                    input.value = '';
                } catch (err) {
                    console.error(err);
                    Swal.fire('خطأ', 'فشل إرسال الرسالة', 'error');
                }
            };
            sendBtn.onclick = sendMessage;
            input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
        },
        willClose: () => {
            if (currentChatUnsubscribe) currentChatUnsubscribe();
            currentChatRecipientId = null;
        }
    });
}

function handleMessageIconClick(event) {
    event.stopPropagation();
    const icon = event.currentTarget;
    const recipientId = icon.dataset.id;
    const recipientName = icon.dataset.name;
    showPrivateMessageModal(recipientId, recipientName);
}

function startUnreadMessagesListener() {
    if (unreadMessagesListener) unreadMessagesListener();
    const messagesRef = collection(db, 'privateMessages');
    const q = query(messagesRef, where('toId', '==', currentStudentId), where('read', '==', false));
    unreadMessagesListener = onSnapshot(q, (snapshot) => {
        unreadMessagesCount = snapshot.size;
        const badge = document.getElementById('unread-messages-badge');
        if (badge) {
            if (unreadMessagesCount > 0) {
                badge.innerText = unreadMessagesCount > 9 ? '9+' : unreadMessagesCount;
                badge.classList.remove('hidden');
                badge.style.display = 'flex';
            } else {
                badge.classList.add('hidden');
            }
        }
    });
}

function openGlobalMessagesModal() {
    Swal.fire({
        title: 'الرسائل',
        text: `لديك ${unreadMessagesCount} رسالة غير مقروءة. يمكنك الرد من خلال أيقونة الرسائل بجانب أسماء الأصدقاء.`,
        icon: 'info',
        confirmButtonText: 'حسناً',
        background: '#0f172a',
        color: '#fff'
    });
}

async function updateFriendsList() {
    currentFriendsList = await getFriendsList(currentStudentId);
}

export async function updateStudentDashboard(studentId) {
    // تم استبدال هذه الدالة بالمراقبة المباشرة، لكن نتركها للتوافق
    console.log('updateStudentDashboard called, but real-time listener is active');
}

export async function switchStudentTab(tabName) {
    document.querySelectorAll('.student-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.student-tab-panel').forEach(panel => {
        panel.classList.toggle('hidden', panel.id !== 'student-tab-' + tabName);
    });
    if (tabName === 'profile') {
        // لا حاجة لتحديث يدوي بسبب onSnapshot
    } else if (tabName === 'rooms') await refreshPublicRoomsSimulated();
    else if (tabName === 'global') await renderGlobalEnvironment();
    else if (tabName === 'friends') await renderFriendsPanel();
    else if (tabName === 'leaderboard') await loadLeaderboard(currentLeaderboardType);
    else if (tabName === 'tournaments') await renderTournamentsList();
}

async function refreshPublicRoomsSimulated() {
    if (true) { // تعطيل مؤقت
    container.innerHTML = '<div class="text-center text-gray-400 py-4 text-xs">ميزة الغرف الأونلاين قيد التطوير حاليًا</div>';
    return;
}
    const container = document.getElementById('public-rooms-list');
    if (!container) return;
    container.innerHTML = '<div class="loader-spinner mx-auto"></div><p class="text-center text-gray-400 text-xs">جاري تحميل الغرف...</p>';
    try {
        const rooms = await getActiveRooms('student', { id: currentStudentId, teacherId: currentTeacherCode });
        if (rooms.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-4 text-xs">لا توجد غرف متاحة حالياً</div>';
            return;
        }
        let html = '<div class="grid grid-cols-1 gap-2">';
        for (const room of rooms) {
            html += `
                <div class="pubg-panel p-2 flex flex-wrap justify-between items-center gap-2">
                    <div class="flex-1">
                        <div class="font-bold text-yellow-400 text-xs">🎮 ${escapeHtml(room.name || `غرفة ${room.pin}`)}</div>
                        <div class="text-[10px] text-gray-300">المضيف: ${escapeHtml(room.hostName)}</div>
                        <div class="text-[9px] text-gray-400">📖 ${escapeHtml(room.grade)} | ${escapeHtml(room.subject)}</div>
                        <div class="text-[9px]">👥 ${room.players?.length || 0}/${room.maxPlayers || 10}</div>
                    </div>
                    <button class="join-room-btn bg-green-600 hover:bg-green-500 px-3 py-1 rounded-lg text-[10px] font-bold" data-room-id="${room.id}">انضم</button>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        document.querySelectorAll('.join-room-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const roomId = btn.dataset.roomId;
                try {
                    await joinRoom(roomId, { id: currentStudentId, name: currentStudentName, img: currentStudentImg });
                    await openRoomLobby(roomId, { id: currentStudentId, name: currentStudentName, img: currentStudentImg }, 'student', 'player');
                } catch (err) {
                    showFloatingNotification(err.message, 'error');
                }
            });
        });
    } catch (error) {
        container.innerHTML = '<div class="text-center text-red-400 py-4 text-xs">حدث خطأ في تحميل الغرف</div>';
    }
}

export async function renderGlobalEnvironment() {
    const container = document.getElementById('global-environment-container');
    if (!container) return;
    if (!currentStudentId) {
        container.innerHTML = `<div class="pubg-panel p-4 text-center text-red-400 text-xs">يرجى تسجيل الدخول مرة أخرى</div>`;
        return;
    }
    container.innerHTML = `<div class="loader-spinner mx-auto"></div><p class="text-center text-xs">جاري تحميل الطلاب...</p>`;
    try {
        const allStudents = await getAllStudentsGlobal();
        const currentUserId = currentStudentId;
        const myGrade = currentStudentGrade;
        const classmates = allStudents.filter(s => s.grade === myGrade && s.teacherId === currentTeacherCode && s.id !== currentUserId);
        const otherStudents = allStudents.filter(s => (s.grade !== myGrade || s.teacherId !== currentTeacherCode) && s.id !== currentUserId);
        
        let sentRequests = [], receivedRequests = [];
        try {
            const { getSentFriendRequests, getFriendRequests } = await import('../services/dataService.js');
            sentRequests = await getSentFriendRequests(currentUserId);
            receivedRequests = await getFriendRequests(currentUserId);
        } catch(e) { console.warn(e); }
        const sentIds = new Set(sentRequests.map(r => r.to));
        const receivedFromIds = new Set(receivedRequests.map(r => r.from));
        
        function renderStudentCard(student) {
            const isRequestSent = sentIds.has(student.id);
            const isRequestReceived = receivedFromIds.has(student.id);
            const studentImg = student.img && student.img !== 'undefined' ? student.img : DEFAULT_IMG;
            return `
                <div class="pubg-panel p-2 flex justify-between items-center global-student-card cursor-pointer hover:border-amber-500" onclick="window.viewStudentStats('${student.id}', '${escapeHtml(student.name)}')">
                    <div class="flex items-center gap-2">
                        <img src="${studentImg}" class="w-8 h-8 rounded-full border border-yellow-500 object-cover" loading="lazy">
                        <div>
                            <div class="font-bold text-white text-xs">${escapeHtml(student.name)}</div>
                            <div class="text-[9px] text-gray-400">${escapeHtml(student.grade)}</div>
                        </div>
                    </div>
                    <div class="friend-actions">
                        ${isRequestSent ? '<span class="text-gray-400 text-[9px]">✓ طلب مرسل</span>' : 
                          isRequestReceived ? `<button class="respond-friend-btn bg-green-600 px-2 py-0.5 rounded-lg text-[9px]" data-id="${student.id}" data-action="accept">قبول</button>
                                               <button class="respond-friend-btn bg-red-600 px-2 py-0.5 rounded-lg text-[9px]" data-id="${student.id}" data-action="reject">رفض</button>` :
                          `<button class="add-friend-btn bg-purple-600 hover:bg-purple-500 px-2 py-0.5 rounded-lg text-[9px]" data-id="${student.id}">➕ إضافة</button>`}
                    </div>
                </div>
            `;
        }
        let html = `<div class="pubg-panel p-3 mb-3"><h2 class="text-xs font-bold text-yellow-400 mb-2">👥 زملائي في الصف (${classmates.length})</h2><div class="grid grid-cols-1 gap-1.5">`;
        if (classmates.length === 0) html += `<div class="text-center text-gray-400 text-[10px] col-span-full">لا يوجد زملاء</div>`;
        else classmates.forEach(s => { html += renderStudentCard(s); });
        html += `</div></div><div class="pubg-panel p-3"><h2 class="text-xs font-bold text-yellow-400 mb-2">🌍 طلاب من صفوف أخرى (${otherStudents.length})</h2><div class="grid grid-cols-1 gap-1.5">`;
        if (otherStudents.length === 0) html += `<div class="text-center text-gray-400 text-[10px]">لا يوجد طلاب</div>`;
        else otherStudents.forEach(s => { html += renderStudentCard(s); });
        html += `</div></div>`;
        container.innerHTML = html;
        
        document.querySelectorAll('.add-friend-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const targetId = btn.dataset.id;
                await sendFriendRequest(currentStudentId, targetId);
                await renderGlobalEnvironment();
            });
        });
        document.querySelectorAll('.respond-friend-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const targetId = btn.dataset.id;
                const action = btn.dataset.action;
                if (action === 'accept') await acceptFriendRequest(currentStudentId, targetId);
                else await rejectFriendRequest(currentStudentId, targetId);
                await renderGlobalEnvironment();
            });
        });
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '🔍 ابحث عن طالب...';
        searchInput.className = 'w-full bg-slate-950 border border-amber-500/30 rounded-full px-3 py-1.5 text-xs mb-3 focus:outline-none focus:border-amber-400';
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.global-student-card').forEach(card => {
                const name = card.querySelector('.font-bold')?.innerText.toLowerCase() || '';
                card.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });
        container.prepend(searchInput);
    } catch (error) {
        container.innerHTML = `<div class="pubg-panel p-4 text-center text-red-400 text-xs">حدث خطأ في تحميل البيئة العالمية</div>`;
    }
}

export async function renderFriendsPanel() {
    const container = document.getElementById('friends-list');
    if (!container) return;
    if (!currentStudentId) {
        container.innerHTML = `<div class="pubg-panel p-4 text-center text-red-400 text-xs">يرجى تسجيل الدخول مرة أخرى</div>`;
        return;
    }
    container.innerHTML = '<div class="loader-spinner mx-auto"></div>';
    try {
        await updateFriendsList();
        const friends = currentFriendsList;
        const receivedRequests = await getFriendRequests(currentStudentId);
        const sentRequests = await getSentFriendRequests(currentStudentId);
        let html = '';
        if (receivedRequests.length > 0) {
            html += `<div class="pubg-panel p-3 mb-3"><h3 class="text-xs font-bold text-yellow-400 mb-2">📩 طلبات الصداقة الواردة</h3><div class="space-y-1.5">`;
            for (const req of receivedRequests) {
                html += `<div class="flex justify-between items-center p-2 bg-white/5 rounded-xl"><div class="flex items-center gap-2"><img src="${req.fromImg || DEFAULT_IMG}" class="w-7 h-7 rounded-full border border-yellow-500"><div><div class="font-bold text-xs">${escapeHtml(req.fromName)}</div><div class="text-[9px] text-gray-400">يريد إضافتك</div></div></div><div class="flex gap-1.5"><button class="accept-friend-request-btn bg-green-600 px-2 py-0.5 rounded-lg text-[9px]" data-from="${req.from}">قبول</button><button class="reject-friend-request-btn bg-red-600 px-2 py-0.5 rounded-lg text-[9px]" data-from="${req.from}">رفض</button></div></div>`;
            }
            html += `</div></div>`;
        }
        if (sentRequests.length > 0) {
            html += `<div class="pubg-panel p-3 mb-3"><h3 class="text-xs font-bold text-purple-400 mb-2">📤 طلبات مرسلة (قيد الانتظار)</h3><div class="space-y-1.5">`;
            for (const req of sentRequests) {
                const toStudent = await getStudentById(req.to);
                if (toStudent) {
                    html += `<div class="flex justify-between items-center p-2 bg-white/5 rounded-xl"><div class="flex items-center gap-2"><img src="${toStudent.img || DEFAULT_IMG}" class="w-7 h-7 rounded-full border border-purple-500"><div><div class="font-bold text-xs">${escapeHtml(toStudent.name)}</div><div class="text-[9px] text-gray-400">في انتظار الرد</div></div></div><button class="cancel-friend-request-btn bg-gray-600 px-2 py-0.5 rounded-lg text-[9px]" data-to="${req.to}">إلغاء</button></div>`;
                }
            }
            html += `</div></div>`;
        }
        html += `<div class="pubg-panel p-3"><h3 class="text-xs font-bold text-green-400 mb-2">👫 أصدقائي (${friends.length})</h3>`;
        if (friends.length === 0) html += `<div class="text-center text-gray-400 py-3 text-xs">لا يوجد أصدقاء بعد. ابحث في البيئة العالمية!</div>`;
        else {
            html += `<div class="grid grid-cols-1 gap-1.5">`;
            for (const friend of friends) {
                html += `<div class="flex justify-between items-center p-2 bg-white/5 rounded-xl cursor-pointer hover:bg-amber-500/10" onclick="window.viewStudentStats('${friend.id}', '${escapeHtml(friend.name)}')"><div class="flex items-center gap-2"><img src="${friend.img || DEFAULT_IMG}" class="w-7 h-7 rounded-full border border-yellow-500" loading="lazy"><div><div class="font-bold text-xs">${escapeHtml(friend.name)}</div><div class="text-[9px] text-gray-400">${escapeHtml(friend.grade)}</div></div></div><button class="remove-friend-btn bg-red-700/70 hover:bg-red-600 px-2 py-0.5 rounded-lg text-[9px]" data-id="${friend.id}">🗑️</button></div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
        container.innerHTML = html;
        
        document.querySelectorAll('.accept-friend-request-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fromId = btn.dataset.from;
                await acceptFriendRequest(currentStudentId, fromId);
                await updateFriendsList();
                await renderFriendsPanel();
                showFloatingNotification('تم قبول الصديق', 'success');
            });
        });
        document.querySelectorAll('.reject-friend-request-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fromId = btn.dataset.from;
                await rejectFriendRequest(currentStudentId, fromId);
                await renderFriendsPanel();
                showFloatingNotification('تم رفض الطلب', 'info');
            });
        });
        document.querySelectorAll('.cancel-friend-request-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const toId = btn.dataset.to;
                const { db, collection, query, where, getDocs, deleteDoc } = await import('../firebase/init.js');
                const q = query(collection(db, 'friendRequests'), where('from', '==', currentStudentId), where('to', '==', toId), where('status', '==', 'pending'));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    await deleteDoc(snap.docs[0].ref);
                    await updateFriendsList();
                    await renderFriendsPanel();
                    showFloatingNotification('تم إلغاء الطلب', 'info');
                }
            });
        });
        document.querySelectorAll('.remove-friend-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('هل تريد إزالة هذا الصديق؟')) {
                    await removeFriend(currentStudentId, btn.dataset.id);
                    await updateFriendsList();
                    await renderFriendsPanel();
                    showFloatingNotification('تم إزالة الصديق', 'info');
                }
            });
        });
    } catch (error) {
        container.innerHTML = '<div class="text-center text-red-400 py-4 text-xs">فشل تحميل الأصدقاء</div>';
    }
}

// ========================================================
// 🏆 لوحة الصدارة المحسنة فائق الجمال (بدون سكرول متجاوبة 100%) 🏆
// ========================================================
async function loadLeaderboard(type) {
    currentLeaderboardType = type;
    const container = document.getElementById('global-leaderboard-container');
    if (!container) return;
    
    if (!currentStudentId) {
        container.innerHTML = `<div class="p-6 text-center text-red-400 text-xs font-bold bg-red-950/20 border border-red-500/30 rounded-2xl animate-pulse">⚠️ يرجى تسجيل الدخول مرة أخرى للمتابعة</div>`;
        return;
    }
    
    if (leaderboardUnsubscribe) leaderboardUnsubscribe();
    
    container.innerHTML = `<div class="flex justify-center items-center py-16"><div class="relative w-10 h-10 animate-spin"><div class="absolute inset-0 rounded-full border-2 border-amber-500/10"></div><div class="absolute inset-0 rounded-full border-2 border-t-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]"></div></div></div>`;
    
    let collectionRef, constraints = [];
    if (type === 'global') { 
        collectionRef = collection(db, 'students'); 
        constraints = [orderBy('score', 'desc'), limit(50)]; 
    } else if (type === 'teacher') { 
        if (!currentTeacherCode) return; 
        collectionRef = collection(db, 'students'); 
        constraints = [where('teacherId', '==', currentTeacherCode), orderBy('score', 'desc'), limit(50)]; 
    } else if (type === 'grade') { 
        if (!currentStudentGrade) return; 
        collectionRef = collection(db, 'students'); 
        constraints = [where('grade', '==', currentStudentGrade), orderBy('score', 'desc'), limit(50)]; 
    } else return;
    
    const q = query(collectionRef, ...constraints);
    leaderboardUnsubscribe = onSnapshot(q, async (snapshot) => {
        let students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const history = await getGameHistory();
        
        for (let s of students) {
            s.wins = history.filter(g => String(g.winnerId) === String(s.id)).length;
            const stats = await getStudentStats(s.id);
            if (stats) {
                s.correctAnswers = stats.correctAnswers || 0;
                s.totalAnswers = stats.totalAnswers || 0;
                s.score = stats.score || s.score || 0;
            }
        }
        
        students.sort((a,b) => (b.score || 0) - (a.score || 0));
        currentLeaderboardStudents = students;
        
        const top3 = students.slice(0, 3);
        const rest = students.slice(3);
        
        // --- بناء منصة التتويج الذكية المضغوطة ---
        let podiumHtml = '';
        if (top3.length) {
            podiumHtml = `<div class="grid grid-cols-3 items-end gap-1.5 md:gap-4 my-6 px-1 w-full max-w-xl mx-auto box-border overflow-hidden">`;
            podiumHtml += top3.map((s, idx) => {
                const rank = idx + 1;
                const isRank1 = rank === 1;
                const medalIcon = isRank1 ? '👑' : (rank === 2 ? '🥈' : '🥉');
                const flexOrder = isRank1 ? 'order-2' : (rank === 2 ? 'order-1' : 'order-3');
                let cardStyle = '';
                if (isRank1) cardStyle = 'border-yellow-500/40 bg-gradient-to-b from-yellow-500/15 to-transparent shadow-[0_0_20px_rgba(234,179,8,0.25)] scale-105 z-10 pt-4 pb-3';
                else if (rank === 2) cardStyle = 'border-slate-400/30 bg-gradient-to-b from-slate-400/10 to-transparent shadow-[0_0_12px_rgba(203,213,225,0.15)] pb-2 pt-3';
                else cardStyle = 'border-amber-700/40 bg-gradient-to-b from-amber-800/10 to-transparent shadow-[0_0_12px_rgba(180,83,9,0.15)] pb-2 pt-3';
                const isCurrent = (s.id === currentStudentId);
                return `
                    <div class="${flexOrder} podium-card relative flex flex-col items-center p-1.5 md:p-3 text-center rounded-xl border backdrop-blur-md transition-all duration-300 hover:scale-[1.03] cursor-pointer ${cardStyle} ${isCurrent ? 'ring-1 ring-amber-400 ring-offset-1 ring-offset-slate-900 bg-amber-500/10' : ''}" onclick="window.viewStudentStats('${s.id}', '${escapeHtml(s.name)}')">
                        <div class="absolute -top-4 text-lg md:text-2xl drop-shadow-[0_2px_5px_rgba(0,0,0,0.6)]">${medalIcon}</div>
                        <div class="relative mt-1"><img src="${s.img || DEFAULT_IMG}" class="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full border-2 ${isRank1 ? 'border-yellow-400 shadow-yellow-500/50' : (rank === 2 ? 'border-slate-300' : 'border-amber-600')} object-cover shadow-md" loading="lazy"><span class="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-slate-900 text-[8px] font-bold px-1 rounded-full text-white border border-gray-700 font-mono">#${rank}</span></div>
                        <div class="font-bold text-[10px] md:text-xs text-white truncate w-full mt-2 px-0.5 drop-shadow-sm">${escapeHtml(s.name)}</div>
                        <div class="text-yellow-400 font-black text-[10px] md:text-xs mt-0.5 flex items-center gap-0.5 justify-center">✨${s.score || 0}</div>
                        <div class="text-[8px] md:text-[10px] text-gray-400 font-medium mt-0.5">🏆 ${s.wins || 0} فوز</div>
                        ${isCurrent ? '<div class="text-[7px] md:text-[9px] text-amber-400 font-black tracking-tighter mt-1 bg-amber-500/20 px-1 rounded-sm">أنت ★</div>' : ''}
                    </div>`;
            }).join('');
            podiumHtml += `</div>`;
        }
        
        // --- بناء جدول الترتيب ---
        let tableHtml = '';
        if (rest.length) {
            tableHtml = `<div class="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40 backdrop-blur-md shadow-2xl mt-4"><div class="overflow-x-auto"><table class="w-full text-right text-[11px] md:text-xs"><thead><tr class="bg-white/5 border-b border-white/10 text-gray-400 font-medium"><th class="p-2.5 text-center w-10">#</th><th class="p-2.5">المحارب</th><th class="p-2.5 text-center">✨ النقاط</th><th class="p-2.5 text-center">🏆 الانتصارات</th><th class="p-2.5 text-center hidden sm:table-cell">⚡ اللقب</th></tr></thead><tbody class="divide-y divide-white/5">`;
            rest.forEach((s, idx) => {
                const isCurrent = (s.id === currentStudentId);
                const rank = idx + 4;
                tableHtml += `<tr class="leaderboard-row group hover:bg-white/5 cursor-pointer transition-all duration-150 ${isCurrent ? 'bg-amber-500/10 font-bold text-amber-300' : 'text-gray-300'}" data-student-id="${s.id}" onclick="window.viewStudentStats('${s.id}', '${escapeHtml(s.name)}')"><td class="p-2.5 text-center font-mono ${isCurrent ? 'text-amber-400 font-black' : 'text-gray-500'}">${rank}</td><td class="p-2.5"><div class="flex items-center gap-2"><img src="${s.img || DEFAULT_IMG}" class="w-6 h-6 rounded-full object-cover border border-white/10 shadow-sm group-hover:scale-105 transition-transform" loading="lazy"><div class="flex flex-col min-w-0"><span class="truncate max-w-[100px] md:max-w-[150px] font-medium group-hover:text-white transition-colors">${escapeHtml(s.name)}</span></div>${isCurrent ? '<span class="text-[8px] bg-amber-500 text-black px-1 rounded font-black scale-90">أنت</span>' : ''}</div></td><td class="p-2.5 text-center text-yellow-400 font-bold">✨ ${s.score || 0}</td><td class="p-2.5 text-center font-medium">🏆 ${s.wins || 0}</td><td class="p-2.5 text-center hidden sm:table-cell"><span class="inline-block px-2 py-0.5 rounded bg-slate-900 text-[9px] text-slate-400 border border-slate-800">${getLevelDisplay({score: s.score || 0})}</span></td></tr>`;
            });
            tableHtml += `</tbody></table></div></div>`;
        }
        
        // تحديث أشرطة الترتيب الثابتة
        const myRank = students.findIndex(s => s.id === currentStudentId) + 1;
        const myScore = students.find(s => s.id === currentStudentId)?.score || 0;
        const stickyRank = document.getElementById('my-sticky-rank');
        const stickyScore = document.getElementById('my-sticky-score');
        if (stickyRank) stickyRank.innerText = myRank > 0 ? `#${myRank}` : 'غير مصنف';
        if (stickyScore) stickyScore.innerText = `${myScore} نقطة`;
        
        container.innerHTML = podiumHtml + tableHtml;
        
        // شريط البحث
        if (!document.getElementById('leaderboard-search-input')) {
            const searchDiv = document.createElement('div');
            searchDiv.className = 'mb-4 relative w-full';
            searchDiv.innerHTML = `<span class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500 text-xs">🔍</span><input type="text" id="leaderboard-search-input" placeholder="ابحث عن منافس بداخل لوحة الصدارة..." class="w-full bg-slate-950/70 border border-white/10 rounded-xl pr-8 pl-4 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all">`;
            container.prepend(searchDiv);
            const searchInput = document.getElementById('leaderboard-search-input');
            if (searchInput) searchInput.addEventListener('input', (e) => filterLeaderboard(e.target.value.toLowerCase()));
        }
    });
}

// ========================================================
// 🚀 القفز الذكي الفلاشي لترتيب اللاعب الحالي 🚀
// ========================================================
async function jumpToMyRank() {
    const container = document.getElementById('global-leaderboard-container');
    if (!container) return;
    
    let myRow = null;
    let myPodium = null;
    
    const rows = container.querySelectorAll('.leaderboard-row');
    for (const row of rows) {
        if (row.dataset.studentId === currentStudentId) { myRow = row; break; }
    }
    const podiums = container.querySelectorAll('.podium-card');
    for (const podium of podiums) {
        const onclickAttr = podium.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(currentStudentId)) { myPodium = podium; break; }
    }
    
    if (myRow) {
        myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        myRow.classList.add('bg-amber-500/30', 'scale-[1.01]', 'ring-1', 'ring-amber-500/50');
        setTimeout(() => myRow.classList.remove('bg-amber-500/30', 'scale-[1.01]', 'ring-1', 'ring-amber-500/50'), 1800);
        showFloatingNotification('⚡ تم الانتقال إلى موقعك الحالي', 'success', 1500);
    } else if (myPodium) {
        myPodium.scrollIntoView({ behavior: 'smooth', block: 'center' });
        myPodium.classList.add('scale-105', 'shadow-[0_0_20px_rgba(245,158,11,0.4)]');
        setTimeout(() => myPodium.classList.remove('scale-105', 'shadow-[0_0_20px_rgba(245,158,11,0.4)]'), 1800);
        showFloatingNotification('👑 رائع! أنت تتربع على منصة التتويج حالياً', 'success', 1500);
    } else {
        Swal.fire({
            title: '🎯 رتبتك الحالية',
            text: 'أنت حالياً خارج أفضل 50 بطلاً. استمر في التحدي والمواجهة لتكتسح الصدارة وتحتل المنصة!',
            icon: 'info',
            confirmButtonText: 'تحدي وقبول 🔥',
            background: '#090d16',
            color: '#fff',
            customClass: { popup: 'rounded-2xl border border-white/10 shadow-2xl', confirmButton: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-6 py-2 rounded-xl text-xs font-bold shadow-md border-none' }
        });
    }
}

// ========================================================
// 📊 عرض بطاقة هوية المحارب الفخمة (مودال إحصائي مبهر) 📊
// ========================================================
async function showStudentStatsModal(studentId, studentName) {
    try {
        let student = null;
        if (typeof window.getStudentById === 'function') {
            student = await window.getStudentById(studentId);
        } else {
            const { getStudentById } = await import('../services/dataService.js');
            student = await getStudentById(studentId);
        }
        if (!student) throw new Error('تعذر العثور على بيانات اللاعب');
        
        let stats = await getStudentStats(studentId);
        if (!stats) stats = { score: student.score || 0, correctAnswers: 0, totalAnswers: 0, wins: 0 };
        
        const correct = stats.correctAnswers || 0;
        const total = stats.totalAnswers || 0;
        const wrong = total - correct;
        const wins = stats.wins || 0;
        const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
        const level = getLevelDisplay({ score: stats.score || 0 });
        const history = await getGameHistory();
        const totalMatches = history.filter(g => g.participants?.includes(studentId)).length;
        
        Swal.fire({
            title: '',
            html: `<div class="flex flex-col items-center"><div class="relative mb-2.5"><div class="absolute inset-0 bg-amber-500 rounded-full blur-md opacity-20 animate-pulse"></div><img src="${student.img || DEFAULT_IMG}" class="relative w-20 h-20 rounded-full border-2 border-amber-500/80 object-cover shadow-2xl" loading="lazy"></div><div class="text-base font-black text-white tracking-wide">${escapeHtml(student.name)}</div><div class="text-amber-400 text-[10px] font-bold px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full mt-1">${escapeHtml(student.grade)}</div><div class="w-full border-b border-white/5 my-3.5"></div><div class="grid grid-cols-2 gap-2.5 w-full text-xs"><div class="bg-slate-950/60 border border-white/5 p-2.5 rounded-xl text-center"><div class="text-yellow-400 text-base font-black">✨ ${stats.score || 0}</div><div class="text-[9px] text-gray-500 mt-0.5">مجموع النقاط</div></div><div class="bg-slate-950/60 border border-white/5 p-2.5 rounded-xl text-center"><div class="text-green-400 text-base font-black">🏆 ${wins}</div><div class="text-[9px] text-gray-500 mt-0.5">المركز الأول</div></div><div class="bg-slate-950/60 border border-white/5 p-2.5 rounded-xl text-center"><div class="text-emerald-400 text-sm font-bold">✅ ${correct}</div><div class="text-[9px] text-gray-500 mt-0.5">إجابة صحيحة</div></div><div class="bg-slate-950/60 border border-white/5 p-2.5 rounded-xl text-center"><div class="text-red-400 text-sm font-bold">❌ ${wrong}</div><div class="text-[9px] text-gray-500 mt-0.5">إجابة خاطئة</div></div></div><div class="w-full mt-3.5 bg-slate-950/90 border border-white/5 p-2.5 rounded-xl"><div class="flex justify-between text-[10px] mb-1 text-gray-400"><span>🎮 إجمالي المواجهات: <strong class="text-cyan-400 font-mono">${totalMatches}</strong></span><span>🎯 دقة الإجابة: <strong class="text-emerald-400 font-mono">${accuracy}%</strong></span></div><div class="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden"><div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" style="width: ${accuracy}%"></div></div></div><div class="mt-3.5 w-full text-center bg-gradient-to-r from-purple-950/20 to-slate-950/30 border border-purple-500/20 p-2 rounded-xl text-[11px] text-purple-200">⚡ رتبة اللقب الفعلي: <span class="font-bold text-white">${level}</span></div></div>`,
            showConfirmButton: true,
            confirmButtonText: 'إغلاق البطاقة الشخصية',
            background: '#060911',
            color: '#fff',
            customClass: { popup: 'rounded-2xl border border-white/10 w-[92%] max-w-sm backdrop-blur-2xl shadow-2xl p-5', confirmButton: 'w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black py-2 rounded-xl text-xs font-black transition-all shadow-md border-none' }
        });
    } catch (error) {
        console.error(error);
        showFloatingNotification('🚨 تعذر استدعاء الملف الشخصي للبطل حالياً', 'error');
    }
}

// تعريف الدوال العامة
window.viewStudentStats = showStudentStatsModal;
window.jumpToMyRank = jumpToMyRank;
window.handleMessageIcon = handleMessageIconClick;

async function sendFriendRequest(fromId, toId) {
    try { await sendFriendRequestService(fromId, toId); showFloatingNotification('تم إرسال طلب الصداقة', 'success'); } catch(e) { showFloatingNotification(e.message, 'error'); }
}
async function acceptFriendRequest(currentId, requesterId) {
    try { await acceptFriendRequestService(currentId, requesterId); showFloatingNotification('تم قبول الصديق', 'success'); } catch(e) { showFloatingNotification(e.message, 'error'); }
}
async function rejectFriendRequest(currentId, requesterId) {
    try { await rejectFriendRequestService(currentId, requesterId); showFloatingNotification('تم رفض الطلب', 'info'); } catch(e) { showFloatingNotification(e.message, 'error'); }
}

async function openCreateRoomModalForStudent() {
    showFloatingNotification('إنشاء الغرف الأونلاين متاح حاليًا للمعلمين فقط، وسيتم تفعيله للطلاب قريبًا', 'info');
return;
    if (!currentTeacherCode) { showFloatingNotification('لا يمكن تحديد معلمك. يرجى تسجيل الدخول مرة أخرى.', 'error'); return; }
    const { getTeacherSubscription } = await import('../services/dataService.js');
    const subscription = await getTeacherSubscription(currentTeacherCode);
    const plan = subscription?.plan || 'free';
    if (plan !== 'gold' && plan !== 'platinum') {
        showFloatingNotification(`معلمك مشترك في الباقة ${plan === 'free' ? 'المجانية' : (plan === 'silver' ? 'الفضية' : plan)}، لا يمكنك إنشاء غرف أونلاين. يرجى التواصل معه للترقية إلى الباقة الذهبية.`, 'error');
        return;
    }
    if (plan === 'silver') {
        const used = subscription?.onlineRoomsUsedThisMonth || 0;
        const max = 10;
        if (used >= max) { showFloatingNotification(`معلمك استنفذ عدد المباريات الشهرية المسموحة (${max}/ شهر). سيتم التجديد الشهر القادم أو يمكنه الترقية للذهبية.`, 'error'); return; }
        showFloatingNotification(`✨ يمكنك إنشاء غرف (متبقي ${max - used} من أصل ${max} هذا الشهر)`, 'info', 3000);
    }
    const originalTeacherCode = sessionStorage.getItem('peak_teacher_code');
    const originalTeacherLogged = sessionStorage.getItem('peak_teacher_logged_in');
    sessionStorage.setItem('peak_teacher_code', currentTeacherCode);
    sessionStorage.setItem('peak_teacher_logged_in', 'true');
    try { console.log('محاولة فتح نافذة إنشاء غرفة'); } finally {
        if (originalTeacherLogged === 'true') { sessionStorage.setItem('peak_teacher_code', originalTeacherCode); sessionStorage.setItem('peak_teacher_logged_in', 'true'); }
        else { sessionStorage.removeItem('peak_teacher_code'); sessionStorage.removeItem('peak_teacher_logged_in'); }
    }
}

export async function renderTournamentsList() {
    if (true) {
    container.innerHTML = '<div class="pubg-panel p-4 text-center text-gray-400 text-xs">🏆 البطولات قيد التطوير حاليًا</div>';
    return;
}
    const container = document.getElementById('tournaments-container');
    if (!container) return;
    if (!currentStudentId) { container.innerHTML = `<div class="pubg-panel p-4 text-center text-red-400 text-xs">يرجى تسجيل الدخول مرة أخرى</div>`; return; }
    container.innerHTML = '<div class="loader-spinner mx-auto"></div>';
    try {
        const tournaments = await getAvailableTournaments('student', { id: currentStudentId, teacherId: currentTeacherCode });
        if (!tournaments || tournaments.length === 0) {
            container.innerHTML = `<div class="pubg-panel p-4 text-center"><i class="fas fa-trophy text-3xl text-gray-500 mb-2"></i><p class="text-gray-400 text-xs">🏆 لا توجد بطولات نشطة حالياً</p><p class="text-[9px] text-gray-500">يمكن للمعلم إنشاء بطولات جديدة</p></div>`;
            return;
        }
        let html = '<div class="space-y-2">';
        for (const t of tournaments) {
            const isJoined = t.players?.some(p => p.id === currentStudentId);
            html += `<div class="pubg-panel p-2"><div class="flex justify-between items-center"><div><span class="font-bold text-yellow-400 text-xs">${escapeHtml(t.name)}</span></div>${!isJoined ? `<button class="join-tournament-btn bg-blue-600 hover:bg-blue-500 px-2 py-0.5 rounded-lg text-[9px]" data-id="${t.id}">سجل الآن</button>` : '<span class="text-green-400 text-[9px]">✓ مسجل</span>'}</div><div class="text-[9px] text-gray-300">📖 ${t.grade} | ${t.subject} | ${t.type === 'knockout' ? 'إقصائي' : 'دوري'}</div><div class="text-[8px] text-gray-400">👥 ${t.players?.length || 0} مسجل</div></div>`;
        }
        html += '</div>';
        container.innerHTML = html;
        document.querySelectorAll('.join-tournament-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await joinTournament(id, { id: currentStudentId, name: currentStudentName, img: currentStudentImg });
                showFloatingNotification('تم التسجيل بنجاح', 'success');
                await renderTournamentsList();
            });
        });
    } catch (err) { container.innerHTML = `<div class="pubg-panel p-4 text-center text-red-400 text-xs">حدث خطأ في تحميل البطولات: ${err.message}</div>`; }
}

let activeRaceWatcher = null;
export function startWatchingActiveRaces() {
    if (activeRaceWatcher) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('race') === 'participant') return;
    (async () => {
        const user = await getCurrentUserInfo();
        if (!user || user.isTeacher) return;
        const { db, collection, query, where, onSnapshot } = await import('../firebase/init.js');
        const q = query(collection(db, 'activeRaces'), where('players', 'array-contains', { id: user.id }));
        activeRaceWatcher = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' && !isRedirecting) {
                    const race = change.doc.data();
                    if (race.status === 'waiting') {
                        isRedirecting = true;
                        sessionStorage.setItem('current_race_session', JSON.stringify(race));
                        Swal.fire({ title: '⚔️ مباراة جاهزة!', text: `تم بدء مباراتك${race.tournamentId ? ' في البطولة' : ''}. سيتم نقلك إلى ساحة المعركة.`, icon: 'info', timer: 2000, showConfirmButton: false, background: '#0f172a', color: '#fff', didOpen: () => { setTimeout(() => { window.location.href = `platform.html?race=participant&sessionId=${race.sessionId}`; setTimeout(() => { isRedirecting = false; }, 3000); }, 2000); } });
                    }
                }
            });
        });
    })();
}

let friendRequestsUnsubscribe = null;
async function setupFriendRequestsListener() {
    if (friendRequestsUnsubscribe) friendRequestsUnsubscribe();
    const { db, collection, query, where, onSnapshot } = await import('../firebase/init.js');
    const receivedQ = query(collection(db, 'friendRequests'), where('to', '==', currentStudentId), where('status', '==', 'pending'));
    const sentQ = query(collection(db, 'friendRequests'), where('from', '==', currentStudentId), where('status', '==', 'pending'));
    const unsubscribeReceived = onSnapshot(receivedQ, async () => { await renderFriendsPanel(); });
    const unsubscribeSent = onSnapshot(sentQ, async () => { await renderFriendsPanel(); });
    friendRequestsUnsubscribe = () => { unsubscribeReceived(); unsubscribeSent(); };
}

export { loadOnlineUsers };