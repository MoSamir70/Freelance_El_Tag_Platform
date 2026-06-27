// src/arena/views/globalChatView.js
// واجهة دردشة عالمية محسّنة للمعلمين (بصمة عصرية)

import { subscribeToGlobalChat, sendGlobalMessage, stopListeningToChat } from '../services/chatService.js';
import { renderChatMessage } from '../components/chatMessage.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';

let unsubscribe = null;
let messagesContainer = null;
let inputField = null;
let sendBtn = null;
let loadingIndicator = null;

export async function render(container, currentUser, role) {
    // التحقق من الصلاحيات
    if (!role.isTeacher) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <i class="fas fa-lock text-6xl text-red-500 mb-4"></i>
                <h3 class="text-xl font-bold text-white">⛔ غير مصرح</h3>
                <p class="text-gray-400 mt-2">الدردشة العالمية متاحة للمعلمين فقط</p>
            </div>
        `;
        return;
    }
    
    const teacherPlan = sessionStorage.getItem('teacher_plan') || 'free';
    if (teacherPlan === 'free') {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <i class="fas fa-gem text-6xl text-yellow-500 mb-4"></i>
                <h3 class="text-xl font-bold text-white">🔒 باقة مجانية</h3>
                <p class="text-gray-400 mt-2">الدردشة العالمية متاحة للمعلمين المشتركين في الباقات المدفوعة</p>
                <button id="upgrade-btn" class="mt-4 bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-2 rounded-full font-bold transition">✨ ترقية الآن</button>
            </div>
        `;
        document.getElementById('upgrade-btn')?.addEventListener('click', () => {
            window.open('index.html#pricing', '_blank');
        });
        return;
    }
    
    // بناء الواجهة
    container.innerHTML = `
        <div class="flex flex-col h-full min-h-[500px] bg-gradient-to-b from-slate-800/30 to-slate-900/30 rounded-2xl overflow-hidden border border-white/10">
            <!-- رأس الدردشة -->
            <div class="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 p-4 border-b border-white/10">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-bold text-yellow-400">
                            <i class="fas fa-comments ml-2"></i> دردشة المعلمين
                        </h3>
                        <p class="text-xs text-gray-400 mt-1">تواصل مع زملائك المعلمين في المنصة</p>
                    </div>
                    <div id="online-teachers-count" class="bg-green-500/20 px-3 py-1 rounded-full text-sm">
                        <i class="fas fa-circle text-green-400 text-xs ml-1"></i>
                        <span>0 متصل</span>
                    </div>
                </div>
            </div>
            
            <!-- منطقة الرسائل -->
            <div id="chat-messages-area" class="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20" style="max-height: 400px; min-height: 350px;"></div>
            
            <!-- منطقة الكتابة -->
            <div class="p-4 border-t border-white/10 bg-white/5">
                <div class="flex gap-2 items-end">
                    <div class="flex-1 relative">
                        <textarea id="chat-input" rows="1" placeholder="اكتب رسالتك هنا..." class="w-full bg-slate-800/80 rounded-2xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none placeholder:text-gray-500"></textarea>
                        <div id="typing-indicator" class="absolute -top-5 left-2 text-xs text-gray-400 hidden">✍️ جاري الكتابة...</div>
                    </div>
                    <button id="send-chat-btn" class="bg-yellow-500 hover:bg-yellow-400 text-black w-10 h-10 rounded-full flex items-center justify-center transition transform hover:scale-105">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="text-[10px] text-gray-500 mt-2 text-center">
                    <i class="fas fa-shield-alt"></i> رسائلك مرسلة بشكل آمن ومرئية لجميع المعلمين المسجلين
                </div>
            </div>
        </div>
    `;
    
    messagesContainer = document.getElementById('chat-messages-area');
    inputField = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-chat-btn');
    
    // تهيئة الـ textarea (توسع تلقائي)
    autoResizeTextarea(inputField);
    
    // إرسال الرسالة
 const sendMessage = async () => {
    const text = inputField.value.trim();
    if (!text) return;
    try {
        await sendGlobalMessage(text);
        inputField.value = '';
        autoResizeTextarea(inputField);
        // ✅ إخفاء مؤشر الكتابة
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.classList.add('hidden');
        if (typingTimeout) clearTimeout(typingTimeout);
        setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
        showFloatingNotification(err.message, 'error');
    }
};
    sendBtn.addEventListener('click', sendMessage);
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // تفعيل مؤشر الكتابة (بسيط)
    let typingTimeout;
    inputField.addEventListener('input', () => {
        const indicator = document.getElementById('typing-indicator');
        indicator.classList.remove('hidden');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            indicator.classList.add('hidden');
        }, 1000);
    });
    
    // الاشتراك في تحديثات الدردشة
    if (unsubscribe) unsubscribe();
    unsubscribe = subscribeToGlobalChat((message) => {
        if (!messagesContainer) return;
        const isCurrentUser = (message.userId === currentUser.id);
        const msgElement = renderChatMessage(message, isCurrentUser);
        messagesContainer.appendChild(msgElement);
        scrollToBottom();
    });
    
    // تحديث عدد المتصلين (يمكن إضافته لاحقاً)
    updateOnlineTeachersCount();
    const onlineInterval = setInterval(updateOnlineTeachersCount, 30000);
    
    // تنظيف عند مغادرة الصفحة
    const cleanup = () => {
        clearInterval(onlineInterval);
        if (unsubscribe) unsubscribe();
        stopListeningToChat();
    };
    window.addEventListener('beforeunload', cleanup);
    
    // حفظ دالة التنظيف للتدمير لاحقاً
    return cleanup;
}

function scrollToBottom() {
    if (messagesContainer) {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
}

async function updateOnlineTeachersCount() {
    try {
        const { getOnlineUsers } = await import('../../online/presence/presenceManager.js');
        const users = await getOnlineUsers();
        const teachersOnline = users.filter(u => u.role === 'teacher').length;
        const countEl = document.getElementById('online-teachers-count');
        if (countEl) {
            countEl.innerHTML = `<i class="fas fa-circle text-green-400 text-xs ml-1"></i> <span>${teachersOnline} متصل</span>`;
        }
    } catch (err) {
        console.warn('Failed to fetch online teachers:', err);
    }
}

export function destroy() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    stopListeningToChat();
}