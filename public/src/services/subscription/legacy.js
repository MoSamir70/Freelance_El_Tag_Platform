// legacy.js - دوال التوافق مع الكود القديم من subscriptionGuard.js
// يستخدم النظام الجديد للاشتراكات ويوفر الواجهة القديمة

import { getTeacherSubscription, refreshTeacherPlanIfExpired, invalidateTeacherSubscriptionCache, getTeacherDocumentByCode } from './teacherData.js';
import { getPlanDetails, PLANS, DEVELOPER_CODE } from './plans.js';
import { getTeacherStudentCount, getTeacherQuestionCount, incrementTeacherRoomCount } from './counters.js';
import { checkTeacherAccess, canAccessAnalytics, getUserPlan } from './checks.js';
import { db, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, getDoc } from '../../firebase/init.js';
import { soloModes, teamModes } from '../../constants.js';

// ========== دوال الحدود (مطلوبة في crud.js) ==========
export async function getMaxStudents(teacherId) {
  const sub = await getTeacherSubscription(teacherId);
  return sub.maxStudents;
}

export async function getMaxQuestions(teacherId) {
  const sub = await getTeacherSubscription(teacherId);
  return sub.maxQuestions;
}

export function getAllowedModes(plan) {
  const details = getPlanDetails(plan);
  return details.allowedModes || [];
}

export function isThemeAllowed(plan, themeName) {
  const details = getPlanDetails(plan);
  if (details.allowedThemes === 'all') return true;
  return details.allowedThemes?.includes(themeName) || false;
}

export async function canAccessGlobalArena(userId, isTeacher = true) {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return true;
  if (isTeacher) {
    if (userId === DEVELOPER_CODE) return true;
    const plan = await getUserPlan(userId, true);
    const details = getPlanDetails(plan);
    return details.canAccessGlobalArena || false;
  }
  try {
    const { getStudentById } = await import('../dataService/student.js');
    const student = await getStudentById(userId);
    if (!student || !student.teacherId) return false;
    const teacherPlan = await getUserPlan(student.teacherId, true);
    const details = getPlanDetails(teacherPlan);
    return details.canAccessGlobalArena || false;
  } catch(e) { return false; }
}

export async function canPlayOnline(userId, isTeacher = true) {
  const plan = await getUserPlan(userId, isTeacher);
  const details = getPlanDetails(plan);
  return details.canPlayOnline || false;
}

export async function canPlayTeamMode(userId, isTeacher = true) {
  const plan = await getUserPlan(userId, isTeacher);
  const details = getPlanDetails(plan);
  return details.canPlayTeamMode || false;
}

export async function getMaxSubjects(teacherId) {
  const plan = await getUserPlan(teacherId, true);
  const details = getPlanDetails(plan);
  return details.maxSubjects || Infinity;
}

export async function canStudentCreateRoom(studentId) {
  const { getStudentById } = await import('../dataService/student.js');
  const student = await getStudentById(studentId);
  if (!student || !student.teacherId) return false;
  const teacherPlan = await getUserPlan(student.teacherId, true);
  const details = getPlanDetails(teacherPlan);
  return details.canStudentCreateRoom || false;
}

export function getPlanLimits(plan) {
  const details = getPlanDetails(plan);
  return {
    maxStudents: details.maxStudents,
    maxQuestions: details.maxQuestions,
    maxRoomsPerMonth: details.maxOnlineGamesPerMonth,
    allowedModes: details.allowedModes,
    allowedThemes: details.allowedThemes,
    canAccessAnalytics: details.canAccessAnalytics,
    canAccessGlobalArena: details.canAccessGlobalArena,
    canStudentCreateRoom: details.canStudentCreateRoom,
    canPlayOnline: details.canPlayOnline,
    canAccessLeaderboard: details.canAccessLeaderboard,
    canPlayTeamMode: details.canPlayTeamMode,
    maxSubjects: details.maxSubjects
  };
}

export async function canAccessLeaderboard(userId, isStudent = false) {
  if (userId === DEVELOPER_CODE) return true;
  try {
    let plan;
    if (isStudent) {
      plan = sessionStorage.getItem('student_teacher_plan') || 'free';
      if (plan === 'gold' || plan === 'developer') return true;
      return plan === 'silver';
    } else {
      plan = await getUserPlan(userId, true);
      const details = getPlanDetails(plan);
      return details.canAccessLeaderboard === true;
    }
  } catch(e) { return false; }
}

export async function getTeacherMonthlyUsage(teacherId) {
  const sub = await getTeacherSubscription(teacherId);
  return { roomsUsed: sub.onlineRoomsUsedThisMonth || 0 };
}

export async function incrementMonthlyRoomCount(teacherId) {
  await incrementTeacherRoomCount(teacherId);
}

// ========== دوال الجلسة (مطلوبة في platform.html) ==========
export async function refreshTeacherSession(teacherCode) {
  const result = await checkTeacherAccess(teacherCode);
  if (!result.allowed) {
    sessionStorage.clear();
    if (window.location.pathname.includes('platform.html') || window.location.pathname.includes('stats-preview.html')) {
      window.location.href = 'index.html?expired=true';
    }
    return false;
  }
  sessionStorage.setItem('teacher_plan', result.plan);
  sessionStorage.setItem('teacher_expiry', result.expiryDate ? result.expiryDate.toISOString() : '');
  return true;
}

export function clearSubscriptionCache(teacherCode) {
  invalidateTeacherSubscriptionCache(teacherCode);
}

// ========== دوال الجهاز (لمنع تعدد الأجهزة) ==========
export function getDeviceFingerprint() {
  try {
    const screen = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    const platform = navigator.platform;
    const userAgent = navigator.userAgent;
    let fingerprint = `${screen}|${timezone}|${language}|${platform}|${userAgent.substring(0, 100)}`;
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  } catch(e) {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
  }
}

export async function getUserIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch(e) { return 'unknown'; }
}

export async function checkDeviceAccess(teacherCode, isDeveloperSimulating = false) {
  if (teacherCode === DEVELOPER_CODE || isDeveloperSimulating) return { allowed: true };
  try {
    const teacherDoc = await getTeacherDocumentByCode(teacherCode);
    if (!teacherDoc) return { allowed: false, message: 'المعلم غير موجود' };
    const teacherData = teacherDoc.data;
    const registeredDevice = teacherData.registeredDevice;
    const status = teacherData.status || 'active';
    if (status === 'suspended_device') {
      return { allowed: false, message: 'تم تعليق حسابك بسبب محاولة دخول من جهاز جديد. يرجى التواصل مع المطور.', isBlocked: true };
    }
    const currentDevice = getDeviceFingerprint();
    if (!registeredDevice) return { allowed: true, isNewDevice: true };
    if (registeredDevice === currentDevice) return { allowed: true };
    return { allowed: false, message: 'تم اكتشاف محاولة دخول من جهاز جديد. تم تعليق حسابك لحين مراجعة المطور.', isNewDevice: true };
  } catch(e) { return { allowed: true }; }
}

export async function registerDeviceForTeacher(teacherCode, deviceFingerprint, ip) {
  if (teacherCode === DEVELOPER_CODE) return true;
  try {
    const teacherDoc = await getTeacherDocumentByCode(teacherCode);
    if (!teacherDoc) return false;
    await updateDoc(teacherDoc.ref, {
      registeredDevice: deviceFingerprint,
      registeredIP: ip,
      status: 'active',
      lastDeviceSeen: new Date().toISOString()
    });
    return true;
  } catch(e) { return false; }
}

export async function logDeviceViolation(teacherCode, teacherName, deviceFingerprint, ip) {
  if (teacherCode === DEVELOPER_CODE) return;
  try {
    const violationsRef = collection(db, 'violations');
    await addDoc(violationsRef, {
      teacherId: teacherCode,
      teacherName: teacherName,
      type: 'multiple_devices',
      details: `محاولة تسجيل دخول من جهاز جديد (بصمة: ${deviceFingerprint?.substring(0, 10)}...، IP: ${ip})`,
      timestamp: serverTimestamp(),
      resolved: false,
      notes: '',
      deviceFingerprint,
      ip
    });
  } catch(e) {}
}

// ========== دوال أوضاع اللعب (لـ gameSetupNew.js) ==========
export function getAllowedIndividualModes(plan) {
  const details = getPlanDetails(plan);
  if (plan === 'developer' || plan === 'gold') return soloModes.map(m => m.id);
  if (plan === 'silver') {
    return [
      'solo_classic', 'solo_memory', 'solo_mined', 'solo_speedrun', 'solo_survival', 'solo_quizrush'
    ];
  }
  return ['solo_classic', 'solo_memory', 'solo_marathon'];
}

export function getAllowedTeamModes(plan) {
  if (plan === 'developer' || plan === 'gold') return teamModes.map(m => m.id);
  if (plan === 'silver') {
    return ['team_relay', 'team_trophy', 'team_penalty'];
  }
  return [];
}

export function isModeAllowed(modeId, plan) {
  const individual = getAllowedIndividualModes(plan);
  const team = getAllowedTeamModes(plan);
  return individual.includes(modeId) || team.includes(modeId);
}

// ========== دوال الطلاب (لـ auth.js) ==========
export async function canStudentJoin(studentId, teacherPlan) {
    if (teacherPlan === 'developer') teacherPlan = 'gold';
    if (teacherPlan === 'gold') return { allowed: true, message: '', remaining: null };
    if (teacherPlan === 'free') {
        return { allowed: false, message: 'معلمك مشترك في الباقة المجانية، لا يمكنك المشاركة في المباريات الأونلاين. يرجى التواصل معه لترقية الاشتراك.', remaining: null };
    }
    if (teacherPlan === 'silver') {
        const usage = await getTeacherMonthlyUsage(studentId);
        const maxAllowed = 10;
        const used = usage.roomsUsed || 0;
        if (used >= maxAllowed) {
            return { allowed: false, message: `معلمك استنفذ عدد المباريات الشهرية المسموحة (${maxAllowed}/ شهر). سيتم التجديد الشهر القادم.`, remaining: 0 };
        }
        return { allowed: true, message: '', remaining: maxAllowed - used };
    }
    return { allowed: false, message: 'خطأ غير معروف في صلاحية الاشتراك.', remaining: null };
}

export async function checkStudentAccess(studentId) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return { allowed: true };
    }
    const { getStudentById } = await import('../dataService/student.js');
    const student = await getStudentById(studentId);
    if (!student) return { allowed: false, message: 'الطالب غير موجود' };
    const teacherId = student.teacherId;
    if (!teacherId) return { allowed: true };
    const teacherAccess = await checkTeacherAccess(teacherId);
    if (!teacherAccess.allowed) return { allowed: false, message: teacherAccess.message };
    const teacherPlan = teacherAccess.plan;
    return await canStudentJoin(studentId, teacherPlan);
}