// src/services/roomsService.js
// خدمة إدارة الغرف النشطة – جلب، تصفية، بحث بالكود
// ✅ تم تعديلها لدعم hostId (uid) بدلاً من teacherId للمعلم

import { 
  db, collection, getDocs, getDoc, doc, query, where, 
  onSnapshot, orderBy, limit 
} from '../firebase/init.js';
import { getCurrentUserInfo } from '../firebase/auth.js';

/**
 * الاشتراك الحي لقائمة الغرف النشطة حسب الدور والفلاتر
 * @param {Object} role - معلومات المستخدم (isTeacher, teacherId, studentGrade, plan, id)
 * @param {string} filter - 'teacher', 'platform', 'all'
 * @param {Function} callback - تستقبل مصفوفة الغرف
 * @returns {Function} دالة لإلغاء الاشتراك
 */
export function subscribeToRooms(role, filter, callback) {
  console.log('[roomsService] subscribeToRooms called with filter:', filter, 'role:', role);
  
  // دالة مساعدة لتنفيذ الاستعلام وإرجاع النتائج
  const executeQuery = (q) => {
    return onSnapshot(q, (snapshot) => {
      let rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`[roomsService] Got ${rooms.length} rooms before filtering`);
      
      // تصفية إضافية للطالب: يجب أن يكون صف الغرفة مطابقاً لصف الطالب
      if (!role.isTeacher && filter !== 'platform') {
        const before = rooms.length;
        rooms = rooms.filter(room => room.grade === role.studentGrade);
        console.log(`[roomsService] Filtered by student grade (${role.studentGrade}): ${before} -> ${rooms.length}`);
      }
      
      // عرض الغرف النشطة فقط (waiting)
      rooms = rooms.filter(room => room.status === 'waiting');
      console.log(`[roomsService] After status filter: ${rooms.length} rooms`);
      
      callback(rooms);
    }, (error) => {
      console.error('[roomsService] Firestore error:', error);
      callback([]);
    });
  };

  // بناء الاستعلام حسب الفلتر
  if (filter === 'teacher') {
    // 🔑 للمعلم: نستخدم hostId (uid) لأنه المعرف الموحد للمعلم في الغرفة
    // إذا كان role.id (uid) موجوداً، نستخدمه. وإلا نستخدم role.teacherId كاحتياطي.
    let hostIdValue = role.isTeacher ? (role.id || role.uid) : null;
    
    if (!hostIdValue && role.teacherId) {
      // محاولة الحصول على uid من sessionStorage أو من user الحالي
      hostIdValue = role.teacherId;
    }
    
    if (!hostIdValue) {
      // محاولة أخيرة: جلب المستخدم الحالي
      const user = await getCurrentUserInfo();
      if (user) hostIdValue = user.id;
    }
    
    if (!hostIdValue) {
      console.warn('[roomsService] No hostId found for teacher, returning empty');
      callback([]);
      return () => {};
    }
    
    console.log('[roomsService] Querying rooms for hostId:', hostIdValue);
    // استعلام باستخدام hostId (الطريقة الصحيحة)
    const q = query(collection(db, 'activeRooms'), where('hostId', '==', hostIdValue));
    return executeQuery(q);
    
  } else if (filter === 'platform') {
    // غرف المنصة العامة
    const q = query(collection(db, 'activeRooms'), where('isPublic', '==', true));
    return executeQuery(q);
    
  } else { // 'all'
    // جميع الغرف (بدون فلترة)
    const q = collection(db, 'activeRooms');
    return executeQuery(q);
  }
}
/**
 * البحث عن غرفة باستخدام المعرف (ID) أو رمز PIN
 * @param {string} code - يمكن أن يكون roomId أو pin
 * @returns {Promise<Object|null>}
 */
export async function findRoomByCode(code) {
  if (!code) return null;
  
  // أولاً: محاولة البحث بالمعرف المباشر
  try {
    const roomRef = doc(db, 'activeRooms', code);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
      return { id: roomSnap.id, ...roomSnap.data() };
    }
  } catch (e) {
    // المعرف غير صالح
  }
  
  // ثانياً: البحث بالـ PIN
  const q = query(collection(db, 'activeRooms'), where('pin', '==', code));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
  }
  
  return null;
}

/**
 * جلب غرفة محددة بواسطة ID
 * @param {string} roomId 
 * @returns {Promise<Object|null>}
 */
export async function getRoomById(roomId) {
  const snap = await getDoc(doc(db, 'activeRooms', roomId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * جلب جميع الغرف النشطة (للمشرف)
 * @param {number} maxResults 
 * @returns {Promise<Array>}
 */
export async function getAllActiveRooms(maxResults = 50) {
  const q = query(collection(db, 'activeRooms'), where('status', '==', 'waiting'), limit(maxResults));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * جلب الغرف الخاصة بمعلم معين (للاستخدام المباشر)
 * @param {string} teacherId 
 * @returns {Promise<Array>}
 */
export async function getRoomsByTeacher(teacherId) {
  const q = query(collection(db, 'activeRooms'), where('teacherId', '==', teacherId), where('status', '==', 'waiting'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * جلب الغرف العامة (المنصة)
 * @returns {Promise<Array>}
 */
export async function getPublicRooms() {
  const q = query(collection(db, 'activeRooms'), where('isPublic', '==', true), where('status', '==', 'waiting'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * التحقق مما إذا كانت الغرفة ممتلئة
 */
export function isRoomFull(room) {
  return (room.players?.length || 0) >= (room.maxPlayers || 8);
}

/**
 * التحقق مما إذا كان المستخدم بالفعل في الغرفة
 */
export function isUserInRoom(room, userId) {
  return room.players?.some(p => p.id === userId) || false;
}