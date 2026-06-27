// storeFriends.js - المتجر والأصدقاء والمتصلون
import { 
  db, collection, doc, getDocs, getDoc, setDoc, deleteDoc, 
  query, where, addDoc, updateDoc, serverTimestamp 
} from '../../firebase/init.js';
import { showFloatingNotification } from '../../utils/helpers/notifications.js';
import { getStudentById, updateStudent } from './student.js';

// ========== المتجر ==========
export async function getStoreItems() { 
    const snapshot = await getDocs(collection(db, 'storeItems')); 
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
}

export async function addStoreItem(item) { 
    await addDoc(collection(db, 'storeItems'), item); 
}

export async function purchaseItem(studentId, itemId) {
    const student = await getStudentById(studentId);
    if (!student) return false;
    const items = await getStoreItems();
    const item = items.find(i => i.id === itemId);
    if (!item || student.score < item.price) return false;
    await updateStudent(studentId, { score: student.score - item.price });
    await setDoc(doc(db, 'inventory', `${studentId}_${itemId}`), { studentId, itemId, purchasedAt: serverTimestamp() });
    showFloatingNotification(`تم شراء ${item.name} بنجاح`, 'success');
    return true;
}

export async function getUserInventory(studentId) {
    const q = query(collection(db, 'inventory'), where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
}

// ========== الأصدقاء ==========
export async function sendFriendRequest(fromId, toId) {
    const existingQuery = query(collection(db, 'friendRequests'), where('from', '==', fromId), where('to', '==', toId));
    const existing = await getDocs(existingQuery);
    if (!existing.empty) throw new Error('طلب الصداقة موجود بالفعل');
    await addDoc(collection(db, 'friendRequests'), {
        from: fromId,
        to: toId,
        status: 'pending',
        createdAt: serverTimestamp()
    });
}

export async function acceptFriendRequest(currentId, requesterId) {
    const q = query(collection(db, 'friendRequests'), where('from', '==', requesterId), where('to', '==', currentId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error('لم يتم العثور على الطلب');
    const reqDoc = snapshot.docs[0];
    await updateDoc(reqDoc.ref, { status: 'accepted' });
    await setDoc(doc(db, 'friendships', `${currentId}_${requesterId}`), { userId: currentId, friendId: requesterId, createdAt: serverTimestamp() });
    await setDoc(doc(db, 'friendships', `${requesterId}_${currentId}`), { userId: requesterId, friendId: currentId, createdAt: serverTimestamp() });
}

export async function rejectFriendRequest(currentId, requesterId) {
    const q = query(collection(db, 'friendRequests'), where('from', '==', requesterId), where('to', '==', currentId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error('لم يتم العثور على الطلب');
    await deleteDoc(snapshot.docs[0].ref);
}

export async function getFriendsList(studentId) {
    const friendshipsRef = collection(db, 'friendships');
    const q = query(friendshipsRef, where('userId', '==', studentId));
    const snapshot = await getDocs(q);
    const friendIds = snapshot.docs.map(doc => doc.data().friendId);
    if (friendIds.length === 0) return [];
    const friends = [];
    for (const fid of friendIds) {
        const docSnap = await getDoc(doc(db, 'students', fid));
        if (docSnap.exists()) friends.push({ id: fid, ...docSnap.data() });
    }
    return friends;
}

export async function getFriendRequests(studentId) {
    const q = query(collection(db, 'friendRequests'), where('to', '==', studentId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    const requests = [];
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const fromStudent = await getStudentById(data.from);
        if (fromStudent) {
            requests.push({ id: docSnap.id, from: data.from, fromName: fromStudent.name, fromImg: fromStudent.img, createdAt: data.createdAt });
        }
    }
    return requests;
}

export async function getSentFriendRequests(studentId) {
    const q = query(collection(db, 'friendRequests'), where('from', '==', studentId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, to: doc.data().to }));
}

export async function removeFriend(studentId, friendId) {
    await deleteDoc(doc(db, 'friendships', `${studentId}_${friendId}`));
    await deleteDoc(doc(db, 'friendships', `${friendId}_${studentId}`));
}

// ========== المتصلون ==========
export async function getOnlineUsers() {
    const presenceRef = collection(db, 'userPresence');
    const q = query(presenceRef, where('online', '==', true));
    const snapshot = await getDocs(q);
    const userIds = snapshot.docs.map(doc => doc.id);
    if (userIds.length === 0) return [];
    const users = [];
    for (const uid of userIds) {
        const studentSnap = await getDoc(doc(db, 'students', uid));
        if (studentSnap.exists()) users.push({ id: uid, ...studentSnap.data() });
        else {
            const teacherSnap = await getDoc(doc(db, 'teachers', uid));
            if (teacherSnap.exists()) users.push({ id: uid, ...teacherSnap.data(), isTeacher: true });
        }
    }
    return users;
}