// src/firebase/auth.js (نسخة معدلة - مع إصلاح الجلسات بين التبويبات)
// نسخة معدلة لاستخدام نظام الاشتراك الجديد
// تم إزالة تعريف refreshTeacherPlanIfExpired وإعادة تصديره من subscription
// تم تغيير استيراد checkTeacherAccess

import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, writeBatch } from './init.js';
import { ADMIN_SECRET_KEY, DEFAULT_IMG, TEACHER_IMG } from '../config.js';
import { showFloatingNotification } from '../utils/helpers/notifications.js';
import { dbLight, loadLightData, saveLightData } from '../db/localstorage.js';
import { encryptWithPassword, decryptWithPassword } from '../utils/crypto.js';
import { checkTeacherAccess } from '../services/subscription/index.js';
import { startPresence, stopPresence } from './presence.js';

let currentUser = null;
let migrationDone = false;

// ========== دوال إدارة الجلسات الآمنة للطلاب ==========
let _encryptionKey = null;

async function getEncryptionKey() {
  if (_encryptionKey) return _encryptionKey;
  let storedKey = sessionStorage.getItem('student_enc_key');
  if (!storedKey) {
    storedKey = crypto.randomUUID();
    sessionStorage.setItem('student_enc_key', storedKey);
  }
  _encryptionKey = storedKey;
  return storedKey;
}

export async function _setSecureStudentId(id) {
  const key = await getEncryptionKey();
  const encrypted = await encryptWithPassword(id, key);
  sessionStorage.setItem('current_student_id_enc', encrypted);
  sessionStorage.setItem('current_student_id', id);
}

export async function _getSecureStudentId() {
  const encrypted = sessionStorage.getItem('current_student_id_enc');
  if (!encrypted) {
    const oldId = sessionStorage.getItem('current_student_id');
    if (oldId) return oldId;
    return null;
  }
  try {
    const key = await getEncryptionKey();
    return await decryptWithPassword(encrypted, key);
  } catch(e) {
    console.error('فشل فك تشفير معرف الطالب', e);
    return null;
  }
}

export async function _clearSecureStudent() {
  sessionStorage.removeItem('current_student_id_enc');
  sessionStorage.removeItem('current_student_id');
  sessionStorage.removeItem('current_student_name');
  sessionStorage.removeItem('current_student_grade');
  sessionStorage.removeItem('current_student_img');
  sessionStorage.removeItem('current_student_score');
  sessionStorage.removeItem('current_student_teacherId');
  sessionStorage.removeItem('student_teacher_plan');
  sessionStorage.removeItem('student_enc_key');
  _encryptionKey = null;
}

export async function getStudentTeacherPlan(studentId) {
  try {
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) return 'free';
    const teacherId = studentSnap.data().teacherId;
    if (!teacherId) return 'free';
    const teacherRef = doc(db, 'teachers', teacherId);
    const teacherSnap = await getDoc(teacherRef);
    return teacherSnap.exists() ? (teacherSnap.data().plan || 'free') : 'free';
  } catch(e) {
    console.error('getStudentTeacherPlan error:', e);
    return 'free';
  }
}

// ========== دوال التخزين الجديدة لاستمرار الجلسة بين التبويبات ==========
function setPersistentStorage(key, value) {
  // المفاتيح الهامة لاستمرار الجلسة نضعها في localStorage
  const persistentKeys = ['peak_teacher_logged_in', 'peak_teacher_code', 'teacher_plan', 'teacher_expiry', 'is_admin', 'is_developer', 'firebase_uid'];
  if (persistentKeys.includes(key)) {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } else {
    if (value === null || value === undefined) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
    }
  }
}

function getPersistentStorage(key) {
  const persistentKeys = ['peak_teacher_logged_in', 'peak_teacher_code', 'teacher_plan', 'teacher_expiry', 'is_admin', 'is_developer', 'firebase_uid'];
  if (persistentKeys.includes(key)) {
    return localStorage.getItem(key);
  }
  return sessionStorage.getItem(key);
}

// ✅ تم نقل دالة refreshTeacherPlanIfExpired إلى نظام الاشتراك الجديد
// وسنقوم بإعادة تصديرها من هناك، لذا نحذف تعريفها هنا

export async function migrateLocalToFirestore(teacherCode, uid) {
  if (migrationDone) return;
  console.log('[Auth] Starting one-time migration from localStorage to Firestore...');
  
  loadLightData();
  const hasLocalStudents = dbLight.students.length > 0;
  if (!hasLocalStudents) {
    migrationDone = true;
    return;
  }
  
  const q = query(collection(db, 'students'), where('teacherId', '==', teacherCode));
  const snap = await getDocs(q);
  if (!snap.empty) {
    console.log('[Auth] Firestore already has data, skipping migration');
    migrationDone = true;
    return;
  }
  
  try {
    const batch = writeBatch(db);
    for (const student of dbLight.students) {
      const studentRef = doc(db, 'students', student.id);
      batch.set(studentRef, { ...student, teacherId: teacherCode });
    }
    for (const [sid, stats] of Object.entries(dbLight.studentStats || {})) {
      const statsRef = doc(db, 'studentStats', sid);
      batch.set(statsRef, stats);
    }
    for (const game of dbLight.gameHistory || []) {
      const gameId = game.id || `${game.timestamp}_${Math.random()}`;
      const gameRef = doc(db, 'gameHistory', gameId);
      batch.set(gameRef, { ...game, teacherId: teacherCode });
    }
    if (dbLight.customGrades && dbLight.customGrades.length) {
      const gradesRef = doc(db, 'customGrades', teacherCode);
      batch.set(gradesRef, { grades: dbLight.customGrades });
    }
    await batch.commit();
    migrationDone = true;
    showFloatingNotification('✅ تم ترحيل بياناتك إلى السحاب بنجاح', 'success');
    console.log('[Auth] Migration completed');
  } catch (error) {
    console.error('[Auth] Migration error:', error);
    showFloatingNotification('❌ فشل الترحيل التلقائي، سيتم المحاولة لاحقاً', 'error');
  }
}

async function ensureStudentInFirestore(studentId) {
  try {
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      return studentSnap.data();
    }
    loadLightData();
    const localStudent = dbLight.students.find(s => String(s.id) === String(studentId));
    if (localStudent) {
      await setDoc(studentRef, { ...localStudent, id: studentId });
      console.log(`[Auth] تم ترحيل الطالب ${studentId} إلى Firestore`);
      return localStudent;
    }
    return null;
  } catch (error) {
    console.error('[Auth] ensureStudentInFirestore error:', error);
    return null;
  }
}

async function storeSubscriptionInSession(teacherCode) {
  try {
    const teacherQuery = query(collection(db, 'teachers'), where('code', '==', teacherCode));
    const teacherSnap = await getDocs(teacherQuery);
    if (teacherSnap.empty) return;
    const teacherData = teacherSnap.docs[0].data();
    const plan = teacherData.plan || 'free';
    const lockedSubject = teacherData.lockedSubject || null;
    const totalQuestionsCount = teacherData.totalQuestionsCount || 0;
    const onlineRoomsUsedThisMonth = teacherData.onlineRoomsUsedThisMonth || 0;
    
    setPersistentStorage('teacher_plan', plan);
    sessionStorage.setItem('teacher_locked_subject', lockedSubject || '');
    sessionStorage.setItem('teacher_total_questions', totalQuestionsCount);
    sessionStorage.setItem('teacher_online_rooms_used', onlineRoomsUsedThisMonth);
    
    console.log('[Auth] Subscription stored in session:', { plan, lockedSubject });
  } catch (error) {
    console.error('[Auth] Failed to store subscription:', error);
  }
}

export function getTeacherPlan() {
  return getPersistentStorage('teacher_plan') || 'free';
}
export function getTeacherLockedSubject() {
  return sessionStorage.getItem('teacher_locked_subject') || null;
}
export function getTeacherTotalQuestions() {
  return parseInt(sessionStorage.getItem('teacher_total_questions') || '0');
}
export function getTeacherOnlineRoomsUsed() {
  return parseInt(sessionStorage.getItem('teacher_online_rooms_used') || '0');
}

export function getCurrentAdminPermissions() {
  const perms = sessionStorage.getItem('assistant_permissions');
  if (perms) {
    try {
      return JSON.parse(perms);
    } catch(e) { return null; }
  }
  return null;
}

// ========== إنشاء حساب معلم جديد ==========
export async function createTeacherAccount(teacherCode, teacherName, plan = 'free', expiryDate = null, phone = '', createdByCoupon = false, couponCode = null) {
  try {
    if (!teacherCode || !teacherName) {
      return { success: false, error: 'الاسم والكود مطلوبان' };
    }
    
    const codeQuery = query(collection(db, 'teacherCodes'), where('code', '==', teacherCode));
    const codeSnap = await getDocs(codeQuery);
    if (!codeSnap.empty) {
      return { success: false, error: 'هذا الكود موجود مسبقاً' };
    }
    
    const email = `teacher_${teacherCode}@platform.com`;
    const password = `Teacher@${teacherCode}`;
    
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        throw error;
      }
    }
    
    const uid = userCredential.user.uid;
    
    await setDoc(doc(db, 'teachers', uid), {
      code: teacherCode,
      name: teacherName,
      phone: phone,
      plan: plan,
      expiryDate: expiryDate || null,
      createdAt: new Date().toISOString(),
      img: TEACHER_IMG,
      isAdmin: false,
      isDeveloper: false,
      lockedSubject: null,
      totalQuestionsCount: 0,
      onlineRoomsUsedThisMonth: 0,
      subjectChangeCount: 0,
      lastResetDate: null,
      status: 'active',
      createdByCoupon: createdByCoupon,
      couponCode: couponCode
    });
    
    await setDoc(doc(db, 'teacherCodes', teacherCode), {
      code: teacherCode,
      uid: uid,
      name: teacherName,
      plan: plan,
      createdAt: new Date().toISOString()
    });
    
    showFloatingNotification(`تم إنشاء حساب المعلم "${teacherName}" بنجاح`, 'success');
    return { success: true, uid: uid };
  } catch (error) {
    console.error('createTeacherAccount error:', error);
    showFloatingNotification('فشل إنشاء حساب المعلم: ' + error.message, 'error');
    return { success: false, error: error.message };
  }
}

// ========== تسجيل دخول المعلم العادي ==========
export async function loginAsOrdinaryTeacher(teacherCode) {
  try {
    console.log('[Auth] محاولة تسجيل دخول معلم:', teacherCode);

    const isAdmin = getPersistentStorage('is_admin') === 'true';
    const isSimulateMode = sessionStorage.getItem('simulate_mode') === 'true';
    const isDeveloperSimulating = isAdmin && isSimulateMode;
    const DEVELOPER_CODE = ADMIN_SECRET_KEY;

    // جلب بيانات المعلم من Firestore
    const codeQuery = query(collection(db, 'teacherCodes'), where('code', '==', teacherCode));
    const codeDocSnap = await getDocs(codeQuery);
    let uid = null;
    let teacherName = '';
    let existingPlan = 'free';
    let existingExpiryDate = null;
    let lockedSubject = null;
    let totalQuestionsCount = 0;
    let onlineRoomsUsedThisMonth = 0;
    let currentStatus = 'active';
    let isAssistant = false;
    let assistantRole = null;
    let assistantPermissions = null;

    if (!codeDocSnap.empty) {
      const codeDoc = codeDocSnap.docs[0];
      uid = codeDoc.data().uid;
      teacherName = codeDoc.data().name || '';
      const teacherRef = doc(db, 'teachers', uid);
      const teacherSnap = await getDoc(teacherRef);
      if (teacherSnap.exists()) {
        const teacherData = teacherSnap.data();
        existingPlan = teacherData.plan || 'free';
        existingExpiryDate = teacherData.expiryDate || null;
        lockedSubject = teacherData.lockedSubject || null;
        totalQuestionsCount = teacherData.totalQuestionsCount || 0;
        onlineRoomsUsedThisMonth = teacherData.onlineRoomsUsedThisMonth || 0;
        currentStatus = teacherData.status || 'active';
        isAssistant = teacherData.isAssistant === true;
        assistantRole = teacherData.role || null;
      } else {
        existingPlan = 'free';
      }
    } else {
      showFloatingNotification('الكود غير صحيح أو المعلم غير موجود', 'error');
      return { success: false, error: 'Teacher not found' };
    }

    // فحص الجهاز (مع try/catch لمنع فشل الدخول)
    let deviceAccess = { allowed: true };
    if (!isDeveloperSimulating && teacherCode !== DEVELOPER_CODE) {
      try {
        const { checkDeviceAccess, registerDeviceForTeacher, logDeviceViolation, getDeviceFingerprint, getUserIP } = await import('../services/subscription/index.js');
        deviceAccess = await checkDeviceAccess(teacherCode, isDeveloperSimulating);
        
        if (!deviceAccess.allowed) {
          const deviceFingerprint = getDeviceFingerprint();
          const ip = await getUserIP();
          await logDeviceViolation(teacherCode, teacherName || teacherCode, deviceFingerprint, ip);
          
          const teacherRef = doc(db, 'teachers', uid);
          await updateDoc(teacherRef, { status: 'suspended_device' });
          
          showFloatingNotification(deviceAccess.message, 'error');
          return { success: false, error: deviceAccess.message, isDeviceBlocked: true };
        }
      } catch(err) {
        console.warn('[Auth] Device check disabled due to error:', err);
        // نسمح بالدخول كحل مؤقت
      }
    }

    // فحص صلاحية الاشتراك باستخدام النظام الجديد
    let access = null;
    let subscriptionExpired = false;

    if (!isDeveloperSimulating) {
      try {
        const { checkTeacherAccess } = await import('../services/subscription/index.js');
        access = await checkTeacherAccess(teacherCode);
        if (!access.allowed) {
          showFloatingNotification(access.message, 'error');
          return { success: false, error: access.message, expired: access.expired };
        }
        subscriptionExpired = access.expired;
      } catch(err) {
        console.warn('[Auth] Subscription check disabled:', err);
        access = { allowed: true, plan: existingPlan || 'free', expired: false };
      }
    } else {
      const expiryDate = existingExpiryDate ? new Date(existingExpiryDate) : null;
      subscriptionExpired = expiryDate && expiryDate < new Date();
      access = { allowed: true, plan: existingPlan || 'free', expired: subscriptionExpired };
      if (subscriptionExpired) {
        showFloatingNotification(`⚠️ المحاكاة: هذا المعلم منتهي الصلاحية. تستخدم لأغراض الاختبار فقط.`, 'warning');
      }
    }

    // إنشاء / تسجيل دخول Firebase Auth
    const email = `teacher_${teacherCode}@platform.com`;
    const password = `Teacher@${teacherCode}`;
    let userCredential;
    let isNewUser = false;

    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[Auth] تم تسجيل الدخول بنجاح إلى Firebase Auth:', userCredential.user.uid);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        console.log('[Auth] حساب Firebase غير موجود، جاري إنشاؤه...');
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        isNewUser = true;
        console.log('[Auth] تم إنشاء حساب Firebase جديد:', userCredential.user.uid);
      } else {
        throw authError;
      }
    }

    const finalUid = userCredential.user.uid;
    const plan = access?.plan || existingPlan || 'free';
    const expiryDate = access?.expiryDate ? access.expiryDate.toISOString() : (existingExpiryDate || null);

    // إنشاء / تحديث وثيقة المعلم في Firestore
    const teacherDocRef = doc(db, 'teachers', finalUid);
    if (!isNewUser && (await getDoc(teacherDocRef)).exists()) {
      if (currentStatus !== 'suspended_device' || isDeveloperSimulating) {
        await updateDoc(teacherDocRef, {
          plan,
          expiryDate,
          lastLogin: new Date().toISOString(),
          firebaseUid: finalUid
        });
      }
    } else {
      teacherName = teacherName || `معلم ${teacherCode}`;
      await setDoc(teacherDocRef, {
        code: teacherCode,
        name: teacherName,
        plan,
        expiryDate,
        createdAt: new Date().toISOString(),
        img: TEACHER_IMG,
        status: 'active',
        isTeacher: true,
        lockedSubject: null,
        totalQuestionsCount: 0,
        onlineRoomsUsedThisMonth: 0,
        subjectChangeCount: 0,
        lastResetDate: null,
        firebaseUid: finalUid,
        isAdmin: false,
        isDeveloper: false
      });
    }

    // تحديث teacherCodes
    const codeDocRef = doc(db, 'teacherCodes', teacherCode);
    await setDoc(codeDocRef, {
      code: teacherCode,
      uid: finalUid,
      name: teacherName,
      plan,
      createdAt: new Date().toISOString()
    }, { merge: true });

    // جلب صلاحيات المساعد
    let permissionsObj = null;
    if (isAssistant) {
      const adminRoleSnap = await getDoc(doc(db, 'admin_roles', finalUid));
      if (adminRoleSnap.exists()) {
        permissionsObj = adminRoleSnap.data().permissions;
        console.log('[Auth] تم تحميل صلاحيات المساعد:', permissionsObj);
      } else {
        console.warn('[Auth] المساعد موجود لكن لا توجد صلاحيات في admin_roles');
      }
    }

    const isDeveloper = (teacherCode === DEVELOPER_CODE);
    const isAdminUser = isDeveloper;

    setPersistentStorage('peak_teacher_logged_in', 'true');
    setPersistentStorage('peak_teacher_name', teacherName);
    setPersistentStorage('peak_teacher_code', teacherCode);
    setPersistentStorage('is_admin', isAdminUser ? 'true' : 'false');
    setPersistentStorage('is_developer', isDeveloper ? 'true' : 'false');
    setPersistentStorage('firebase_uid', finalUid);
    setPersistentStorage('teacher_plan', plan);
    setPersistentStorage('teacher_expiry', expiryDate || '');
    sessionStorage.setItem('teacher_locked_subject', lockedSubject || '');
    sessionStorage.setItem('teacher_total_questions', totalQuestionsCount);
    sessionStorage.setItem('teacher_online_rooms_used', onlineRoomsUsedThisMonth);
    
    if (isAssistant && permissionsObj) {
      sessionStorage.setItem('is_assistant', 'true');
      sessionStorage.setItem('assistant_role', assistantRole || 'moderator');
      sessionStorage.setItem('assistant_permissions', JSON.stringify(permissionsObj));
    } else {
      sessionStorage.setItem('is_assistant', 'false');
      sessionStorage.removeItem('assistant_permissions');
      sessionStorage.removeItem('assistant_role');
    }

    // تسجيل الجهاز (مع try/catch)
    if (!isDeveloperSimulating && teacherCode !== DEVELOPER_CODE) {
      try {
        const { registerDeviceForTeacher, getDeviceFingerprint, getUserIP } = await import('../services/subscription/index.js');
        const deviceFingerprint = getDeviceFingerprint();
        const ip = await getUserIP();
        await registerDeviceForTeacher(teacherCode, deviceFingerprint, ip);
      } catch(err) {
        console.warn('[Auth] Device registration skipped:', err);
      }
    }

    if (isSimulateMode) {
      sessionStorage.removeItem('simulate_mode');
      sessionStorage.removeItem('simulate_teacher_code');
    }

    console.log('[Auth] تم تخزين الجلسة بنجاح للمعلم:', teacherName);
    migrateLocalToFirestore(teacherCode, finalUid).catch(err => console.warn('[Auth] خطأ في الترحيل:', err));

    await startPresence();
    showFloatingNotification(`مرحباً أستاذ ${teacherName}!`, 'success');
    return { success: true, user: { name: teacherName, isTeacher: true, code: teacherCode, plan, expiryDate, uid: finalUid, isAssistant, permissions: permissionsObj } };
  } catch (error) {
    console.error('[Auth] loginAsOrdinaryTeacher error:', error);
    showFloatingNotification('حدث خطأ أثناء تسجيل الدخول: ' + error.message, 'error');
    return { success: false, error: error.message };
  }
}

export async function getTeachersList() {
  try {
    const teachersSnap = await getDocs(collection(db, 'teacherCodes'));
    const teachers = [];
    for (const docSnap of teachersSnap.docs) {
      const data = docSnap.data();
      const teacherRef = doc(db, 'teachers', data.uid);
      const teacherSnap = await getDoc(teacherRef);
      let plan = 'free';
      let expiryDate = null;
      if (teacherSnap.exists()) {
        plan = teacherSnap.data().plan || 'free';
        expiryDate = teacherSnap.data().expiryDate || null;
      }
      teachers.push({
        id: data.code,
        uid: data.uid,
        name: data.name,
        plan: plan,
        expiryDate: expiryDate
      });
    }
    return teachers;
  } catch (error) {
    console.error('getTeachersList error:', error);
    return [];
  }
}

export async function updateTeacherPlan(teacherCode, newPlan, newExpiryDate = null) {
  try {
    const codeRef = doc(db, 'teacherCodes', teacherCode);
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) {
      return { success: false, error: 'المعلم غير موجود' };
    }
    const uid = codeSnap.data().uid;
    const teacherRef = doc(db, 'teachers', uid);
    await updateDoc(teacherRef, {
      plan: newPlan,
      expiryDate: newExpiryDate || null,
      updatedAt: new Date().toISOString()
    });
    // تحديث localStorage أيضاً
    setPersistentStorage('teacher_plan', newPlan);
    setPersistentStorage('teacher_expiry', newExpiryDate || '');
    showFloatingNotification(`تم تحديث خطة المعلم "${codeSnap.data().name}" إلى ${newPlan}`, 'success');
    return { success: true };
  } catch (error) {
    console.error('updateTeacherPlan error:', error);
    return { success: false, error: error.message };
  }
}

export async function logout() {
  try {
    await stopPresence();
    await signOut(auth);
    await _clearSecureStudent();
    if (window._teacherDataUnsubscribe) {
      window._teacherDataUnsubscribe();
      window._teacherDataUnsubscribe = null;
    }
    // مسح localStorage و sessionStorage
    const persistentKeys = ['peak_teacher_logged_in', 'peak_teacher_code', 'teacher_plan', 'teacher_expiry', 'is_admin', 'is_developer', 'firebase_uid'];
    persistentKeys.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    localStorage.removeItem('firebase_uid');
    if (window._cleanupFirestoreListeners && typeof window._cleanupFirestoreListeners === 'function') {
      window._cleanupFirestoreListeners();
    }
    showFloatingNotification('تم تسجيل الخروج', 'info');
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
  });
}

export function getCurrentUser() { return currentUser; }

export async function getCurrentUserInfo() {
  const isDev = getPersistentStorage('is_developer') === 'true';
  if (isDev) {
    const teacherCode = getPersistentStorage('peak_teacher_code');
    const teacherName = getPersistentStorage('peak_teacher_name');
    return {
      id: teacherCode,
      name: teacherName,
      isTeacher: true,
      code: teacherCode,
      plan: 'developer',
      img: TEACHER_IMG,
      isDeveloper: true,
      isAdmin: true
    };
  }
  
  const isTeacherLogged = getPersistentStorage('peak_teacher_logged_in') === 'true';
  if (isTeacherLogged) {
    const teacherCode = getPersistentStorage('peak_teacher_code');
    const teacherName = getPersistentStorage('peak_teacher_name');
    let teacherPlan = getPersistentStorage('teacher_plan') || 'free';
    if (teacherCode === ADMIN_SECRET_KEY) teacherPlan = 'developer';
    return {
      id: teacherCode,
      name: teacherName,
      isTeacher: true,
      code: teacherCode,
      plan: teacherPlan,
      img: TEACHER_IMG,
      isDeveloper: (teacherPlan === 'developer'),
      isAdmin: (teacherPlan === 'developer')
    };
  }

  const studentId = await _getSecureStudentId();
  if (studentId) {
    const studentName = sessionStorage.getItem('current_student_name');
    const studentGrade = sessionStorage.getItem('current_student_grade');
    const studentImg = sessionStorage.getItem('current_student_img');
    const studentScore = sessionStorage.getItem('current_student_score');
    const teacherId = sessionStorage.getItem('current_student_teacherId');
    
    let teacherPlan = sessionStorage.getItem('student_teacher_plan') || 'free';
    
    const lastPlanUpdate = sessionStorage.getItem('student_teacher_plan_timestamp');
    const now = Date.now();
    if (!lastPlanUpdate || (now - parseInt(lastPlanUpdate)) > 5 * 60 * 1000) {
      try {
        const freshPlan = await getStudentTeacherPlan(studentId);
        if (freshPlan && freshPlan !== 'free') {
          teacherPlan = freshPlan;
          sessionStorage.setItem('student_teacher_plan', freshPlan);
        } else if (teacherPlan === 'free' && freshPlan === 'free') {
        } else if (teacherPlan !== 'free' && freshPlan === 'free') {
          console.warn('[getCurrentUserInfo] refused to override teacherPlan from', teacherPlan, 'to free');
        } else {
          teacherPlan = freshPlan;
          sessionStorage.setItem('student_teacher_plan', freshPlan);
        }
        sessionStorage.setItem('student_teacher_plan_timestamp', now.toString());
      } catch(e) {
        console.warn('[getCurrentUserInfo] Failed to refresh teacher plan:', e);
      }
    }
    
    return {
      id: studentId,
      name: studentName,
      grade: studentGrade,
      img: studentImg || DEFAULT_IMG,
      score: parseInt(studentScore) || 0,
      isTeacher: false,
      teacherId: teacherId,
      teacherPlan: teacherPlan,
      plan: teacherPlan
    };
  }

  return null;
}

export async function loginAsStudent(studentId) {
  try {
    const cleanId = String(studentId).replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!cleanId) {
      showFloatingNotification('معرف الطالب غير صالح', 'error');
      return { success: false, error: 'Invalid student ID' };
    }

    const { checkStudentAccess } = await import('../services/subscription/index.js');
    const access = await checkStudentAccess(cleanId);
    if (!access.allowed) {
      await Swal.fire({
        title: '🚫 لا يمكنك دخول الساحة العالمية',
        html: access.message,
        icon: 'error',
        confirmButtonText: 'حسناً',
        background: '#0f172a',
        color: '#fff'
      });
      return { success: false, error: access.message };
    }

    let studentData = null;
    let teacherPlan = 'free';
    try {
      const studentRef = doc(db, 'students', cleanId);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        studentData = studentSnap.data();
        if (studentData.teacherId) {
          const teacherRef = doc(db, 'teachers', studentData.teacherId);
          const teacherSnap = await getDoc(teacherRef);
          if (teacherSnap.exists()) {
            teacherPlan = teacherSnap.data().plan || 'free';
            if (teacherSnap.data().isDeveloper === true || teacherPlan === 'developer') teacherPlan = 'gold';
          }
        }
      } else {
        loadLightData();
        const localStudent = dbLight.students.find(s => String(s.id) === String(cleanId));
        if (localStudent) {
          studentData = localStudent;
          await setDoc(studentRef, { ...localStudent, teacherId: localStudent.teacherId }, { merge: true });
          if (localStudent.teacherId) {
            const teacherRef = doc(db, 'teachers', localStudent.teacherId);
            const teacherSnap = await getDoc(teacherRef);
            if (teacherSnap.exists()) {
              teacherPlan = teacherSnap.data().plan || 'free';
            }
          }
        }
      }
    } catch (err) { console.error(err); }

    if (!studentData) {
      showFloatingNotification('معرف الطالب غير موجود', 'error');
      return { success: false, error: 'Student not found' };
    }

    await _setSecureStudentId(cleanId);
    sessionStorage.setItem('current_student_name', studentData.name || '');
    sessionStorage.setItem('current_student_grade', studentData.grade || '');
    sessionStorage.setItem('current_student_img', studentData.img || DEFAULT_IMG);
    sessionStorage.setItem('current_student_score', studentData.score || 0);
    sessionStorage.setItem('current_student_teacherId', studentData.teacherId || '');
    
    const finalPlan = (studentData.teacherId === ADMIN_SECRET_KEY) ? 'gold' : teacherPlan;
    sessionStorage.setItem('student_teacher_plan', finalPlan);
    sessionStorage.setItem('student_teacher_plan_timestamp', Date.now().toString());

    sessionStorage.removeItem('firebase_uid');
    await startPresence();
    showFloatingNotification(`مرحباً ${studentData.name}!`, 'success');
    
    window.location.href = (finalPlan === 'gold' || finalPlan === 'silver') ? 'arena.html?role=student' : 'arena.html';
    return { success: true };
  } catch (error) {
    console.error('loginAsStudent error:', error);
    showFloatingNotification('حدث خطأ: ' + error.message, 'error');
    return { success: false, error: error.message };
  }
}

export async function loginAsDeveloper(code) {
  try {
    if (code !== ADMIN_SECRET_KEY) {
      showFloatingNotification('كود المطور غير صحيح', 'error');
      return { success: false, error: 'Invalid developer code' };
    }

    const email = `developer@al-taj-platform.com`;
    const password = `Developer@${ADMIN_SECRET_KEY}`;
    
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'teachers', userCredential.user.uid), {
          code: ADMIN_SECRET_KEY,
          name: 'المطور (صاحب المنصة)',
          isAdmin: true,
          isDeveloper: true,
          plan: 'developer',
          createdAt: new Date().toISOString(),
          img: TEACHER_IMG
        });
      } else {
        throw error;
      }
    }
    
    const codeDocRef = doc(db, 'teacherCodes', ADMIN_SECRET_KEY);
    const codeDocSnap = await getDoc(codeDocRef);
    if (!codeDocSnap.exists()) {
      await setDoc(codeDocRef, {
        code: ADMIN_SECRET_KEY,
        uid: userCredential.user.uid,
        name: 'المطور',
        plan: 'developer',
        createdAt: new Date().toISOString()
      });
    }
    
    setPersistentStorage('peak_teacher_logged_in', 'true');
    setPersistentStorage('peak_teacher_name', 'المطور (صاحب المنصة)');
    setPersistentStorage('peak_teacher_code', ADMIN_SECRET_KEY);
    setPersistentStorage('is_admin', 'true');
    setPersistentStorage('is_developer', 'true');
    setPersistentStorage('firebase_uid', userCredential.user.uid);
    setPersistentStorage('teacher_plan', 'developer');
    sessionStorage.setItem('teacher_locked_subject', '');
    sessionStorage.setItem('teacher_total_questions', '0');
    sessionStorage.setItem('teacher_online_rooms_used', '0');
    
    showFloatingNotification(`مرحباً أيها المطور!`, 'success');
    return { success: true, user: { name: 'المطور', isTeacher: true, code: ADMIN_SECRET_KEY, isAdmin: true, isDeveloper: true, uid: userCredential.user.uid, plan: 'developer' } };
  } catch (error) {
    console.error('loginAsDeveloper error:', error);
    showFloatingNotification('حدث خطأ أثناء تسجيل الدخول: ' + error.message, 'error');
    return { success: false, error: error.message };
  }
}

export async function initLoginScreen() {
  console.log('[Auth] Initializing login screen');
  registerGlobalAuthFunctions();
  const teacherLogged = getPersistentStorage('peak_teacher_logged_in') === 'true';
  const studentId = await _getSecureStudentId();
  if (teacherLogged) {
    console.log('[Auth] Existing teacher session detected');
  } else if (studentId) {
    console.log('[Auth] Existing student session detected, redirecting...');
    window.location.href = 'arena.html?role=student';
  }
}

export function registerGlobalAuthFunctions() {
  window._loginAsDeveloper = loginAsDeveloper;
  window._loginAsTeacher = loginAsOrdinaryTeacher;
  window._loginAsOrdinaryTeacher = loginAsOrdinaryTeacher;
  window._loginAsStudent = loginAsStudent;
  window._getSecureStudentId = _getSecureStudentId;
  window.getCurrentUserInfo = getCurrentUserInfo;
  window.logout = logout;
  window.createTeacherAccount = createTeacherAccount;
  window.getTeachersList = getTeachersList;
  window.updateTeacherPlan = updateTeacherPlan;
  window.loginAsTeacher = loginAsOrdinaryTeacher;
  window.migrateLocalToFirestore = migrateLocalToFirestore;
  window.getTeacherPlan = getTeacherPlan;
  window.getTeacherLockedSubject = getTeacherLockedSubject;
  window.getTeacherTotalQuestions = getTeacherTotalQuestions;
  window.getTeacherOnlineRoomsUsed = getTeacherOnlineRoomsUsed;
  window.getCurrentAdminPermissions = getCurrentAdminPermissions;
}

export function updateTeacherDisplayName() {
  const name = getPersistentStorage('peak_teacher_name') || 'معلم';
  const el = document.getElementById('teacher-display-name');
  if (el) el.innerText = 'أستاذ: ' + name;
}

export function setCurrentAdminPermissions(permissions) {
    window.currentAdminPermissions = permissions;
    if (permissions) {
        sessionStorage.setItem('assistant_permissions', JSON.stringify(permissions));
    }
}

export function hasPermission(module, action) {
    const perms = window.currentAdminPermissions || getCurrentAdminPermissions();
    if (!perms) return false;
    if (getPersistentStorage('is_developer') === 'true') return true;
    const modulePerms = perms[module];
    if (!modulePerms) return false;
    return modulePerms[action] === true;
}

export function disableUnauthorizedButtons(selector, module, action) {
    document.querySelectorAll(selector).forEach(btn => {
        if (!hasPermission(module, action)) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.title = 'لا تملك صلاحية';
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });
}

export function hideUnauthorizedElements(selector, module, action) {
    if (!hasPermission(module, action)) {
        document.querySelectorAll(selector).forEach(el => el.style.display = 'none');
    }
}

// ✅ إعادة تصدير دالة refreshTeacherPlanIfExpired من نظام الاشتراك الجديد
export { refreshTeacherPlanIfExpired } from '../services/subscription/index.js';