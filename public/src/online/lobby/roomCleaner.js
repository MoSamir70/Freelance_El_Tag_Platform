// src/online/lobby/roomCleaner.js
// حذف الغرف التي مضى عليها وقت طويل دون نشاط

import { db, collection, getDocs, query, where, deleteDoc, writeBatch } from '../../firebase/init.js';

const STALE_TIMEOUT_MS = 30 * 60 * 1000; // 30 دقيقة

export async function cleanStaleRooms() {
    const now = Date.now();
    const cutoff = new Date(now - STALE_TIMEOUT_MS);
    const q = query(collection(db, 'activeRooms'), where('lastActivity', '<', cutoff));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`[RoomCleaner] Deleted ${snapshot.size} stale rooms`);
}