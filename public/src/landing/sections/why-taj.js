// src/landing/sections/why-taj.js

const sliderStages = [
    { label: '🌱 مبتدئ — الشهر الأول', desc: 'يبدأ الطالب باكتشاف عالم السباقات وجمع أول نقاطه', xp: 120, acc: '55%', rank: '#48' },
    { label: '⚡ متقدم — الشهر الثاني', desc: 'يتحسن الأداء، تزيد دقة الإجابات، ويرتفع الترتيب', xp: 580, acc: '72%', rank: '#24' },
    { label: '🏆 بطل — الشهر الثالث', desc: 'الطالب يتنافس مع أفضل اللاعبين ويتصدر المشهد', xp: 1250, acc: '85%', rank: '#8' },
    { label: '👑 أيقونة — ما بعد 3 أشهر', desc: 'صدارة الترتيب، وسام التاج الذهبي، مثال يحتذى به في الفصل', xp: 3750, acc: '94%', rank: '#1 👑' }
];

export function initProgressSlider() {
    const slider = document.getElementById('progressSlider');
    const progressFill = document.getElementById('progressFill');
    const sliderLabel = document.getElementById('sliderLabel');
    const sliderDesc = document.getElementById('sliderDesc');
    const sliderXP = document.getElementById('sliderXP');
    const sliderAccuracy = document.getElementById('sliderAccuracy');
    const sliderRank = document.getElementById('sliderRank');
    
    if (!slider) return;
    
    function updateSlider(value) {
        if (progressFill) progressFill.style.width = value + '%';
        const idx = value < 25 ? 0 : value < 50 ? 1 : value < 75 ? 2 : 3;
        const s = sliderStages[idx];
        if (sliderLabel) sliderLabel.textContent = s.label;
        if (sliderDesc) sliderDesc.textContent = s.desc;
        if (sliderXP) sliderXP.textContent = s.xp.toLocaleString();
        if (sliderAccuracy) sliderAccuracy.textContent = s.acc;
        if (sliderRank) sliderRank.textContent = s.rank;
    }
    
    slider.addEventListener('input', () => {
        updateSlider(parseInt(slider.value));
    });
    
    updateSlider(20);
}