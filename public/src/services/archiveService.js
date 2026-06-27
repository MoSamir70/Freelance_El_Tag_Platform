// src/services/archiveService.js
import { db, collection, getDocs, writeBatch, serverTimestamp } from '../firebase/init.js';
import { addAuditLog } from './auditLog.js';

const ARCHIVE_DAYS = 7;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function archiveOldTournaments() {
    const now = Date.now();
    const cutoffDate = new Date(now - (ARCHIVE_DAYS * 24 * 60 * 60 * 1000));

    const tournamentsRef = collection(db, 'tournaments');
    const snapshot = await getDocs(tournamentsRef);

    const toArchive = [];
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.status === 'finished' && data.finishedAt) {
            const finishedDate = data.finishedAt.toDate ? data.finishedAt.toDate() : new Date(data.finishedAt);
            if (finishedDate < cutoffDate) {
                toArchive.push({ id: docSnap.id, ...data });
            }
        }
    }

    if (toArchive.length === 0) return;

    const batch = writeBatch(db);
    for (const tournament of toArchive) {
        const archivedRef = doc(db, 'archivedTournaments', tournament.id);
        batch.set(archivedRef, {
            ...tournament,
            archivedAt: serverTimestamp(),
            originalCollection: 'tournaments'
        });
        const originalRef = doc(db, 'tournaments', tournament.id);
        batch.delete(originalRef);
    }

    await batch.commit();
    await addAuditLog('أرشفة تلقائية', `تم أرشفة ${toArchive.length} بطولة منتهية`);
    console.log(`[Archive] تم أرشفة ${toArchive.length} بطولة`);
}

let archiveInterval = null;
export function startArchiveService() {
    if (archiveInterval) clearInterval(archiveInterval);
    archiveInterval = setInterval(() => {
        archiveOldTournaments().catch(err => console.error('[ArchiveService] Error:', err));
    }, CHECK_INTERVAL_MS);
    console.log('[ArchiveService] بدأت خدمة الأرشفة التلقائية');
}

export function stopArchiveService() {
    if (archiveInterval) {
        clearInterval(archiveInterval);
        archiveInterval = null;
    }
}