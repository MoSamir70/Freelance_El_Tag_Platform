// src/student/StudentDashboard.js
// واجهة الطالب الموحدة – تحتوي على الغرف، البطولات، الأصدقاء، لوحة الصدارة، والتحديات المباشرة.
// تعتمد على onSnapshot للتحديث الحي.

import { getCurrentUserInfo } from '../firebase/auth.js';
import { db, collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, orderBy, limit } from '../firebase/init.js';
import { getAvailableRoomsForStudent, joinPrivateRoom, createRoomAsStudent, joinRoom } from '../online/online-service.js';
import { getActiveTournamentsForStudent, getTournamentById } from '../services/dataService.js';
import { renderTournamentBracket } from '../online/TournamentBracket.js';
import { showFloatingNotification, escapeHtml } from '../utils.js';
import { DEFAULT_IMG } from '../constants.js';
import { openRoomLobby } from '../online/room-manager.js';

let currentStudent = null;
let roomsUnsubscribe = null;
let tournamentsUnsubscribe = null;
let challengesUnsubscribe = null;
let activeTab = 'home';

// ========== التهيئة الرئيسية ==========
export async function initStudentDashboard() {
    currentStudent = await getCurrentUserInfo();
    if (!currentStudent || currentStudent.isTeacher) {
        window.location.href = 'index.html';
        return;
    }
    
    await setupEventListeners();
    await loadHomeTab();
    await loadOnlineUsers();
    await setupChallengesListener();       // مراقبة التحديات الواردة
    await startWatchingActiveRaces();
}

function setupEventListeners() {
    const tabs = document.querySelectorAll('.student-main-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            if (activeTab === 'home') await loadHomeTab();
            else if (activeTab === 'rooms') await loadRoomsTab();
            else if (activeTab === 'tournaments') await loadTournamentsTab();
            else if (activeTab === 'friends') await loadFriendsTab();
            else if (activeTab === 'leaderboard') await loadLeaderboardTab();
        });
    });
    
    document.getElementById('createRoomBtn')?.addEventListener('click', showCreateRoomModal);
    document.getElementById('joinPrivateRoomBtn')?.addEventListener('click', () => joinPrivateRoomHandler());
    document.getElementById('refreshOnlineUsers')?.addEventListener('click', loadOnlineUsers);
}

// ========== التبويب الرئيسي (الملف الشخصي) ==========
async function loadHomeTab() {
    const container = document.getElementById('tab-home');
    if (!container) return;
    
    const student = currentStudent;
    const stats = await getStudentStats(student.id);
    const level = getLevelDisplay(student.score);
    
    container.innerHTML = `
        <div class="student-profile-card glass-panel p-6 text-center">
            <img src="${student.img || DEFAULT_IMG}" class="w-24 h-24 rounded-full mx-auto border-4 border-yellow-500">
            <h2 class="text-2xl font-bold mt-3">${escapeHtml(student.name)}</h2>
            <p class="text-gray-300">${escapeHtml(student.grade)}</p>
            <div class="flex justify-center gap-4 mt-3">
                <div class="text-center"><div class="text-yellow-400 text-xl">⭐ ${student.score}</div><div class="text-xs">نقطة</div></div>
                <div class="text-center"><div class="text-green-400 text-xl">🎮 ${stats.totalMatches || 0}</div><div class="text-xs">مباراة</div></div>
                <div class="text-center"><div class="text-yellow-400 text-xl">🏆 ${stats.wins || 0}</div><div class="text-xs">فوز</div></div>
            </div>
            <div class="mt-4">
                <div class="text-sm text-gray-400">المستوى: ${level}</div>
                <div class="w-full bg-gray-700 rounded-full h-2 mt-2"><div class="bg-yellow-500 h-2 rounded-full" style="width: ${getLevelProgress(student.score)}%"></div></div>
            </div>
        </div>
        <div class="glass-panel p-4 mt-4">
            <h3 class="text-lg font-bold text-yellow-400">📊 إحصائيات سريعة</h3>
            <div class="grid grid-cols-2 gap-3 mt-2">
                <div><span class="text-gray-400">الدقة:</span> ${Math.round(stats.accuracy || 0)}%</div>
                <div><span class="text-gray-400">أفضل سلسلة:</span> ${stats.bestStreak || 0}</div>
                <div><span class="text-gray-400">الترتيب (صفك):</span> #${stats.classRank || '?'}</div>
                <div><span class="text-gray-400">الترتيب (معلمك):</span> #${stats.teacherRank || '?'}</div>
            </div>
        </div>
    `;
}

// ========== التبويب: الغرف ==========
async function loadRoomsTab() {
    const container = document.getElementById('tab-rooms');
    if (!container) return;
    
    if (roomsUnsubscribe) roomsUnsubscribe();
    const q = query(collection(db, 'activeRooms'), where('hostId', '==', currentStudent.teacherId), where('status', '==', 'waiting'));
    roomsUnsubscribe = onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderRoomsList(rooms);
    });
}

function renderRoomsList(rooms) {
    const container = document.getElementById('roomsList');
    if (!container) return;
    if (rooms.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">لا توجد غرف نشطة حالياً</div>';
        return;
    }
    container.innerHTML = rooms.map(room => `
        <div class="room-card glass-panel p-4 flex justify-between items-center">
            <div>
                <div class="font-bold text-yellow-400">${escapeHtml(room.name || `غرفة ${room.pin}`)}</div>
                <div class="text-sm text-gray-300">📖 ${room.grade} | ${room.subject}</div>
                <div class="text-xs text-gray-400">👥 ${room.players.length}/${room.maxPlayers} لاعب</div>
            </div>
            <button class="join-room-btn bg-green-600 hover:bg-green-500 px-4 py-2 rounded-full text-sm" data-room-id="${room.id}">انضم</button>
        </div>
    `).join('');
    document.querySelectorAll('.join-room-btn').forEach(btn => {
        btn.addEventListener('click', () => joinRoomHandler(btn.dataset.roomId));
    });
}

async function joinRoomHandler(roomId) {
    try {
        await joinRoom(roomId, currentStudent);
        window.openRoomLobbyForStudent(roomId, currentStudent);
    } catch (err) {
        showFloatingNotification(err.message, 'error');
    }
}

async function joinPrivateRoomHandler() {
    const code = document.getElementById('privateRoomCode').value.trim();
    if (!code) return;
    try {
        const roomId = await joinPrivateRoom(code, currentStudent);
        window.openRoomLobbyForStudent(roomId, currentStudent);
    } catch (err) {
        showFloatingNotification(err.message, 'error');
    }
}

// ========== التبويب: البطولات ==========
async function loadTournamentsTab() {
    const container = document.getElementById('tab-tournaments');
    if (!container) return;
    if (tournamentsUnsubscribe) tournamentsUnsubscribe();
    const q = query(collection(db, 'tournaments'), where('teacherId', '==', currentStudent.teacherId), where('status', 'in', ['waiting', 'active']));
    tournamentsUnsubscribe = onSnapshot(q, async (snapshot) => {
        const tournaments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let html = `<div class="space-y-4">`;
        for (const t of tournaments) {
            const isRegistered = t.players?.some(p => p.id === currentStudent.id);
            const statusText = t.status === 'waiting' ? 'مفتوحة للتسجيل' : (t.status === 'active' ? 'جارية' : 'منتهية');
            html += `
                <div class="glass-panel p-4">
                    <div class="flex justify-between items-center">
                        <div><span class="font-bold text-yellow-400">${escapeHtml(t.name)}</span><span class="text-xs text-gray-400 mr-2">(${statusText})</span></div>
                        ${!isRegistered && t.status === 'waiting' ? `<button class="register-tournament-btn bg-purple-600 px-3 py-1 rounded-full text-sm" data-id="${t.id}">سجل الآن</button>` : ''}
                        ${isRegistered ? `<span class="text-green-400 text-sm">✓ مسجل</span>` : ''}
                    </div>
                    <div class="text-sm text-gray-300 mt-1">📖 ${t.grade} | ${t.subject} | ${t.type === 'knockout' ? 'إقصائي' : 'دوري'}</div>
                    ${t.status === 'active' ? `<button class="view-bracket-btn mt-2 text-blue-400 text-sm" data-id="${t.id}">عرض شجرة البطولة</button>` : ''}
                </div>
            `;
        }
        html += `</div>`;
        container.innerHTML = html;
        document.querySelectorAll('.register-tournament-btn').forEach(btn => {
            btn.addEventListener('click', () => registerForTournament(btn.dataset.id));
        });
        document.querySelectorAll('.view-bracket-btn').forEach(btn => {
            btn.addEventListener('click', () => showTournamentBracket(btn.dataset.id));
        });
    });
}

async function registerForTournament(tournamentId) {
    const { joinTournament } = await import('../online/online-service.js');
    try {
        await joinTournament(tournamentId, { id: currentStudent.id, name: currentStudent.name, img: currentStudent.img });
        showFloatingNotification('تم التسجيل بنجاح', 'success');
        await loadTournamentsTab();
    } catch (err) {
        showFloatingNotification(err.message, 'error');
    }
}

async function showTournamentBracket(tournamentId) {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) return;
    const bracketHtml = renderTournamentBracket(tournament, currentStudent.id, false);
    Swal.fire({
        title: `🏆 شجرة بطولة ${escapeHtml(tournament.name)}`,
        html: `<div style="max-height: 70vh; overflow-y: auto;">${bracketHtml}</div>`,
        width: '90%',
        background: '#0f172a',
        color: '#fff',
        confirmButtonText: 'إغلاق'
    });
}

// ========== التبويب: الأصدقاء والتحديات ==========
async function loadFriendsTab() {
    const container = document.getElementById('tab-friends');
    if (!container) return;
    const { getFriendsList, getOnlineUsers } = await import('../services/dataService.js');
    const friends = await getFriendsList(currentStudent.id);
    const onlineUsers = await getOnlineUsers();
    const onlineIds = new Set(onlineUsers.map(u => u.id));
    if (friends.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">لا يوجد أصدقاء بعد</div>';
        return;
    }
    let html = '<div class="space-y-3">';
    for (const f of friends) {
        const isOnline = onlineIds.has(f.id);
        html += `
            <div class="glass-panel p-3 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <img src="${f.img || DEFAULT_IMG}" class="w-10 h-10 rounded-full">
                    <div><div class="font-bold">${escapeHtml(f.name)}</div><div class="text-xs ${isOnline ? 'text-green-400' : 'text-gray-400'}">${isOnline ? '🟢 متصل' : '⚫ غير متصل'}</div></div>
                </div>
                ${isOnline ? `<button class="challenge-friend-btn bg-yellow-600 px-3 py-1 rounded-full text-sm" data-id="${f.id}" data-name="${escapeHtml(f.name)}">🎮 تحدى</button>` : ''}
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
    document.querySelectorAll('.challenge-friend-btn').forEach(btn => {
        btn.addEventListener('click', () => sendChallenge(btn.dataset.id, btn.dataset.name));
    });
}

// ========== إرسال تحدٍ مباشر ==========
async function sendChallenge(friendId, friendName) {
    try {
        // إنشاء وثيقة تحدٍ في Firestore
        const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const challengeData = {
            id: challengeId,
            from: {
                id: currentStudent.id,
                name: currentStudent.name,
                img: currentStudent.img || DEFAULT_IMG
            },
            to: friendId,
            status: 'pending',  // pending, accepted, rejected, expired
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 دقائق صلاحية
            gameSettings: {
                grade: currentStudent.grade,
                subject: null,
                goal: 10,
                timePerQuestion: 12,
                gameMode: 'classic'
            }
        };
        await setDoc(doc(db, 'challenges', challengeId), challengeData);
        showFloatingNotification(`✅ تم إرسال تحدٍ إلى ${friendName}`, 'success');
    } catch (err) {
        console.error('Error sending challenge:', err);
        showFloatingNotification('فشل إرسال التحدي', 'error');
    }
}

// ========== قبول التحدي ==========
async function acceptChallenge(challengeId, fromUserId) {
    try {
        const challengeRef = doc(db, 'challenges', challengeId);
        const challengeSnap = await getDoc(challengeRef);
        if (!challengeSnap.exists()) throw new Error('التحدي غير موجود');
        const challenge = challengeSnap.data();
        if (challenge.status !== 'pending') throw new Error('هذا التحدي تم الرد عليه مسبقاً');
        
        // إنشاء غرفة خاصة للتحدي
        const roomPin = Math.floor(1000 + Math.random() * 9000).toString();
        const roomData = {
            name: `تحدي: ${challenge.from.name} vs ${currentStudent.name}`,
            grade: challenge.gameSettings.grade,
            subject: challenge.gameSettings.subject || 'عام',
            gameMode: challenge.gameSettings.gameMode,
            maxPlayers: 2,
            isPrivate: true,
            accessCode: roomPin,
            players: [
                { id: challenge.from.id, name: challenge.from.name, img: challenge.from.img, isReady: false },
                { id: currentStudent.id, name: currentStudent.name, img: currentStudent.img || DEFAULT_IMG, isReady: false }
            ],
            hostId: challenge.from.id,
            hostName: challenge.from.name,
            status: 'waiting',
            createdAt: serverTimestamp()
        };
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await setDoc(doc(db, 'activeRooms', roomId), roomData);
        
        // تحديث حالة التحدي إلى accepted
        await updateDoc(challengeRef, { status: 'accepted', roomId, acceptedAt: serverTimestamp() });
        
        showFloatingNotification(`🎮 تم قبول التحدي! جارٍ فتح الغرفة...`, 'success');
        // فتح لوبي الغرفة للطالب
        await openRoomLobby(roomId, currentStudent, 'student', 'player');
    } catch (err) {
        console.error('Error accepting challenge:', err);
        showFloatingNotification(err.message, 'error');
    }
}

// ========== رفض التحدي ==========
async function rejectChallenge(challengeId) {
    try {
        const challengeRef = doc(db, 'challenges', challengeId);
        await updateDoc(challengeRef, { status: 'rejected', rejectedAt: serverTimestamp() });
        showFloatingNotification('تم رفض التحدي', 'info');
    } catch (err) {
        console.error('Error rejecting challenge:', err);
    }
}

// ========== مراقبة التحديات الواردة ==========
function setupChallengesListener() {
    if (challengesUnsubscribe) challengesUnsubscribe();
    const q = query(collection(db, 'challenges'), where('to', '==', currentStudent.id), where('status', '==', 'pending'));
    challengesUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const challenge = { id: change.doc.id, ...change.doc.data() };
                showChallengeNotification(challenge);
            }
        });
    });
}

function showChallengeNotification(challenge) {
    // نافذة منبثقة باستخدام SweetAlert
    Swal.fire({
        title: '🎮 تحدٍ جديد!',
        html: `
            <div class="text-center">
                <img src="${challenge.from.img}" class="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-yellow-500">
                <p class="text-lg font-bold">${escapeHtml(challenge.from.name)}</p>
                <p>يتحداك في مبارزة!</p>
                <p class="text-sm text-gray-400">${challenge.gameSettings.goal} نقطة | ${challenge.gameSettings.timePerQuestion} ثانية</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'قبول 🎮',
        cancelButtonText: 'رفض ❌',
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#ef4444'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await acceptChallenge(challenge.id, challenge.from.id);
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            await rejectChallenge(challenge.id);
        }
    });
}

// ========== لوحة الصدارة الحية (Real-time) ==========
async function loadLeaderboardTab() {
    const container = document.getElementById('tab-leaderboard');
    if (!container) return;
    
    container.innerHTML = `
        <div class="flex gap-2 mb-4">
            <button id="leaderboardGlobal" class="bg-purple-600 px-4 py-2 rounded-full text-sm">🌍 عالمي</button>
            <button id="leaderboardTeacher" class="bg-gray-700 px-4 py-2 rounded-full text-sm">👨‍🏫 معلمي</button>
            <button id="leaderboardGrade" class="bg-gray-700 px-4 py-2 rounded-full text-sm">📚 صفي</button>
        </div>
        <div id="leaderboardContent"></div>
    `;
    
    let currentUnsubscribe = null;
    
    const loadLeaderboard = (type) => {
        if (currentUnsubscribe) currentUnsubscribe();
        let q;
        if (type === 'global') {
            q = query(collection(db, 'students'), orderBy('score', 'desc'), limit(20));
        } else if (type === 'teacher') {
            if (!currentStudent.teacherId) return;
            q = query(collection(db, 'students'), where('teacherId', '==', currentStudent.teacherId), orderBy('score', 'desc'), limit(20));
        } else {
            q = query(collection(db, 'students'), where('grade', '==', currentStudent.grade), orderBy('score', 'desc'), limit(20));
        }
        currentUnsubscribe = onSnapshot(q, (snapshot) => {
            const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            document.getElementById('leaderboardContent').innerHTML = renderLeaderboardTable(students);
        });
    };
    
    loadLeaderboard('global');
    document.getElementById('leaderboardGlobal').onclick = () => loadLeaderboard('global');
    document.getElementById('leaderboardTeacher').onclick = () => loadLeaderboard('teacher');
    document.getElementById('leaderboardGrade').onclick = () => loadLeaderboard('grade');
}

function renderLeaderboardTable(students) {
    if (!students.length) return '<div class="text-gray-400 text-center">لا توجد بيانات</div>';
    let html = '<table class="w-full text-right"><thead><tr class="border-b border-yellow-500/30"><th>#</th><th>الاسم</th><th>النقاط</th><th>المستوى</th></tr></thead><tbody>';
    students.forEach((s, idx) => {
        const level = getLevelDisplay(s.score);
        html += `<tr class="border-b border-white/10"><td class="p-2">${idx+1}</td><td class="p-2 flex items-center gap-2"><img src="${s.img || DEFAULT_IMG}" class="w-6 h-6 rounded-full">${escapeHtml(s.name)}</td><td class="p-2">⭐ ${s.score || 0}</td><td class="p-2">${level}</td><tr>`;
    });
    html += '</tbody>赶 </div>';
    return html;
}

// ========== المتصلون ==========
async function loadOnlineUsers() {
    const container = document.getElementById('onlineUsersList');
    if (!container) return;
    const { getOnlineUsers } = await import('../services/dataService.js');
    const users = await getOnlineUsers();
    if (users.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center">لا يوجد متصلون</div>';
        return;
    }
    container.innerHTML = users.map(u => `<div class="flex items-center gap-2 p-2 bg-white/5 rounded-xl"><span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span><img src="${u.img || DEFAULT_IMG}" class="w-6 h-6 rounded-full"><span>${escapeHtml(u.name)}</span></div>`).join('');
}

// ========== إحصائيات الطالب ==========
async function getStudentStats(studentId) {
    const { getStudentStats } = await import('../services/dataService.js');
    return await getStudentStats(studentId);
}

// ========== وظائف المستوى ==========
function getLevelDisplay(score) {
    if (score >= 5000) return 'أسطورة';
    if (score >= 3000) return 'خبير';
    if (score >= 1500) return 'محترف';
    if (score >= 500) return 'متقدم';
    if (score >= 100) return 'مبتدئ';
    return 'جديد';
}

function getLevelProgress(score) {
    const boundaries = [0, 100, 500, 1500, 3000, 5000];
    for (let i = 1; i < boundaries.length; i++) {
        if (score < boundaries[i]) {
            return Math.round(((score - boundaries[i-1]) / (boundaries[i] - boundaries[i-1])) * 100);
        }
    }
    return 100;
}

// ========== مراقبة المباريات النشطة ==========
function startWatchingActiveRaces() {
    const q = query(collection(db, 'activeRaces'), where('players', 'array-contains', { id: currentStudent.id }));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const race = change.doc.data();
                if (race.status === 'waiting') {
                    showFloatingNotification('⚔️ مباراة جاهزة! سيتم نقلك الآن.', 'info');
                    setTimeout(() => window.location.href = `/race/race-participant.html?sessionId=${race.sessionId}`, 2000);
                }
            }
        });
    });
}

// ========== دوال إنشاء الغرفة (مودال) ==========
function showCreateRoomModal() {
    Swal.fire({
        title: 'إنشاء غرفة جديدة',
        html: `
            <input id="roomName" class="swal2-input" placeholder="اسم الغرفة">
            <select id="roomSubject" class="swal2-select">
                <option value="">اختر المادة</option>
                <option value="الرياضيات">الرياضيات</option>
                <option value="العلوم">العلوم</option>
                <option value="اللغة العربية">اللغة العربية</option>
            </select>
            <input id="roomGoal" type="number" class="swal2-input" placeholder="عدد خطوات الفوز" value="10">
            <input id="roomTimer" type="number" class="swal2-input" placeholder="وقت الإجابة (ث)" value="12">
            <label><input type="checkbox" id="roomPrivate"> غرفة خاصة (برمز)</label>
            <div id="roomCodeDiv" style="display:none"><input id="roomCode" class="swal2-input" placeholder="رمز 4 أرقام" maxlength="4"></div>
        `,
        showCancelButton: true,
        confirmButtonText: 'إنشاء',
        cancelButtonText: 'إلغاء',
        preConfirm: async () => {
            const name = document.getElementById('roomName').value;
            const subject = document.getElementById('roomSubject').value;
            const goal = parseInt(document.getElementById('roomGoal').value);
            const timer = parseInt(document.getElementById('roomTimer').value);
            const isPrivate = document.getElementById('roomPrivate').checked;
            const code = isPrivate ? document.getElementById('roomCode').value : null;
            if (!name || !subject) {
                Swal.showValidationMessage('الاسم والمادة مطلوبة');
                return false;
            }
            if (isPrivate && (!code || code.length !== 4)) {
                Swal.showValidationMessage('رمز الدخول يجب أن يكون 4 أرقام');
                return false;
            }
            try {
                const roomId = await createRoomAsStudent({
                    name, subject, goal, timer, isPrivate, accessCode: code,
                    grade: currentStudent.grade,
                    gameMode: 'classic',
                    maxPlayers: 10
                });
                window.openRoomLobbyForStudent(roomId, currentStudent);
            } catch (err) {
                Swal.showValidationMessage(err.message);
            }
        },
        didOpen: () => {
            const privateCheck = document.getElementById('roomPrivate');
            const codeDiv = document.getElementById('roomCodeDiv');
            privateCheck.onchange = () => codeDiv.style.display = privateCheck.checked ? 'block' : 'none';
        }
    });
}

// دالة مؤقتة لفتح لوبي الطالب (سيتم ربطها لاحقاً)
window.openRoomLobbyForStudent = (roomId, student) => {
    console.log('فتح لوبي الطالب للغرفة', roomId);
    // سنقوم بتفعيلها عند اكتمال integration مع room-manager
    if (typeof openRoomLobby === 'function') {
        openRoomLobby(roomId, student, 'student', 'player');
    } else {
        showFloatingNotification('تم إنشاء الغرفة بنجاح! يمكنك مشاركة الرمز مع أصدقائك.', 'success');
        location.reload();
    }
};

// وظيفة مساعدة لإنشاء غرفة كطالب (إضافة في online-service)
async function createRoomAsStudent(roomData) {
    const { createRoom } = await import('../online/online-service.js');
    return await createRoom({
        ...roomData,
        hostId: currentStudent.id,
        hostName: currentStudent.name,
        players: [{ id: currentStudent.id, name: currentStudent.name, img: currentStudent.img, isReady: false }]
    });
}

// تصدير الدوال العامة
export { loadOnlineUsers };