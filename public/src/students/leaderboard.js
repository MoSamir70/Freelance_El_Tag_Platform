// src/students/leaderboard.js
// لوحة الشرف: عرض الأوائل، أكثر لاعب فوزاً، أكثر لاعب دقة
// [FIX] إزالة الاعتماد على dbLight المباشر واستخدام dataService
// [FIX] تحديث البيانات من Firebase (getStudents, getGameHistory, getStudentStats)
// [FIX] تحسين الأداء: استخدام cache مؤقت لتجنب إعادة الحساب المتكررة
// [FIX] إضافة فحص صلاحية الوصول للمجاني

import { getStudents, getGameHistory, getStudentStats, fetchAllCachedData } from '../services/dataService.js';
import { calculateLevel, getLevelDisplay } from './studentStats.js';
import { escapeHtml } from '../utils.js';
import { getUserPlan, getPlanLimits } from '../services/subscriptionGuard.js';
import { getCurrentUserInfo } from '../firebase/auth.js';  // ✅ استيراد من المسار الصحيح


let currentTop3Html = '';
let currentRestHtml = '';

export async function getMostWinsStudent() {
    const history = await getGameHistory();
    const students = await getStudents();
    
    let winsCount = {};
    history.forEach(game => {
        if (game.winnerId) {
            winsCount[game.winnerId] = (winsCount[game.winnerId] || 0) + 1;
        }
    });
    let maxWins = 0;
    let topStudent = null;
    for (let [id, wins] of Object.entries(winsCount)) {
        if (wins > maxWins) {
            maxWins = wins;
            topStudent = students.find(s => String(s.id) === String(id));
        }
    }
    return { student: topStudent, wins: maxWins };
}

export async function getMostAccurateStudent() {
    const students = await getStudents();
    let bestAccuracy = -1;
    let topStudent = null;
    
    for (const s of students) {
        const stats = await getStudentStats(s.id);
        const total = stats.totalAnswers || 0;
        const correct = stats.correctAnswers || 0;
        if (total > 0) {
            let accuracy = (correct / total) * 100;
            if (accuracy > bestAccuracy) {
                bestAccuracy = accuracy;
                topStudent = s;
            }
        }
    }
    return { student: topStudent, accuracy: bestAccuracy };
}

export function updateHallFilter() {
    const filterSelect = document.getElementById('hall-grade-filter');
    if (filterSelect) {
        const newFilter = filterSelect.cloneNode(true);
        filterSelect.parentNode.replaceChild(newFilter, filterSelect);
        newFilter.addEventListener('change', () => renderLeaderboard());
    }
}
export async function renderLeaderboard() {
    // ✅ فحص صلاحية المجاني باستخدام getPlanLimits
    const user = await getCurrentUserInfo();
    if (user) {
        let plan = user.plan;
        if (!user.isTeacher && user.teacherPlan) {
            plan = user.teacherPlan;
        }
        const limits = getPlanLimits(plan);
        if (!limits.canAccessLeaderboard) {
            const container = document.getElementById('hall-list');
            if (container) {
                container.innerHTML = '<div class="text-center text-yellow-400 py-10">🔒 لوحة الصدارة متاحة فقط للمشتركين في الباقة الفضية أو الذهبية.</div>';
            }
            return;
        }
    }
    
    // باقي الكود الأصلي دون تغيير...
    const filter = document.getElementById('hall-grade-filter')?.value || 'all';
    const cached = await fetchAllCachedData();
    if (!cached) return;
    
    const { students, history } = cached;
    
    let filteredStudents = students.filter(s => !s.isTeacher);
    if (filter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.grade === filter);
    }
    
    let wins = {};
    history.forEach(g => {
        if (g.winnerId) {
            wins[g.winnerId] = (wins[g.winnerId] || 0) + 1;
        }
    });

    let sorted = [...filteredStudents].sort((a,b) => (b.score || 0) - (a.score || 0));
    let top3 = sorted.slice(0,3);
    let rest = sorted.slice(3);

    const getProgress = (s) => {
        const lvl = calculateLevel(s.score || 0);
        if(lvl.max === Infinity) return 100;
        return Math.min(100, ((s.score - lvl.min) / (lvl.max - lvl.min)) * 100);
    };

    let newPodiumHtml = buildPodiumHtml(top3, wins, getProgress);
    let newRestHtml = buildRestHtml(rest, wins, getProgress);

    if (newPodiumHtml !== currentTop3Html) {
        const podiumContainer = document.getElementById('hall-top-3');
        if (podiumContainer) {
            requestAnimationFrame(() => {
                podiumContainer.innerHTML = newPodiumHtml;
                currentTop3Html = newPodiumHtml;
            });
        }
    }
    if (newRestHtml !== currentRestHtml) {
        const listContainer = document.getElementById('hall-list');
        if (listContainer) {
            requestAnimationFrame(() => {
                listContainer.innerHTML = newRestHtml;
                currentRestHtml = newRestHtml;
            });
        }
    }
}
function buildPodiumHtml(top3, wins, getProgress) {
    if (!top3.length) return '<div class="text-center text-gray-400">لا توجد بيانات كافية</div>';
    
    let podium = `
    <style>
        @keyframes fadeInUp {
            from { opacity:0; transform:translateY(30px); }
            to { opacity:1; transform:translateY(0); }
        }
        @keyframes progressFill {
            from { width:0%; }
        }
        @keyframes softPulse {
            0%,100% { box-shadow:0 0 20px #facc15; }
            50% { box-shadow:0 0 40px #facc15, 0 0 60px #ffd700; }
        }
        .podium-card {
            transition: all 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);
            animation: fadeInUp 0.6s ease forwards;
        }
        .podium-card:hover {
            transform: translateY(-8px) scale(1.02) !important;
            background: rgba(255,255,255,0.12) !important;
            border-color: var(--hover-color) !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 35px var(--hover-color) !important;
        }
        .podium-card img {
            transition: transform 0.4s ease, box-shadow 0.4s ease;
        }
        .podium-card:hover img {
            transform: scale(1.08);
        }
        .first-place-img {
            animation: softPulse 2s infinite ease-in-out;
        }
        .progress-fill {
            animation: progressFill 1.5s ease-out forwards;
            width: 0%;
        }
        .rest-row {
            transition: all 0.3s ease;
            animation: fadeInUp 0.5s ease forwards;
        }
        .rest-row:hover {
            background: rgba(255,255,255,0.1) !important;
            transform: translateX(-6px);
            border-color: #facc15 !important;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }
    </style>
    <div style="display:flex; justify-content:center; align-items:flex-end; gap:22px; margin:40px 0; flex-wrap:wrap;">`;

    const config = [
        { emoji:"👑", color:"#facc15", size:180, scale:1.2, glow:"#facc15", z:3, isFirst:true },
        { emoji:"🥈", color:"#c0c0c0", size:125, scale:1, glow:"#c0c0c0", z:2 },
        { emoji:"🥉", color:"#cd7f32", size:125, scale:1, glow:"#cd7f32", z:1 }
    ];

    top3.forEach((s,i)=>{
        if(!s) return;
        const w = wins[s.id] || 0;
        const p = getProgress(s);
        const lvl = getLevelDisplay(s);
        const isFirst = i === 0;
        const delay = i * 0.15;

        let order;
        if (i === 0) order = 2;
        else if (i === 1) order = 1;
        else order = 3;

        const studentImg = s.img && s.img !== 'undefined' ? s.img : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23facc15\' stroke-width=\'1.5\'%3E%3Cpath d=\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\'%3E%3C/path%3E%3Ccircle cx=\'12\' cy=\'7\' r=\'4\'%3E%3C/circle%3E%3C/svg%3E';

        podium += `
        <div style="transform:scale(${config[i].scale}); z-index:${config[i].z}; width:260px; order: ${order}; animation-delay:${delay}s;" class="podium-card">
            <div style="background:rgba(255,255,255,0.06); backdrop-filter:blur(20px); border:2px solid ${isFirst ? config[i].color : 'rgba(255,255,255,0.1)'}; border-radius:28px; padding:22px; text-align:center; position:relative; box-shadow:0 0 35px ${config[i].color}55; transition: all 0.3s ease; --hover-color: ${config[i].color};">
                ${i === 0 
                    ? `<div style="width: 90px; height: 90px; margin: 0 auto 10px; background: radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 75%); display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                        <span style="font-size: 3.5rem; filter: drop-shadow(0 0 12px #ffd700) drop-shadow(0 0 6px #fff); animation: floatCrown 2.2s ease-in-out infinite, glowPulse 1.8s ease-in-out infinite alternate;">👑</span>
                       </div>`
                    : `<div style="font-size:2rem">${config[i].emoji}</div>
                `}
                <div style="display:flex; justify-content:center; align-items:center; margin:12px 0;">
                    <img src="${studentImg}" class="${isFirst ? 'first-place-img' : ''}" style="width:${config[i].size}px; height:${config[i].size}px; border-radius:50%; object-fit:cover; border:4px solid ${config[i].color}; box-shadow:0 0 25px ${config[i].color};">
                </div>
                <div style="font-weight:900; font-size:1.3rem; color:white;">${escapeHtml(s.name)}</div>
                <div style="font-size:1.6rem; font-weight:900; color:${config[i].color}; margin-top:6px;">⭐ ${s.score || 0}</div>
                <div style="margin-top:6px; font-size:0.85rem; color:#cbd5e1;">${lvl}</div>
                <div style="margin-top:4px; font-size:0.9rem; color:#fbbf24; font-weight:700;">🏆 ${w} فوز</div>
                <div style="margin-top:12px; height:8px; background:rgba(255,255,255,0.08); border-radius:20px; overflow:hidden;">
                    <div class="progress-fill" style="height:100%; background:linear-gradient(90deg,#facc15,#22c55e); width:${p}%; transition: width 1s ease;"></div>
                </div>
            </div>
        </div>`;
    });
    podium += "</div>";
    return podium;
}

function buildRestHtml(rest, wins, getProgress) {
    if (!rest.length) return '';
    
    let list = rest.map((s,i)=>{
        const w = wins[s.id] || 0;
        const p = getProgress(s);
        const lvl = getLevelDisplay(s);
        const delay = i * 0.08;
        const studentImg = s.img && s.img !== 'undefined' ? s.img : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239ca3af\' stroke-width=\'1.5\'%3E%3Cpath d=\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\'%3E%3C/path%3E%3Ccircle cx=\'12\' cy=\'7\' r=\'4\'%3E%3C/circle%3E%3C/svg%3E';

        return `
        <div class="rest-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px; margin-bottom:10px; border-radius:18px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); animation-delay:${delay}s;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;font-weight:900;color:#facc15;">#${i+4}</div>
                <img src="${studentImg}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #facc15;transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                <div>
                    <div style="font-weight:700;color:white;">${escapeHtml(s.name)}</div>
                    <div style="font-size:0.75rem;color:#94a3b8;">${lvl}</div>
                    <div style="width:150px;height:6px;margin-top:5px;background:rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;">
                        <div class="progress-fill" style="height:100%;background:linear-gradient(90deg,#facc15,#22c55e);width:${p}%;transition: width 1s ease;"></div>
                    </div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:900;color:white;">⭐ ${s.score || 0}</div>
                <div style="color:#fbbf24;font-size:0.85rem;font-weight:700;">🏆 ${w}</div>
            </div>
        </div>`;
    }).join('');
    return list;
}