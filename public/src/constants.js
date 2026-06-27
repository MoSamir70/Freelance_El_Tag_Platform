// src/constants.js

// ⚠️ IMPORTANT: في بيئة الإنتاج، يجب تعيين كود المطور عبر متغيرات البيئة
// للتطوير المحلي، يمكنك ترك القيمة الافتراضية، لكن لا تستخدمها في الإنتاج

export const DEFAULT_IMG = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
export const TEACHER_IMG = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

// كود المطور - يمكن تغييره عبر localStorage (للتطوير) أو عبر متغيرات البيئة لاحقاً
export const DEVELOPER_CODES = (() => {
  // محاولة قراءة من localStorage (يتيح للمطور تغيير الكود دون تعديل الملف)
  try {
    const savedCodes = localStorage.getItem('dev_codes');
    if (savedCodes) {
      const parsed = JSON.parse(savedCodes);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch(e) { /* تجاهل الأخطاء */ }
  
  // قيمة افتراضية للتطوير فقط – يجب تغييرها قبل الإنتاج!
  // التحقق من وجود خاصية تحدد بيئة التطوير (مثل hostname أو وجود متغير مخصص)
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isDev) {
    console.warn('⚠️ DEVELOPMENT MODE: using default developer code 12345. Change this before production!');
  }
  return [12345];
})();

export const DEFAULT_GRADES = [
    "الأول الابتدائي", "الثاني الابتدائي", "الثالث الابتدائي", "الرابع الابتدائي",
    "الخامس الابتدائي", "السادس الابتدائي", "الأول الإعدادي", "الثاني الإعدادي",
    "الثالث الإعدادي", "الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"
];

export const LEVELS = [
    { min: 0, max: 999, name: "مبتدئ", icon: "🌱" },
    { min: 1000, max: 1999, name: "صاعد", icon: "📈" },
    { min: 2000, max: 2999, name: "طموح", icon: "⭐" },
    { min: 3000, max: 3999, name: "متقدم", icon: "⚡" },
    { min: 4000, max: 4999, name: "محترف", icon: "💪" },
    { min: 5000, max: 5999, name: "خبير", icon: "🧠" },
    { min: 6000, max: 6999, name: "نابغة", icon: "🎓" },
    { min: 7000, max: 7999, name: "أسطورة", icon: "🏆" },
    { min: 8000, max: 8999, name: "خرافي", icon: "🦸" },
    { min: 9000, max: Infinity, name: "أيقونة", icon: "👑" }
];

export const soloModes = [
    { id: 'solo_classic', name: 'الكلاسيكي', icon: '⚡', desc: 'تقدم/تراجع خطوة.' },
    { id: 'solo_memory', name: 'تحدي الذاكرة', icon: '🧠', desc: 'يختفي السؤال بعد ثوانٍ.' },
    { id: 'solo_mined', name: 'اللغز الملغوم', icon: '💣', desc: 'سؤال ملغوم (+2/-3).' },
    { id: 'solo_bet', name: 'المراهنة', icon: '🎲', desc: 'راهن قبل كل سؤال.' },
    { id: 'solo_speedrun', name: 'سباق السرعة', icon: '⏱️', desc: 'وقت يقل مع التقدم.' },
    { id: 'solo_marathon', name: 'ماراثون', icon: '🏃', desc: 'أسئلة متتالية لطالب واحد' },
    { id: 'solo_survival', name: 'البقاء للأذكى', icon: '🛡️', desc: '3 قلوب، الخطأ ينقص.' },
    { id: 'solo_quizrush', name: 'تحدي اللاخطأ', icon: '💥', desc: 'الصح بنقطة، الخطأ يرجعك للصفر.' },
    { id: 'solo_surprise', name: '🎲 المفاجآت', icon: '🃏', desc: 'بطاقات عشوائية تغير مجرى السباق' },
    {
        id: 'solo_magnet',
        name: 'وضع الجذب',
        icon: '🧲',
        desc: 'الإجابات الصحيحة تسحب اللاعبين الآخرين خطوة للخلف',
        comingSoon: true
    },
    {
        id: 'solo_disguise',
        name: 'وضع التنكر',
        icon: '🎭',
        desc: 'تتبادل مراكزك مع أحد المنافسين عشوائياً بعد كل 3 أسئلة',
        comingSoon: true
    },
    {
        id: 'solo_aim',
        name: 'وضع الرمية',
        icon: '🎯',
        desc: 'تختار صعوبة السؤال بنفسك (سهل=خطوة، صعب=3 خطوات)',
        comingSoon: true
    },
    {
        id: 'solo_shadow',
        name: 'وضع الظل',
        icon: '👤',
        desc: 'نسخة مظلمة تتقدم خلفك وتنافسك',
        comingSoon: true
    },
    {
        id: 'solo_circus',
        name: 'وضع السيرك',
        icon: '🤹',
        desc: 'تأثيرات عشوائية مضحكة بين كل جولة',
        comingSoon: true
    }
];


export const teamModes = [
    { id: 'team_relay', name: 'سباق التتابع', icon: '🏃', desc: 'الأعضاء يتناوبون.' },
    { id: 'team_battle', name: 'حرب الفرق', icon: '⚔️', desc: 'الخطأ يعطي المنافس نقطة.' },
    { id: 'team_trophy', name: 'الكأس المتجول', icon: '🏆', desc: 'الكأس ينتقل.' },
    { id: 'team_mined', name: 'حقل الألغام', icon: '💣', desc: 'ألغام تخصم 4 نقاط.' },
    { id: 'team_revenge', name: 'ثأر الفرسان', icon: '🔥', desc: 'سرقة نقاط.' },
    { id: 'team_penalty', name: 'قانون العقوبات', icon: '⚖️', desc: 'الخطأ يعطي الجميع نقطة.' },
    {
        id: 'team_elimination_relay',
        name: 'التتابع الإقصائي',
        icon: '🔄',
        desc: 'ترتيب محدد، من يخطئ يُستبعد. الفريق يكمل بمن تبقى.',
        comingSoon: true
    },
    {
        id: 'team_collective_puzzle',
        name: 'لغز العقل الجمعي',
        icon: '🧩',
        desc: 'كل عضو يرى جزءاً من السؤال. اجمعوا الأجزاء للإجابة.',
        comingSoon: true
    },
    {
        id: 'team_strategic_sacrifice',
        name: 'التضحية الاستراتيجية',
        icon: '🛡️',
        desc: 'تضحية بعضو لإنقاذ زميله. قرار تكتيكي عالي التأثير.',
        comingSoon: true
    },
    {
        id: 'team_memory',
        name: 'ذاكرة الفريق',
        icon: '🧠',
        desc: 'يتذكر الفريق الإجابة بعد اختفاء السؤال، مع موارد محدودة للاستدعاء.',
        comingSoon: true
    }
];

export const WINNER_MESSAGES = [
    "🏆 هنيئاً لك هذا الفوز العظيم، لقد أثبت جدارتك.",
    "👑 توجت جهودك بالنجاح، فأنت بطل المنصة اليوم.",
    "🌟 تألقت فأبدعت، فكان الفوز حليفك بكل استحقاق.",
    "📚 العلم يرفع أهله، وأنت اليوم في القمة.",
    "💪 إصرارك أوصلك، فخورون بك أيها البطل.",
    "✨ أثلجت صدورنا بهذا الفوز المشرف.",
    "🎖️ استحققت الوسام، فقد كنت مثالاً للتفوق.",
    "🔥 نار التحدي لم تثنك، فكنت أنت المنتصر.",
    "❄️ بعقل متقد وثقة، حصدت أعلى المراتب.",
    "🏅 فوزك اليوم ثمرة اجتهادك، فدام تألقك."
];