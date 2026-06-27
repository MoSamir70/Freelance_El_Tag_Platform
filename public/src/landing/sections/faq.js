// src/landing/sections/faq.js

const faqs = [
    { q: "ما هي منصة التاج؟", a: "منصة التاج هي نظام تعليمي تفاعلي قائم على التلعيب، يحول التعلم إلى تجربة ممتعة من خلال السباقات والتحديات الجماعية." },
    { q: "كيف يمكنني التسجيل في المنصة؟", a: "يمكنك التسجيل كمعلم أو طالب عبر شاشة الدخول." },
    { q: "هل المنصة مجانية؟", a: "توجد باقة مجانية أساسية، وباقات مدفوعة بمميزات إضافية." },
    { q: "ما هي أنماط اللعب المتاحة؟", a: "9 أوضاع فردية و6 أوضاع جماعية." },
    { q: "كيف يعمل نظام المكافآت؟", a: "بطاقات جوائز تحفز الطالب على التفوق." },
    { q: "هل يمكنني إنشاء غرفة خاصة؟", a: "نعم، يمكنك إنشاء غرفة خاصة برمز دخول." },
    { q: "ما هي ميزة اللعب الجماعي؟", a: "التنافس مع طلاب من مدارس مختلفة." },
    { q: "كيف يتم احتساب النقاط؟", a: "بناءً على صحة الإجابة وسرعتها." },
    { q: "هل يمكن للمعلم متابعة تقدم طلابه؟", a: "نعم، لوحة المعلم توفر إحصائيات تفصيلية." },
    { q: "ما هي تقارير الذكاء الاصطناعي؟", a: "تقارير تحليلية ذكية مع توصيات للتحسين." },
    { q: "كيف أرفع أسئلتي الخاصة؟", a: "رفع ملفات Excel للأسئلة بكل سهولة." },
    { q: "هل يدعم العربية فقط؟", a: "مصمم خصيصاً للغة العربية مع RTL." },
    { q: "كيف أتواصل مع الدعم؟", a: "عبر واتساب أو فيسبوك." },
    { q: "ما هي متطلبات التشغيل؟", a: "هاتف - متصفح (Chrome, Firefox, Safari)." },
    { q: "هل توجد نسخة للجوال؟", a: "نعم، المنصة متجاوبة مع جميع الشاشات." }
];

export function initFaqAccordion() {
    const faqContainer = document.getElementById('faq-container');
    if (!faqContainer) return;
    
    // تفريغ المحتوى القديم إن وجد
    faqContainer.innerHTML = '';
    
    faqs.forEach((faq) => {
        const item = document.createElement('div');
        item.className = 'faq-item glass-card p-4 cursor-pointer transition-all mb-2';
        item.innerHTML = `<div class="faq-question flex justify-between items-center"><span class="font-bold text-lg">📌 ${faq.q}</span><span class="faq-icon text-yellow-400 transition-transform">▼</span></div><div class="faq-answer text-gray-300 pt-2">${faq.a}</div>`;
        
        item.querySelector('.faq-question').addEventListener('click', () => { 
            const isActive = item.classList.contains('active'); 
            document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('active')); 
            if (!isActive) item.classList.add('active'); 
        });
        
        faqContainer.appendChild(item);
    });
}