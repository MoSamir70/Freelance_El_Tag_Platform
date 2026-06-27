// src/landing/globals.js
// هذا الملف مسؤول عن تعريف جميع الدوال العامة التي تستخدم في onclick في HTML

// 1. switchPremiumTab
window.switchPremiumTab = function(key) {
    document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => btn.classList.remove('premium-tab-active'));
    const activeBtn = document.getElementById(`tab-btn-${key}`);
    if (activeBtn) activeBtn.classList.add('premium-tab-active');
    
    document.querySelectorAll('.premium-pane').forEach(pane => {
        pane.classList.add('hidden');
        pane.style.opacity = '0';
        pane.style.transform = 'translateY(12px)';
    });
    
    const activePane = document.getElementById(`premium-pane-${key}`);
    if (activePane) {
        activePane.classList.remove('hidden');
        setTimeout(() => {
            activePane.style.opacity = '1';
            activePane.style.transform = 'translateY(0)';
        }, 40);
    }
};

// 2. selectMcqBloom (نسخة مختصرة لكن كاملة)
const mcqBloomDb = {
    evaluate: {
        cardId: "mcq-card-evaluate",
        subject: "الدراسات الاجتماعية",
        subjectStyle: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
        level: "مستوى التقييم والنقد",
        question: "« ما هو السبب الرئيسي والأعمق تاريخياً وراء تفكك وضَعْف الخلافة العباسية؟ »",
        optA: "ازدهار حركة الترجمة والعلوم.",
        optB: "اعتماد نفوذ القادة غير العرب.",
        optC: "نقل مركز العاصمة إلى بغداد.",
        optD: "تلاشي وانخفاض الفتن الداخلية.",
        desc: "الخيارات حماسية وقصيرة وتناسب وتيرة ألعاب الذكاء، لكنها مهندسة بدقة لتقيس مهارة الطالب في نقد الأسباب وموازنتها بدقة بدلاً من الحفظ البصري للتواريخ الجافة.",
        ratioText: "15% من أسئلة المسابقة",
        ratioWidth: "15%",
        colorClass: "from-orange-500 to-amber-500",
        borderGlow: "border-orange-500/30 bg-orange-950/10",
        screenBorder: "border-orange-500/30 shadow-[0_0_40px_rgba(249,115,22,0.15)]"
    },
    analyze: {
        cardId: "mcq-card-analyze",
        subject: "مادة العلوم العامة",
        subjectStyle: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
        level: "مستوى التحليل والربط",
        question: "« ماذا يحدث مباشرة للنباتات عند إدخال كائن مستهلك أول جائع وجديد للبيئة؟ »",
        optA: "تزداد معدلات البناء الضوئي.",
        optB: "تتناقص أعداد الغطاء النباتي.",
        optC: "تتحول النباتات لكائنات محللة.",
        optD: "تتضاعف كمية الأكسجين بالهواء.",
        desc: "سؤال قصير وسريع! يقيس قدرة الطالب على تفكيك عناصر السلسلة الغذائية واستنتاج العلاقة الحاكمة بين المتغير الجديد والمنتجات الطبيعية دون تعقيد.",
        ratioText: "20% من أسئلة المسابقة",
        ratioWidth: "20%",
        colorClass: "from-yellow-500 to-yellow-400",
        borderGlow: "border-yellow-500/30 bg-yellow-950/10",
        screenBorder: "border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.15)]"
    },
    apply: {
        cardId: "mcq-card-apply",
        subject: "قواعد النحو العربي",
        subjectStyle: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        level: "مستوى التطبيق الإجرائي",
        question: "« (إنَّ في طَلَبِ العِلْمِ لَمَشَقَّةً)؛ ما إعراب كلمة (لَمَشَقَّةً) في الجملة؟ »",
        optA: "اسم مجرور وعلامة جره الكسرة.",
        optB: "اسم إنَّ مؤخر منصوب بالفتحة.",
        optC: "خبر إنَّ مقدم مرفوع بالضمة.",
        optD: "مبتدأ مؤخر مرفوع بالضمة.",
        desc: "تحدي خاطف وممتع في النحو! يطبق الطالب قاعدة (إنَّ واللام المزحلقة) على سياق جملة قصيرة جديدة، مما يبرز مهارته التنفيذية الفورية في ثوانٍ معدودة.",
        ratioText: "25% من أسئلة المسابقة",
        ratioWidth: "25%",
        colorClass: "from-emerald-500 to-teal-500",
        borderGlow: "border-emerald-500/30 bg-emerald-950/10",
        screenBorder: "border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
    },
    understand: {
        cardId: "mcq-card-understand",
        subject: "قواعد النحو العربي",
        subjectStyle: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
        level: "مستوى الفهم والاستيعاب",
        question: "« حدد الجملة الصحيحة التي عملت فيها (لا النافية للجنس) عمل (إنَّ) تماماً: »",
        optA: "لا في المدرسةِ طلابٌ مقصرون.",
        optB: "لا بائعَ وطنٍ محترمٌ بيننا.",
        optC: "حضر الطلابُ للمسابقة بلا شكٍّ.",
        optD: "إن الطالبَ الذكيَّ لا يهملُ واجبَهُ.",
        desc: "بدلاً من سؤال الطالب عن الشروط نظرياً، يختبر النظام استيعابه الحقيقي عبر تمييز الجمل المستوفية للأركان لضمان رسوخ الفكرة في عقله وتطبيقها بحماس.",
        ratioText: "30% من أسئلة المسابقة",
        ratioWidth: "30%",
        colorClass: "from-cyan-500 to-blue-500",
        borderGlow: "border-cyan-500/30 bg-cyan-950/10",
        screenBorder: "border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)]"
    },
    remember: {
        cardId: "mcq-card-remember",
        subject: "الدراسات التاريخية",
        subjectStyle: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
        level: "مستوى التذكر السريع",
        question: "« في أي عام ميلادي وقعت معركة حطين الشهيرة؟ »",
        optA: "عام 1260 ميلادية.",
        optB: "عام 1187 ميلادية.",
        optC: "عام 1099 ميلادية.",
        optD: "عام 1218 ميلادية.",
        desc: "مستوى الاستدعاء الخاطف والتلقائي للمعلومات والتواريخ الثابتة، وهو النمط الأفضل لبدء تسخين رتم اللعبة السريع وبناء ثقة الطالب في الخطوات الأولى للعبة.",
        ratioText: "10% من أسئلة المسابقة",
        ratioWidth: "10%",
        colorClass: "from-purple-500 to-indigo-500",
        borderGlow: "border-purple-500/30 bg-purple-950/10",
        screenBorder: "border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.15)]"
    }
};

window.selectMcqBloom = function(key) {
    const data = mcqBloomDb[key];
    if (!data) return;
    
    document.querySelectorAll('.mcq-bloom-card').forEach(card => {
        card.className = "mcq-bloom-card p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all duration-300 flex items-center justify-between group relative overflow-hidden";
    });
    const activeCard = document.getElementById(data.cardId);
    if (activeCard) {
        activeCard.className = `mcq-bloom-card p-5 rounded-2xl border ${data.borderGlow} cursor-pointer transition-all duration-300 flex items-center justify-between group relative overflow-hidden shadow-lg shadow-black/50`;
    }
    const screenPanel = document.getElementById('game-screen-panel');
    if (screenPanel) {
        screenPanel.className = `lg:col-span-7 p-6 rounded-3xl border bg-gradient-to-br from-slate-950 via-blue-950/90 to-neutral-950 flex flex-col justify-between relative overflow-hidden transition-all duration-500 ${data.screenBorder}`;
    }
    
    const options = ['opt-a', 'opt-b', 'opt-c', 'opt-d'];
    options.forEach(optId => {
        const el = document.getElementById(optId);
        if (!el) return;
        const badge = el.querySelector('span:first-child');
        if (optId === 'opt-b') {
            let glow = "border-orange-500/30 bg-orange-500/5 text-white shadow-[0_0_12px_rgba(249,115,22,0.1)]";
            let badgeColor = "w-6 h-6 rounded-md bg-orange-500/20 flex items-center justify-center text-xs font-black text-orange-400";
            if (key === 'analyze') { glow = "border-yellow-500/30 bg-yellow-500/5 text-white shadow-[0_0_12px_rgba(234,179,8,0.1)]"; badgeColor = "w-6 h-6 rounded-md bg-yellow-500/20 flex items-center justify-center text-xs font-black text-yellow-400"; }
            if (key === 'apply') { glow = "border-emerald-500/30 bg-emerald-500/5 text-white shadow-[0_0_12px_rgba(16,185,129,0.1)]"; badgeColor = "w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center text-xs font-black text-emerald-400"; }
            if (key === 'understand') { glow = "border-cyan-500/30 bg-cyan-500/5 text-white shadow-[0_0_12px_rgba(6,182,212,0.1)]"; badgeColor = "w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center text-xs font-black text-cyan-400"; }
            if (key === 'remember') { glow = "border-purple-500/30 bg-purple-500/5 text-white shadow-[0_0_12px_rgba(168,85,247,0.1)]"; badgeColor = "w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center text-xs font-black text-purple-400"; }
            el.className = `p-3 rounded-xl border ${glow} text-sm md:text-base font-bold transition-all duration-300 flex items-center gap-3`;
            if (badge) badge.className = badgeColor;
        } else {
            el.className = "p-3 rounded-xl border border-white/5 bg-white/[0.02] text-sm md:text-base font-bold text-neutral-400 transition-all duration-300 flex items-center gap-3";
            if (badge) badge.className = "w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-xs font-black text-neutral-500";
        }
    });
    
    const textNodes = ['badge-subject', 'badge-level', 'mcq-question-display', 'text-opt-a', 'text-opt-b', 'text-opt-c', 'text-opt-d', 'mcq-desc-display', 'mcq-ratio-text'];
    textNodes.forEach(id => { const el = document.getElementById(id); if (el) el.style.opacity = '0.2'; });
    
    setTimeout(() => {
        const bSub = document.getElementById('badge-subject');
        if (bSub) { bSub.innerText = data.subject; bSub.className = `text-xs font-black px-3 py-1 rounded-md ${data.subjectStyle} transition-all duration-300`; }
        const bLevel = document.getElementById('badge-level'); if (bLevel) bLevel.innerText = data.level;
        const qDisplay = document.getElementById('mcq-question-display'); if (qDisplay) qDisplay.innerText = data.question;
        const optA = document.getElementById('text-opt-a'); if (optA) optA.innerText = data.optA;
        const optB = document.getElementById('text-opt-b'); if (optB) optB.innerText = data.optB;
        const optC = document.getElementById('text-opt-c'); if (optC) optC.innerText = data.optC;
        const optD = document.getElementById('text-opt-d'); if (optD) optD.innerText = data.optD;
        const desc = document.getElementById('mcq-desc-display'); if (desc) desc.innerText = data.desc;
        const ratioText = document.getElementById('mcq-ratio-text'); if (ratioText) ratioText.innerText = data.ratioText;
        const bar = document.getElementById('mcq-ratio-bar'); if (bar) { bar.style.width = data.ratioWidth; bar.className = `h-full bg-gradient-to-l ${data.colorClass} transition-all duration-500 rounded-full`; }
        textNodes.forEach(id => { const el = document.getElementById(id); if (el) el.style.opacity = '1'; });
    }, 120);
};

// 3. highlightChartMetric
let secretReportChart = null;
window.highlightChartMetric = function(index) {
    if (secretReportChart) {
        secretReportChart.setActiveElements([{ datasetIndex: 0, index: index }]);
        if (secretReportChart.tooltip) secretReportChart.tooltip.setActiveElements([{ datasetIndex: 0, index: index }]);
        secretReportChart.update();
    }
};

// 4. changeReportMode و changeReportTime (للتقرير السري)
let reportMode = 'student';
let reportTime = 'daily';

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
    // استدعاء دالة التحديث من analytics.js إذا كانت موجودة، وإلا سنضيفها لاحقاً
    if (window._renderSecretReport) window._renderSecretReport();
};

window.changeReportTime = function(time) {
    reportTime = time;
    const times = ['daily', 'weekly', 'monthly'];
    times.forEach(t => {
        const btn = document.getElementById(`time-${t}`);
        if (btn) {
            if (t === time) btn.className = "px-4 py-2 text-xs font-black rounded-lg bg-yellow-500 text-black transition-all shadow-md";
            else btn.className = "px-4 py-2 text-xs font-black rounded-lg text-gray-400 hover:text-white transition-all";
        }
    });
    if (window._renderSecretReport) window._renderSecretReport();
};

// تصدير دالة لتسجيل الرسم البياني من analytics.js
window._setSecretReportChart = function(chart) { secretReportChart = chart; };

console.log('Globals loaded: switchPremiumTab, selectMcqBloom, highlightChartMetric, changeReportMode, changeReportTime are ready');