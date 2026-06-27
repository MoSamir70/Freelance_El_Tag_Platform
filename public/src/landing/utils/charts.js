// src/landing/utils/charts.js

export function initProgressChart(ctx, labels, data, topData) {
    if (!ctx) return null;
    const gradient1 = ctx.createLinearGradient(0, 0, 0, 250);
    gradient1.addColorStop(0, 'rgba(139,92,246,0.5)');
    gradient1.addColorStop(1, 'rgba(6,182,212,0.05)');
    
    return new Chart(ctx, {
        type: 'line',
        data: { 
            labels: labels,
            datasets: [
                { label: 'متوسط التقدم', data: data, borderColor: '#8B5CF6', backgroundColor: gradient1, tension: 0.5, fill: true, borderWidth: 3, pointBackgroundColor: '#F59E0B', pointBorderColor: '#fff', pointRadius: 6, pointHoverRadius: 8 },
                { label: 'أفضل طالب', data: topData, borderColor: '#F59E0B', backgroundColor: 'transparent', tension: 0.5, fill: false, borderWidth: 2, borderDash: [6,4], pointBackgroundColor: '#06B6D4', pointRadius: 5, pointHoverRadius: 7 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: true, 
            animation: { duration: 1200, easing: 'easeOutQuart' }, 
            plugins: { 
                legend: { labels: { color: '#e5e7eb', font: { size: 11 } } }, 
                tooltip: { backgroundColor: '#1a1a2a', titleColor: '#facc15', bodyColor: '#fff' } 
            }, 
            scales: { 
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' } }, 
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' }, min: 0, max: 100 } 
            } 
        }
    });
}

export function initAnswersChart(ctx) {
    if (!ctx) return null;
    return new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels: ['✅ إجابات صحيحة 72%', '❌ إجابات خاطئة 28%'], 
            datasets: [{ 
                data: [72, 28], 
                backgroundColor: ['rgba(16,185,129,0.85)', 'rgba(239,68,68,0.6)'], 
                borderColor: ['#10B981', '#EF4444'], 
                borderWidth: 2, 
                hoverOffset: 20 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: true, 
            cutout: '65%', 
            animation: { duration: 1500, easing: 'easeOutElastic', animateRotate: true }, 
            plugins: { 
                legend: { labels: { color: '#e5e7eb' }, position: 'bottom' }, 
                tooltip: { backgroundColor: '#1a1a2a' } 
            } 
        }
    });
}