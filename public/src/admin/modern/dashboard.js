// src/admin/modern/dashboard.js
// لوحة المعلومات – الإحصائيات والرسوم البيانية

import { db, collection, getDocs, query, where } from '../../firebase/init.js';
import { getTeachersList } from '../../firebase/auth.js';
import { loadQuestionsFromIndexedDB } from '../../db/indexeddb.js';
import { getAllStudents, animateNumber, showNotification } from './utils.js';

let growthChart = null, planChart = null;

export async function renderDashboard() {
    const teachers = await getTeachersList();
    const students = await getAllStudents();
    const gameHistoryCollection = collection(db, 'gameHistory');
    const gamesSnap = await getDocs(gameHistoryCollection);
    const games = gamesSnap.docs.map(d => d.data());
    const messagesCollection = collection(db, 'messages');
    const messagesSnap = await getDocs(query(messagesCollection, where('to', '==', 'admin')));
    const messages = messagesSnap.docs.map(d => d.data());
    const unreadMessages = messages.filter(m => !m.read).length;
    let totalQuestions = 0;
    const gradesSet = new Set(students.map(s => s.grade));
    for (const grade of gradesSet) {
        const qs = await loadQuestionsFromIndexedDB(grade);
        totalQuestions += qs.length;
    }
    const now = Date.now();
    const teachersWithExpiry = teachers.filter(t => t.expiryDate);
    const expiredCount = teachersWithExpiry.filter(t => new Date(t.expiryDate).getTime() < now).length;
    const nearExpiryCount = teachersWithExpiry.filter(t => {
        const diff = new Date(t.expiryDate).getTime() - now;
        return diff > 0 && diff < 7 * 86400000;
    }).length;
    const recentTeachers = teachers.filter(t => t.createdAt && (now - t.createdAt) < 30 * 86400000).length;
    const planDistribution = {
        free: teachers.filter(t => t.plan === 'free').length,
        silver: teachers.filter(t => t.plan === 'silver').length,
        gold: teachers.filter(t => t.plan === 'gold').length
    };
    const container = document.getElementById('dashboardPane');
    container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div class="glass-card kpi-card p-4 text-center" data-type="teachers"><div class="shimmer"></div><i class="fas fa-chalkboard-user text-3xl text-yellow-400 mb-1"></i><div class="stat-number text-2xl font-black text-yellow-400" id="countTeachers">0</div><div class="text-sm">المعلمين</div><div class="text-xs text-gray-400">جديد: ${recentTeachers}</div></div>
            <div class="glass-card kpi-card p-4 text-center" data-type="students"><div class="shimmer"></div><i class="fas fa-users text-3xl text-yellow-400 mb-1"></i><div class="stat-number text-2xl font-black text-yellow-400" id="countStudents">0</div><div class="text-sm">الطلاب</div></div>
            <div class="glass-card kpi-card p-4 text-center" data-type="questions"><div class="shimmer"></div><i class="fas fa-database text-3xl text-yellow-400 mb-1"></i><div class="stat-number text-2xl font-black text-yellow-400" id="countQuestions">0</div><div class="text-sm">الأسئلة</div></div>
            <div class="glass-card kpi-card p-4 text-center" data-type="expired"><div class="shimmer"></div><i class="fas fa-hourglass-half text-3xl text-red-400 mb-1"></i><div class="stat-number text-2xl font-black text-red-400" id="expiredCount">${expiredCount}</div><div class="text-sm">اشتراكات منتهية</div></div>
            <div class="glass-card kpi-card p-4 text-center" data-type="nearExpiry"><div class="shimmer"></div><i class="fas fa-clock text-3xl text-orange-400 mb-1"></i><div class="stat-number text-2xl font-black text-orange-400" id="nearExpiryCount">${nearExpiryCount}</div><div class="text-sm">قاربت على الانتهاء</div></div>
            <div class="glass-card kpi-card p-4 text-center" data-type="unreadMessages"><div class="shimmer"></div><i class="fas fa-envelope text-3xl text-blue-400 mb-1"></i><div class="stat-number text-2xl font-black text-blue-400">${unreadMessages}</div><div class="text-sm">رسائل غير مقروءة</div></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="glass-card p-5"><h3 class="text-xl font-bold text-yellow-400 mb-4"><i class="fas fa-chart-line"></i> نمو المنصة (شهرياً)</h3><canvas id="growthChartCanvas" height="200"></canvas></div>
            <div class="glass-card p-5"><h3 class="text-xl font-bold text-yellow-400 mb-4"><i class="fas fa-chart-pie"></i> توزيع خطط المعلمين</h3><canvas id="planChartCanvas" height="200"></canvas></div>
        </div>
    `;
    animateNumber('countTeachers', teachers.length);
    animateNumber('countStudents', students.length);
    animateNumber('countQuestions', totalQuestions);
    document.getElementById('expiredCount').innerText = expiredCount;
    document.getElementById('nearExpiryCount').innerText = nearExpiryCount;

    if (growthChart) growthChart.destroy();
    const ctxGrowth = document.getElementById('growthChartCanvas').getContext('2d');
    Chart.defaults.font.family = 'Cairo';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#8da4c8';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(8,10,22,0.97)';
    Chart.defaults.plugins.tooltip.titleFont = { family: 'Cairo', weight: 700, size: 13 };
    Chart.defaults.plugins.tooltip.bodyFont = { family: 'Cairo', size: 12 };
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(139,92,246,0.45)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.caretPadding = 10;
    Chart.defaults.plugins.tooltip.displayColors = false;
    Chart.defaults.plugins.tooltip.cornerRadius = 16;
    Chart.defaults.plugins.tooltip.titleColor = '#a78bfa';
    Chart.defaults.plugins.tooltip.bodyColor = '#c8d8f0';

    const growthGradient = ctxGrowth.createLinearGradient(0, 0, 0, 240);
    growthGradient.addColorStop(0, 'rgba(139,92,246,0.45)');
    growthGradient.addColorStop(0.5, 'rgba(6,182,212,0.18)');
    growthGradient.addColorStop(1, 'rgba(6,182,212,0.01)');

    growthChart = new Chart(ctxGrowth, {
        type: 'line',
        data: {
            labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
            datasets: [{
                label: 'المستخدمين النشطين', data: [12, 19, 15, 27, 32, 45, 58, 72, 85, 98, 112, 128],
                borderColor: '#a78bfa', backgroundColor: growthGradient, fill: true, tension: 0.45,
                cubicInterpolationMode: 'monotone', pointBackgroundColor: '#22d3ee', pointBorderColor: '#a78bfa',
                pointRadius: 5, pointHoverRadius: 8, pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { labels: { color: '#a78bfa', font: { family: 'Cairo', weight: '700' } } } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#6b7fa3', font: { family: 'Cairo' } } },
                y: { grid: { color: 'rgba(139,92,246,0.05)', drawBorder: false }, ticks: { color: '#6b7fa3', font: { family: 'Cairo' } } }
            }
        }
    });

    if (planChart) planChart.destroy();
    const ctxPlan = document.getElementById('planChartCanvas').getContext('2d');
    const planGradientGold = ctxPlan.createLinearGradient(0, 0, 400, 0);
    planGradientGold.addColorStop(0, '#facc15');
    planGradientGold.addColorStop(1, '#f59e0b');

    planChart = new Chart(ctxPlan, {
        type: 'bar',
        data: {
            labels: ['مجاني', 'فضي', 'ذهبي'],
            datasets: [{
                label: 'عدد المعلمين',
                data: [planDistribution.free, planDistribution.silver, planDistribution.gold],
                backgroundColor: ['#ef4444', '#9ca3af', planGradientGold],
                borderRadius: 8, barThickness: 18
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(10,14,24,0.9)', borderColor: 'rgba(139,92,246,0.12)', borderWidth: 1 } },
            scales: { x: { grid: { display: false }, ticks: { color: '#9aa4bb' } }, y: { grid: { display: false }, ticks: { color: '#fff' } } }
        }
    });

    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            if (type === 'teachers') Swal.fire({ title: 'تفاصيل المعلمين', html: `<p>إجمالي المعلمين: ${teachers.length}</p><p>نشط: ${teachers.filter(t => t.status === 'active').length}</p><p>معلق: ${teachers.filter(t => t.status === 'suspended').length}</p>`, background: '#0f172a', color: '#fff' });
            else if (type === 'students') Swal.fire({ title: 'تفاصيل الطلاب', html: `<p>إجمالي الطلاب: ${students.length}</p><p>موزعون على ${teachers.length} معلم</p>`, background: '#0f172a', color: '#fff' });
            else if (type === 'expired') {
                const expiredTeachers = teachers.filter(t => t.expiryDate && new Date(t.expiryDate).getTime() < now);
                Swal.fire({ title: 'المعلمون المنتهية اشتراكاتهم', html: `<div style="max-height:300px; overflow-y:auto;">${expiredTeachers.map(t => `<p>${t.name} (${t.id}) - ${new Date(t.expiryDate).toLocaleDateString()}</p>`).join('') || 'لا يوجد'}</div>`, background: '#0f172a' });
            } else if (type === 'nearExpiry') {
                const near = teachers.filter(t => t.expiryDate && (new Date(t.expiryDate).getTime() - now) > 0 && (new Date(t.expiryDate).getTime() - now) < 7 * 86400000);
                Swal.fire({ title: 'المعلمون القاربة اشتراكاتهم على الانتهاء', html: `<div style="max-height:300px; overflow-y:auto;">${near.map(t => `<p>${t.name} (${t.id}) - ينتهي في ${new Date(t.expiryDate).toLocaleDateString()}</p>`).join('') || 'لا يوجد'}</div>`, background: '#0f172a' });
            } else if (type === 'unreadMessages') switchTab('messages');
        });
    });
    showNotification('تم تحديث لوحة المعلومات بنجاح', 'success');
}