// src/core/surpriseCards.js
// ============================================================
// وضع المفاجآت – 150 بطاقة (120 ضارة، 30 ذاتية) – النسخة النهائية
// [FIX] دعم كامل للأوضاع الجماعية (الفرق)
// [FIX] دعم وضع التدريب (isTrainingMode) و sessionId
// [FIX] إضافة دوال اختيار بطاقتين مع منع التكرار
// [FIX] تحسين استدعاء renderTracks باستخدام sessionId

import { getStudentById, updateStudent } from '../services/dataService.js';
import { RaceEvents } from './raceEvents.js';
import { showFloatingNotification } from '../utils.js';

// ------------------------------------------------------------------
// 1. تعريف البطاقات (ضرر على الآخرين + منفعة ذاتية)
// ------------------------------------------------------------------
export const CARDS_DATA = {
  // البطاقات الضارة (120 بطاقة – تم إضافة 50 بطاقة جديدة)
  harmful: [
    // === البطاقات الأصلية (70 بطاقة) ===
    { id: 'slow', name: '🐢 إبطاء', desc: 'الهدف يخسر خطوة واحدة', effect: 'lossSteps', amount: 1, weight: 4 },
    { id: 'stumble', name: '🦶 تعثر', desc: 'الهدف يتراجع خطوتين', effect: 'lossSteps', amount: 2, weight: 3 },
    { id: 'trip', name: '🚫 عثرة', desc: 'الهدف لا يتقدم في سؤاله التالي (خطوة 0)', effect: 'zeroStepNext', amount: 1, weight: 3 },
    { id: 'fog', name: '🌫️ ضباب', desc: 'الهدف يرى الخيارات مشوشة لمدة سؤال', effect: 'blurOptions', amount: 1, weight: 3 },
    { id: 'mud', name: '🟤 وحل', desc: 'الهدف يقضي وقتاً أطول (+3 ثوانٍ)', effect: 'addTime', amount: 3, weight: 3 },
    { id: 'leak', name: '💧 تسريب نقاط', desc: 'الهدف يخسر نقطة واحدة', effect: 'losePoints', amount: 1, weight: 4 },
    { id: 'rust', name: '🔧 صدأ', desc: 'الهدف يخسر 2 نقطة', effect: 'losePoints', amount: 2, weight: 3 },
    { id: 'confusion', name: '🌀 تشويش', desc: 'خيارات الهدف في سؤاله القادم تظهر بشكل عشوائي', effect: 'shuffleOptions', amount: 1, weight: 3 },
    { id: 'gravity', name: '🌍 جاذبية', desc: 'الهدف لا يستطيع التقدم خطوتين متتاليتين', effect: 'capSteps', amount: 1, weight: 2 },
    { id: 'silence', name: '🤐 صمت', desc: 'الهدف لا يستخدم أي بطاقة لمدة دورين', effect: 'silence', amount: 2, weight: 2 },
    { id: 'bomb', name: '💣 قنبلة', desc: 'الهدف يخسر 3 خطوات', effect: 'lossSteps', amount: 3, weight: 2 },
    { id: 'mine', name: '💥 لغم', desc: 'الهدف يخسر 4 خطوات', effect: 'lossSteps', amount: 4, weight: 1 },
    { id: 'swap', name: '🔄 تبادل المراكز', desc: 'تتبادلان موقعيكما على المضمار', effect: 'swapPositions', amount: null, weight: 2 },
    { id: 'freeze', name: '🧊 تجميد', desc: 'الهدف لا يستطيع الإجابة في سؤاله القادم', effect: 'skipNextQuestion', amount: 1, weight: 3 },
    { id: 'lightning', name: '⚡ صاعقة', desc: 'الهدف يعود إلى نقطة البداية', effect: 'backToStart', amount: null, weight: 2 },
    { id: 'magnet', name: '🧲 مغناطيس النقاط', desc: 'تسحب 5 نقاط من الهدف', effect: 'stealPoints', amount: 5, weight: 2 },
    { id: 'tornado', name: '🌪️ إعصار', desc: 'جميع المنافسين يتراجعون خطوة', effect: 'pushAllOthers', amount: 1, weight: 2 },
    { id: 'jail', name: '🔒 سجن', desc: 'الهدف يتغيب عن سؤالين', effect: 'skipNextQuestions', amount: 2, weight: 2 },
    { id: 'mimic', name: '🎭 مقلد', desc: 'تنسخ آخر بطاقة استخدمت على الهدف', effect: 'mimicLastCard', amount: null, weight: 1 },
    { id: 'collapse', name: '📉 انهيار', desc: 'الهدف يفقد 30% من نقاطه', effect: 'losePercentagePoints', amount: 30, weight: 1 },
    { id: 'curse', name: '🧙 لعنة', desc: 'الهدف يجيب خطأ في سؤاله القادم تلقائياً', effect: 'autoWrong', amount: 1, weight: 2 },
    { id: 'timeWarp', name: '⏳ تشويه زمني', desc: 'الهدف يخسر 10 ثوانٍ من وقته', effect: 'reduceTime', amount: 10, weight: 1 },
    { id: 'bandit', name: '🏹 لص', desc: 'تسرق بطاقة من الهدف إذا كان لديه', effect: 'stealCard', amount: null, weight: 1 },
    { id: 'clone', name: '👥 استنساخ', desc: 'يتقدم الهدف خطوة إضافية (سخرية)', effect: 'cloneStep', amount: 1, weight: 2 },
    { id: 'poison', name: '☠️ سم', desc: 'الهدف يخسر نقطة لكل إجابة صحيحة لـ 3 أدوار', effect: 'poison', amount: 3, weight: 2 },
    { id: 'earthquake', name: '🌋 زلزال', desc: 'جميع اللاعبين عداك يتراجعون خطوتين', effect: 'massLoss', amount: 2, weight: 1 },
    { id: 'reverse', name: '🔁 انعكاس', desc: 'يتقدم الهدف للخلف وأنت للأمام', effect: 'reverseSwap', amount: 1, weight: 1 },
    { id: 'nightmare', name: '🌙 كابوس', desc: 'الهدف يخسر دوره الحالي بالكامل', effect: 'skipCurrentTurn', amount: null, weight: 1 },
    { id: 'vampire', name: '🧛 مصاص نقاط', desc: 'تأخذ 3 نقاط من الهدف', effect: 'stealPoints', amount: 3, weight: 2 },
    { id: 'earthBind', name: '⛓️ قيود أرضية', desc: 'الهدف لا يتقدم لـ 2 سؤال (يظل في مكانه)', effect: 'freezeProgress', amount: 2, weight: 2 },
    { id: 'mirage', name: '🏜️ سراب', desc: 'الهدف يرى الإجابة الصحيحة خاطئة والعكس لمدة سؤال', effect: 'invertAnswer', amount: 1, weight: 1 },
    { id: 'twister', name: '🌪️ دوامة', desc: 'الهدف يتراجع 3 خطوات', effect: 'lossSteps', amount: 3, weight: 2 },
    { id: 'spider', name: '🕷️ عنكبوت', desc: 'الهدف يعلق لمدة سؤال (يضغط على أي خيار يخطئ)', effect: 'autoWrong', amount: 1, weight: 2 },
    { id: 'ghost', name: '👻 شبح', desc: 'الهدف يرى الشاشة مشوشة لمدة 5 ثوانٍ', effect: 'blurScreen', amount: 5, weight: 2 },
    { id: 'frog', name: '🐸 تحول', desc: 'يتقدم الهدف للخلف 4 خطوات ويتقدم أنت 2', effect: 'reverseSwap', amount: 2, weight: 1 },
    { id: 'rustyArmor', name: '🛡️ درع صدئ', desc: 'الهدف يخسر 50% من نقاطه', effect: 'losePercentagePoints', amount: 50, weight: 1 },
    { id: 'blackHole', name: '🕳️ ثقب أسود', desc: 'الهدف يتراجع 5 خطوات', effect: 'lossSteps', amount: 5, weight: 1 },
    { id: 'timeBomb', name: '💣 قنبلة موقوتة', desc: 'الهدف يخسر 3 خطوات بعد 3 أسئلة', effect: 'delayedLoss', amount: 3, weight: 1 },
    { id: 'copyCat', name: '🐱 نسخ', desc: 'تنسخ آخر حركة للهدف وتتقدم مثله', effect: 'copyLastMove', amount: null, weight: 2 },
    { id: 'iceAge', name: '❄️ عصر جليدي', desc: 'جميع اللاعبين يتجمدون لسؤال واحد', effect: 'freezeAll', amount: 1, weight: 1 },
    { id: 'meteor', name: '☄️ نيزك', desc: 'الهدف يخسر 4 خطوات', effect: 'lossSteps', amount: 4, weight: 1 },
    { id: 'pandemic', name: '🦠 وباء', desc: 'جميع اللاعبين يخسرون نقطة واحدة', effect: 'massLosePoints', amount: 1, weight: 2 },
    { id: 'tsunami', name: '🌊 تسونامي', desc: 'الهدف يتراجع 4 خطوات ويفقد 10 نقاط', effect: 'lossStepsAndPoints', steps: 4, points: 10, weight: 1 },
    { id: 'thunder', name: '⛈️ رعد', desc: 'الهدف يجيب خطأ في سؤاله الحالي', effect: 'currentAutoWrong', amount: 1, weight: 2 },
    { id: 'sandStorm', name: '🏜️ عاصفة رملية', desc: 'الهدف يرى جميع الخيارات متشابهة', effect: 'hideOptions', amount: 1, weight: 2 },
    { id: 'magicSwap', name: '🪄 تبادل سحري', desc: 'تتبادل نقاطك مع الهدف', effect: 'swapPoints', amount: null, weight: 1 },
    { id: 'treasureHunter', name: '🏴‍☠️ صائد الكنوز', desc: 'تسرق 8 نقاط من الهدف', effect: 'stealPoints', amount: 8, weight: 1 },
    { id: 'darkness', name: '🌑 ظلام', desc: 'الهدف لا يرى السؤال (فشل تلقائي)', effect: 'autoWrong', amount: 1, weight: 1 },
    { id: 'parasite', name: '🪱 طفيلي', desc: 'الهدف يخسر نقطة كل سؤال لمدة 4 أدوار', effect: 'poison', amount: 4, weight: 1 },
    { id: 'avalanche', name: '🏔️ انهيار جليدي', desc: 'جميع اللاعبين يتراجعون 3 خطوات', effect: 'massLoss', amount: 3, weight: 1 },
    { id: 'dragonBreath', name: '🐉 نار التنين', desc: 'الهدف يخسر 6 خطوات', effect: 'lossSteps', amount: 6, weight: 1 },
    { id: 'witchCurse', name: '🧙 لعنة ساحرة', desc: 'الهدف يجيب خطأ لمدة سؤالين', effect: 'autoWrong', amount: 2, weight: 1 },
    { id: 'voodoo', name: '🪆 فودو', desc: 'تتحكم بالهدف: تجبره على اختيار إجابة خطأ', effect: 'forceWrong', amount: 1, weight: 1 },
    { id: 'timeTravel', name: '⌛ سفر عبر الزمن', desc: 'الهدف يعود إلى وضعيته قبل 3 أدوار', effect: 'revertState', amount: 3, weight: 1 },
    { id: 'inferno', name: '🔥 جحيم', desc: 'الهدف يخسر 7 خطوات و10 نقاط', effect: 'lossStepsAndPoints', steps: 7, points: 10, weight: 1 },
    { id: 'frostbite', name: '❄️ صقيع', desc: 'الهدف يتجمد لسؤالين (لا يتحرك)', effect: 'freezeProgress', amount: 2, weight: 2 },
    { id: 'chaos', name: '🌀 فوضى', desc: 'جميع اللاعبين يتبادلون مراكزهم عشوائياً', effect: 'randomSwapAll', amount: null, weight: 1 },
    { id: 'brainFreeze', name: '🧠 تجميد العقل', desc: 'الهدف ينسى الإجابة الصحيحة', effect: 'autoWrong', amount: 1, weight: 2 },
    { id: 'shadow', name: '🌑 ظل', desc: 'الهدف يخسر 3 خطوات وتأخذ أنت 2', effect: 'stealSteps', amount: 3, weight: 1 },
    { id: 'storm', name: '🌩️ عاصفة', desc: 'جميع اللاعبين عداك يتراجعون 4 خطوات', effect: 'massLoss', amount: 4, weight: 1 },
    { id: 'quicksand', name: '🏜️ رمال متحركة', desc: 'الهدف يغرق ويخسر 5 خطوات', effect: 'lossSteps', amount: 5, weight: 1 },
    { id: 'mummy', name: '🧟 مومياء', desc: 'الهدف يتجمد لمدة سؤالين دون إجابة', effect: 'skipNextQuestions', amount: 2, weight: 1 },
    { id: 'alien', name: '👽 فضائي', desc: 'يختفي سؤال الهدف (فشل تلقائي)', effect: 'autoWrong', amount: 1, weight: 1 },
    { id: 'robot', name: '🤖 خلل إلكتروني', desc: 'الهدف يرى واجهة معطلة', effect: 'glitchUI', amount: 1, weight: 1 },
    { id: 'zombie', name: '🧟 زومبي', desc: 'الهدف يخسر دورين كاملين', effect: 'skipCurrentTurn', amount: 2, weight: 1 },
    { id: 'magicMirror', name: '🪞 مرآة سحرية', desc: 'ينعكس الضرر عليك أنت والهدف', effect: 'reflectDamage', amount: 1, weight: 1 },
    
    // === بطاقات ضارة جديدة (50 بطاقة) ===
    { id: 'brainFreeze2', name: '🧠 تجميد العقل', desc: 'الهدف ينسى الإجابة الصحيحة للسؤال القادم', effect: 'autoWrong', amount: 1, weight: 2 },
    { id: 'shadowThief', name: '🌑 لص الظل', desc: 'تسرق 2 خطوات من الهدف', effect: 'stealSteps', amount: 2, weight: 2 },
    { id: 'chaosOrb', name: '🌀 كرة الفوضى', desc: 'جميع اللاعبين يتبادلون مراكزهم عشوائياً', effect: 'randomSwapAll', amount: null, weight: 1 },
    { id: 'voodooDoll', name: '🪆 دمية فودو', desc: 'تجبر الهدف على اختيار إجابة خاطئة في سؤاله الحالي', effect: 'forceWrong', amount: 1, weight: 1 },
    { id: 'timeLeak', name: '⏳ تسرب زمني', desc: 'الهدف يخسر 5 ثوانٍ من وقته المتبقي', effect: 'reduceTime', amount: 5, weight: 2 },
    { id: 'mirrorImage', name: '🪞 صورة مرآة', desc: 'ينعكس الضرر الذي يسببه الهدف عليك', effect: 'reflectDamage', amount: 1, weight: 1 },
    { id: 'earthquake2', name: '🌍 زلزال عنيف', desc: 'جميع اللاعبين عداك يتراجعون 3 خطوات', effect: 'massLoss', amount: 3, weight: 1 },
    { id: 'poisonIvy', name: '🌿 لبلاب سام', desc: 'الهدف يخسر نقطة واحدة لكل إجابة صحيحة لـ 4 أدوار', effect: 'poison', amount: 4, weight: 2 },
    { id: 'blackout', name: '⚫ انقطاع كهرباء', desc: 'تختفي خيارات الهدف تماماً لسؤال واحد', effect: 'hideOptions', amount: 1, weight: 2 },
    { id: 'gravityWell', name: '🌀 بئر جاذبية', desc: 'الهدف لا يستطيع التقدم أكثر من خطوة واحدة في سؤاله القادم', effect: 'capSteps', amount: 1, weight: 2 },
    { id: 'memoryWipe', name: '🧽 مسح ذاكرة', desc: 'الهدف ينسى آخر 3 إجابات صحيحة (لا يحصل على نقاطها عند التقييم النهائي)', effect: 'memoryLoss', amount: 3, weight: 1 },
    { id: 'energyDrain', name: '🔋 استنزاف طاقة', desc: 'الهدف يخسر 10 نقاط', effect: 'losePoints', amount: 10, weight: 1 },
    { id: 'timeFreeze', name: '⏸️ تجميد الوقت', desc: 'الهدف لا يتحرك لسؤالين (يبقى في مكانه)', effect: 'freezeProgress', amount: 2, weight: 2 },
    { id: 'darknessFalls', name: '🌑 ظلام حالك', desc: 'الهدف يرى السؤال مشوشاً', effect: 'blurScreen', amount: 3, weight: 2 },
    { id: 'confusionWave', name: '🌊 موجة تشويش', desc: 'خيارات الهدف تظهر بشكل عشوائي', effect: 'shuffleOptions', amount: 1, weight: 2 },
    { id: 'slowMotion', name: '🐢 حركة بطيئة', desc: 'الهدف يخسر خطوتين', effect: 'lossSteps', amount: 2, weight: 3 },
    { id: 'quickSand', name: '🏜️ رمال متحركة', desc: 'الهدف يغرق ويخسر 4 خطوات', effect: 'lossSteps', amount: 4, weight: 2 },
    { id: 'thunderStrike', name: '⚡ ضربة صاعقة', desc: 'الهدف يعود إلى نقطة البداية', effect: 'backToStart', amount: null, weight: 1 },
    { id: 'iceShard', name: '❄️ شظية جليد', desc: 'الهدف يتجمد لمدة سؤال (لا يتحرك)', effect: 'freezeProgress', amount: 1, weight: 2 },
    { id: 'fireBall', name: '🔥 كرة نار', desc: 'الهدف يخسر 5 نقاط وخطوتين', effect: 'lossStepsAndPoints', steps: 2, points: 5, weight: 2 },
    { id: 'windGust', name: '💨 هبوب ريح', desc: 'جميع المنافسين يتراجعون خطوة واحدة', effect: 'pushAllOthers', amount: 1, weight: 2 },
    { id: 'stoneGaze', name: '👁️ نظرة حجر', desc: 'الهدف يتحول إلى حجر ولا يستطيع الإجابة لسؤال واحد', effect: 'skipNextQuestion', amount: 1, weight: 2 },
    { id: 'mysticMist', name: '🌫️ ضباب سحري', desc: 'الهدف يرى جميع الخيارات متشابهة', effect: 'blurOptions', amount: 1, weight: 2 },
    { id: 'curseOfAges', name: '🧙 لعنة العصور', desc: 'الهدف يجيب خطأ في السؤالين القادمين', effect: 'autoWrong', amount: 2, weight: 1 },
    { id: 'leechLife', name: '🩸 مص الحياة', desc: 'تسرق 7 نقاط من الهدف', effect: 'stealPoints', amount: 7, weight: 2 },
    { id: 'swapSkills', name: '🔄 تبادل مهارات', desc: 'تتبادل نقاطك مع الهدف', effect: 'swapPoints', amount: null, weight: 1 },
    { id: 'eternalNight', name: '🌃 ليل أبدي', desc: 'الهدف لا يرى أي شيء لمدة 10 ثوانٍ', effect: 'blurScreen', amount: 10, weight: 1 },
    { id: 'crystalShard', name: '🔮 شظية كريستال', desc: 'تنسخ آخر بطاقة ضارة استخدمت على الهدف', effect: 'mimicLastCard', amount: null, weight: 2 },
    { id: 'spiderWeb', name: '🕸️ شبكة عنكبوت', desc: 'الهدف يتعلق في الشبكة ويخسر دوره الحالي', effect: 'skipCurrentTurn', amount: 1, weight: 2 },
    { id: 'toxicSludge', name: '☣️ حمأة سامة', desc: 'الهدف يخسر نقطة واحدة لكل إجابة صحيحة لـ 5 أدوار', effect: 'poison', amount: 5, weight: 1 },
    { id: 'fearAura', name: '😨 هالة الخوف', desc: 'الهدف يتراجع خطوتين ويخسر 3 نقاط', effect: 'lossStepsAndPoints', steps: 2, points: 3, weight: 2 },
    { id: 'blizzard', name: '🌨️ عاصفة ثلجية', desc: 'جميع اللاعبين عداك يتجمدون لسؤال واحد', effect: 'freezeAll', amount: 1, weight: 1 },
    { id: 'lavaFlow', name: '🌋 تدفق حمم', desc: 'الهدف يخسر 6 نقاط و 3 خطوات', effect: 'lossStepsAndPoints', steps: 3, points: 6, weight: 1 },
    { id: 'puppetMaster', name: '🎭 سيد الدمى', desc: 'تتحكم بإجابة الهدف القادمة (تختار أنت الإجابة)', effect: 'controlAnswer', amount: 1, weight: 1 },
    { id: 'nightmare2', name: '🌙 كابوس', desc: 'الهدف لا يستطيع النوم (يخسر دوره الحالي)', effect: 'skipCurrentTurn', amount: 1, weight: 1 },
    { id: 'curseOfSilence', name: '🤫 لعنة الصمت', desc: 'الهدف لا يستخدم أي بطاقة لمدة 3 أدوار', effect: 'silence', amount: 3, weight: 1 },
    { id: 'timeWarp2', name: '🌀 اعوجاج زمني', desc: 'الهدف يعود إلى وضعه قبل 4 أدوار', effect: 'revertState', amount: 4, weight: 1 },
    { id: 'mindControl', name: '🧠 سيطرة عقلية', desc: 'تجبر الهدف على الإجابة خطأ في سؤاله الحالي', effect: 'forceWrong', amount: 1, weight: 1 },
    { id: 'poisonedApple', name: '🍎 تفاحة مسمومة', desc: 'الهدف يخسر 8 نقاط', effect: 'losePoints', amount: 8, weight: 2 },
    { id: 'stormCloud', name: '⛈️ سحابة عاصفة', desc: 'جميع اللاعبين يتراجعون خطوتين', effect: 'massLoss', amount: 2, weight: 2 },
    { id: 'luckyCoinHarm', name: '🪙 عملة محظوظة (ضارة)', desc: 'يخسر الهدف 1-5 خطوات عشوائياً', effect: 'randomLossSteps', amount: 5, weight: 2 },
    { id: 'reverseCard', name: '🃏 بطاقة عكسية', desc: 'ينعكس تأثير البطاقة التالية التي يستخدمها الهدف عليك', effect: 'reflectNextCard', amount: 1, weight: 1 },
    { id: 'ghostHand', name: '👻 يد شبح', desc: 'تسرق نقطة عشوائية من الهدف وتضيفها لنفسك', effect: 'stealRandomPoint', amount: 1, weight: 2 },
    { id: 'explosion', name: '💥 انفجار', desc: 'الهدف يخسر 8 خطوات', effect: 'lossSteps', amount: 8, weight: 1 },
    { id: 'infection', name: '🦠 عدوى', desc: 'الهدف ينقل خسارته للاعب التالي بعد دوره', effect: 'spreadLoss', amount: 1, weight: 1 },
    { id: 'shrink', name: '📏 تصغير', desc: 'الهدف لا يتقدم في سؤاله القادم', effect: 'zeroStepNext', amount: 1, weight: 2 },
    { id: 'mute', name: '🔇 كتم', desc: 'الهدف لا يسمع المؤقت (ينخدع بالوقت)', effect: 'muteTimer', amount: 1, weight: 1 },
    { id: 'confettiGlitch', name: '🎊 خلل احتفالي', desc: 'تظهر واجهة معطلة للهدف', effect: 'glitchUI', amount: 1, weight: 1 },
    { id: 'darkPulse', name: '🌑 نبضة مظلمة', desc: 'الهدف يخسر 2 خطوة و 5 نقاط', effect: 'lossStepsAndPoints', steps: 2, points: 5, weight: 2 },
    { id: 'frostArmor', name: '❄️ درع جليدي', desc: 'الهدف يتجمد لمدة سؤالين ويتأثر بالسم', effect: 'freezeProgress', amount: 2, weight: 1 },
    { id: 'soulDrain', name: '💀 سحب الروح', desc: 'تسرق 4 نقاط و 2 خطوات من الهدف', effect: 'stealSteps', amount: 2, weight: 1 }
  ],

  // البطاقات الذاتية (30 بطاقة)
  self: [
    { id: 'boost', name: '⚡ تسريع', desc: 'تتقدم خطوة إضافية', effect: 'extraStep', amount: 1, weight: 4 },
    { id: 'smallHeal', name: '💚 شفاء صغير', desc: 'تستعيد 5 نقاط', effect: 'addPoints', amount: 5, weight: 4 },
    { id: 'luckyCoin', name: '🪙 عملة حظ', desc: 'تتقدم 1-3 خطوات', effect: 'randomSteps', amount: null, weight: 3 },
    { id: 'focus', name: '🎯 تركيز', desc: 'ضعف سرعة الوقت للسؤال القادم (6 ثوانٍ بدلاً من 12)', effect: 'lessTime', amount: 6, weight: 3 },
    { id: 'meditation', name: '🧘 تأمل', desc: 'تتقدم خطوة بدون إجابة', effect: 'extraStep', amount: 1, weight: 3 },
    { id: 'recycle', name: '♻️ إعادة تدوير', desc: 'تستعيد بطاقة مستخدمة', effect: 'reclaimCard', amount: null, weight: 2 },
    { id: 'clover', name: '🍀 برسيم', desc: 'فرصة مضاعفة للحصول على بطاقة المرة القادمة', effect: 'doubleCardChance', amount: 1, weight: 2 },
    { id: 'wisdom', name: '📖 حكمة', desc: 'ترى الإجابة الصحيحة للسؤال القادم', effect: 'revealAnswer', amount: null, weight: 3 },
    { id: 'shield', name: '🛡️ درع', desc: 'حماية من أي ضرر لدورين', effect: 'shield', amount: 2, weight: 3 },
    { id: 'secondChance', name: '🔁 فرصة ثانية', desc: 'إذا أخطأت لا تخسر شيئاً', effect: 'secondChance', amount: 1, weight: 3 },
    { id: 'doublePoints', name: '✨ نقاط مضاعفة', desc: 'نقاط إجابتك القادمة ×2', effect: 'doubleNextPoints', amount: 1, weight: 2 },
    { id: 'temporaryBoost', name: '🪄 تعزيز مؤقت', desc: 'كل إجابة صحيحة تحسب خطوتين لدورين', effect: 'doubleStepsForTurns', amount: 2, weight: 2 },
    { id: 'gift', name: '🎁 هدية', desc: 'تحصل على بطاقة إضافية (يمكن استخدامها فوراً)', effect: 'extraCard', amount: null, weight: 2 },
    { id: 'treasure', name: '💰 كنز', desc: 'تحصل على 10 نقاط (نادر)', effect: 'addPoints', amount: 10, weight: 1 },
    { id: 'genius', name: '🧠 عبقرية', desc: 'تتقدم خطوتين إضافيتين', effect: 'extraStep', amount: 2, weight: 2 },
    { id: 'phoenix', name: '🔥 عنقاء', desc: 'إذا كنت متأخراً (آخر 3 مراكز) تتقدم 5 خطوات', effect: 'comebackBoost', amount: 5, weight: 1 },
    { id: 'timeFreeze', name: '⏱️ وقت إضافي', desc: 'يمنحك 10 ثوانٍ إضافية للسؤال الحالي', effect: 'addTime', amount: 10, weight: 2 },
    { id: 'mastery', name: '🏆 براعة', desc: 'تتقدم خطوة لكل إجابة صحيحة قادمة لدورين', effect: 'doubleStepsForTurns', amount: 2, weight: 1 },
    { id: 'luck', name: '🍀 حظ كبير', desc: 'تتقدم 4 خطوات عشوائية', effect: 'randomSteps', amount: 4, weight: 1 },
    { id: 'cloneSelf', name: '👥 استنساخ ذاتي', desc: 'ينشأ نسخة منك تتقدم خطوة بدلاً عنك', effect: 'cloneStep', amount: 1, weight: 1 },
    { id: 'instantWin', name: '🏆 فوز فوري', desc: 'إذا كنت على بعد خطوة واحدة من النهاية، تصل مباشرة (نادر جداً)', effect: 'instantWin', amount: null, weight: 0.3 },
    { id: 'mirageSelf', name: '🏜️ سراب', desc: 'تتقدم 3 خطوات وتسرق 5 نقاط من المتصدر', effect: 'stealFromLeader', amount: 5, weight: 1 },
    { id: 'resurrection', name: '⚰️ بعث', desc: 'إذا خرجت من السباق (0 قلوب) تعود بقلب واحد', effect: 'revive', amount: 1, weight: 0.5 },
    { id: 'bank', name: '🏦 بنك', desc: 'تحفظ 10 نقاط حالياً وتستعيدها عند الخسارة', effect: 'bankPoints', amount: 10, weight: 1 },
    { id: 'inspiration', name: '💡 إلهام', desc: 'الإجابة الصحيحة القادمة تمنحك +2 خطوات', effect: 'nextDoubleStep', amount: 2, weight: 2 },
    { id: 'magicPotion', name: '🧪 جرعة سحرية', desc: 'تتقدم 3 خطوات وتزيد نقاطك 5', effect: 'stepAndPoints', steps: 3, points: 5, weight: 1 },
    { id: 'wind', name: '💨 رياح', desc: 'تتقدم خطوة وجميع المنافسين يتراجعون خطوة', effect: 'boostAndPush', amount: 1, weight: 1 },
    { id: 'alchemist', name: '🧪 كيميائي', desc: 'تحول 10 نقاط إلى 5 خطوات', effect: 'pointsToSteps', amount: 10, weight: 1 },
    { id: 'savior', name: '🦸 منقذ', desc: 'تنقذ لاعباً ضعيفاً وتأخذ منه خطوة', effect: 'helpAndSteal', amount: 1, weight: 1 },
    { id: 'eternity', name: '♾️ أبدية', desc: 'تتقدم 2 خطوة وتستعيد درعاً', effect: 'stepAndShield', steps: 2, shield: 2, weight: 1 }
  ]
};

// ------------------------------------------------------------------
// 2. دالة سحب بطاقة عشوائية مرجحة (للتوافق القديم)
// ------------------------------------------------------------------
export function drawRandomCard() {
  const allCards = [];
  for (const card of CARDS_DATA.harmful) {
    const repeats = Math.max(1, Math.floor(card.weight * 10));
    for (let i = 0; i < repeats; i++) allCards.push({ ...card, type: 'harmful' });
  }
  for (const card of CARDS_DATA.self) {
    const repeats = Math.max(1, Math.floor(card.weight * 10));
    for (let i = 0; i < repeats; i++) allCards.push({ ...card, type: 'self' });
  }
  if (allCards.length === 0) return { card: CARDS_DATA.harmful[0], type: 'harmful' };
  const rand = Math.floor(Math.random() * allCards.length);
  return { card: allCards[rand], type: allCards[rand].type };
}

// ------------------------------------------------------------------
// 3. تطبيق البطاقات الضارة (دعم الفردي والجماعي) – مع Firebase ووضع التدريب
// ------------------------------------------------------------------
export async function applyHarmfulEffect(card, raceData, sourcePlayerId, targetPlayerId, isTeamMode = false, sessionId = null) {
  const isTraining = raceData.isTrainingMode === true;
  const players = raceData.players;
  const teams = raceData.teams;
  const source = players.find(p => p.id === sourcePlayerId);
  const isMultiTarget = (targetPlayerId === null);
  let target = null;
  let targetTeam = null;
  
  if (!isMultiTarget) {
    if (isTeamMode) {
      const teamId = parseInt(String(targetPlayerId).replace('team_', ''));
      targetTeam = teams.find(t => t.id === teamId);
      if (!targetTeam) return false;
    } else {
      target = players.find(p => p.id === targetPlayerId);
      if (!target) return false;
    }
  }

  // قائمة التأثيرات التي يمكن صدها بالدرع (للأفراد)
  const harmfulEffects = [
    'lossSteps', 'swapPositions', 'backToStart', 'stealPoints', 'pushAllOthers',
    'skipNextQuestion', 'skipNextQuestions', 'losePercentagePoints', 'autoWrong',
    'reduceTime', 'capSteps', 'cloneStep', 'poison', 'massLoss', 'reverseSwap',
    'skipCurrentTurn', 'zeroStepNext', 'blurOptions', 'losePoints', 'freezeProgress',
    'invertAnswer', 'blurScreen', 'delayedLoss', 'copyLastMove', 'freezeAll',
    'lossStepsAndPoints', 'currentAutoWrong', 'hideOptions', 'swapPoints',
    'stealSteps', 'massLosePoints', 'randomSwapAll', 'forceWrong', 'glitchUI',
    'randomLossSteps', 'stealRandomPoint', 'reflectNextCard', 'spreadLoss', 'muteTimer'
  ];
  
  // فحص الدرع للفرد
  if (!isMultiTarget && !isTeamMode && target && target._shieldRemaining > 0 && harmfulEffects.includes(card.effect)) {
    target._shieldRemaining--;
    showFloatingNotification(`🛡️ ${target.name} محمي بالدرع! لم يتأثر. (متبقي ${target._shieldRemaining} درع)`, 'info', 1500);
    if (sessionId && typeof RaceEvents.renderTracks === 'function') RaceEvents.renderTracks(sessionId);
    return true;
  }
  
  if (!isMultiTarget && isTeamMode && targetTeam) {
    const anyShield = targetTeam.members.some(m => m._shieldRemaining > 0);
    if (anyShield && harmfulEffects.includes(card.effect)) {
      const shieldedMember = targetTeam.members.find(m => m._shieldRemaining > 0);
      if (shieldedMember) {
        shieldedMember._shieldRemaining--;
        showFloatingNotification(`🛡️ فريق ${targetTeam.name} محمي بدرع ${shieldedMember.name}! لم يتأثر.`, 'info', 1500);
        if (sessionId && typeof RaceEvents.renderTracks === 'function') RaceEvents.renderTracks(sessionId);
        return true;
      }
    }
  }

  let needsRender = false;

  switch (card.effect) {
    case 'lossSteps':
      if (!isMultiTarget && !isTeamMode && target) target.pos = Math.max(0, target.pos - (card.amount || 1));
      if (!isMultiTarget && isTeamMode && targetTeam) targetTeam.pos = Math.max(0, targetTeam.pos - (card.amount || 1));
      needsRender = true;
      break;
      
    case 'swapPositions':
      if (!isMultiTarget && !isTeamMode && source && target) { 
        const temp = source.pos; source.pos = target.pos; target.pos = temp; 
        needsRender = true;
      } else if (!isMultiTarget && isTeamMode && source && targetTeam) {
        const sourcePlayer = players.find(p => p.id === sourcePlayerId);
        if (sourcePlayer) {
          const tempPos = sourcePlayer.pos;
          sourcePlayer.pos = targetTeam.pos;
          targetTeam.pos = tempPos;
          needsRender = true;
        }
      }
      break;
      
    case 'backToStart':
      if (!isMultiTarget && !isTeamMode && target) target.pos = 0;
      if (!isMultiTarget && isTeamMode && targetTeam) targetTeam.pos = 0;
      needsRender = true;
      break;
      
    case 'stealPoints': {
      if (source && target && !isTeamMode) {
        const sTarget = await getStudentById(target.id);
        const sSource = await getStudentById(source.id);
        if (sTarget && sSource) {
          const steal = Math.min(card.amount || 5, sTarget.score);
          const newTargetScore = Math.max(0, sTarget.score - steal);
          const newSourceScore = sSource.score + steal;
          if (!isTraining) {
            await updateStudent(target.id, { score: newTargetScore });
            await updateStudent(source.id, { score: newSourceScore });
          }
          target.score = newTargetScore;
          source.score = newSourceScore;
          needsRender = true;
        }
      } else if (source && isTeamMode && targetTeam && targetTeam.members.length) {
        const targetMember = targetTeam.members[0];
        const sTarget = await getStudentById(targetMember.id);
        const sSource = await getStudentById(source.id);
        if (sTarget && sSource) {
          const steal = Math.min(card.amount || 5, sTarget.score);
          const newTargetScore = Math.max(0, sTarget.score - steal);
          const newSourceScore = sSource.score + steal;
          if (!isTraining) {
            await updateStudent(targetMember.id, { score: newTargetScore });
            await updateStudent(source.id, { score: newSourceScore });
          }
          targetMember.score = newTargetScore;
          source.score = newSourceScore;
          needsRender = true;
        }
      }
      break;
    }
      
    case 'pushAllOthers':
      if (!isTeamMode) {
        players.forEach(p => { if (p.id !== source.id && p.id !== (target?.id)) p.pos = Math.max(0, p.pos - (card.amount || 1)); });
      } else {
        teams.forEach(t => { if (t.id !== targetTeam?.id) t.pos = Math.max(0, t.pos - (card.amount || 1)); });
      }
      needsRender = true;
      break;
      
    case 'skipNextQuestion':
    case 'skipNextQuestions':
      const turns = card.amount || 1;
      if (!isMultiTarget && !isTeamMode && target) target._skipTurns = (target._skipTurns || 0) + turns;
      if (!isMultiTarget && isTeamMode && targetTeam) {
        targetTeam.members.forEach(m => m._skipTurns = (m._skipTurns || 0) + turns);
      }
      break;
      
    case 'losePercentagePoints':
      if (!isMultiTarget && !isTeamMode && target) {
        const student = await getStudentById(target.id);
        if (student) {
          const percent = card.amount || 30;
          const lose = Math.floor(student.score * (percent / 100));
          const newScore = Math.max(0, student.score - lose);
          if (!isTraining) await updateStudent(target.id, { score: newScore });
          target.score = newScore;
          needsRender = true;
        }
      }
      break;
      
    case 'autoWrong':
      const wrongCount = card.amount || 1;
      if (!isMultiTarget && !isTeamMode && target) target._forcedWrong = (target._forcedWrong || 0) + wrongCount;
      if (!isMultiTarget && isTeamMode && targetTeam) {
        targetTeam.members.forEach(m => m._forcedWrong = (m._forcedWrong || 0) + wrongCount);
      }
      break;
      
    case 'reduceTime':
      if (!isMultiTarget && !isTeamMode && target) {
        target._timeReduction = (target._timeReduction || 0) + (card.amount || 10);
        showFloatingNotification(`⏳ ${target.name} سينقص وقته في السؤال القادم!`, 'urgent', 1500);
      }
      break;
      
    case 'shuffleOptions':
      if (!isMultiTarget && !isTeamMode && target) target._shuffleOptions = true;
      if (!isMultiTarget && isTeamMode && targetTeam) targetTeam.members.forEach(m => m._shuffleOptions = true);
      break;
      
    case 'capSteps':
      if (!isMultiTarget && !isTeamMode && target) target._maxStep = 1;
      break;
      
    case 'cloneStep':
      if (!isMultiTarget && !isTeamMode && target) target.pos = Math.max(0, target.pos - 1);
      if (source) source.pos += 1;
      showFloatingNotification(`🎭 استنساخ ضار! ${target?.name || 'الهدف'} يتراجع خطوة${source ? ` و ${source.name} يتقدم خطوة` : ''}.`, 'urgent', 1500);
      needsRender = true;
      break;
      
    case 'poison':
      const poisonTurns = card.amount || 3;
      if (!isMultiTarget && !isTeamMode && target) target._poisonRemaining = poisonTurns;
      if (!isMultiTarget && isTeamMode && targetTeam) targetTeam.members.forEach(m => m._poisonRemaining = poisonTurns);
      break;
      
    case 'massLoss':
      if (!isTeamMode) {
        players.forEach(p => { if (p.id !== source.id) p.pos = Math.max(0, p.pos - (card.amount || 2)); });
      } else {
        teams.forEach(t => { if (t.id !== targetTeam?.id) t.pos = Math.max(0, t.pos - (card.amount || 2)); });
      }
      needsRender = true;
      break;
      
    case 'reverseSwap':
      if (source && target && !isTeamMode) {
        const diff = Math.abs(source.pos - target.pos);
        if (source.pos > target.pos) { source.pos -= diff; target.pos += diff; }
        else { source.pos += diff; target.pos -= diff; }
        needsRender = true;
      } else if (source && isTeamMode && targetTeam) {
        const sourcePlayer = players.find(p => p.id === sourcePlayerId);
        if (sourcePlayer) {
          const diff = Math.abs(sourcePlayer.pos - targetTeam.pos);
          if (sourcePlayer.pos > targetTeam.pos) { sourcePlayer.pos -= diff; targetTeam.pos += diff; }
          else { sourcePlayer.pos += diff; targetTeam.pos -= diff; }
          needsRender = true;
        }
      }
      break;
      
    case 'skipCurrentTurn':
      if (!isMultiTarget && !isTeamMode && target) target._skipCurrentTurn = true;
      if (!isMultiTarget && isTeamMode && targetTeam) targetTeam.members.forEach(m => m._skipCurrentTurn = true);
      break;
      
    case 'zeroStepNext':
      if (!isMultiTarget && !isTeamMode && target) target._zeroStepNext = true;
      break;
      
    case 'blurOptions':
      if (!isMultiTarget && !isTeamMode && target) target._blurOptions = true;
      break;
      
    case 'addTime':
      if (!isMultiTarget && !isTeamMode && target) target._extraTime = (target._extraTime || 0) + (card.amount || 3);
      break;
      
    case 'losePoints': {
      const pointsLoss = card.amount || 1;
      if (!isMultiTarget && !isTeamMode && target) {
        const student = await getStudentById(target.id);
        if (student) {
          const newScore = Math.max(0, student.score - pointsLoss);
          if (!isTraining) await updateStudent(target.id, { score: newScore });
          target.score = newScore;
          needsRender = true;
        }
      }
      break;
    }
      
    case 'freezeProgress':
      const freezeTurns = card.amount || 1;
      if (!isMultiTarget && !isTeamMode && target) target._freezeTurns = (target._freezeTurns || 0) + freezeTurns;
      break;
      
    case 'invertAnswer':
      if (!isMultiTarget && !isTeamMode && target) target._invertAnswer = true;
      break;
      
    case 'blurScreen':
      const blurSeconds = card.amount || 5;
      if (!isMultiTarget && !isTeamMode && target) target._blurScreen = (target._blurScreen || 0) + blurSeconds;
      break;
      
    case 'delayedLoss':
      if (!isMultiTarget && !isTeamMode && target) target._delayedLoss = { amount: card.amount || 3, turnsRemaining: 3 };
      break;
      
    case 'freezeAll':
      if (!isTeamMode) players.forEach(p => { if (p.id !== source.id) p._freezeTurns = (p._freezeTurns || 0) + 1; });
      else teams.forEach(t => { if (t.id !== targetTeam?.id) t.members.forEach(m => m._freezeTurns = (m._freezeTurns || 0) + 1); });
      break;
      
    case 'lossStepsAndPoints':
      if (!isMultiTarget && !isTeamMode && target) {
        target.pos = Math.max(0, target.pos - (card.steps || 4));
        const student = await getStudentById(target.id);
        if (student) {
          const newScore = Math.max(0, student.score - (card.points || 10));
          if (!isTraining) await updateStudent(target.id, { score: newScore });
          target.score = newScore;
        }
        needsRender = true;
      }
      break;
      
    case 'currentAutoWrong':
      if (!isMultiTarget && !isTeamMode && target) target._currentAutoWrong = true;
      break;
      
    case 'hideOptions':
      if (!isMultiTarget && !isTeamMode && target) target._hideOptions = true;
      break;
      
    case 'swapPoints':
      if (source && target && !isTeamMode) {
        const sSource = await getStudentById(source.id);
        const sTarget = await getStudentById(target.id);
        if (sSource && sTarget) {
          const tempScore = sSource.score;
          if (!isTraining) {
            await updateStudent(source.id, { score: sTarget.score });
            await updateStudent(target.id, { score: tempScore });
          }
          source.score = sTarget.score;
          target.score = tempScore;
          needsRender = true;
        }
      }
      break;
      
    case 'stealSteps':
      if (source && target && !isTeamMode) {
        const steal = Math.min(card.amount || 3, target.pos);
        target.pos -= steal;
        source.pos += steal;
        needsRender = true;
      }
      break;
      
    case 'massLosePoints': {
      const massLossPoints = card.amount || 1;
      if (!isTeamMode) {
        for (const p of players) {
          if (p.id !== source.id) {
            const student = await getStudentById(p.id);
            if (student) {
              const newScore = Math.max(0, student.score - massLossPoints);
              if (!isTraining) await updateStudent(p.id, { score: newScore });
              p.score = newScore;
            }
          }
        }
      } else {
        for (const t of teams) {
          if (t.id !== targetTeam?.id) {
            for (const m of t.members) {
              const student = await getStudentById(m.id);
              if (student) {
                const newScore = Math.max(0, student.score - massLossPoints);
                if (!isTraining) await updateStudent(m.id, { score: newScore });
                m.score = newScore;
              }
            }
          }
        }
      }
      needsRender = true;
      break;
    }
      
    case 'randomSwapAll':
      if (!isTeamMode) {
        const positions = players.map(p => p.pos);
        for (let i = positions.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [positions[i], positions[j]] = [positions[j], positions[i]]; }
        players.forEach((p, idx) => { p.pos = positions[idx]; });
      } else {
        const positions = teams.map(t => t.pos);
        for (let i = positions.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [positions[i], positions[j]] = [positions[j], positions[i]]; }
        teams.forEach((t, idx) => { t.pos = positions[idx]; });
      }
      needsRender = true;
      break;
      
    case 'forceWrong':
      if (!isMultiTarget && !isTeamMode && target) target._forcedWrongNext = true;
      break;
      
    case 'glitchUI':
      if (!isMultiTarget && !isTeamMode && target) target._glitchUI = true;
      break;
      
    // تأثيرات جديدة
    case 'randomLossSteps':
      if (!isMultiTarget && !isTeamMode && target) {
        const loss = Math.floor(Math.random() * (card.amount || 5)) + 1;
        target.pos = Math.max(0, target.pos - loss);
        showFloatingNotification(`${target.name} يخسر ${loss} خطوة عشوائياً!`, 'urgent', 1500);
        needsRender = true;
      }
      break;
      
    case 'stealRandomPoint':
      if (source && target && !isTeamMode) {
        const steal = 1;
        const newTargetScore = Math.max(0, target.score - steal);
        const newSourceScore = source.score + steal;
        if (!isTraining) {
          await updateStudent(target.id, { score: newTargetScore });
          await updateStudent(source.id, { score: newSourceScore });
        }
        target.score = newTargetScore;
        source.score = newSourceScore;
        showFloatingNotification(`👻 ${source.name} يسرق نقطة عشوائية من ${target.name}!`, 'urgent', 1500);
        needsRender = true;
      }
      break;
      
    case 'reflectNextCard':
      if (!isMultiTarget && !isTeamMode && target) target._reflectNext = true;
      break;
      
    case 'spreadLoss':
      // تأثير معقد: سيتم تطبيقه لاحقاً
      break;
      
    case 'muteTimer':
      if (!isMultiTarget && !isTeamMode && target) target._muteTimer = true;
      break;
      
    default: return false;
  }
  
  if (needsRender && typeof RaceEvents.renderTracks === 'function' && sessionId) {
    RaceEvents.renderTracks(sessionId);
  }
  
  return true;
}

// ------------------------------------------------------------------
// 4. تطبيق البطاقات الذاتية (دعم فردي وجماعي) – مع Firebase ووضع التدريب
// ------------------------------------------------------------------
export async function applySelfEffect(card, raceData, playerId, isTeamMode = false, sessionId = null) {
  const isTraining = raceData.isTrainingMode === true;
  if (!isTeamMode) {
    const player = raceData.players.find(p => p.id === playerId);
    if (!player) return;
    await applySelfEffectToPlayer(card, raceData, player, isTraining, sessionId);
  } else {
    const team = raceData.teams.find(t => t.members.some(m => m.id === playerId));
    if (!team) return;
    for (const member of team.members) {
      await applySelfEffectToPlayer(card, raceData, member, isTraining, sessionId);
    }
  }
}

async function applySelfEffectToPlayer(card, raceData, player, isTraining, sessionId) {
  let needsRender = false;

  switch (card.effect) {
    case 'extraStep': player.pos += (card.amount || 1); needsRender = true; break;
    case 'shield': player._shieldRemaining = (card.amount || 2); break;
    case 'addPoints': {
      const student = await getStudentById(player.id);
      if (student) {
        const newScore = student.score + (card.amount || 5);
        if (!isTraining) await updateStudent(player.id, { score: newScore });
        player.score = newScore;
        needsRender = true;
      }
      break;
    }
    case 'secondChance': player._secondChance = true; break;
    case 'doubleNextPoints': player._doublePointsNext = true; break;
    case 'randomSteps': {
      const max = card.amount || 3; const steps = Math.floor(Math.random() * max) + 1; player.pos += steps; needsRender = true; break;
    }
    case 'doubleStepsForTurns': player._doubleStepsRemaining = (card.amount || 2); break;
    case 'revealAnswer': player._revealAnswer = true; break;
    case 'extraCard': if (!raceData._pendingExtraCard) raceData._pendingExtraCard = true; break;
    case 'lessTime': player._customTimeLimit = (card.amount || 6); break;
    case 'addTime': player._extraTime = (player._extraTime || 0) + (card.amount || 10); break;
    
    case 'reclaimCard': {
      if (raceData.surpriseCardsUsed && raceData.surpriseCardsUsed[player.id] > 0) {
        raceData.surpriseCardsUsed[player.id]--;
        showFloatingNotification(`♻️ تم استعادة بطاقة! لديك الآن ${3 - raceData.surpriseCardsUsed[player.id]} بطاقة متاحة`, 'success', 2000);
        needsRender = false;
      } else {
        showFloatingNotification(`⚠️ ليس لديك بطاقات مستخدمة لاستعادتها`, 'info', 1500);
      }
      break;
    }
    
    case 'doubleCardChance': player._doubleCardChance = true; break;
    case 'comebackBoost': {
      const sorted = [...raceData.players].sort((a,b) => b.pos - a.pos);
      const rank = sorted.findIndex(p => p.id === player.id);
      if (rank >= sorted.length - 3) player.pos += (card.amount || 5); needsRender = true;
      break;
    }
    case 'cloneStep': player.pos++; needsRender = true; break;
    
    case 'instantWin':
      if (player.pos >= raceData.goal - 1) {
        player.pos = raceData.goal;
        needsRender = true;
        setTimeout(() => {
          if (typeof window.winGame === 'function') {
            window.winGame(player, player);
          } else {
            console.warn('winGame function not found in window');
          }
        }, 100);
      }
      break;
      
    case 'stealFromLeader': {
      const sorted = [...raceData.players].sort((a,b) => b.pos - a.pos);
      const leader = sorted[0];
      if (leader && leader.id !== player.id) {
        const steal = Math.min(card.amount || 5, leader.score);
        const sLeader = await getStudentById(leader.id);
        const sPlayer = await getStudentById(player.id);
        if (sLeader && sPlayer) {
          const newLeaderScore = Math.max(0, sLeader.score - steal);
          const newPlayerScore = sPlayer.score + steal;
          if (!isTraining) {
            await updateStudent(leader.id, { score: newLeaderScore });
            await updateStudent(player.id, { score: newPlayerScore });
          }
          leader.score = newLeaderScore;
          player.score = newPlayerScore;
          needsRender = true;
        }
        player.pos += 3; needsRender = true;
      }
      break;
    }
    case 'revive': {
      if (raceData.survivalLives && raceData.survivalLives[player.id] === 0) {
        raceData.survivalLives[player.id] = 1;
        player.pos = Math.max(1, Math.floor(raceData.goal / 2));
        needsRender = true;
      }
      break;
    }
    case 'bankPoints': {
      if (!player._bankedPoints) player._bankedPoints = 0;
      const student = await getStudentById(player.id);
      if (student) {
        const bank = Math.min(card.amount || 10, student.score);
        const newScore = student.score - bank;
        if (!isTraining) await updateStudent(player.id, { score: newScore });
        player._bankedPoints += bank;
        player.score = newScore;
        needsRender = true;
      }
      break;
    }
    case 'nextDoubleStep': player._nextStepMultiplier = (card.amount || 2); break;
    case 'stepAndPoints': {
      player.pos += (card.steps || 3);
      const student = await getStudentById(player.id);
      if (student) {
        const newScore = student.score + (card.points || 5);
        if (!isTraining) await updateStudent(player.id, { score: newScore });
        player.score = newScore;
        needsRender = true;
      }
      break;
    }
    case 'boostAndPush': {
      player.pos += (card.amount || 1);
      for (const p of raceData.players) {
        if (p.id !== player.id) p.pos = Math.max(0, p.pos - 1);
      }
      needsRender = true;
      break;
    }
    case 'pointsToSteps': {
      const student = await getStudentById(player.id);
      if (student && student.score >= (card.amount || 10)) {
        const newScore = student.score - (card.amount || 10);
        if (!isTraining) await updateStudent(player.id, { score: newScore });
        player.score = newScore;
        player.pos += 5;
        needsRender = true;
      }
      break;
    }
    case 'helpAndSteal': {
      const sorted = [...raceData.players].sort((a,b) => a.pos - b.pos);
      const last = sorted[0];
      if (last && last.id !== player.id) {
        last.pos += (card.amount || 1);
        player.pos += (card.amount || 1);
        needsRender = true;
      }
      break;
    }
    case 'stepAndShield': player.pos += (card.steps || 2); player._shieldRemaining = (card.shield || 2); needsRender = true; break;
    default: return;
  }
  
  if (needsRender && typeof RaceEvents.renderTracks === 'function' && sessionId) {
    RaceEvents.renderTracks(sessionId);
  }
}

// ------------------------------------------------------------------
// 5. دوال اختيار بطاقتين مختلفتين (واحدة ضارة وواحدة نفعية) مع منع التكرار
// ------------------------------------------------------------------
export function getRandomCardPair(playerId, raceData) {
    // قوائم البطاقات المتاحة (الضارة والشخصية)
    let availableHarmful = [...CARDS_DATA.harmful];
    let availableSelf = [...CARDS_DATA.self];

    // إذا كان لدى اللاعب سجل بالبطاقات المستخدمة، نستبعدها
    const usedIds = raceData.usedCardIds?.[playerId] || new Set();
    if (usedIds.size > 0) {
        availableHarmful = availableHarmful.filter(c => !usedIds.has(c.id));
        availableSelf = availableSelf.filter(c => !usedIds.has(c.id));
    }

    // إذا لم يتبقَ شيء، نعيد تعيين القوائم (نتجاوز منع التكرار)
    if (availableHarmful.length === 0) availableHarmful = [...CARDS_DATA.harmful];
    if (availableSelf.length === 0) availableSelf = [...CARDS_DATA.self];

    // اختيار بطاقة ضارة عشوائية (مرجحة حسب الوزن)
    const harmfulCard = selectRandomWeighted(availableHarmful);
    // اختيار بطاقة نفعية عشوائية (مرجحة حسب الوزن)
    const selfCard = selectRandomWeighted(availableSelf);

    // تسجيل البطاقات المستخدمة (لتجنب التكرار في المستقبل)
    if (!raceData.usedCardIds) raceData.usedCardIds = {};
    if (!raceData.usedCardIds[playerId]) raceData.usedCardIds[playerId] = new Set();
    raceData.usedCardIds[playerId].add(harmfulCard.id);
    raceData.usedCardIds[playerId].add(selfCard.id);

    return { harmfulCard, selfCard };
}

function selectRandomWeighted(cards) {
    if (cards.length === 0) return null;
    let totalWeight = cards.reduce((sum, c) => sum + (c.weight || 1), 0);
    let rand = Math.random() * totalWeight;
    let accum = 0;
    for (const card of cards) {
        accum += (card.weight || 1);
        if (rand <= accum) return { ...card, type: card.type || (card.effect ? 'harmful' : 'self') };
    }
    return { ...cards[0], type: cards[0].type || 'harmful' };
}