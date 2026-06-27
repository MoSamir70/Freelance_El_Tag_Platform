// src/landing/sections/analytics.js
import { initProgressChart, initAnswersChart } from '../utils/charts.js';
import { observeCounters } from '../utils/counters.js';

let progressChart = null;
let answersChart = null;

// قاعدة بيانات التقرير السري
const secretReportDb = {
    student: {
        title: "التقرير السلوكي للطالب",
        desc: "يقوم برصد ومراقبة الرحلة التعليمية لكل طالب على حدة، ليقوم بتحويل أرقام الأداء إلى لغة مفهومة وواضحة لولي الأمر، مما يبني جسر ثقة متين بين البيت والمعلم.",
        daily: {
            sub: "تقرير الطالب السلوكي • النطاق: يومي",
            labels: ['الفهم السريع', 'الدقة الحركية', 'التركيز الذهني', 'الثبات النفسي', 'سرعة البديهة'],
            dataset: [90, 85, 75, 88, 95],
            label: 'بصمة الطالب المهارية الفردية',
            color: '#a855f7',
            strengths: "سرعة بديهة فائقة في غرف التحدي الحالية، واستجابة فورية خارقة عند المفاجأة بأسئلة قياس الذكاء السريعة.",
            remedy: "يُفضل توجيه الطالب لمراجعة الفيديوهات القصيرة قبل النوم لزيادة معدل التركيز الثابت وتثبيت المعلومة."
        },
        weekly: {
            sub: "تقرير الطالب السلوكي • النطاق: أسبوعي تراكمي",
            labels: ['الالتزام بالواجبات', 'متوسط الدقة', 'التنافس الجماعي', 'تطوير الأداء', 'الاستمرارية'],
            dataset: [80, 88, 92, 84, 79],
            label: 'بصمة الطالب التراكمية الأسبوعية',
            color: '#ec4899',
            strengths: "ثبات تصاعدي في الترتيب العام بلوحة الشرف طوال الأسبوع، مع التزام تام بحل كافة الامتحانات التكيفية المرسلة منزلياً.",
            remedy: "يحتاج الطالب لتكثيف المشاركة الفردية في الأنماط المباشرة للتغلب على تردد الثواني الأولى في صياغة الإجابة."
        },
        monthly: {
            sub: "تقرير الطالب السلوكي • النطاق: حصاد الشهر النهائي",
            labels: ['معدل الاكتساح', 'الثبات الأكاديمي', 'سرعة التفكير', 'التفاعل الشامل', 'المرونة التقنية'],
            dataset: [85, 90, 88, 93, 87],
            label: 'الحصاد المهارى الشهري الشامل للولي الأمر',
            color: '#eab308',
            strengths: "تحقيق شارة (الملك الصامد) الملحمية لهذا الشهر، مع تفوق ساحق على 88% من أقرانه داخل فصول ومجموعات السنتر.",
            remedy: "الحفاظ على هذا الريتم الممتاز عبر منحه اختبارات تحدي خاصة ومتقدمة (مستوى المتفوقين الخفي) للحفاظ على شغفه."
        }
    },
    class: {
        title: "المنظومة التحليلية للصف",
        desc: "تمنح المعلم عيناً ثالثة لرؤية المشهد بالكامل؛ حيث تجمع لقطات إحصائية شاملة ومكثفة توضح مستوى الفصول ككتلة واحدة، وتحدد لك بدقة أين تقع الثغرة الجماعية لتعالجها فوراً.",
        daily: {
            sub: "المنظومة التحليلية للصف • النطاق: يومي",
            labels: ['تفاعل المجموعة', 'متوسط سرعة الفصل', 'نسبة الفهم الجماعي', 'الالتزام بالحضور', 'مؤشر الحماس واللعب'],
            dataset: [75, 65, 80, 95, 88],
            label: 'النبض الإحصائي اليومي للمجموعة',
            color: '#06b6d4',
            strengths: "نسبة حضور قياسية والتزام فوري بكود الدخول لغرف المنافسة؛ الروح الحماسية للمجموعة متقدة للغاية اليوم.",
            remedy: "رصد نظام الذكاء الاصطناعي ضعفاً جماعياً نسبياً في سرعة حل الأسئلة الطويلة؛ ينصح بتقصير نصوص الأسئلة في التحدي القادم."
        },
        weekly: {
            sub: "المنظومة التحليلية للصف • النطاق: أسبوعي شامل",
            labels: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
            dataset: [65, 74, 90, 85, 92],
            label: 'منحنى تقدم الفصول الأسبوعي',
            color: '#10b981',
            strengths: "الفصل نجح ككتلة واحدة في علاج ثغرة (قواعد البلاغة) المكتشفة الأسبوع الماضي، وارتفعت نسبة دقة الإجابات فيها بنسبة 25%.",
            remedy: "يُفضل تخصيص أول 5 دقائق من الحصة القادمة لتكريم المجموعة الفرعية المتصدرة لبث روح الغيرة الأكاديمية التنافسية."
        },
        monthly: {
            sub: "المنظومة التحليلية للصف • النطاق: الحصاد الشهري للمدرسة",
            labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'],
            dataset: [55, 72, 85, 96],
            label: 'معدل الاكتساح ونمو الفصول الإجمالي',
            color: '#3b82f6',
            strengths: "المنصة نجحت هذا الشهر في توفير ما يقارب 40 ساعة تصحيح يدوي مجهد على المعلم، مع قفزة 35% في متوسط درجات الطلاب الضعاف.",
            remedy: "استقرار تام للمنظومة؛ يُنصح بالبدء في فتح غرف تحدي ومسابقات مشتركة ومباشرة بين المحافظات والمجموعات المختلفة للاكتساح التام."
        }
    }
};

let reportMode = 'student';
let reportTime = 'daily';
let reportChart = null;

function renderActiveReport() {
    const modeData = secretReportDb[reportMode];
    const activeData = modeData[reportTime];
    
    const sidebarTitle = document.getElementById('sidebar-title');
    const sidebarDesc = document.getElementById('sidebar-desc');
    const reportSubTitle = document.getElementById('report-sub-title');
    const descStrengths = document.getElementById('desc-strengths');
    const descRemedy = document.getElementById('desc-remedy');
    
    if (sidebarTitle) sidebarTitle.innerText = modeData.title;
    if (sidebarDesc) sidebarDesc.innerText = modeData.desc;
    if (reportSubTitle) reportSubTitle.innerHTML = `التصنيف النشط: <span class="text-cyan-400 font-bold">${activeData.sub}</span>`;
    if (descStrengths) descStrengths.innerText = activeData.strengths;
    if (descRemedy) descRemedy.innerText = activeData.remedy;
    
    initOrUpdateChart(reportMode, activeData.labels, activeData.dataset, activeData.label, activeData.color);
}

function initOrUpdateChart(type, labels, data, labelName, color) {
    const canvas = document.getElementById('tajSecretReportChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (reportChart) reportChart.destroy();
    
    let chartConfig;
    if (type === 'student') {
        chartConfig = {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: labelName,
                    data: data,
                    backgroundColor: color + '22',
                    borderColor: color,
                    borderWidth: 2,
                    pointBackgroundColor: color,
                    pointBorderColor: '#ffffff',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#e5e7eb', font: { family: 'Cairo', weight: 'bold', size: 12 } } },
                    tooltip: { backgroundColor: '#171717', titleFont: { family: 'Cairo' }, bodyFont: { family: 'Cairo' } }
                },
                scales: {
                    r: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#9ca3af', font: { family: 'Cairo', size: 11, weight: 'bold' } },
                        ticks: { display: false },
                        min: 0,
                        max: 100
                    }
                }
            }
        };
    } else {
        const gradientFill = ctx.createLinearGradient(0, 0, 0, 250);
        gradientFill.addColorStop(0, color + '55');
        gradientFill.addColorStop(1, color + '00');
        chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: labelName,
                    data: data,
                    backgroundColor: gradientFill,
                    borderColor: color,
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: color,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#e5e7eb', font: { family: 'Cairo', weight: 'bold', size: 12 } } },
                    tooltip: { backgroundColor: '#171717', titleFont: { family: 'Cairo' }, bodyFont: { family: 'Cairo' } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { family: 'Cairo', size: 11 } } },
                    y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { family: 'Cairo', size: 11 } } }
                }
            }
        };
    }
    reportChart = new Chart(ctx, chartConfig);
}

// جعل الدوال عامة للاستخدام في onclick المباشر في HTML
window.changeReportMode = function(mode) {
    reportMode = mode;
    const btnStudent = document.getElementById('mode-student');
    const btnClass = document.getElementById('mode-class');
    if (mode === 'student') {
        if (btnStudent) btnStudent.className = "flex-1 sm:flex-none px-6 py-3 font-black text-xs md:text-sm rounded-xl transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg";
        if (btnClass) btnClass.className = "flex-1 sm:flex-none px-6 py-3 font-black text-xs md:text-sm rounded-xl transition-all duration-300 text-gray-400 hover:text-white";
    } else {
        if (btnClass) btnClass.className = "flex-1 sm:flex-none px-6 py-3 font-black text-xs md:text-sm rounded-xl transition-all duration-300 bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg";
        if (btnStudent) btnStudent.className = "flex-1 sm:flex-none px-6 py-3 font-black text-xs md:text-sm rounded-xl transition-all duration-300 text-gray-400 hover:text-white";
    }
    renderActiveReport();
};

window.changeReportTime = function(time) {
    reportTime = time;
    const times = ['daily', 'weekly', 'monthly'];
    times.forEach(t => {
        const btn = document.getElementById(`time-${t}`);
        if (t === time) {
            if (btn) btn.className = "px-4 py-2 text-xs font-black rounded-lg bg-yellow-500 text-black transition-all shadow-md";
        } else {
            if (btn) btn.className = "px-4 py-2 text-xs font-black rounded-lg text-gray-400 hover:text-white transition-all";
        }
    });
    renderActiveReport();
};

window.highlightChartMetric = function(index) {
    if (!reportChart) return;
    reportChart.setActiveElements([{ datasetIndex: 0, index: index }]);
    if (reportChart.tooltip) reportChart.tooltip.setActiveElements([{ datasetIndex: 0, index: index }]);
    reportChart.update();
};

export function initAnalytics() {
    // الرسوم البيانية الرئيسية
    const weeklyLabels = ['أسبوع 1', 'أسبوع 2', 'أسبوع 3', 'أسبوع 4', 'أسبوع 5', 'أسبوع 6'];
    const weeklyData = [35, 52, 61, 72, 80, 91];
    const weeklyTopData = [50, 68, 80, 87, 93, 98];
    
    const monthlyLabels = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];
    const monthlyData = [45, 58, 67, 78, 84, 91];
    const monthlyTopData = [55, 72, 83, 89, 94, 98];
    
    let currentDataset = 'weekly';
    const ctx1 = document.getElementById('progressChart')?.getContext('2d');
    const ctx2 = document.getElementById('answersChart')?.getContext('2d');
    
    if (ctx1) {
        progressChart = initProgressChart(ctx1, weeklyLabels, weeklyData, weeklyTopData);
    }
    if (ctx2) {
        answersChart = initAnswersChart(ctx2);
    }
    
    const weeklyBtn = document.getElementById('weeklyBtn');
    const monthlyBtn = document.getElementById('monthlyBtn');
    
    if (weeklyBtn && monthlyBtn && ctx1) {
        weeklyBtn.addEventListener('click', () => {
            if (currentDataset === 'weekly') return;
            currentDataset = 'weekly';
            weeklyBtn.className = 'px-3 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300 font-bold';
            monthlyBtn.className = 'px-3 py-1 text-xs rounded-full bg-white/5 text-gray-400 hover:text-white transition';
            if (progressChart) progressChart.destroy();
            progressChart = initProgressChart(ctx1, weeklyLabels, weeklyData, weeklyTopData);
        });
        monthlyBtn.addEventListener('click', () => {
            if (currentDataset === 'monthly') return;
            currentDataset = 'monthly';
            monthlyBtn.className = 'px-3 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300 font-bold';
            weeklyBtn.className = 'px-3 py-1 text-xs rounded-full bg-white/5 text-gray-400 hover:text-white transition';
            if (progressChart) progressChart.destroy();
            progressChart = initProgressChart(ctx1, monthlyLabels, monthlyData, monthlyTopData);
        });
    }
    
    observeCounters();
    
    // تهيئة التقرير السري
    setTimeout(() => {
        renderActiveReport();
    }, 400);
}