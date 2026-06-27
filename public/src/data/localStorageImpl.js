// src/data/localStorageImpl.js
// هذا الملف هو التطبيق الفعلي للتخزين المحلي (localStorage)
// يحتوي على كل دوال القراءة والكتابة للبيانات
// ✅ تم تعديل دوال الاشتراك لدعم الخطط: مجاني، فضي، ذهبي، مطور
// ✅ تم إزالة أي ذكر لـ "platinum" نهائياً
// ✅ الفضي: حد 10 غرف شهرياً، حد 1000 سؤال إجمالي، مادة واحدة مقفلة
// ✅ الذهبي: غير محدود، يمكن تغيير المادة مرتين شهرياً
// ✅ المطور: غير محدود، صلاحية كاملة

// الكائن الرئيسي للتخزين (بنية البيانات)
let db = {
  students: [],           // قائمة الطلاب المسجلين
  studentStats: {},       // إحصائيات الطلاب (إجابات، دقة، إلخ)
  gameHistory: [],        // تاريخ المباريات
  customGrades: [],       // الصفوف المضافة من قبل المعلم
  teacherSubscriptions: {}, // اشتراكات المعلمين (خطة مجاني/فضي/ذهبي/مطور)
  tournaments: [],        // البطولات
  quickRaces: [],         // السباقات السريعة
  storeItems: [],         // عناصر المتجر
  userInventory: {},      // ممتلكات الطلاب من المتجر
  friends: {},            // قائمة الأصدقاء
  friendRequests: []      // طلبات الصداقة
};

// تحميل البيانات من localStorage عند بدء التشغيل
export function loadData() {
  const stored = localStorage.getItem('peak_platform_data');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      db = { ...db, ...parsed };
    } catch(e) { console.warn('فشل قراءة البيانات المخزنة', e); }
  }
  // التأكد من وجود الحقول الجديدة
  if (!db.tournaments) db.tournaments = [];
  if (!db.quickRaces) db.quickRaces = [];
  if (!db.storeItems) db.storeItems = [];
  if (!db.userInventory) db.userInventory = {};
  if (!db.friends) db.friends = {};
  if (!db.friendRequests) db.friendRequests = [];
  
  // محاولة ترحيل البيانات القديمة من النظام السابق إذا وجدت
  const oldData = localStorage.getItem('peak_platform_light');
  if (oldData && !localStorage.getItem('peak_platform_data')) {
    try {
      const parsedOld = JSON.parse(oldData);
      db.students = parsedOld.students || [];
      db.studentStats = parsedOld.studentStats || {};
      db.gameHistory = parsedOld.gameHistory || [];
      db.customGrades = parsedOld.customGrades || [];
      if (parsedOld.teacherSubscriptions) db.teacherSubscriptions = parsedOld.teacherSubscriptions;
      saveData();
      console.log('[Data] تم ترحيل البيانات القديمة إلى الهيكل الجديد');
    } catch(e) { console.warn('فشل الترحيل', e); }
  }
  
}

// حفظ البيانات إلى localStorage
export function saveData() {
  localStorage.setItem('peak_platform_data', JSON.stringify(db));
}

// ========== دوال الطلاب ==========
export function getStudents() {
  return db.students.filter(s => !s.isTeacher);
}
export function getStudentById(id) {
  return db.students.find(s => String(s.id) === String(id) && !s.isTeacher);
}
export function addStudent(student) {
  db.students.push(student);
  saveData();
  return student;
}
export function updateStudent(id, updates) {
  const index = db.students.findIndex(s => String(s.id) === String(id) && !s.isTeacher);
  if (index !== -1) {
    db.students[index] = { ...db.students[index], ...updates };
    saveData();
    return db.students[index];
  }
  return null;
}
export function deleteStudent(id) {
  db.students = db.students.filter(s => String(s.id) !== String(id) || s.isTeacher);
  delete db.studentStats[id];
  saveData();
}

// ========== إحصائيات الطلاب ==========
export function getStudentStats(studentId) {
  return db.studentStats[studentId] || { totalAnswers: 0, correctAnswers: 0, speedAvg: 0, categoryStats: {}, correctByCategory: {}, difficultyStats: {}, withdrawCount: 0 };
}
export function updateStudentStats(studentId, statsUpdate) {
  if (!db.studentStats[studentId]) db.studentStats[studentId] = {};
  Object.assign(db.studentStats[studentId], statsUpdate);
  saveData();
}

// ========== تاريخ المباريات ==========
export function getGameHistory(filters = {}) {
  let history = [...db.gameHistory];
  if (filters.startDate) history = history.filter(g => g.timestamp >= filters.startDate);
  if (filters.endDate) history = history.filter(g => g.timestamp <= filters.endDate);
  if (filters.studentId) history = history.filter(g => g.participants?.map(String).includes(String(filters.studentId)));
  return history;
}
export function addGameHistory(record) {
  db.gameHistory.unshift(record);
  saveData();
}

// ========== الصفوف ==========
export function getAllGrades() {
  const gradesSet = new Set();
  db.students.forEach(s => { if (s.grade) gradesSet.add(s.grade); });
  db.customGrades.forEach(g => gradesSet.add(g));
  return Array.from(gradesSet).sort();
}
export function addCustomGrade(grade) {
  if (!db.customGrades.includes(grade)) {
    db.customGrades.push(grade);
    saveData();
  }
}
export function removeCustomGrade(grade) {
  db.customGrades = db.customGrades.filter(g => g !== grade);
  saveData();
}

// ========== البطولات ==========
export function createTournament(data) {
  const newTournament = {
    id: 'trn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    status: 'waiting', // waiting, active, finished
    createdAt: Date.now(),
    players: [],       // { id, name, img, ready, eliminated, score }
    matches: [],       // { id, round, playerA, playerB, winner, status, startTime, endTime }
    marathonScores: {},
    winnerId: null,
    ...data
  };
  db.tournaments.push(newTournament);
  saveData();
  return newTournament;
}
export function getTournamentByCode(joinCode) {
  return db.tournaments.find(t => t.joinCode === joinCode && t.status !== 'finished');
}
export function getTournamentById(id) {
  return db.tournaments.find(t => t.id === id);
}
export function addPlayerToTournament(tournamentId, player) {
  const tournament = getTournamentById(tournamentId);
  if (!tournament) return false;
  if (tournament.players.some(p => p.id === player.id)) return false;
  tournament.players.push({ ...player, ready: false, eliminated: false, score: 0 });
  saveData();
  return true;
}
export function updateTournament(tournamentId, updates) {
  const index = db.tournaments.findIndex(t => t.id === tournamentId);
  if (index === -1) return false;
  db.tournaments[index] = { ...db.tournaments[index], ...updates };
  saveData();
  return true;
}

export function deleteTournament(tournamentId) {
  db.tournaments = db.tournaments.filter(t => t.id !== tournamentId);
  saveData();
}
export function getActiveTournaments() {
  return db.tournaments.filter(t => t.status === 'waiting' || t.status === 'active');
}

// ========== السباقات السريعة ==========
export function createQuickRace(data) {
  const newRace = {
    id: 'qr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    status: 'waiting',
    createdAt: Date.now(),
    players: [],
    marathonScores: {},
    winnerId: null,
    finishedAt: null,
    ...data
  };
  db.quickRaces.push(newRace);
  saveData();
  return newRace;
}
export function getQuickRaceByCode(joinCode) {
  return db.quickRaces.find(r => r.joinCode === joinCode && r.status !== 'finished');
}
export function addPlayerToQuickRace(raceId, player) {
  const race = db.quickRaces.find(r => r.id === raceId);
  if (!race) return false;
  if (race.players.some(p => p.id === player.id)) return false;
  race.players.push({ ...player, score: 0 });
  saveData();
  return true;
}
export function updateQuickRace(raceId, updates) {
  const index = db.quickRaces.findIndex(r => r.id === raceId);
  if (index === -1) return false;
  db.quickRaces[index] = { ...db.quickRaces[index], ...updates };
  saveData();
}
export function deleteQuickRace(raceId) {
  db.quickRaces = db.quickRaces.filter(r => r.id !== raceId);
  saveData();
}

// ========== دوال الاشتراكات (معدلة بالكامل لدعم silver و developer) ==========
export function getTeacherSubscription(teacherCode) {
    // تحديد الخطة بشكل افتراضي بناءً على كود المعلم (للتطوير والاختبار)
    let plan = 'free';
    if (teacherCode === '2222') plan = 'silver';
    if (teacherCode === '3333') plan = 'gold';
    if (teacherCode === '12345' || teacherCode === '29910141300038') plan = 'developer';
    
    if (!db.teacherSubscriptions[teacherCode]) {
        db.teacherSubscriptions[teacherCode] = {
            plan: plan,
            expiryDate: null,
            allowedSubject: null,
            totalQuestionsCount: 0,
            onlineRoomsUsedThisMonth: 0,
            subjectChangeCount: 0,
            lastResetDate: null
        };
    }
    return db.teacherSubscriptions[teacherCode];
}

// دالة مساعدة لإعادة تعيين العدادات الشهرية إذا لزم الأمر
export function resetTeacherMonthlyCountersIfNeeded(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    if (sub.lastResetDate !== currentMonthKey) {
        sub.onlineRoomsUsedThisMonth = 0;
        if (sub.plan === 'gold' || sub.plan === 'developer') {
            sub.subjectChangeCount = 0;
        }
        sub.lastResetDate = currentMonthKey;
        saveData();
    }
}

// التحقق من صلاحية إنشاء غرفة
export function canTeacherCreateRoom(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    resetTeacherMonthlyCountersIfNeeded(teacherCode);
    const plan = sub.plan;
    
    if (plan === 'free') return false;
    if (plan === 'silver') return sub.onlineRoomsUsedThisMonth < 10;
    if (plan === 'gold' || plan === 'developer') return true;
    return false;
}

// زيادة عداد الغرف الشهرية
export function incrementTeacherRoomCount(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    const plan = sub.plan;
    
    if (plan === 'silver') {
        if (sub.onlineRoomsUsedThisMonth < 10) {
            sub.onlineRoomsUsedThisMonth++;
            saveData();
            return true;
        }
        return false;
    }
    if (plan === 'gold' || plan === 'developer') {
        sub.onlineRoomsUsedThisMonth++;
        saveData();
        return true;
    }
    return false;
}

// التحقق من صلاحية رفع الأسئلة
export function canTeacherUploadQuestions(teacherCode, subject, newQuestionsCount) {
    const sub = getTeacherSubscription(teacherCode);
    const plan = sub.plan;
    
    if (plan === 'free') {
        if (sub.allowedSubject === null) return { allowed: true, needReplace: false };
        if (sub.allowedSubject !== subject) {
            return { allowed: false, message: `الخطة المجانية تسمح بمادة واحدة فقط. المادة المسموحة: ${sub.allowedSubject}` };
        }
        const newTotal = sub.totalQuestionsCount + newQuestionsCount;
        if (newTotal > 150) {
            return { allowed: false, message: `لا يمكن تجاوز 150 سؤالاً في الباقة المجانية. لديك ${sub.totalQuestionsCount}` };
        }
        return { allowed: true, needReplace: false };
    }
    
    if (plan === 'silver') {
        if (sub.allowedSubject === null) return { allowed: true, needReplace: false };
        if (sub.allowedSubject !== subject) {
            return { allowed: false, message: `الباقة الفضية مقفلة على مادة "${sub.allowedSubject}". لا يمكن تغييرها.` };
        }
        const newTotal = sub.totalQuestionsCount + newQuestionsCount;
        if (newTotal > 1000) {
            return { allowed: false, message: `لا يمكن تجاوز 1000 سؤال في الباقة الفضية. لديك ${sub.totalQuestionsCount}` };
        }
        return { allowed: true, needReplace: false };
    }
    
    if (plan === 'gold') {
        resetTeacherMonthlyCountersIfNeeded(teacherCode);
        if (sub.allowedSubject === null) return { allowed: true, needReplace: false };
        if (sub.allowedSubject !== subject) {
            if (sub.subjectChangeCount >= 2) {
                return { allowed: false, message: 'لقد استنفدت حد تغيير المادة هذا الشهر (مرتين). يمكنك التغيير في الشهر القادم.' };
            }
            return { allowed: true, needReplace: true, oldSubject: sub.allowedSubject };
        }
        return { allowed: true, needReplace: false };
    }
    
    if (plan === 'developer') {
        return { allowed: true, needReplace: false };
    }
    
    return { allowed: false, message: 'خطة غير معروفة' };
}

// دوال مساعدة أخرى
export function updateTeacherTotalQuestions(teacherCode, delta) {
    const sub = getTeacherSubscription(teacherCode);
    sub.totalQuestionsCount += delta;
    saveData();
}

export function setLockedSubject(teacherCode, subject) {
    const sub = getTeacherSubscription(teacherCode);
    sub.allowedSubject = subject;
    saveData();
}

export function getLockedSubject(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    return sub.allowedSubject || null;
}

export function getTeacherPlan(teacherCode) {
    const sub = getTeacherSubscription(teacherCode);
    return sub.plan;
}

export function recordTeacherSubjectChange(teacherCode, newSubject) {
    const sub = getTeacherSubscription(teacherCode);
    if (sub.plan === 'gold') {
        sub.subjectChangeCount = (sub.subjectChangeCount || 0) + 1;
        sub.allowedSubject = newSubject;
        saveData();
    }
}

export function deleteTeacherQuestionsBySubject(teacherCode, subject) {
    console.warn(`deleteTeacherQuestionsBySubject called for ${teacherCode}, subject ${subject}`);
}

// تحميل البيانات فور استيراد الملف
loadData();