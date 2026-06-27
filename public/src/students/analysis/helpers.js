// helpers.js - دوال مساعدة للرسوم البيانية والتوصيات
import { escapeHtml } from '../../utils.js';

export function renderStudentProgressChartStatic(studentId, studentName, filteredHistory) {
    const allMatches = filteredHistory.filter(g => g.participants?.map(String).includes(studentId)).sort((a, b) => a.timestamp - b.timestamp);
    const lastMatches = allMatches.slice(-10);
    if (lastMatches.length < 2) return '<div class="text-center text-gray-400">لا توجد بيانات كافية للرسم البياني</div>';
    
    const dataPoints = [];
    for (let i = 0; i < lastMatches.length; i++) {
        const match = lastMatches[i];
        const playerScoreObj = match.scores?.find(s => String(s.id) === studentId);
        const score = playerScoreObj ? playerScoreObj.score : 0;
        dataPoints.push(score);
    }
    
    window._tempChartData = dataPoints;
    window._tempChartLabels = lastMatches.map((_, i) => `مباراة ${i+1}`);
    
    const chartId = `print-chart-${Date.now()}`;
    return `<canvas id="${chartId}" width="400" height="200" style="max-width:100%; height:auto;"></canvas>`;
}

export function renderStudentProgressChart(studentId, studentName, filteredHistory) {
    const allMatches = filteredHistory.filter(g => g.participants?.map(String).includes(studentId)).sort((a, b) => a.timestamp - b.timestamp);
    const lastMatches = allMatches.slice(-10);
    if (lastMatches.length < 2) return '<div class="text-center text-gray-400 py-8">لا توجد بيانات كافية للرسم البياني</div>';
    
    const dataPoints = [];
    for (let i = 0; i < lastMatches.length; i++) {
        const match = lastMatches[i];
        const playerScoreObj = match.scores?.find(s => String(s.id) === studentId);
        const score = playerScoreObj ? playerScoreObj.score : 0;
        dataPoints.push(score);
    }
    
    window._tempChartData = dataPoints;
    window._tempChartLabels = lastMatches.map((_, i) => `مباراة ${i+1}`);
    
    const chartId = `progress-chart-${Date.now()}`;
    
    setTimeout(() => {
        const canvas = document.getElementById(chartId);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: window._tempChartLabels,
                        datasets: [{
                            label: 'رصيد الطالب بعد المباراة',
                            data: window._tempChartData,
                            borderColor: '#facc15',
                            backgroundColor: 'rgba(250,204,21,0.1)',
                            borderWidth: 3,
                            pointRadius: 5,
                            pointBackgroundColor: '#facc15',
                            pointBorderColor: '#000',
                            pointHoverRadius: 7,
                            fill: true,
                            tension: 0.2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: (ctx) => `${ctx.raw} نقطة` } }
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#ccc' } },
                            x: { ticks: { color: '#ccc', maxRotation: 45, autoSkip: true } }
                        }
                    }
                });
            }
        }
    }, 100);
    
    return `
        <div class="analysis-stat-card mt-4">
            <div class="text-yellow-400 text-lg mb-2">📈 تطور مستوى الطالب (النقاط الفعلية)</div>
            <div style="background: rgba(0,0,0,0.3); border-radius: 24px; padding: 12px; border: 1px solid rgba(250,204,21,0.3);">
                <canvas id="${chartId}" width="600" height="250" style="width: 100%; height: 230px;"></canvas>
            </div>
            <div class="text-xs text-gray-400 text-center mt-2">
                * النقاط الفعلية للطالب بعد كل مباراة من آخر ${lastMatches.length} مباراة
            </div>
        </div>
    `;
}

export function generateDetailedParentAdvice(data) {
    const {
        studentName,
        dateRangeLabel,
        accuracy,
        speedAvg,
        withdrawCount,
        weakCategories,
        strongCategories,
        levelName,
        winRate,
        studentGames,
        score,
        totalAnswers,
        correctAnswers
    } = data;

    const intros = [
        "📋 توصية مخصصة لولي الأمر: ",
        "📌 بناءً على أداء الطالب في الفترة المحددة، نوصي بما يلي: ",
        "💡 ملخص تحليل الأداء والتوصية: "
    ];
    let advice = intros[Math.floor(Math.random() * intros.length)];

    if (studentGames === 0) {
        const noGamesTexts = [
            "لم يشارك الطالب في أي مباراة بعد. ننصح بالبدء بمباراة تجريبية قصيرة (5 أسئلة) لقياس مستواه، ثم مناقشة النتائج معاً. الممارسة المنتظمة هي مفتاح التقدم. نشكرك على متابعة ابنك/ابنتك معنا.",
            "لم تسجل للطالب أية مشاركة. حافزه لتجربة أول مباراة اليوم، فالبداية هي نصف النجاح. شكراً لاهتمامك.",
            "لا توجد بيانات كافية بعد. شجع ابنك/ابنتك على خوض أول تحدٍ في المنصة، وخصص وقتاً يومياً بسيطاً للممارسة. نحن هنا لدعمك."
        ];
        return advice + noGamesTexts[Math.floor(Math.random() * noGamesTexts.length)];
    }

    const levelTexts = {
        مبتدئ: ["الطالب لا يزال في بداية الطريق التعليمي، ", "مستوى الطالب تمهيدي، يحتاج إلى تأسيس قوي، ", "الطالب ما زال يخطو خطواته الأولى، "],
        صاعد: ["الطالب في مرحلة صاعدة ويُظهر تحسناً ملحوظاً، ", "مستواه في تطور مستمر، ", "الطالب يتقدم بشكل جيد، "],
        طموح: ["الطالب يمتلك طموحاً واضحاً للتعلم، ", "لديه عزيمة للوصول إلى مستويات أعلى، ", "الطالب يسعى بجد ويتطور، "],
        متقدم: ["الطالب يمتلك أساساً جيداً ويستطيع حل الأسئلة المتوسطة بطلاقة، ", "مستوى جيد يمكن البناء عليه، ", "الطالب في مرحلة متقدمة نسبياً، "],
        محترف: ["الطالب في مستوى متقدم جداً ويحل الأسئلة بمهارة، ", "أداء يشبه المحترفين، ", "مستوى عالٍ من الإتقان، "],
        خبير: ["الطالب في مستوى خبير ويظهر فهماً استثنائياً، ", "خبرة عالية في المادة، ", "أداء خبير مميز، "],
        نابغة: ["الطالب في مستوى نابغة ويبرع في الاستيعاب، ", "ذكاء وتركيز عاليين، ", "مستوى يفوق المتوقع، "],
        أسطورة: ["الطالب وصل إلى مستوى أسطورة، وهذا إنجاز كبير، ", "أداء أسطوري نادر، ", "قمة المنصة العلمية، "],
        أيقونة: ["الطالب أصبح أيقونة في المنصة، ", "قدوة يحتذى بها، ", "مستوى لا يُضاهى، "]
    };
    const levelKey = Object.keys(levelTexts).find(k => levelName.includes(k));
    if (levelKey) {
        advice += levelTexts[levelKey][Math.floor(Math.random() * levelTexts[levelKey].length)];
    } else {
        advice += "الطالب يسير في طريق التقدم بشكل مطرد، ";
    }

    if (accuracy < 40) {
        advice += "لديه صعوبة واضحة في الإجابات الصحيحة، مما يستدعي العودة إلى الدروس الأساسية وتكرار التمارين البسيطة أولاً. ";
    } else if (accuracy < 60) {
        advice += "إجاباته الصحيحة مقبولة لكنها قد تكون أفضل، ركز على فهم الأخطاء وحلها معاً. ";
    } else if (accuracy < 80) {
        advice += "مستوى الدقة جيد ويحتاج فقط إلى تعزيز بمراجعة خفيفة. ";
    } else {
        advice += "إجاباته دقيقة جداً، وهذا مؤشر ممتاز، يمكنه الآن الانتقال إلى الأسئلة الصعبة والمواقف التحدية. ";
    }

    if (speedAvg > 12 && speedAvg > 0) {
        advice += "يستغرق وقتاً طويلاً في التفكير قبل الإجابة، لذا نوصي بتدريبات السرعة المنزلية لمدة 5 دقائق يومياً. ";
    } else if (speedAvg > 8 && speedAvg > 0) {
        advice += "وقت الإجابة أطول من المثالي بقليل، ويمكن تحسين ذلك باستخدام مؤقت بسيط أثناء حل الأسئلة السهلة. ";
    } else if (speedAvg < 5 && speedAvg > 0) {
        advice += "استجابة سريعة جداً، لكن تأكد من أن هذه السرعة لا تضحي بالدقة؛ ننصح أحياناً بقراءة السؤال مرتين. ";
    }

    if (accuracy >= 85 && speedAvg < 5 && speedAvg > 0) {
        advice += "مستواه استثنائي في السرعة والدقة معاً، مما يجعله مرشحاً لخوض أصعب التحديات. ";
    }

    if (withdrawCount >= 5) {
        advice += "كثرة الانسحاب قد تكون علامة إحباط أو صعوبة في قبول الخطأ، تحدث معه بلطف عن أهمية إكمال التحدي حتى النهاية، وخصص مكافأة صغيرة عند عدم الانسحاب لأسبوع كامل. ";
    } else if (withdrawCount >= 2) {
        advice += "لاحظنا بعض الانسحابات، قد يكون الطالب يشعر بالإرهاق أو يواجه سؤالاً صعباً. امدح محاولاته وشجعه على استكمال المباراة. ";
    }

    if (weakCategories.length > 0) {
        const weakList = weakCategories.slice(0, 3).map(c => escapeHtml(c)).join('، ');
        advice += `أظهر ضعفاً خاصاً في (${weakList})، لذا نوصي بتخصيص 10 دقائق يومياً لحل أسئلة من هذه التصنيفات فقط حتى يعتاد عليها. `;
    }

    if (strongCategories.length > 0) {
        const strongList = strongCategories.slice(0, 2).map(c => escapeHtml(c)).join(' و ');
        advice += `بالمقابل، هو قوي في (${strongList})، ويمكن استثمار ذلك لبناء الثقة وتحفيزه على تحدي نفسه في مجالات أوسع. `;
    }

    if (weakCategories.length > 2 && winRate < 30 && studentGames >= 5) {
        advice += `تعدد مجالات الضعف إلى جانب انخفاض نسبة الفوز يستدعي خطة مكثفة: نوصي بالتواصل مع معلم المادة لوضع برنامج علاجي، وتخصيص 20 دقيقة يومياً للتمرين على هذه المجالات فقط. `;
    }

    if (studentGames < 5) {
        advice += `المشاركة لا تزال قليلة للحصول على صورة دقيقة، لكن الحماس موجود؛ شجعه على مباراة إضافية أسبوعياً. `;
    } else if (winRate < 40 && studentGames >= 5) {
        advice += `نسبة الفوز منخفضة مقارنة بعدد المباريات، وهذا يعني أنه غالباً ما يخسر في مراحل متقدمة؛ ننصح بمراجعة الأخطاء معاً ورسم خطة لتحسين التكتيك. `;
    } else if (winRate > 75 && studentGames >= 10) {
        advice += `فوزه متكرر بشكل لافت، وهذا يدل على سيطرة جيدة على المادة. تحداه بتقليل وقت الإجابة أو تجربة أوضاع جديدة. `;
    }

    if (studentGames >= 20 && winRate >= 40 && winRate <= 60 && accuracy >= 60) {
        advice += `الطالب يمتلك أداءً ثابتاً ومستقراً على مدى فترة طويلة، مما يعني أنه مستعد لرفع مستوى الصعوبة تدريجياً. `;
    }

    const closings = [
        "تذكّر أن المثابرة أهم من النتيجة الفورية، وأن كل خطأ هو فرصة للتعلم. نشكرك على متابعة تقدم ابنك/ابنتك معنا.",
        "استمر في دعمه، فالتقدم التدريجي يبني عالماً من النجاحات. شكراً لاهتمامك.",
        "الاهتمام والمتابعة نصف الطريق. نشكرك على ثقتك بمنصة التاج.",
        "بالتشجيع المستمر سيصل إلى أعلى المستويات. فخورون بجهودكما معاً.",
        "تذكر أن التعلم رحلة ممتعة، وأنت شريكك الأساسي فيها. دمت عوناً لأبنائك."
    ];
    advice += " " + closings[Math.floor(Math.random() * closings.length)];

    return advice;
}   