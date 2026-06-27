// src/online/tournament/tournamentListeners.js
// مستمعات البطولات (للتحديث المباشر)

import { subscribeToDocument } from '../core/firestoreSync.js';
import { db, collection, query, where, onSnapshot } from '../../firebase/init.js';

/**
 * الاستماع إلى بطولة محددة
 * @param {string} tournamentId 
 * @param {Function} onUpdate - تستقبل كائن البطولة
 * @returns {Function} دالة إلغاء الاشتراك
 */
export function listenToTournament(tournamentId, onUpdate) {
  return subscribeToDocument('tournaments', tournamentId, onUpdate);
}

/**
 * الاستماع إلى جميع البطولات النشطة لمعلم معين
 * @param {string} teacherId 
 * @param {Function} onUpdate - تستقبل مصفوفة البطولات
 * @returns {Function}
 */
export function listenToTeacherTournaments(teacherId, onUpdate) {
  const q = query(collection(db, 'tournaments'), where('teacherId', '==', teacherId), where('status', 'in', ['waiting', 'active']));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const tournaments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    onUpdate(tournaments);
  });
  return unsubscribe;
}

/**
 * الاستماع إلى البطولات المتاحة لطالب (الخاصة بمعلمه والتي لم تبدأ بعد)
 * @param {string} teacherId 
 * @param {Function} onUpdate
 * @returns {Function}
 */
export function listenToAvailableTournamentsForStudent(teacherId, onUpdate) {
  const q = query(collection(db, 'tournaments'), where('teacherId', '==', teacherId), where('status', '==', 'waiting'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const tournaments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    onUpdate(tournaments);
  });
  return unsubscribe;
}