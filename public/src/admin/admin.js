// src/admin/admin.js
// نظام إدارة المنصة للمطور (المدير)
// [FIX] إضافة فحص is_developer لمنع الوصول غير المصرح به

import { ADMIN_SECRET_KEY } from '../config.js';
import { dbLight, save, getDynamicGrades } from '../db/localstorage.js';
import { loadQuestionsFromIndexedDB, saveQuestionsToIndexedDB } from '../db/indexeddb.js';
import { getStudents, getStudentStats, getGameHistory, updateStudent, addStudent } from '../services/dataService.js';
import { escapeHtml, showFloatingNotification } from '../utils.js';
import { db, collection, query, where, getDocs, updateDoc, doc, serverTimestamp, addDoc } from '../firebase/init.js';

// ========== دالة مساعدة للتحقق من صلاحية المطور ==========
function requireDeveloper() {
  const isDev = sessionStorage.getItem('is_developer') === 'true';
  if (!isDev) {
    console.warn('[Admin] Unauthorized access attempt');
    showFloatingNotification('غير مصرح بالوصول إلى لوحة الإدارة', 'error');
    throw new Error('Unauthorized');
  }
  return true;
}

// ========== التحقق من جلسة المدير ==========
let adminAuthenticated = false;

export function isAdminAuthenticated() {
    if (!adminAuthenticated) {
        const stored = sessionStorage.getItem('admin_authenticated');
        const sessionTime = parseInt(sessionStorage.getItem('admin_session_time') || '0');
        if (stored === 'true' && (Date.now() - sessionTime) < 8 * 60 * 60 * 1000) {
            adminAuthenticated = true;
        }
    }
    return adminAuthenticated;
}

export function loginAdmin(secretKey) {
    if (secretKey === ADMIN_SECRET_KEY) {
        adminAuthenticated = true;
        sessionStorage.setItem('admin_authenticated', 'true');
        sessionStorage.setItem('admin_session_time', Date.now().toString());
        sessionStorage.setItem('is_admin', 'true');
        sessionStorage.setItem('is_developer', 'true'); // ✅ تعيين مطور
        return true;
    }
    return false;
}

export function logoutAdmin() {
    adminAuthenticated = false;
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('admin_session_time');
    sessionStorage.removeItem('is_admin');
    sessionStorage.removeItem('is_developer');
}

// ========== إدارة المعلمين ==========
export function getAllTeachers() {
    requireDeveloper();
    return dbLight.students.filter(s => s.isTeacher === true);
}

export async function addTeacher(teacherData) {
    requireDeveloper();
    const { name, teacherId, email, phone, img, plan, expiryDate, notes } = teacherData;
    if (!name || !teacherId) throw new Error('الاسم والكود مطلوبان');
    if (dbLight.students.some(s => s.isTeacher && String(s.teacherId) === String(teacherId))) {
        throw new Error('كود المعلم موجود مسبقاً');
    }
    const newTeacher = {
        id: Date.now().toString(),
        name,
        teacherId,
        email: email || '',
        phone: phone || '',
        img: img || 'https://via.placeholder.com/150?text=Teacher',
        plan: plan || 'free',
        status: 'active',
        expiryDate: expiryDate || null,
        notes: notes || '',
        isTeacher: true,
        createdAt: Date.now(),
        lastActive: Date.now(),
        devices: [],
        violations: [],
        activityLog: []
    };
    dbLight.students.push(newTeacher);
    await save();
    return newTeacher;
}

export async function updateTeacher(teacherId, updates) {
    requireDeveloper();
    const index = dbLight.students.findIndex(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (index === -1) throw new Error('المعلم غير موجود');
    dbLight.students[index] = { ...dbLight.students[index], ...updates };
    await save();
    return dbLight.students[index];
}

export async function deleteTeacher(teacherId, permanent = false) {
    requireDeveloper();
    if (permanent) {
        dbLight.students = dbLight.students.filter(s => !(s.isTeacher && String(s.teacherId) === String(teacherId)));
    } else {
        const index = dbLight.students.findIndex(s => s.isTeacher && String(s.teacherId) === String(teacherId));
        if (index !== -1) dbLight.students[index].status = 'deleted';
    }
    await save();
}

export async function toggleTeacherSuspension(teacherId, suspend) {
    requireDeveloper();
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (teacher) {
        teacher.status = suspend ? 'suspended' : 'active';
        await save();
    }
}

export async function upgradeTeacherPlan(teacherId, newPlan, extendDays = 30) {
    requireDeveloper();
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (!teacher) throw new Error('المعلم غير موجود');
    teacher.plan = newPlan;
    if (extendDays && teacher.expiryDate) {
        const currentExpiry = new Date(teacher.expiryDate);
        if (currentExpiry > new Date()) {
            teacher.expiryDate = new Date(currentExpiry.getTime() + extendDays * 86400000).toISOString();
        } else {
            teacher.expiryDate = new Date(Date.now() + extendDays * 86400000).toISOString();
        }
    } else if (extendDays) {
        teacher.expiryDate = new Date(Date.now() + extendDays * 86400000).toISOString();
    }
    await save();
    return teacher;
}

// ========== إحصائيات المنصة ==========
export async function getPlatformStats() {
    requireDeveloper();
    const teachers = getAllTeachers();
    const activeTeachers = teachers.filter(t => t.status === 'active');
    const suspendedTeachers = teachers.filter(t => t.status === 'suspended');
    const allStudents = dbLight.students.filter(s => !s.isTeacher);
    const totalQuestions = await getTotalQuestionsCount();
    const gameHistory = dbLight.gameHistory || [];
    const totalMatches = gameHistory.length;
    const top5Students = [...allStudents].sort((a,b) => b.score - a.score).slice(0,5);
    const last5Matches = [...gameHistory].sort((a,b) => b.timestamp - a.timestamp).slice(0,5);
    
    return {
        totalTeachers: teachers.length,
        activeTeachers: activeTeachers.length,
        suspendedTeachers: suspendedTeachers.length,
        totalStudents: allStudents.length,
        totalQuestions,
        totalMatches,
        top5Students,
        last5Matches
    };
}

async function getTotalQuestionsCount() {
    let total = 0;
    const grades = getDynamicGrades();
    for (const grade of grades) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        total += questions.length;
    }
    return total;
}

export async function getTeacherStats(teacherId) {
    requireDeveloper();
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (!teacher) return null;
    const students = dbLight.students.filter(s => !s.isTeacher && s.teacherId === teacherId);
    let totalQuestions = 0;
    const grades = getDynamicGrades();
    for (const grade of grades) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        const teacherQuestions = questions.filter(q => q.teacherId === teacherId);
        totalQuestions += teacherQuestions.length;
    }
    const roomsCreated = (dbLight.gameHistory || []).filter(g => g.createdBy === teacherId).length;
    const studentIds = students.map(s => String(s.id));
    const matchesWithStudents = (dbLight.gameHistory || []).filter(g => 
        g.participants?.some(p => studentIds.includes(String(p)))
    ).length;
    
    return {
        teacher,
        studentsCount: students.length,
        totalQuestions,
        roomsCreated,
        matchesWithStudents,
        devices: teacher.devices || [],
        violations: teacher.violations || [],
        activityLog: teacher.activityLog || []
    };
}

export async function getAllQuestionsFromAllTeachers() {
    requireDeveloper();
    const allQuestions = [];
    const grades = getDynamicGrades();
    for (const grade of grades) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        for (const q of questions) {
            allQuestions.push({
                ...q,
                grade,
                teacherId: q.teacherId || 'unknown',
                teacherName: getTeacherNameById(q.teacherId)
            });
        }
    }
    return allQuestions;
}

function getTeacherNameById(teacherId) {
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    return teacher ? teacher.name : 'غير معروف';
}

export async function updateGlobalQuestion(questionId, grade, updates) {
    requireDeveloper();
    const questions = await loadQuestionsFromIndexedDB(grade);
    const index = questions.findIndex(q => q.id === questionId);
    if (index === -1) throw new Error('السؤال غير موجود');
    questions[index] = { ...questions[index], ...updates };
    await saveQuestionsToIndexedDB(grade, questions);
}

export async function deleteGlobalQuestion(questionId, grade) {
    requireDeveloper();
    const questions = await loadQuestionsFromIndexedDB(grade);
    const filtered = questions.filter(q => q.id !== questionId);
    await saveQuestionsToIndexedDB(grade, filtered);
}

export function getActiveRooms() {
    return dbLight.activeRooms || [];
}

export function logDeviceForTeacher(teacherId, deviceInfo) {
    requireDeveloper();
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (teacher) {
        if (!teacher.devices) teacher.devices = [];
        const existingIndex = teacher.devices.findIndex(d => d.deviceId === deviceInfo.deviceId);
        if (existingIndex !== -1) {
            teacher.devices[existingIndex].lastSeen = Date.now();
        } else {
            teacher.devices.push({ ...deviceInfo, firstSeen: Date.now(), lastSeen: Date.now() });
        }
        save();
    }
}

export function addViolation(teacherId, violationType, details) {
    requireDeveloper();
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (teacher) {
        if (!teacher.violations) teacher.violations = [];
        teacher.violations.push({
            type: violationType,
            date: Date.now(),
            details,
            resolved: false
        });
        save();
    }
}

export function addActivityLog(teacherId, action, details) {
    requireDeveloper();
    const teacher = dbLight.students.find(s => s.isTeacher && String(s.teacherId) === String(teacherId));
    if (teacher) {
        if (!teacher.activityLog) teacher.activityLog = [];
        teacher.activityLog.push({
            action,
            timestamp: Date.now(),
            details
        });
        if (teacher.activityLog.length > 200) teacher.activityLog.shift();
        save();
    }
}

// دوال إضافية تحتاج دوال Firestore – تم إصلاحها جزئياً
export async function unsuspendTeacher(teacherCode) {
    requireDeveloper();
    const teacherDoc = await getTeacherDocumentByCode(teacherCode);
    if (!teacherDoc) return { success: false, error: 'المعلم غير موجود' };
    await updateDoc(teacherDoc.ref, { status: 'active' });
    await addAuditLog('رفع تعليق عن معلم', teacherCode);
    return { success: true };
}

export async function allowNewDevice(teacherCode, deviceFingerprint, ip) {
    requireDeveloper();
    const teacherDoc = await getTeacherDocumentByCode(teacherCode);
    if (!teacherDoc) return { success: false, error: 'المعلم غير موجود' };
    await updateDoc(teacherDoc.ref, {
        registeredDevice: deviceFingerprint,
        registeredIP: ip,
        status: 'active',
        lastDeviceSeen: new Date().toISOString()
    });
    await addAuditLog('السماح بجهاز جديد للمعلم', `${teacherCode} - بصمة: ${deviceFingerprint}`);
    return { success: true };
}

export async function resolveViolation(violationId) {
    requireDeveloper();
    const violationRef = doc(db, 'violations', violationId);
    await updateDoc(violationRef, { resolved: true, resolvedAt: serverTimestamp() });
    await addAuditLog('حل مخالفة', violationId);
    return { success: true };
}

// دوال مساعدة مفقودة – إضافتها لتجنب الأخطاء
async function getTeacherDocumentByCode(teacherCode) {
    const q = query(collection(db, 'teachers'), where('code', '==', teacherCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { ref: snapshot.docs[0].ref, data: snapshot.docs[0].data() };
}

async function addAuditLog(action, target) {
    try {
        await addDoc(collection(db, 'adminAuditLogs'), {
            action,
            target,
            adminId: sessionStorage.getItem('peak_teacher_code'),
            timestamp: serverTimestamp()
        });
    } catch(e) { console.error(e); }
}