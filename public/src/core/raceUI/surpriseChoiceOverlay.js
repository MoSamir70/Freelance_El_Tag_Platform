// src/core/raceUI/surpriseChoiceOverlay.js
import { escapeHtml } from '../../utils.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

export function showChoiceOverlay(sessionId, harmfulCard, selfCard, raceData, playerId) {
    return new Promise((resolve) => {
        let resolved = false;
        const overlay = document.createElement('div');
        overlay.id = 'surprise-choice-overlay';
        overlay.className = 'fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 backdrop-blur-md';
        overlay.style.direction = 'rtl';

        overlay.innerHTML = `
            <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-4 w-[90%] max-w-md border-2 border-yellow-500 shadow-2xl animate-fade-in-up">
                <div class="text-center mb-3">
                    <div class="text-3xl mb-1">🎲 بطاقة المفاجأة!</div>
                    <div class="text-sm text-yellow-400">اختر إحدى البطاقتين</div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="choice-card harmful-card p-3 rounded-2xl bg-red-900/40 border border-red-500 cursor-pointer transition-transform hover:scale-105 text-center" data-type="harmful">
                        <div class="text-4xl mb-1">${escapeHtml(harmfulCard.name.split(' ')[0])}</div>
                        <div class="font-bold text-red-300 text-sm">${escapeHtml(harmfulCard.name)}</div>
                        <div class="text-xs text-gray-300 mt-1">${escapeHtml(harmfulCard.desc)}</div>
                    </div>
                    <div class="choice-card self-card p-3 rounded-2xl bg-green-900/40 border border-green-500 cursor-pointer transition-transform hover:scale-105 text-center" data-type="self">
                        <div class="text-4xl mb-1">${escapeHtml(selfCard.name.split(' ')[0])}</div>
                        <div class="font-bold text-green-300 text-sm">${escapeHtml(selfCard.name)}</div>
                        <div class="text-xs text-gray-300 mt-1">${escapeHtml(selfCard.desc)}</div>
                    </div>
                </div>
                <div class="flex justify-center mt-4">
                    <button class="cancel-choice bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-full text-sm transition">تخطي (لا شيء)</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const handleChoice = (type) => {
            if (resolved) return;
            resolved = true;
            overlay.remove();
            if (type === 'harmful') {
                resolve({ type: 'harmful', card: harmfulCard });
            } else if (type === 'self') {
                resolve({ type: 'self', card: selfCard });
            } else {
                resolve(null);
            }
        };

        overlay.querySelectorAll('.choice-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = card.dataset.type;
                handleChoice(type);
            });
        });

        const cancelBtn = overlay.querySelector('.cancel-choice');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => handleChoice(null));
        }

        setTimeout(() => {
            if (!resolved) {
                handleChoice(null);
                showFloatingNotification('⌛ انتهى وقت الاختيار', 'info', 1500);
            }
        }, 15000);
    });
}