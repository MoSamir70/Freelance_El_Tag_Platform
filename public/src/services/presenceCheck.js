// src/services/presenceCheck.js
// خدمة التحقق من آخر ظهور للاعب – تُستخدم في مهلة البطولات وفوز الانسحاب

import { db, doc, getDoc, collection, query, where, getDocs, serverTimestamp, updateDoc, setDoc } from '../firebase/init.js';


/**
 * التحقق مما إذا كان اللاعب نشطاً خلال فترة زمنية محددة
 * @param {string} playerId - معرف اللاعب (طالب أو معلم)
 * @param {number} timeoutMs - المهلة بالمللي ثانية (افتراضي 5 دقائق)
 * @returns {Promise<boolean>} - true إذا كان اللاعب نشطاً، false إذا غائب
 */
export async function checkPlayerLastSeen(playerId, timeoutMs = 5 * 60 * 1000) {
    try {
        // 1. محاولة جلب بيانات الحضور من userPresence
        const presenceRef = doc(db, 'userPresence', playerId);
        const presenceSnap = await getDoc(presenceRef);
        
        if (presenceSnap.exists()) {
            const data = presenceSnap.data();
            const lastSeen = data.lastSeen?.toDate ? data.lastSeen.toDate() : (data.lastSeen ? new Date(data.lastSeen) : null);
            const online = data.online === true;
            
            if (online) return true; // متصل حالياً
            
            if (lastSeen) {
                const now = Date.now();
                const diff = now - lastSeen.getTime();
                return diff < timeoutMs;
            }
        }
        
        // 2. إذا لم يكن في userPresence، نبحث في activeRaces (ربما مشارك في سباق ولم يحدث presence)
        const racesQuery = query(
            collection(db, 'activeRaces'),
            where('players', 'array-contains', { id: playerId })
        );
        const racesSnap = await getDocs(racesQuery);
        if (!racesSnap.empty) {
            // يوجد سباق نشط، نعتبره نشطاً
            return true;
        }
        
        // 3. محاولة جلب آخر نشاط من studentStats (حقل lastActive)
        const statsRef = doc(db, 'studentStats', playerId);
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) {
            const lastActive = statsSnap.data().lastActive;
            if (lastActive) {
                const lastActiveDate = lastActive.toDate ? lastActive.toDate() : new Date(lastActive);
                const diff = Date.now() - lastActiveDate.getTime();
                if (diff < timeoutMs) return true;
            }
        }
        
        // 4. افتراض الغياب إذا لم نجد أي دليل على النشاط
        return false;
    } catch (error) {
        console.error(`[presenceCheck] خطأ في التحقق من آخر ظهور للاعب ${playerId}:`, error);
        // في حالة الخطأ، نعتبر اللاعب غائباً لتطبيق المهلة بشكل آمن
        return false;
    }
}

/**
 * الحصول على آخر ظهور للاعب (كنص timestamp)
 * @param {string} playerId
 * @returns {Promise<Date|null>}
 */
export async function getLastSeen(playerId) {
    try {
        const presenceRef = doc(db, 'userPresence', playerId);
        const presenceSnap = await getDoc(presenceRef);
        if (presenceSnap.exists()) {
            const data = presenceSnap.data();
            const lastSeen = data.lastSeen?.toDate ? data.lastSeen.toDate() : (data.lastSeen ? new Date(data.lastSeen) : null);
            if (lastSeen) return lastSeen;
        }
        const statsRef = doc(db, 'studentStats', playerId);
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) {
            const lastActive = statsSnap.data().lastActive;
            if (lastActive) return lastActive.toDate ? lastActive.toDate() : new Date(lastActive);
        }
        return null;
    } catch (error) {
        console.error(`[presenceCheck] خطأ في جلب آخر ظهور للاعب ${playerId}:`, error);
        return null;
    }
}

/**
 * تحديث آخر ظهور للاعب (يمكن استدعاؤها من أي مكان في المنصة)
 * @param {string} playerId
 */
export async function updateLastSeen(playerId) {
    try {
        const presenceRef = doc(db, 'userPresence', playerId);
        const presenceSnap = await getDoc(presenceRef);
        if (presenceSnap.exists()) {
            await updateDoc(presenceRef, { lastSeen: serverTimestamp() });
        } else {
            // إنشاء مستند جديد إذا لم يكن موجوداً
            await setDoc(presenceRef, {
                userId: playerId,
                online: true,
                lastSeen: serverTimestamp(),
                role: 'unknown'
            });
        }
    } catch (error) {
        console.error(`[presenceCheck] خطأ في تحديث آخر ظهور للاعب ${playerId}:`, error);
    }
}

// استيراد serverTimestamp للاستخدام في updateLastSeen
import { serverTimestamp, updateDoc, setDoc } from '../firebase/init.js';