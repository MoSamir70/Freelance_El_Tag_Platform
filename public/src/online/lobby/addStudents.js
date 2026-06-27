// src/online/lobby/addStudents.js
// إضافة طلاب من حساب المعلم إلى الغرفة مباشرة (دون حاجة لرمز دخول)

import { updateDocumentWithRetry, getDocumentOnce } from '../core/firestoreSync.js';
import { getStudents } from '../../services/dataService.js';
import { getCurrentUserInfo } from '../../firebase/auth.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';

/**
 * إضافة طالب (أو عدة طلاب) إلى غرفة معينة
 * @param {string} roomId 
 * @param {string|string[]} studentIds - معرف طالب واحد أو مصفوفة
 * @returns {Promise<{success: boolean, added: number}>}
 */
export async function addStudentsToRoom(roomId, studentIds) {
  const user = await getCurrentUserInfo();
  if (!user || !user.isTeacher) {
    showFloatingNotification('غير مصرح لك بهذه العملية', 'error');
    return { success: false, added: 0 };
  }

  // جلب الغرفة للتأكد من وجودها وأن المضيف هو نفس المعلم
  const room = await getDocumentOnce(`activeRooms/${roomId}`);
  if (!room) {
    showFloatingNotification('الغرفة غير موجودة', 'error');
    return { success: false, added: 0 };
  }
  if (room.hostId !== user.id) {
    showFloatingNotification('فقط مضيف الغرفة يمكنه إضافة طلاب', 'error');
    return { success: false, added: 0 };
  }

  // جلب قائمة طلاب المعلم من Firestore
  const studentsList = await getStudents(); // ترجع قائمة بكل طلاب المعلم الحالي
  const studentsMap = new Map();
  studentsList.forEach(s => studentsMap.set(s.id, s));

  const idsArray = Array.isArray(studentIds) ? studentIds : [studentIds];
  const validStudents = idsArray.filter(id => studentsMap.has(id));
  if (validStudents.length === 0) {
    showFloatingNotification('لم يتم العثور على طلاب بهذه المعرفات', 'error');
    return { success: false, added: 0 };
  }

  // تحويل الطلاب إلى صيغة اللاعبين في الغرفة
  const newPlayers = validStudents.map(id => ({
    id,
    name: studentsMap.get(id).name,
    img: studentsMap.get(id).img || '',
    isReady: false,
    score: 0,
    pos: 0
  }));

  // منع تكرار الطلاب الموجودين بالفعل
  const existingIds = new Set(room.players.map(p => p.id));
  const filteredNew = newPlayers.filter(p => !existingIds.has(p.id));
  if (filteredNew.length === 0) {
    showFloatingNotification('جميع الطلاب المحددين موجودون بالفعل في الغرفة', 'warning');
    return { success: true, added: 0 };
  }

  // التحقق من عدم تجاوز الحد الأقصى
  const totalAfterAdd = room.players.length + filteredNew.length;
  if (totalAfterAdd > room.maxPlayers) {
    showFloatingNotification(`لا يمكن إضافة أكثر من ${room.maxPlayers} لاعب`, 'error');
    return { success: false, added: 0 };
  }

  const updatedPlayers = [...room.players, ...filteredNew];
  const result = await updateDocumentWithRetry(`activeRooms/${roomId}`, { players: updatedPlayers });
  if (result.success) {
    showFloatingNotification(`تمت إضافة ${filteredNew.length} طالب إلى الغرفة`, 'success');
    return { success: true, added: filteredNew.length };
  }
  return { success: false, added: 0 };
}