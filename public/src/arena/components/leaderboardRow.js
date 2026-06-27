// src/arena/components/leaderboardRow.js
// صف واحد في جدول الصدارة

import { escapeHtml } from '../helpers/escapeHtml.js';

export function renderLeaderboardRow(student, rank, isCurrentUser = false, onImageClick) {
    const row = document.createElement('div');
    row.className = `flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${isCurrentUser ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-white/5 hover:bg-white/10'}`;
    
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    
    row.innerHTML = `
        <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-8 text-center font-bold ${rank <= 3 ? 'text-yellow-400 text-lg' : 'text-gray-400'}">${medal || rank}</div>
            <img src="${student.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" 
                 class="w-10 h-10 rounded-full object-cover border-2 ${rank === 1 ? 'border-yellow-400' : rank === 2 ? 'border-gray-300' : rank === 3 ? 'border-amber-600' : 'border-gray-600'} cursor-pointer hover:scale-105 transition"
                 data-id="${student.id}"
                 data-name="${escapeHtml(student.name)}"
                 data-score="${student.score || 0}"
                 data-wins="${student.wins || 0}"
                 data-correct="${student.correct || 0}"
                 data-total="${student.total || 0}"
                 data-accuracy="${student.accuracy || 0}"
                 data-teacher-id="${student.teacherId || ''}"
                 data-img="${student.img || ''}">
            <div class="flex-1 min-w-0">
                <div class="font-bold text-white truncate">${escapeHtml(student.name)}</div>
                <div class="text-xs text-gray-400 truncate">${escapeHtml(student.grade || 'بدون صف')}</div>
            </div>
        </div>
        <div class="flex gap-4 text-sm">
            <div class="text-yellow-400 font-bold w-16 text-center">${student.score || 0}</div>
            <div class="text-green-400 w-12 text-center">${student.wins || 0}</div>
            <div class="text-blue-400 w-14 text-center">${student.accuracy ? student.accuracy.toFixed(1) + '%' : '0%'}</div>
        </div>
    `;
    
    const img = row.querySelector('img');
    if (img) {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            const data = img.dataset;
            onImageClick({
                id: data.id,
                name: data.name,
                score: parseInt(data.score),
                wins: parseInt(data.wins),
                correct: parseInt(data.correct),
                total: parseInt(data.total),
                accuracy: parseFloat(data.accuracy),
                teacherId: data.teacherId,
                img: data.img
            });
        });
    }
    
    return row;
}