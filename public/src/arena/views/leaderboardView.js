// src/arena/views/leaderboardView.js
// عرض لوحة الصدارة مع الفلاتر والمنصة
// [FIX] إضافة فحص صلاحية المجاني

import { fetchLeaderboard, sortLeaderboard } from '../services/leaderboardService.js';
import { renderLeaderboardRow } from '../components/leaderboardRow.js';
import { showPlayerCard } from '../components/playerCardModal.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import { canAccessLeaderboard } from '../../services/subscriptionGuard.js';

let currentSort = 'score';
let currentType = 'global';
let currentData = [];

export async function render(container, currentUser, role) {
    // ✅ التحقق من صلاحية الوصول للوحة الصدارة
    const canAccess = await canAccessLeaderboard(currentUser.id, !currentUser.isTeacher);
    if (!canAccess) {
        container.innerHTML = `
            <div class="text-center text-yellow-400 py-10 bg-white/5 rounded-xl">
                <i class="fas fa-lock text-4xl mb-2 opacity-50"></i>
                <p>🔒 لوحة الصدارة متاحة فقط للمشتركين في الباقة الفضية أو الذهبية.</p>
                ${!currentUser.isTeacher ? '<p class="text-sm text-gray-400 mt-2">يرجى التواصل مع معلمك لترقية الاشتراك.</p>' : '<p class="text-sm text-gray-400 mt-2">قم بترقية اشتراكك للاستفادة من هذه الميزة.</p>'}
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="mb-4">
            <div class="flex flex-wrap gap-2 mb-4">
                <button data-type="global" class="type-btn bg-purple-600/50 hover:bg-purple-600 px-3 py-1 rounded-full text-sm">🌍 عالمي</button>
                ${role.isTeacher ? `
                    <button data-type="teacher" class="type-btn bg-blue-600/50 hover:bg-blue-600 px-3 py-1 rounded-full text-sm">👨‍🏫 طلابي</button>
                ` : `
                    <button data-type="teacher" class="type-btn bg-blue-600/50 hover:bg-blue-600 px-3 py-1 rounded-full text-sm">👥 طلاب معلمي</button>
                `}
                ${!role.isTeacher ? `
                    <button data-type="grade" class="type-btn bg-green-600/50 hover:bg-green-600 px-3 py-1 rounded-full text-sm">📚 صفي (${escapeHtml(role.studentGrade)})</button>
                ` : ''}
            </div>
            <div class="flex flex-wrap gap-2 mb-4 border-b border-white/10 pb-2">
                <button data-sort="score" class="sort-btn text-sm px-3 py-1 rounded-full transition ${currentSort === 'score' ? 'bg-yellow-500 text-black' : 'bg-white/10'}">✨ النقاط</button>
                <button data-sort="wins" class="sort-btn text-sm px-3 py-1 rounded-full transition ${currentSort === 'wins' ? 'bg-yellow-500 text-black' : 'bg-white/10'}">🏆 الفوز</button>
                <button data-sort="accuracy" class="sort-btn text-sm px-3 py-1 rounded-full transition ${currentSort === 'accuracy' ? 'bg-yellow-500 text-black' : 'bg-white/10'}">🎯 الدقة</button>
            </div>
        </div>
        <div id="leaderboard-content">
            <div class="text-center text-gray-400 py-10">جاري التحميل...</div>
        </div>
    `;
    
    const contentDiv = document.getElementById('leaderboard-content');
    
    async function loadData() {
        contentDiv.innerHTML = '<div class="text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent mx-auto"></div></div>';
        
        let teacherId = null;
        let grade = null;
        if (currentType === 'teacher') {
            if (role.isTeacher) teacherId = currentUser.id;
            else teacherId = currentUser.teacherId;
        } else if (currentType === 'grade') {
            grade = role.studentGrade;
        }
        
        const students = await fetchLeaderboard(currentType, teacherId, grade, 100);
        currentData = students;
        renderLeaderboardUI(contentDiv, currentData, currentSort, currentUser, role);
    }
    
    function renderLeaderboardUI(container, students, sortBy, currentUser, role) {
        const sorted = sortLeaderboard(students, sortBy);
        const top3 = sorted.slice(0, 3);
        const rest = sorted.slice(3);
        
        let podiumHtml = '';
        if (top3.length) {
            podiumHtml = `<div class="grid grid-cols-3 gap-2 mb-6 items-end">`;
            const ranks = [2, 1, 3];
            for (const rank of ranks) {
                const student = top3[rank-1];
                if (!student) continue;
                let medal = rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉';
                let bgClass = rank === 1 ? 'bg-gradient-to-b from-yellow-500/30 to-transparent border-yellow-400' : rank === 2 ? 'bg-gradient-to-b from-gray-400/20 to-transparent border-gray-400' : 'bg-gradient-to-b from-amber-700/30 to-transparent border-amber-600';
                podiumHtml += `
                    <div class="p-2 rounded-xl text-center ${bgClass} border-b-2 cursor-pointer hover:scale-105 transition" data-student-id="${student.id}">
                        <div class="text-3xl">${medal}</div>
                        <img src="${student.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="w-16 h-16 rounded-full mx-auto border-2 ${rank === 1 ? 'border-yellow-400' : rank === 2 ? 'border-gray-300' : 'border-amber-600'} object-cover">
                        <div class="font-bold text-sm mt-1 truncate">${escapeHtml(student.name)}</div>
                        <div class="text-yellow-400 text-xs font-bold">${student.score || 0}</div>
                    </div>
                `;
            }
            podiumHtml += `</div>`;
        }
        
        let tableHtml = `<div class="space-y-2">`;
        rest.forEach((student, idx) => {
            const rank = idx + 4;
            const isCurrent = (student.id === currentUser.id);
            const row = renderLeaderboardRow(student, rank, isCurrent, (studentData) => {
                showPlayerCard(studentData.id);
            });
            tableHtml += row.outerHTML;
        });
        tableHtml += `</div>`;
        
        container.innerHTML = podiumHtml + tableHtml;
        
        document.querySelectorAll('[data-student-id]').forEach(el => {
            const studentId = el.dataset.studentId;
            if (studentId) {
                el.addEventListener('click', () => showPlayerCard(studentId));
            }
        });
        
        if (!role.isTeacher) {
            const myRank = sorted.findIndex(s => s.id === currentUser.id) + 1;
            if (myRank > 0) {
                const jumpBtn = document.createElement('button');
                jumpBtn.className = 'fixed bottom-20 right-4 bg-yellow-600 text-black p-2 rounded-full shadow-lg z-40 text-sm font-bold';
                jumpBtn.innerHTML = '<i class="fas fa-arrow-up"></i> ترتيبي';
                jumpBtn.onclick = () => {
                    const myRow = container.querySelector(`.leaderboard-row[data-id="${currentUser.id}"]`) || 
                                 container.querySelector(`[data-student-id="${currentUser.id}"]`);
                    if (myRow) myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                };
                container.appendChild(jumpBtn);
            }
        }
    }
    
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentType = btn.dataset.type;
            loadData();
        });
    });
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSort = btn.dataset.sort;
            if (currentData.length) {
                renderLeaderboardUI(contentDiv, currentData, currentSort, currentUser, role);
            }
        });
    });
    
    await loadData();
}