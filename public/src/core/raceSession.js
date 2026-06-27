// src/core/raceSession.js
// إدارة جلسات السباق المتعددة (RaceSessionManager)
// يتيح تشغيل سباقات متعددة بشكل متزامن دون استخدام window.raceData
// [FIX] تم تنظيف usedQuestionsPerPlayer و globalUsedIds عند تدمير الجلسة لمنع تسرب الذاكرة
// [FIX] تم إضافة getActiveRaceData() لتسهيل الوصول إلى بيانات الجلسة النشطة
// [FIX] تحسين acquireLock بمهلة 10 ثوانٍ لمنع الأقفال المعلقة
// [FIX] إضافة دالة clearAllSessions لتنظيف جميع الجلسات دفعة واحدة
// [NEW] إضافة حقل isTrainingMode في raceData لدعم وضع التدريب

// تعريف البيانات الافتراضية للسباق
function makeDefaultRaceData() {
    return {
        players: [], teams: [], isTeam: false,
        activeEntityId: null, turn: 0, timerInterval: null, timerTimeout: null,
        timeLeft: 12, goal: 10, timeLimit: 12, gameMode: 'normal', memoryTimeout: null,
        wanderingTrophyTeam: null, wanderingTrophyCount: 0,
        minedQuestionsRemaining: 0, minedQuestionsTotal: 0,
        minedQuestionActive: false, minedQuestionCooldown: 0,
        surpriseUsed: false, lastWrongTeam: null, revengeAvailable: false,
        relayTurn: 0, relayMemberIndex: 0,
        survivalLives: {}, speedrunTimePenalty: 3, quizrushStreak: {},
        memoryHideQuestion: false, soloMinedActive: false, forceBetActive: false,
        onlineMode: false, onlineRoom: null,
        soloMinedCooldown: 0,
        _timerRaf: null, _timerStart: null, _timerDeadline: null,
        raceLock: false,
        _lockTimestamp: null,
        sessionStats: {},
        questionNumber: 0,
        forceHardMode: false,
        allPlayers: [],
        activePlayerIndex: 0,
        surpriseMode: false,
        consecutiveCorrect: {},
        surpriseCardsUsed: {},
        processingSurprise: false,
        revengeExpiry: null,
        savedTimeLeft: 0,
        currentSurpriseCard: null,
        _gameEnded: false,
        _pendingExtraCard: false,
        isTrainingMode: false      // ✅ جديد: وضع التدريب
    };
}

// مدير الجلسات (محسن)
export const RaceSessionManager = {
    sessions: new Map(),      // key: sessionId, value: session object
    activeId: null,           // معرف الجلسة النشطة حالياً (للتطوير فقط)

    /**
     * إنشاء جلسة سباق جديدة
     * @param {Object} config - إعدادات أولية (اختياري)
     * @returns {string} sessionId
     */
    create(config = {}) {
        const id = 'race_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        const session = {
            id,
            raceData: { ...makeDefaultRaceData(), ...config },
            activeGame: [],          // الأسئلة المتبقية
            usedQuestionsPerPlayer: {}, // لكل لاعب الأسئلة المستخدمة
            globalUsedIds: new Set(),    // الأسئلة المستخدمة عالمياً
            currentSelectedQuestion: null
        };
        this.sessions.set(id, session);
        console.log(`✅ تم إنشاء جلسة جديدة: ${id}`);
        return id;
    },

    /**
     * الحصول على جلسة بواسطة معرفها
     * @param {string} id
     * @returns {Object|null}
     */
    getSession(id) {
        return this.sessions.get(id) || null;
    },

    /**
     * تحديث جلسة كاملة (أو دمج البيانات)
     * @param {string} id
     * @param {Object} newData - البيانات الجديدة للجلسة
     * @returns {boolean} نجاح أو فشل
     */
    updateSession(id, newData) {
        const session = this.sessions.get(id);
        if (!session) return false;
        // دمج البيانات (بدون استبدال كامل)
        Object.assign(session, newData);
        if (newData.raceData) {
            Object.assign(session.raceData, newData.raceData);
        }
        if (newData.activeGame) session.activeGame = newData.activeGame;
        if (newData.usedQuestionsPerPlayer) session.usedQuestionsPerPlayer = newData.usedQuestionsPerPlayer;
        if (newData.globalUsedIds) session.globalUsedIds = newData.globalUsedIds;
        if (newData.currentSelectedQuestion) session.currentSelectedQuestion = newData.currentSelectedQuestion;
        return true;
    },

    /**
     * حذف جلسة (بعد انتهاء السباق أو إلغائه)
     * @param {string} id
     */
    destroy(id) {
        const session = this.sessions.get(id);
        if (session) {
            // تنظيف المؤقتات
            if (session.raceData?._timerRaf) cancelAnimationFrame(session.raceData._timerRaf);
            if (session.raceData?.timerInterval) clearInterval(session.raceData.timerInterval);
            if (session.raceData?.timerTimeout) clearTimeout(session.raceData.timerTimeout);
            if (session.raceData?.memoryTimeout) clearTimeout(session.raceData.memoryTimeout);
            
            // ✅ إصلاح تسرب الذاكرة: تنظيف usedQuestionsPerPlayer
            if (session.usedQuestionsPerPlayer) {
                Object.values(session.usedQuestionsPerPlayer).forEach(set => {
                    if (set && typeof set.clear === 'function') set.clear();
                });
                session.usedQuestionsPerPlayer = null;
            }
            
            // ✅ تنظيف globalUsedIds
            if (session.globalUsedIds && typeof session.globalUsedIds.clear === 'function') {
                session.globalUsedIds.clear();
                session.globalUsedIds = null;
            }
            
            // إزالة مراجع أخرى قد تسبب تسرباً
            session.activeGame = null;
            session.currentSelectedQuestion = null;
            session.raceData = null;
        }
        this.sessions.delete(id);
        if (this.activeId === id) {
            this.activeId = null;
            window.__activeRaceSession = null;
        }
        console.log(`🗑️ تم حذف جلسة: ${id}`);
    },

    /**
     * تعيين الجلسة النشطة (للتسهيل المؤقت، سيتم التخلص منه لاحقاً)
     * @param {string} id
     * @returns {boolean}
     */
    setActive(id) {
        if (id && !this.sessions.has(id)) return false;
        this.activeId = id;
        window.__activeRaceSession = id ? this.sessions.get(id) : null;
        return true;
    },

    /**
     * الحصول على الجلسة النشطة
     * @returns {Object|null}
     */
    getActive() {
        return this.activeId ? this.sessions.get(this.activeId) : null;
    },

    /**
     * الحصول على بيانات السباق للجلسة النشطة (اختصار)
     * @returns {Object|null}
     */
    getActiveData() {
        return this.getActive()?.raceData || null;
    },

    /**
     * الحصول على بيانات السباق للجلسة النشطة (اسم بديل للسهولة)
     * @returns {Object|null}
     */
    getActiveRaceData() {
        return this.getActiveData();
    },

    /**
     * قفل الجلسة لمنع التزامن (محسن)
     * @param {string} sessionId
     * @returns {boolean}
     */
    acquireLock(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return false;
        const now = Date.now();
        const lockTime = session.raceData._lockTimestamp || now;
        // مهلة 10 ثوانٍ للقفل المعلق
        if (session.raceData.raceLock && (now - lockTime) > 10000) {
            console.warn(`⚠️ Race lock hang detected for session ${sessionId} – auto-releasing`);
            session.raceData.raceLock = false;
            session.raceData._lockTimestamp = null;
            if (typeof window.showFloatingNotification === 'function') {
                window.showFloatingNotification('⚠️ تم تحرير القفل تلقائياً بعد مهلة', 'warning', 2000);
            }
        }
        if (session.raceData.raceLock) return false;
        session.raceData.raceLock = true;
        session.raceData._lockTimestamp = Date.now();
        return true;
    },

    /**
     * تحرير قفل الجلسة
     * @param {string} sessionId
     */
    releaseLock(sessionId) {
        const session = this.getSession(sessionId);
        if (session) {
            session.raceData.raceLock = false;
            session.raceData._lockTimestamp = null;
        }
    },

    /**
     * تنظيف جميع الجلسات (للاستخدام عند تسجيل الخروج الكامل)
     */
    clearAllSessions() {
        // نسخ المفاتيح لأن destroy سيحذف من الخريطة
        const sessionIds = Array.from(this.sessions.keys());
        for (const id of sessionIds) {
            this.destroy(id);
        }
        this.activeId = null;
        window.__activeRaceSession = null;
        console.log('[RaceSessionManager] All sessions cleared');
    },

    /**
     * الحصول على البيانات الأساسية للسباق (للتوافق القديم، سيتم إزالتها لاحقاً)
     * ⚠️ هذه الدالة موجودة مؤقتاً فقط، لا تستخدمها في الكود الجديد.
     */
    _legacyGetActiveData() {
        return this.getActiveData();
    }
};

// ===================== إزالة الـ Proxies العالمية =====================
// ⚠️ تم تعطيل الـ Proxies لحل مشكلة تعدد الجلسات.
// أي كود قديم يستخدم window.raceData سيظهر خطأ، يجب تحديثه لاستخدام RaceSessionManager مباشرة.

// نحتفظ فقط بـ __activeRaceSession للتوافق المؤقت (سيتم إزالته)
if (window.__activeRaceSession === undefined) window.__activeRaceSession = null;

// دالة مساعدة لتحويل الكود القديم (تظهر تحذير في الكونسول)
export function getLegacyRaceData() {
    console.warn('⚠️ تحذير: استخدام getLegacyRaceData() بدلاً من window.raceData. يرجى تحديث الكود لاستخدام RaceSessionManager.getActiveData()');
    return RaceSessionManager.getActiveData();
}

// دالة مساعدة لتحويل الكود القديم (للسباقات النشطة)
export function getLegacyActiveGame() {
    console.warn('⚠️ تحذير: استخدام getLegacyActiveGame() بدلاً من window.ActiveGame. يرجى تحديث الكود');
    return RaceSessionManager.getActive()?.activeGame || [];
}

// ===================== دالتان للتوافق مع الكود القديم =====================
/**
 * قفل الجلسة النشطة (للاستخدام القديم بدون sessionId)
 * @param {string} [sessionId] - معرف الجلسة (اختياري، سيتم استخدام الجلسة النشطة إذا لم يُقدم)
 * @returns {boolean}
 */
export const acquireRaceLock = (sessionId) => {
    if (sessionId) {
        return RaceSessionManager.acquireLock(sessionId);
    }
    const activeId = RaceSessionManager.activeId;
    if (activeId) {
        return RaceSessionManager.acquireLock(activeId);
    }
    console.warn('⚠️ acquireRaceLock called without sessionId and no active session');
    return false;
};

/**
 * تحرير قفل الجلسة النشطة (للاستخدام القديم بدون sessionId)
 * @param {string} [sessionId] - معرف الجلسة (اختياري)
 */
export const releaseRaceLock = (sessionId) => {
    if (sessionId) {
        RaceSessionManager.releaseLock(sessionId);
        return;
    }
    const activeId = RaceSessionManager.activeId;
    if (activeId) {
        RaceSessionManager.releaseLock(activeId);
    } else {
        console.warn('⚠️ releaseRaceLock called without sessionId and no active session');
    }
};

// ===================== دالة التوافق مع الكود القديم (setupRaceProxies) =====================
/**
 * إعداد الـ Proxies العالمية (تم إلغاؤها لصالح RaceSessionManager)
 * هذه الدالة موجودة فقط للتوافق مع الكود القديم ولا تفعل شيئاً.
 * @deprecated استخدم RaceSessionManager بدلاً من window.raceData
 */
export const setupRaceProxies = () => {
    console.warn('⚠️ setupRaceProxies تم استدعاؤها ولكنها لا تفعل شيئاً (تم استبدالها بـ RaceSessionManager)');
};