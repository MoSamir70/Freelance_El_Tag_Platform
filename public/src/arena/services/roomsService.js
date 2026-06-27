// src/arena/services/roomsService.js
// خدمات جلب الغرف النشطة مع دعم التصفية حسب المعلم أو المنصة
// + فلترة الغرف الميتة (التي انقطع مضيفها أو انتهت صلاحيتها)

import { db, collection, query, where, onSnapshot, getDocs } from '../../firebase/init.js';
import { getDocumentOnce } from '../../online/core/firestoreSync.js';

// المدة التي بعدها تعتبر الغرفة ميتة (30 دقيقة)
const STALE_ROOM_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * التحقق من أن الغرفة لا تزال نشطة (مضيفها متصل أو لم تمر مدة طويلة)
 * @param {object} room
 * @returns {boolean}
 */
function isRoomActive(room) {
    // إذا كانت الغرفة في حالة انتهت (finished) لا تظهر
    if (room.status === 'finished') return false;
    
    // التحقق من آخر نشاط (lastActivity)
    if (room.lastActivity) {
        const lastActivity = room.lastActivity.toDate ? room.lastActivity.toDate() : new Date(room.lastActivity);
        const now = Date.now();
        if (now - lastActivity.getTime() > STALE_ROOM_TIMEOUT_MS) {
            return false; // الغرفة قديمة
        }
    } else {
        // إذا لم يوجد lastActivity، نستخدم createdAt
        if (room.createdAt) {
            const createdAt = room.createdAt.toDate ? room.createdAt.toDate() : new Date(room.createdAt);
            if (Date.now() - createdAt.getTime() > STALE_ROOM_TIMEOUT_MS) {
                return false;
            }
        }
    }
    return true;
}

/**
 * بدء الاستماع الحي لقائمة الغرف مع إمكانية التصفية
 * @param {object} role - كائن الدور من roleDetector
 * @param {string} filter - 'teacher', 'platform', 'all'
 * @param {Function} callback - (rooms) => {}
 * @returns {Function} دالة إلغاء الاشتراك
 */
export function subscribeToRooms(role, filter, callback) {
    let q;
    const teacherId = role.isTeacher ? role.id : role.teacherId;
    
    if (filter === 'teacher') {
        q = query(collection(db, 'activeRooms'), where('teacherId', '==', teacherId));
    } else if (filter === 'platform') {
        if (role.isTeacher) {
            q = query(collection(db, 'activeRooms'));
        } else {
            q = query(collection(db, 'activeRooms'), where('grade', '==', role.studentGrade));
        }
    } else {
        if (role.isTeacher) {
            q = query(collection(db, 'activeRooms'));
        } else {
            return subscribeToAllRoomsForStudent(role, callback);
        }
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        let rooms = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            playersCount: doc.data().players?.length || 0,
            spectatorsCount: doc.data().spectators?.length || 0
        }));
        
        // فلترة الغرف الميتة (التي انتهت صلاحيتها)
        rooms = rooms.filter(room => isRoomActive(room));
        
        rooms.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        callback(rooms);
    }, (error) => {
        console.error('[roomsService] subscribe error:', error);
        callback([]);
    });
    return unsubscribe;
}

/**
 * للطالب: دمج غرف معلمه وغرف نفس الصف (بدون تكرار) مع فلترة الغرف الميتة
 */
function subscribeToAllRoomsForStudent(role, callback) {
    const teacherId = role.teacherId;
    const grade = role.studentGrade;
    
    const q1 = query(collection(db, 'activeRooms'), where('teacherId', '==', teacherId));
    const q2 = query(collection(db, 'activeRooms'), where('grade', '==', grade));
    
    let roomsMap = new Map();
    let readyCount = 0;
    let unsub1, unsub2;
    
    const checkComplete = () => {
        if (readyCount === 2) {
            let rooms = Array.from(roomsMap.values());
            // فلترة الغرف الميتة
            rooms = rooms.filter(room => isRoomActive(room));
            rooms.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            callback(rooms);
        }
    };
    
    unsub1 = onSnapshot(q1, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            const data = change.doc.data();
            const room = {
                id: change.doc.id,
                ...data,
                playersCount: data.players?.length || 0,
                spectatorsCount: data.spectators?.length || 0
            };
            if (change.type === 'removed') roomsMap.delete(change.doc.id);
            else roomsMap.set(change.doc.id, room);
        });
        readyCount++;
        checkComplete();
    });
    
    unsub2 = onSnapshot(q2, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            const data = change.doc.data();
            const room = {
                id: change.doc.id,
                ...data,
                playersCount: data.players?.length || 0,
                spectatorsCount: data.spectators?.length || 0
            };
            if (change.type === 'removed') roomsMap.delete(change.doc.id);
            else roomsMap.set(change.doc.id, room);
        });
        readyCount++;
        checkComplete();
    });
    
    return () => {
        unsub1();
        unsub2();
    };
}

/**
 * الحصول على غرفة واحدة (مرة واحدة)
 * @param {string} roomId
 */
export async function getRoomOnce(roomId) {
    return await getDocumentOnce(`activeRooms/${roomId}`);
}

/**
 * حذف غرفة (للمعلم)
 * @param {string} roomId
 */
export async function deleteRoom(roomId) {
    const { deleteDocumentWithRetry } = await import('../../online/core/firestoreSync.js');
    return await deleteDocumentWithRetry(`activeRooms/${roomId}`);
}

/**
 * البحث عن غرفة بواسطة roomId أو PIN
 * @param {string} code - roomId أو رمز PIN
 * @returns {Promise<object|null>}
 */
export async function findRoomByCode(code) {
    if (!code) return null;
    
    // 1. البحث بالمعرّف المباشر (document id)
    const byId = await getDocumentOnce(`activeRooms/${code}`);
    if (byId) return byId;
    
    // 2. البحث بالرمز (PIN)
    try {
        const q = query(collection(db, 'activeRooms'), where('pin', '==', code));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
    } catch (err) {
        console.warn('[roomsService] findRoomByCode pin error:', err);
    }
    return null;
}