// ===================== src/core/raceQuestions.js =====================
// دوال اختيار الأسئلة التكيفية (Adaptive Question Selection)
// معدلة لدعم جلسات السباق المتعددة (sessionId)

import { RaceSessionManager } from './raceSession.js';
import { dbLight } from '../db/localstorage.js';

/**
 * اختيار سؤال مناسب للاعب بناءً على:
 * - الأسئلة المتاحة
 * - الأسئلة المستخدمة عالمياً ولللاعب
 * - نسبة التقدم في السباق (progressPercent)
 * - إحصائيات الطالب (الدقة)
 * - وضع الصعوبة الإجبارية (forceHardMode من الجلسة)
 * @param {string} sessionId - معرف جلسة السباق
 * @param {Object} player - كائن اللاعب
 * @param {Array} availableQuestions - قائمة الأسئلة المتاحة
 * @param {Set} globalUsedIds - معرفات الأسئلة المستخدمة عالمياً
 * @param {Set} playerUsedIds - معرفات الأسئلة المستخدمة من قبل اللاعب
 * @param {number} progressPercent - نسبة التقدم (0-100)
 * @returns {Object|null} - السؤال المختار أو null
 */
export function getAdaptiveQuestion(sessionId, player, availableQuestions, globalUsedIds, playerUsedIds, progressPercent) {
    if (!availableQuestions.length) return null;

    // الحصول على الجلسة للوصول إلى إعدادات القوة القصوى (forceHardMode)
    const session = RaceSessionManager.getSession(sessionId);
    const forceHardMode = session?.raceData?.forceHardMode || false;

    // 1. أسئلة جديدة (غير مستخدمة عالمياً ولا للاعب)
    let freshQuestions = availableQuestions.filter(q => 
        !globalUsedIds.has(q.uniqueId) && !playerUsedIds.has(q.uniqueId)
    );
    
    // 2. إذا وجدت أسئلة جديدة
    if (freshQuestions.length > 0) {
        // تفعيل الوضع الصعب إذا كان مطلوباً
        if (forceHardMode) {
            let hardFresh = freshQuestions.filter(q => q.difficulty === 'صعب');
            if (hardFresh.length > 0) {
                return hardFresh[Math.floor(Math.random() * hardFresh.length)];
            }
            return freshQuestions[Math.floor(Math.random() * freshQuestions.length)];
        }
        
        // المنطق التكيفي العادي
        let stats = dbLight.studentStats[player.id] || { totalAnswers: 0, correctAnswers: 0 };
        let accuracy = stats.totalAnswers ? stats.correctAnswers / stats.totalAnswers : 0.5;
        let easyRatio = 0.7, mediumRatio = 0.3, hardRatio = 0;
        if (progressPercent < 30) { easyRatio = 0.7; mediumRatio = 0.3; hardRatio = 0; }
        else if (progressPercent < 70) { easyRatio = 0; mediumRatio = 0.5; hardRatio = 0.5; }
        else { easyRatio = 0; mediumRatio = 0.2; hardRatio = 0.8; }
        if (accuracy > 0.7) { hardRatio += 0.2; mediumRatio -= 0.1; easyRatio -= 0.1; }
        else if (accuracy < 0.4) { easyRatio += 0.2; mediumRatio -= 0.1; hardRatio -= 0.1; }
        
        let easyQs = freshQuestions.filter(q => q.difficulty === 'سهل');
        let mediumQs = freshQuestions.filter(q => q.difficulty === 'متوسط');
        let hardQs = freshQuestions.filter(q => q.difficulty === 'صعب');
        let rand = Math.random();
        if (rand < easyRatio && easyQs.length) return easyQs[Math.floor(Math.random() * easyQs.length)];
        if (rand < easyRatio + mediumRatio && mediumQs.length) return mediumQs[Math.floor(Math.random() * mediumQs.length)];
        if (hardQs.length) return hardQs[Math.floor(Math.random() * hardQs.length)];
        
        return freshQuestions[Math.floor(Math.random() * freshQuestions.length)];
    }
    
    // 3. إذا لم يبقَ أسئلة جديدة، نضطر لإعادة استخدام أسئلة قديمة
    let oldQuestions = availableQuestions.filter(q => !playerUsedIds.has(q.uniqueId));
    if (oldQuestions.length > 0) {
        if (forceHardMode) {
            let hardOld = oldQuestions.filter(q => q.difficulty === 'صعب');
            if (hardOld.length) return hardOld[Math.floor(Math.random() * hardOld.length)];
            return oldQuestions[Math.floor(Math.random() * oldQuestions.length)];
        }
        
        let stats = dbLight.studentStats[player.id] || { totalAnswers: 0, correctAnswers: 0 };
        let accuracy = stats.totalAnswers ? stats.correctAnswers / stats.totalAnswers : 0.5;
        let easyRatio = 0.7, mediumRatio = 0.3, hardRatio = 0;
        if (progressPercent < 30) { easyRatio = 0.7; mediumRatio = 0.3; hardRatio = 0; }
        else if (progressPercent < 70) { easyRatio = 0; mediumRatio = 0.5; hardRatio = 0.5; }
        else { easyRatio = 0; mediumRatio = 0.2; hardRatio = 0.8; }
        if (accuracy > 0.7) { hardRatio += 0.2; mediumRatio -= 0.1; easyRatio -= 0.1; }
        else if (accuracy < 0.4) { easyRatio += 0.2; mediumRatio -= 0.1; hardRatio -= 0.1; }
        
        let easyQs = oldQuestions.filter(q => q.difficulty === 'سهل');
        let mediumQs = oldQuestions.filter(q => q.difficulty === 'متوسط');
        let hardQs = oldQuestions.filter(q => q.difficulty === 'صعب');
        let rand = Math.random();
        if (rand < easyRatio && easyQs.length) return easyQs[Math.floor(Math.random() * easyQs.length)];
        if (rand < easyRatio + mediumRatio && mediumQs.length) return mediumQs[Math.floor(Math.random() * mediumQs.length)];
        if (hardQs.length) return hardQs[Math.floor(Math.random() * hardQs.length)];
        return oldQuestions[Math.floor(Math.random() * oldQuestions.length)];
    }
    
    // 4. أخيراً، أي شيء متاح
    return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
}