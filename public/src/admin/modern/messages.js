// src/admin/modern/messages.js
// مركز المراسلات الإدارية – مع دعم صلاحيات المساعدين

import { db, collection, doc, getDocs, query, where, orderBy, addDoc, updateDoc, writeBatch, serverTimestamp } from '../../firebase/init.js';
import { getTeachersList } from '../../firebase/auth.js';
import { escapeHtml, showNotification, addAuditLog, MESSAGES_SWAL_CONFIG, currentChatTeacherId, messagesRefreshInterval, hasPermission, applyUIPermissions } from './utils.js';

// ========== الدوال الرئيسية ==========
export async function renderMessages() {
    if (!hasPermission('messages', 'view')) {
        document.getElementById('messagesPane').innerHTML = `
            <div class="glass-card p-5 text-center">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <h3 class="text-xl font-bold text-red-400">غير مصرح</h3>
                <p class="text-gray-400">ليس لديك صلاحية لعرض المراسلات.</p>
            </div>`;
        return;
    }
    const pane = document.getElementById('messagesPane');
    if (!pane) return;
    try {
        const messagesSnapshot = await getDocs(query(collection(db, 'messages'), orderBy('timestamp', 'desc')));
        const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const unreadCount = messages.filter(m => !m.read && m.to !== 'admin').length;
        pane.innerHTML = buildMessagesCenterLayout(unreadCount);
        await buildConversationsList(messages);
        if (hasPermission('messages', 'reply')) {
            document.getElementById('newGlobalMsgBtn')?.addEventListener('click', () => showComposeModal('all'));
            document.getElementById('newDirectMsgBtn')?.addEventListener('click', () => showComposeModal('teacher'));
            document.getElementById('sendReplyBtn')?.addEventListener('click', handleChatReplySubmit);
        } else {
            document.getElementById('newGlobalMsgBtn')?.remove();
            document.getElementById('newDirectMsgBtn')?.remove();
            document.getElementById('sendReplyBtn')?.remove();
        }
        initMessagesPollingInterval();
        applyUIPermissions();
    } catch (error) {
        console.error("Error rendering messages center:", error);
    }
}

export async function buildConversationsList(preFetchedMessages = null) {
    if (!hasPermission('messages', 'view')) return;
    const container = document.getElementById('conversationsList');
    if (!container) return;
    const [teachers, messagesSnapshot] = await Promise.all([
        getTeachersList(),
        preFetchedMessages ? null : getDocs(query(collection(db, 'messages'), orderBy('timestamp', 'desc')))
    ]);
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.name]));
    const messages = preFetchedMessages || messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const convMap = new Map();
    messages.forEach(m => {
        const otherParty = m.from === 'admin' ? m.to : m.from;
        if (otherParty === 'admin') return;
        if (!convMap.has(otherParty)) {
            convMap.set(otherParty, { id: otherParty, name: teacherMap[otherParty] || otherParty, lastMsg: m, unread: 0 });
        }
        if (!m.read && m.to === 'admin') convMap.get(otherParty).unread++;
    });
    const sortedConvs = Array.from(convMap.values()).sort((a, b) => {
        const timeA = a.lastMsg.timestamp?.toMillis ? a.lastMsg.timestamp.toMillis() : (a.lastMsg.timestamp || 0);
        const timeB = b.lastMsg.timestamp?.toMillis ? b.lastMsg.timestamp.toMillis() : (b.lastMsg.timestamp || 0);
        return timeB - timeA;
    });
    container.innerHTML = sortedConvs.map(c => buildConversationItemTemplate(c)).join('');
    container.querySelectorAll('.conv-item').forEach(item => {
        item.addEventListener('click', () => {
            const teacherId = item.dataset.id;
            if (teacherId) loadChat(teacherId);
        });
    });
}

export async function loadChat(teacherId) {
    if (!hasPermission('messages', 'view')) return;
    if (!teacherId) return;
    window.currentChatTeacherId = teacherId;
    try {
        const teachers = await getTeachersList();
        const teacher = teachers.find(t => t.id === teacherId);
        const chatQuery = query(
            collection(db, 'messages'),
            where('to', 'in', ['admin', teacherId]),
            where('from', 'in', ['admin', teacherId])
        );
        const messagesSnapshot = await getDocs(chatQuery);
        const chatMessages = messagesSnapshot.docs
            .map(doc => doc.data())
            .filter(m => (m.from === 'admin' && m.to === teacherId) || (m.from === teacherId && m.to === 'admin'))
            .sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
                return timeA - timeB;
            });
        const chatMessagesContainer = document.getElementById('chatMessages');
        if (chatMessagesContainer) {
            chatMessagesContainer.innerHTML = chatMessages.map(m => buildMessageBubbleTemplate(m)).join('');
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }
        document.getElementById('chatHeader').innerHTML = `<i class="fas fa-user-circle ml-2 text-xl text-gray-400"></i> ${escapeHtml(teacher?.name || teacherId)}`;
        if (hasPermission('messages', 'reply')) {
            document.getElementById('chatReplyArea').classList.remove('hidden');
        } else {
            document.getElementById('chatReplyArea').classList.add('hidden');
        }
        await markChatAsRead(teacherId);
    } catch (error) {
        console.error("Error loading chat:", error);
    }
}

export async function handleChatReplySubmit() {
    if (!hasPermission('messages', 'reply')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية للرد على الرسائل', 'error');
        return;
    }
    if (!window.currentChatTeacherId) return;
    const replyInput = document.getElementById('replyText');
    const content = replyInput?.value.trim();
    if (!content) return;
    try {
        await addDoc(collection(db, 'messages'), {
            from: 'admin',
            fromName: 'الإدارة',
            to: window.currentChatTeacherId,
            subject: 'رد من الإدارة',
            content: content,
            timestamp: serverTimestamp(),
            read: false
        });
        replyInput.value = '';
        await loadChat(window.currentChatTeacherId);
        await buildConversationsList();
    } catch (error) {
        console.error("Error sending reply:", error);
    }
}

export async function showComposeModal(type) {
    if (!hasPermission('messages', 'reply')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لإرسال رسائل', 'error');
        return;
    }
    const teachers = await getTeachersList();
    const modalFieldsHtml = type === 'teacher'
        ? `<select id="targetTeacher" class="swal2-select w-full bg-slate-800 border border-gray-700 rounded-xl p-2 text-white outline-none">${teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>`
        : `<div class="text-right mt-2 flex gap-6 justify-center bg-slate-900/40 p-3 rounded-xl border border-gray-800">
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="chkGold" class="accent-indigo-500" checked> 👑 ذهبي</label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="chkSilver" class="accent-indigo-500" checked> 🥈 فضي</label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="chkFree" class="accent-indigo-500"> 🥉 مجاني</label>
        </div>`;
    const { value: formResult } = await Swal.fire({
        ...MESSAGES_SWAL_CONFIG,
        title: type === 'all' ? '📢 إعلان جماعي للمعلّمين' : '📨 رسالة خاصة لمعلّم',
        html: `<div class="space-y-3 text-right" dir="rtl">
            <input id="msgSubject" class="w-full bg-slate-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500 text-sm" placeholder="عنوان الرسالة الرئيسي">
            <textarea id="msgContent" class="w-full h-32 bg-slate-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500 text-sm" placeholder="اكتب محتوى تفاصيل الرسالة هنا..."></textarea>
            ${modalFieldsHtml}
        </div>`,
        confirmButtonText: 'إرسال الرسالة الآن',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        customClass: { popup: 'rounded-3xl border border-white/5' },
        preConfirm: () => {
            const subject = document.getElementById('msgSubject').value.trim();
            const content = document.getElementById('msgContent').value.trim();
            if (!subject || !content) {
                Swal.showValidationMessage('يرجى ملء جميع الحقول المطلوبة لبدء الإرسال');
                return false;
            }
            return {
                subject,
                content,
                target: type === 'teacher'
                    ? document.getElementById('targetTeacher').value
                    : {
                        gold: document.getElementById('chkGold').checked,
                        silver: document.getElementById('chkSilver').checked,
                        free: document.getElementById('chkFree').checked
                    }
            };
        }
    });
    if (!formResult) return;
    let recipients = [];
    if (type === 'teacher') {
        recipients = [formResult.target];
    } else {
        recipients = teachers
            .filter(t => (formResult.target.gold && t.plan === 'gold') ||
                (formResult.target.silver && t.plan === 'silver') ||
                (formResult.target.free && t.plan === 'free'))
            .map(t => t.id);
    }
    if (recipients.length === 0) {
        Swal.fire({ ...MESSAGES_SWAL_CONFIG, icon: 'warning', title: 'تنبيه', text: 'لم يتم تحديد أي مستلمين متوافقين مع الفلتر الحالي' });
        return;
    }
    try {
        const batch = writeBatch(db);
        recipients.forEach(recId => {
            const newMsgRef = doc(collection(db, 'messages'));
            batch.set(newMsgRef, {
                from: 'admin',
                fromName: 'الإدارة',
                to: recId,
                subject: formResult.subject,
                content: formResult.content,
                timestamp: serverTimestamp(),
                read: false
            });
        });
        await batch.commit();
        await addAuditLog('إرسال مراسلات إدارية', `إلى ${recipients.length} مستلم - نوع: ${type}`);
        Swal.fire({ ...MESSAGES_SWAL_CONFIG, icon: 'success', title: 'تم الإرسال بنجاح', text: `تم تسليم الرسالة إلى (${recipients.length}) مستلم` });
        showNotification(`📢 تم إرسال الرسائل الإدارية بنجاح`, 'success');
        await renderMessages();
    } catch (error) {
        console.error("Error executing message batch write:", error);
        Swal.fire({ ...MESSAGES_SWAL_CONFIG, icon: 'error', title: 'فشل الإرسال', text: error.message });
    }
}

// ========== دوال مساعدة (UI) ==========
function buildMessagesCenterLayout(unreadCount) {
    const unreadBadge = unreadCount ? `<span class="bg-red-500 text-[10px] px-2 py-0.5 rounded-full animate-pulse font-mono mr-2">${unreadCount} جديد</span>` : '';
    return `
        <div class="glass-card p-6" dir="rtl">
            <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                <h3 class="text-2xl font-bold text-white flex items-center gap-2">
                    <i class="fas fa-comments text-indigo-500"></i>
                    <span>مركز المراسلات الإدارية</span>
                    ${unreadBadge}
                </h3>
                <div class="flex gap-2">
                    <button id="newGlobalMsgBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5" data-perm="messages.reply"><i class="fas fa-bullhorn"></i> إعلان عام</button>
                    <button id="newDirectMsgBtn" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5" data-perm="messages.reply"><i class="fas fa-paper-plane"></i> رسالة خاصة</button>
                </div>
            </div>
            <div class="flex h-[580px] bg-black/30 rounded-3xl overflow-hidden border border-white/5">
                <div class="w-1/3 border-l border-white/5 overflow-y-auto p-4 space-y-1" id="conversationsList"></div>
                <div class="w-2/3 flex flex-col bg-gray-900/30">
                    <div id="chatHeader" class="p-4 border-b border-white/5 font-bold text-indigo-400 text-sm flex items-center gap-2 bg-black/10">اختر محادثة من القائمة لبدء التصفح</div>
                    <div id="chatMessages" class="flex-1 p-6 overflow-y-auto flex flex-col space-y-3 bg-slate-950/20"></div>
                    <div id="chatReplyArea" class="p-4 bg-slate-900/60 border-t border-white/5 hidden flex gap-3 items-center">
                        <textarea id="replyText" class="flex-1 bg-black/40 border border-gray-700/60 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-12 transition" placeholder="اكتب رد الإدارة هنا..."></textarea>
                        <button id="sendReplyBtn" class="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 rounded-xl text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20" data-perm="messages.reply">إرسال</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function buildConversationItemTemplate(c) {
    const isSelected = window.currentChatTeacherId === c.id;
    const unreadBadge = c.unread ? `<span class="bg-indigo-500 text-[10px] font-bold px-2 py-0.5 rounded-full text-white font-mono">${c.unread}</span>` : '';
    return `
        <div class="conv-item p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-all duration-200 border border-transparent ${isSelected ? 'bg-indigo-600/10 border-indigo-500/30 active' : 'mb-1'}" data-id="${c.id}">
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-white text-sm truncate max-w-[80%]">${escapeHtml(c.name)}</span>
                ${unreadBadge}
            </div>
            <div class="text-xs text-gray-400 truncate font-normal">${escapeHtml(c.lastMsg.content)}</div>
        </div>
    `;
}

function buildMessageBubbleTemplate(m) {
    const isAdmin = m.from === 'admin';
    const bubbleClass = isAdmin ? 'bg-indigo-600/20 border border-indigo-500/20 mr-auto text-right' : 'bg-slate-800/60 border border-slate-700/30 ml-auto text-right';
    const timestampMillis = m.timestamp?.toMillis ? m.timestamp.toMillis() : (m.timestamp || Date.now());
    const timeString = new Date(timestampMillis).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return `
        <div class="msg-bubble p-3 rounded-2xl max-w-[75%] shadow-md ${bubbleClass}">
            <div class="text-[10px] text-gray-400 font-medium mb-1 pb-1 border-b border-white/5 flex justify-between items-center gap-4">
                <span class="font-bold text-indigo-400">${escapeHtml(m.fromName)}</span>
                <span class="font-mono text-gray-500">${timeString}</span>
            </div>
            <div class="font-bold text-white text-xs mb-1">${escapeHtml(m.subject)}</div>
            <div class="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">${escapeHtml(m.content)}</div>
        </div>
    `;
}

async function markChatAsRead(teacherId) {
    const unreadQuery = query(collection(db, 'messages'), where('to', '==', 'admin'), where('from', '==', teacherId), where('read', '==', false));
    const unreadSnap = await getDocs(unreadQuery);
    if (!unreadSnap.empty) {
        const batch = writeBatch(db);
        unreadSnap.forEach(docSnap => batch.update(docSnap.ref, { read: true }));
        await batch.commit();
        await buildConversationsList();
    }
}

function initMessagesPollingInterval() {
    if (window.messagesRefreshInterval) clearInterval(window.messagesRefreshInterval);
    window.messagesRefreshInterval = setInterval(async () => {
        const pane = document.getElementById('messagesPane');
        if (pane && pane.classList.contains('active-tab')) {
            await buildConversationsList();
            if (window.currentChatTeacherId) await loadChat(window.currentChatTeacherId);
        }
    }, 5000);
}