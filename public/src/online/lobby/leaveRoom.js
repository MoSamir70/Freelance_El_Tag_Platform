// src/online/lobby/leaveRoom.js
// مغادرة الغرفة وحذفها إذا كان المغادر هو المضيف
// ✅ تم إصلاح مشكلة showToast غير المعرفة
// ✅ تم استبدال showToast بـ showFloatingNotification من utils

import { deleteDocumentWithRetry, getDocumentOnce, updateDocumentWithRetry } from '../core/firestoreSync.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

/**
 * مغادرة الغرفة الحالية
 * @param {string} roomId 
 * @returns {Promise<{success: boolean}>}
 */
export async function leaveRoom(roomId) {
    const user = await getCurrentUserInfo();
    if (!user) return { success: false };

    const room = await getDocumentOnce(`activeRooms/${roomId}`);
    if (!room) return { success: true }; // الغرفة غير موجودة أصلاً

    const isHost = (room.hostId === user.id);
    
    if (isHost) {
        // المضيف يغادر → حذف الغرفة بالكامل
        await deleteDocumentWithRetry(`activeRooms/${roomId}`);
        showFloatingNotification('تم حذف الغرفة لأنك المضيف', 'info');
    } else {
        // لاعب عادي يغادر → إزالته من قائمة اللاعبين
        const updatedPlayers = room.players.filter(p => p.id !== user.id);
        await updateDocumentWithRetry(`activeRooms/${roomId}`, { players: updatedPlayers });
        showFloatingNotification('تم مغادرة الغرفة', 'info');
    }
    return { success: true };
}