// src/arena/components/chatMessage.js
// عرض رسالة واحدة في الدردشة بتصميم عصري

import { escapeHtml } from '../helpers/escapeHtml.js';
import { filterProfanity } from '../../online/chat/chatUtils.js';

export function renderChatMessage(message, isCurrentUser = false) {
    const div = document.createElement('div');
    div.className = `flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''} animate-fadeIn`;
    
    const time = message.timestamp?.toDate ? message.timestamp.toDate() : new Date();
    const formattedTime = time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = time.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const isToday = new Date().toDateString() === time.toDateString();
    const timeString = isToday ? formattedTime : `${formattedDate} ${formattedTime}`;
    
    // تحديد لون خطة المعلم
    let planBadge = '';
    let planColor = '';
    if (message.userPlan === 'gold') {
        planBadge = '<span class="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full text-xs font-bold">ذهبي</span>';
        planColor = 'border-yellow-500/50';
    } else if (message.userPlan === 'silver') {
        planBadge = '<span class="bg-gray-400/20 text-gray-300 px-2 py-0.5 rounded-full text-xs font-bold">فضي</span>';
        planColor = 'border-gray-400/50';
    
} else if (message.userPlan === 'developer') {
    planBadge = '<span class="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full text-xs font-bold">مطور</span>';
    planColor = 'border-purple-500/50';
} else {
    planBadge = '<span class="bg-gray-600/30 text-gray-400 px-2 py-0.5 rounded-full text-xs">مجاني</span>';
}
    
    div.innerHTML = `
        <img src="${message.userImg || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="w-10 h-10 rounded-full object-cover border-2 ${planColor} shadow-md flex-shrink-0" loading="lazy">
        <div class="flex-1 ${isCurrentUser ? 'items-end' : ''}">
            <div class="flex items-center gap-2 flex-wrap ${isCurrentUser ? 'justify-end' : ''}">
                <span class="font-bold text-white text-sm">${escapeHtml(message.userName)}</span>
                ${planBadge}
                <span class="text-[10px] text-gray-500">${timeString}</span>
            </div>
            <div class="mt-1 p-3 rounded-2xl ${isCurrentUser ? 'bg-yellow-500/20 text-white rounded-br-none' : 'bg-white/10 text-gray-200 rounded-bl-none'} break-words max-w-full inline-block">
                ${escapeHtml(message.text)}
            </div>
        </div>
    `;
    
    // إضافة تأثير الظهور
    div.style.animation = 'fadeInUp 0.2s ease-out';
    if (!document.querySelector('#chat-animations')) {
        const style = document.createElement('style');
        style.id = 'chat-animations';
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fadeIn { animation: fadeInUp 0.2s ease-out; }
        `;
        document.head.appendChild(style);
    }
    
    return div;
}