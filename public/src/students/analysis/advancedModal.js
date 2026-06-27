// advancedModal.js - نافذة التحليل المتقدم المنبثقة
import { getStudentById, getGameHistory, getStudentStats, fetchAllCachedData } from '../../services/dataService.js';
import { getStudentRankAndTrend, calculateLevel } from '../studentStats.js';
import { escapeHtml, showFloatingNotification } from '../../utils.js';
import { canAccessAnalytics, getUserPlan } from '../../services/subscriptionGuard.js';
import { renderStudentProgressChart, generateDetailedParentAdvice } from './helpers.js';
import { printStudentReport } from './reportPrint.js';

export async function showAdvancedAnalysis(studentId, dateRange = 'all') {
    const cached = await fetchAllCachedData();
    if (!cached) return;
    const { students, history, studentStats } = cached;
    
    let student = students.find(s => String(s.id) === String(studentId));
    if (!student) {
        student = await getStudentById(studentId);
    }
    if (!student || student.isTeacher) {
        showFloatingNotification('الطالب غير موجود', 'error');
        return;
    }

    const stats = studentStats[studentId] || {};

    const isTeacher = sessionStorage.getItem('peak_teacher_logged_in') === 'true';
    if (isTeacher) {
        const teacherCode = sessionStorage.getItem('peak_teacher_code');
        if (teacherCode) {
            const canAccess = await canAccessAnalytics(teacherCode, true);
            if (!canAccess) {
                const plan = await getUserPlan(teacherCode, true);
                let msg = 'الباقة المجانية لا تسمح بالوصول إلى التحليلات المتقدمة. يرجى الترقية.';
                if (plan === 'silver') {
                    msg = 'الباقة الفضية تسمح بالتحليلات الأساسية فقط. التحليل المتعمق متاح في الباقة الذهبية.';
                }
                showFloatingNotification(msg, 'error');
                return;
            }
        }
    }

    // إغلاق أي نافذة قديمة
    if (typeof Swal !== 'undefined' && Swal.close) Swal.close();
    const oldModal = document.getElementById('student-analysis-modal');
    if (oldModal && oldModal.style.display === 'flex') oldModal.remove();

    const finalStudentId = String(studentId);
    let finalStats = stats;
    if (!finalStats || Object.keys(finalStats).length === 0) {
        finalStats = await getStudentStats(finalStudentId);
    }

    let finalHistory = history;
    if (!finalHistory || finalHistory.length === 0) {
        finalHistory = await getGameHistory();
    }

    const now = new Date();
    let startDate = null;
    if (dateRange === '7days') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === '30days') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (dateRange === '3months') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let filteredHistory = finalHistory;
    if (startDate) filteredHistory = finalHistory.filter(g => g.timestamp >= startDate.getTime());

    const totalAnswers = finalStats.totalAnswers || 0;
    const correctAnswers = finalStats.correctAnswers || 0;
    const wrongAnswers = totalAnswers - correctAnswers;
    const studentWins = filteredHistory.filter(g => String(g.winnerId) === finalStudentId).length;
    const studentGames = filteredHistory.filter(g => g.participants && g.participants.map(String).includes(finalStudentId)).length;
    const winRate = studentGames > 0 ? ((studentWins / studentGames) * 100).toFixed(1) : 0;
    const accuracy = totalAnswers ? ((correctAnswers / totalAnswers) * 100).toFixed(1) : 0;
    const speedAvg = finalStats.speedAvg || 0;
    const withdrawCount = finalStats.withdrawCount || 0;

    const levelObj = calculateLevel(student.score);
    const levelName = levelObj.name;
    const levelIcon = levelObj.icon;

    let categoriesData = [], strengths = [], weaknesses = [];
    for (let cat in (finalStats.categoryStats || {})) {
        let cTotal = finalStats.categoryStats[cat];
        let cCorrect = finalStats.correctByCategory?.[cat] || 0;
        let percent = (cCorrect / cTotal) * 100;
        categoriesData.push({ name: cat, total: cTotal, correct: cCorrect, percent });
        if (percent >= 70) strengths.push(cat);
        else if (percent < 40) weaknesses.push(cat);
    }
    categoriesData.sort((a, b) => b.percent - a.percent);

    const rankTrend = await getStudentRankAndTrend(finalStudentId, student.grade, student.score, filteredHistory, dateRange);
    const chartHtml = renderStudentProgressChart(finalStudentId, student.name, filteredHistory);

    const adviceData = {
        studentName: student.name,
        dateRangeLabel: dateRange === '7days' ? 'آخر 7 أيام' : (dateRange === '30days' ? 'آخر 30 يوماً' : (dateRange === '3months' ? 'آخر 3 أشهر' : 'كل الوقت')),
        accuracy: parseFloat(accuracy),
        speedAvg: speedAvg,
        withdrawCount: withdrawCount,
        weakCategories: weaknesses,
        strongCategories: strengths,
        levelName: levelName,
        winRate: parseFloat(winRate),
        studentGames: studentGames,
        score: student.score,
        totalAnswers: totalAnswers,
        correctAnswers: correctAnswers,
        categoryStats: finalStats.categoryStats || {}
    };
    const parentAdvice = generateDetailedParentAdvice(adviceData);

    // أنماط CSS ونافذة SweetAlert بنفس محتوى الملف الأصلي (سيتم تضمينها كاملة)
    const styles = `...`; // ضع نفس الـ styles من الملف الأصلي
    const modalHtml = `...`; // ضع نفس الـ HTML من الملف الأصلي

    await Swal.fire({
        html: modalHtml,
        showConfirmButton: false,
        background: '#090d16',
        backdrop: 'rgba(2, 4, 8, 0.9)',
        width: '95vw',
        maxWidth: '1100px',
        padding: '1.2rem',
        showCloseButton: true,
        closeButtonHtml: '<span style="color:#64748b; font-size:1.5rem;">&times;</span>',
        customClass: { popup: 'rounded-3xl border border-white/10 overflow-hidden' }
    });

    // ربط الأحداث
    document.querySelectorAll('.premium-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const range = e.currentTarget.dataset.range;
            Swal.close();
            showAdvancedAnalysis(finalStudentId, range);
        });
    });

    const printBtn = document.getElementById('printReportBtnFromModal');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            printStudentReport(finalStudentId, dateRange);
        });
    }

    setTimeout(() => {
        const canvas = document.querySelector('#progressChartContainer canvas');
        if (canvas && canvas.id && typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');
            const labels = window._tempChartLabels || [];
            const data = window._tempChartData || [];
            if (labels.length && data.length) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'النقاط بعد المباراة',
                            data: data,
                            borderColor: '#facc15',
                            backgroundColor: 'rgba(250,204,21,0.04)',
                            borderWidth: 2,
                            pointBackgroundColor: '#facc15',
                            pointRadius: 3,
                            fill: true,
                            tension: 0.25
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }
                        }
                    }
                });
            }
        }
    }, 200);
}