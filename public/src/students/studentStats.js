// src/students/studentStats.js
// إحصائيات الطالب: تحديث الإحصائيات، حساب المستوى، الترتيب والتغيرات
// [FIX] استخدام استيراد ديناميكي مع fallback إلى dbLight لمنع أخطاء التصدير

import { LEVELS } from '../constants.js';
import { RaceSessionManager } from '../core/raceSession.js';
import { dbLight, loadLightData, saveLightData } from '../db/localstorage.js';
import { fetchAllCachedData } from '../services/dataService.js';

// ===================== Throttle helper =====================
const updateStatsThrottle = new Map();

function throttleUpdate(studentId, callback, limitMs = 500) {
    const now = Date.now();
    const last = updateStatsThrottle.get(studentId) || 0;
    if (now - last >= limitMs) {
        updateStatsThrottle.set(studentId, now);
        callback();
    }
}

// ===================== دوال مساعدة آمنة (تستخدم dataService أو dbLight) =====================

async function safeGetStudents() {
    try {
        const { getStudents } = await import('../services/dataService.js');
        if (typeof getStudents === 'function') return await getStudents();
    } catch(e) {}
    loadLightData();
    return dbLight.students || [];
}

async function safeGetStudentById(id) {
    try {
        const { getStudentById } = await import('../services/dataService.js');
        if (typeof getStudentById === 'function') return await getStudentById(id);
    } catch(e) {}
    loadLightData();
    return dbLight.students?.find(s => String(s.id) === String(id)) || null;
}

async function safeUpdateStudent(id, updates) {
    try {
        const { updateStudent } = await import('../services/dataService.js');
        if (typeof updateStudent === 'function') return await updateStudent(id, updates);
    } catch(e) {}
    loadLightData();
    const index = dbLight.students.findIndex(s => String(s.id) === String(id));
    if (index !== -1) {
        dbLight.students[index] = { ...dbLight.students[index], ...updates };
        saveLightData();
    }
}

async function safeGetStudentStats(id) {
    try {
        const { getStudentStats } = await import('../services/dataService.js');
        if (typeof getStudentStats === 'function') return await getStudentStats(id);
    } catch(e) {}
    loadLightData();
    return dbLight.studentStats?.[id] || {
        totalAnswers: 0,
        correctAnswers: 0,
        speedAvg: 0,
        categoryStats: {},
        correctByCategory: {},
        lessonStats: {},
        correctByLesson: {},
        difficultyStats: {},
        withdrawCount: 0
    };
}

async function safeUpdateStudentStats(id, updates) {
    try {
        const { updateStudentStats } = await import('../services/dataService.js');
        if (typeof updateStudentStats === 'function') return await updateStudentStats(id, updates);
    } catch(e) {}
    loadLightData();
    if (!dbLight.studentStats) dbLight.studentStats = {};
    dbLight.studentStats[id] = { ...dbLight.studentStats[id], ...updates };
    saveLightData();
}

async function safeGetGameHistory(filters = {}) {
    try {
        const { getGameHistory } = await import('../services/dataService.js');
        if (typeof getGameHistory === 'function') return await getGameHistory(filters);
    } catch(e) {}
    loadLightData();
    let history = dbLight.gameHistory || [];
    if (filters.startDate) history = history.filter(g => g.timestamp >= filters.startDate);
    if (filters.endDate) history = history.filter(g => g.timestamp <= filters.endDate);
    if (filters.studentId) history = history.filter(g => g.participants?.map(String).includes(String(filters.studentId)));
    return history;
}

// ===================== حساب المستوى =====================
export function calculateLevel(score) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (score >= LEVELS[i].min) return LEVELS[i];
    }
    return LEVELS[0];
}

export function getLevelDisplay(student) {
    const level = calculateLevel(student.score);
    return level.name;
}

// ===================== الدالة الفعلية لتحديث الإحصائيات =====================
async function _updateStatsInternal(studentId, correct, points, timeSpent, category, lesson, isWithdraw = false, currentQuestion = null) {
    let stats = await safeGetStudentStats(studentId);
    if (!stats) {
        stats = {
            totalAnswers: 0,
            correctAnswers: 0,
            speedAvg: 0,
            categoryStats: {},
            correctByCategory: {},
            lessonStats: {},
            correctByLesson: {},
            difficultyStats: {},
            withdrawCount: 0
        };
    }

    if (isWithdraw) {
        stats.withdrawCount = (stats.withdrawCount || 0) + 1;
        await safeUpdateStudentStats(studentId, { withdrawCount: stats.withdrawCount });
    } else {
        const totalAnswers = (stats.totalAnswers || 0) + 1;
        const correctAnswers = (stats.correctAnswers || 0) + (correct ? 1 : 0);
        let speedAvg = stats.speedAvg || 0;
        if (timeSpent && timeSpent > 0) {
            speedAvg = ((stats.speedAvg || 0) * (stats.totalAnswers || 0) + timeSpent) / totalAnswers;
        }
        
        const updates = {
            totalAnswers,
            correctAnswers,
            speedAvg
        };
        
        if (category) {
            const categoryStats = { ...(stats.categoryStats || {}) };
            categoryStats[category] = (categoryStats[category] || 0) + 1;
            updates.categoryStats = categoryStats;
            
            const correctByCategory = { ...(stats.correctByCategory || {}) };
            if (correct) correctByCategory[category] = (correctByCategory[category] || 0) + 1;
            updates.correctByCategory = correctByCategory;
        }
        
        if (lesson) {
            const lessonStats = { ...(stats.lessonStats || {}) };
            lessonStats[lesson] = (lessonStats[lesson] || 0) + 1;
            updates.lessonStats = lessonStats;
            
            const correctByLesson = { ...(stats.correctByLesson || {}) };
            if (correct) correctByLesson[lesson] = (correctByLesson[lesson] || 0) + 1;
            updates.correctByLesson = correctByLesson;
        }
        
        let difficulty = currentQuestion?.difficulty;
        if (!difficulty) {
            const activeSession = RaceSessionManager.getActive();
            if (activeSession && activeSession.currentSelectedQuestion?.difficulty) {
                difficulty = activeSession.currentSelectedQuestion.difficulty;
            }
        }
        
        if (difficulty) {
            const difficultyStats = { ...(stats.difficultyStats || {}) };
            if (!difficultyStats[difficulty]) difficultyStats[difficulty] = { total: 0, correct: 0 };
            difficultyStats[difficulty].total++;
            if (correct) difficultyStats[difficulty].correct++;
            updates.difficultyStats = difficultyStats;
        }
        
        await safeUpdateStudentStats(studentId, updates);
    }

    if (points !== 0) {
        const student = await safeGetStudentById(studentId);
        if (student) {
            const newScore = Math.max(0, (student.score || 0) + points);
            await safeUpdateStudent(studentId, { score: newScore });
        }
    }
}

// ===================== الواجهة الرئيسية =====================
export function updateStats(studentId, correct, points, timeSpent, category, isWithdraw = false, currentQuestion = null) {
    const lesson = currentQuestion?.lesson || null;
    if (currentQuestion === null) {
        console.warn(`⚠️ [updateStats] استدعاء بدون currentQuestion للطالب ${studentId}. يرجى تمرير السؤال.`);
    }
    throttleUpdate(studentId, async () => {
        await _updateStatsInternal(studentId, correct, points, timeSpent, category, lesson, isWithdraw, currentQuestion);
    }, 500);
    }

    // ===================== الترتيب والتغير =====================
 // ===================== الترتيب والتغير =====================
export async function getStudentRankAndTrend(studentId, grade, currentScore, filteredHistory, dateRange) {
    // استخدام الكاش المركزي بدلاً من safeGetStudents
    const { students, history } = await fetchAllCachedData();
    const gradeStudents = students.filter(s => s.grade === grade && !s.isTeacher);
    gradeStudents.sort((a, b) => b.score - a.score);
    const rankIndex = gradeStudents.findIndex(s => String(s.id) === String(studentId));
    const rank = rankIndex + 1;
    const totalStudents = gradeStudents.length;
    
    let scoreChange = 0;
    let trend = '➖ ثبات';
    let changePercent = 0;
    
    // استخدام filteredHistory إذا وُجد، وإلا استخدام history من الكاش
    const gamesHistory = (filteredHistory && filteredHistory.length) ? filteredHistory : history;
    
    if (gamesHistory.length > 0) {
        const studentMatches = gamesHistory
            .filter(m => m.participants?.map(String).includes(studentId))
            .sort((a, b) => a.timestamp - b.timestamp);
        
        if (studentMatches.length >= 2) {
            const firstMatchScoreObj = studentMatches[0].scores?.find(s => String(s.id) === studentId);
            const lastMatchScoreObj = studentMatches[studentMatches.length - 1].scores?.find(s => String(s.id) === studentId);
            if (firstMatchScoreObj && lastMatchScoreObj) {
                scoreChange = lastMatchScoreObj.score - firstMatchScoreObj.score;
                if (scoreChange > 5) trend = '📈 تقدم ملحوظ';
                else if (scoreChange > 0) trend = '📈 تقدم طفيف';
                else if (scoreChange < -5) trend = '📉 تراجع ملحوظ';
                else if (scoreChange < 0) trend = '📉 تراجع طفيف';
                else trend = '➖ ثبات';
                if (scoreChange !== 0) {
                    changePercent = (Math.abs(scoreChange) / firstMatchScoreObj.score) * 100;
                }
            }
        }
    }
    
    return { rank, totalStudents, scoreChange, trend, changePercent };
}