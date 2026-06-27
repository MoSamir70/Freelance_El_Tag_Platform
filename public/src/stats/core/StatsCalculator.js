// src/stats/core/StatsCalculator.js
// جميع العمليات الحسابية المتعلقة بالإحصائيات
// تم استعادة جميع الدوال من analytics/core.js الأصلي

import { getStudents, getStudentStats, getGameHistory, getAllGrades, getQuestions } from '../../services/dataService.js';

export const StatsCalculator = {
    /**
     * حساب مؤشر التميز للطالب (Excellence Index)
     */
    async calculateExcellenceIndex(studentId) {
        const stats = await getStudentStats(studentId);
        const totalAnswers = stats.totalAnswers || 0;
        const correctAnswers = stats.correctAnswers || 0;
        const speedAvg = stats.speedAvg || 0;
        const withdrawCount = stats.withdrawCount || 0;
        
        if (totalAnswers === 0) return 0;
        
        const accuracy = correctAnswers / totalAnswers;
        const speedScore = speedAvg > 0 ? Math.min(1, 10 / speedAvg) : 0;
        const consistency = Math.max(0, 1 - withdrawCount / (totalAnswers + 1));
        
        let difficultyWeight = 1.0;
        if (stats.difficultyStats) {
            let totalWeighted = 0, totalCount = 0;
            const weights = { 'سهل': 0.7, 'متوسط': 1.0, 'صعب': 1.3 };
            for (const [diff, data] of Object.entries(stats.difficultyStats)) {
                const w = weights[diff] || 1.0;
                totalWeighted += data.total * w;
                totalCount += data.total;
            }
            if (totalCount > 0) difficultyWeight = totalWeighted / totalCount;
        }
        
        const rawIndex = (accuracy * 0.5 + speedScore * 0.3 + consistency * 0.2) * 100;
        return Math.min(100, Math.round(rawIndex * difficultyWeight));
    },

    /**
     * أوسمة الطالب (Badges)
     */
    async getStudentBadges(studentId) {
        const badges = [];
        const stats = await getStudentStats(studentId);
        const totalAnswers = stats.totalAnswers || 0;
        const correctAnswers = stats.correctAnswers || 0;
        const accuracy = totalAnswers > 0 ? correctAnswers / totalAnswers : 0;
        const speedAvg = stats.speedAvg || 0;
        const withdrawCount = stats.withdrawCount || 0;
        
        const history = await getGameHistory();
        const gamesPlayed = history.filter(g => g.participants?.map(String).includes(studentId)).length;
        const wins = history.filter(g => String(g.winnerId) === studentId).length;
        
        const students = await getStudents();
        const student = students.find(s => String(s.id) === studentId);
        const score = student ? student.score : 0;

        if (totalAnswers >= 20 && accuracy >= 0.9) badges.push({ id:'sniper', name:'القناص', icon:'🎯', desc:'دقة 90% فأكثر' });
        if (totalAnswers >= 10 && accuracy === 1) badges.push({ id:'perfect', name:'الكمال', icon:'💯', desc:'دقة 100%' });
        if (totalAnswers >= 5 && speedAvg > 0 && speedAvg <= 3) badges.push({ id:'fast', name:'البرق', icon:'⚡', desc:'متوسط وقت ≤ 3 ثوان' });
        if (totalAnswers >= 100) badges.push({ id:'scholar', name:'الموسوعة', icon:'📚', desc:'100 إجابة فأكثر' });
        if (gamesPlayed >= 50) badges.push({ id:'persistent', name:'المثابر', icon:'💪', desc:'50 مباراة فأكثر' });
        if (wins >= 10) badges.push({ id:'champion', name:'بطل المنصة', icon:'🏆', desc:'10 انتصارات فأكثر' });
        if (score >= 500) badges.push({ id:'rich', name:'الغني', icon:'💰', desc:'500 نقطة فأكثر' });
        if (gamesPlayed >= 10 && withdrawCount === 0) badges.push({ id:'disciplined', name:'المنضبط', icon:'🛡️', desc:'لم ينسحب أبداً' });
        
        const index = await this.calculateExcellenceIndex(studentId);
        if (index >= 85) badges.push({ id:'excellent', name:'اللامع', icon:'🌟', desc:'مؤشر التاج ≥ 85' });
        
        return badges;
    },

    /**
     * الحصول على أفضل الطلاب حسب النقاط
     */
    getTopStudents(students, limit = 10) {
        return [...students].filter(s => !s.isTeacher).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
    },

    /**
     * الحصول على أضعف الطلاب حسب النقاط
     */
    getBottomStudents(students, limit = 10) {
        return [...students].filter(s => !s.isTeacher).sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, limit);
    },

    /**
     * حساب متوسط مؤشر التاج لجميع الطلاب
     */
    async getAverageExcellenceIndex(students) {
        if (!students.length) return 0;
        let total = 0;
        for (const s of students) {
            total += await this.calculateExcellenceIndex(s.id);
        }
        return Math.round(total / students.length);
    },

    /**
     * حساب إجمالي الإجابات الصحيحة والخاطئة
     */
    getTotals(students, studentStats) {
        let correct = 0, wrong = 0;
        for (const s of students) {
            const stats = studentStats[s.id] || {};
            correct += stats.correctAnswers || 0;
            wrong += (stats.totalAnswers || 0) - (stats.correctAnswers || 0);
        }
        return { correct, wrong, total: correct + wrong };
    },

    /**
     * حساب متوسط الدقة لجميع الطلاب
     */
    async getAverageAccuracy(students, studentStats) {
        const { correct, wrong } = this.getTotals(students, studentStats);
        return correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;
    },

    /**
     * حساب معدل الانسحاب
     */
    getWithdrawRate(students, studentStats, totalMatches) {
        let withdraws = 0;
        for (const s of students) {
            withdraws += studentStats[s.id]?.withdrawCount || 0;
        }
        return totalMatches ? Math.round((withdraws / totalMatches) * 100) : 0;
    },

    /**
     * الحصول على النشاط اليومي لآخر عدد أيام
     */
    getDailyActivity(history, days = 7) {
        const today = new Date();
        const labels = [], values = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            labels.push(d.toLocaleDateString('ar-EG', { weekday: 'short' }));
            const ds = d.toLocaleDateString('en-CA');
            values.push(history.filter(g => new Date(g.timestamp).toLocaleDateString('en-CA') === ds).length);
        }
        return { labels, values };
    },

    /**
     * الحصول على آخر الأحداث (آخر 5 مباريات)
     */
    getRecentEvents(history, students) {
        const studentMap = Object.fromEntries(students.map(s => [s.id, s.name]));
        return history.slice(0, 5).map(game => {
            if (game.winnerName) {
                return `🏆 فاز ${game.winnerName} في مباراة ${game.mode || 'سباق'}`;
            }
            return `🎮 انتهت مباراة بمشاركة ${game.participants?.length || 0} لاعب`;
        });
    },

    /**
     * توزيع صعوبة الأسئلة
     */
    async getDifficultyDistribution(allQuestions) {
        let easy = 0, medium = 0, hard = 0;
        const grades = Object.keys(allQuestions);
        for (const grade of grades) {
            const questions = await getQuestions(grade);
            easy += questions.filter(q => q.difficulty === 'سهل').length;
            medium += questions.filter(q => q.difficulty === 'متوسط').length;
            hard += questions.filter(q => q.difficulty === 'صعب').length;
        }
        const total = easy + medium + hard || 1;
        return {
            labels: ['سهل', 'متوسط', 'صعب'],
            values: [easy, medium, hard]
        };
    },

    /**
     * الحصول على بيانات لوحة القيادة (KPIs)
     */
    async getDashboardKPIs(data) {
        const { students, history, studentStats } = data;
        const avgAccuracy = await this.getAverageAccuracy(students, studentStats);
        const avgIndex = await this.getAverageExcellenceIndex(students);
        const totalMatches = history.length;
        const totalStudents = students.filter(s => !s.isTeacher).length;
        const dailyActivity = this.getDailyActivity(history, 1);
        return {
            totalStudents,
            totalMatches,
            avgAccuracy,
            avgIndex,
            dailyActive: dailyActivity.values[0] || 0
        };
    },

    /**
     * أفضل وأسوأ مادة
     */
    async getTopAndWeakSubject() {
        const students = await getStudents();
        const catAcc = {}, catTotal = {};
        for (const s of students) {
            const stats = await getStudentStats(s.id);
            if (stats?.categoryStats) {
                for (let [cat, total] of Object.entries(stats.categoryStats)) {
                    catTotal[cat] = (catTotal[cat] || 0) + total;
                    catAcc[cat] = (catAcc[cat] || 0) + (stats.correctByCategory?.[cat] || 0);
                }
            }
        }
        let bestSubject = '—', worstSubject = '—', bestAcc = 0, worstAcc = 1;
        for (let cat in catTotal) {
            const acc = catTotal[cat] > 0 ? (catAcc[cat] || 0) / catTotal[cat] : 0;
            if (acc > bestAcc) { bestAcc = acc; bestSubject = cat; }
            if (acc < worstAcc) { worstAcc = acc; worstSubject = cat; }
        }
        return { topSubject: bestSubject, weakSubject: worstSubject };
    },

    /**
     * بيانات الخريطة الحرارية (12 أسبوع)
     */
    async generateHeatmapData() {
        const history = await getGameHistory();
        const weeks = 12;
        const days = weeks * 7;
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
        const data = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const dateString = date.toLocaleDateString('en-CA');
            const count = history.filter(g => new Date(g.timestamp).toLocaleDateString('en-CA') === dateString).length;
            data.push({ date: dateString, count });
        }
        return data;
    },

    /**
     * الترتيب والتغير للطالب
     */
    async getStudentRankAndTrend(studentId, grade, currentScore, filteredHistory, dateRange) {
        const allStudents = await getStudents();
        const gradeStudents = allStudents.filter(s => s.grade === grade && !s.isTeacher);
        gradeStudents.sort((a, b) => b.score - a.score);
        const rankIndex = gradeStudents.findIndex(s => String(s.id) === String(studentId));
        const rank = rankIndex + 1;
        const totalStudents = gradeStudents.length;
        
        let scoreChange = 0;
        let trend = '➖ ثبات';
        let changePercent = 0;
        
        const history = filteredHistory && filteredHistory.length ? filteredHistory : await getGameHistory();
        
        if (history.length > 0) {
            const studentMatches = history
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
    },

    /**
     * الطالب الأكثر تحسناً
     */
    async getMostImprovedStudent(filteredHistory = null) {
        let bestStudent = null, bestImprovement = -Infinity;
        const history = filteredHistory !== null ? filteredHistory : await getGameHistory();
        const students = await getStudents();
        for (const s of students) {
            const games = history.filter(g => g.participants?.map(String).includes(String(s.id))).sort((a,b) => a.timestamp - b.timestamp);
            if (games.length >= 2) {
                const oldScore = games[0].scores?.find(sc => String(sc.id) === String(s.id))?.score || 0;
                const newScore = games[games.length-1].scores?.find(sc => String(sc.id) === String(s.id))?.score || 0;
                const diff = newScore - oldScore;
                if (diff > bestImprovement) { bestImprovement = diff; bestStudent = s; }
            }
        }
        return bestStudent ? { name: bestStudent.name, improvement: bestImprovement } : { name: '—', improvement: 0 };
    },

    /**
     * الطالب الأكثر تراجعاً
     */
    async getMostDeclinedStudent(filteredHistory = null) {
        let worstStudent = null, worstDecline = Infinity;
        const history = filteredHistory !== null ? filteredHistory : await getGameHistory();
        const students = await getStudents();
        for (const s of students) {
            const games = history.filter(g => g.participants?.map(String).includes(String(s.id))).sort((a,b) => a.timestamp - b.timestamp);
            if (games.length >= 2) {
                const oldScore = games[0].scores?.find(sc => String(sc.id) === String(s.id))?.score || 0;
                const newScore = games[games.length-1].scores?.find(sc => String(sc.id) === String(s.id))?.score || 0;
                const diff = newScore - oldScore;
                if (diff < worstDecline) { worstDecline = diff; worstStudent = s; }
            }
        }
        return worstStudent ? { name: worstStudent.name, decline: worstDecline } : { name: '—', decline: 0 };
    },

    /**
     * توليد توصيات ذكية
     */
    async generateInsights() {
        const insights = [];
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

        const students = await getStudents();
        const history = await getGameHistory();
        
        for (const s of students) {
            const stats = await getStudentStats(s.id);
            if (!stats || stats.totalAnswers < 10) continue;
            const recentGames = history.filter(g => g.timestamp >= oneWeekAgo && g.participants?.map(String).includes(String(s.id)));
            const olderGames = history.filter(g => g.timestamp < oneWeekAgo && g.timestamp >= oneWeekAgo - 7 * 24 * 60 * 60 * 1000 && g.participants?.map(String).includes(String(s.id)));
            const recentAccuracy = recentGames.length ? (recentGames.filter(g => g.winnerId === String(s.id)).length / recentGames.length) * 100 : null;
            const olderAccuracy = olderGames.length ? (olderGames.filter(g => g.winnerId === String(s.id)).length / olderGames.length) * 100 : null;
            if (recentAccuracy !== null && olderAccuracy !== null && (olderAccuracy - recentAccuracy) >= 20) {
                insights.push(`📉 تراجع أداء <span>${s.name}</span> بنسبة ${Math.round(olderAccuracy - recentAccuracy)}% هذا الأسبوع`);
            }
        }

        const inactive = students.filter(s => {
            const lastGame = history.find(g => g.participants?.map(String).includes(String(s.id)));
            return !lastGame || lastGame.timestamp < threeDaysAgo;
        }).slice(0, 3);
        inactive.forEach(s => insights.push(`🔕 <span>${s.name}</span> لم يتفاعل منذ 3 أيام`));

        const topStudent = students.sort((a, b) => b.score - a.score)[0];
        if (topStudent && topStudent.score > 500) insights.push(`🚀 <span>${topStudent.name}</span> يقترب من كسر حاجز الـ 1000 نقطة!`);

        return insights.length ? insights.slice(0, 6) : ['✨ كل الأمور تسير بشكل طبيعي'];
    },

    /**
     * الأحداث الأخيرة
     */
    async getRecentEventsOnly() {
        const events = [];
        const history = await getGameHistory();
        const students = await getStudents();
        const recentGames = history.slice(0, 5);
        recentGames.forEach(g => {
            if (g.winnerName) events.push(`🏆 فاز <span>${g.winnerName}</span> في مباراة ${g.mode || 'سباق'}`);
        });
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
        const inactiveStudents = students.filter(s => {
            const lastGame = history.find(g => g.participants?.includes(String(s.id)));
            return !lastGame || lastGame.timestamp < threeDaysAgo;
        }).slice(0, 2);
        inactiveStudents.forEach(s => events.push(`⚠️ الطالب <span>${s.name}</span> لم يسجل نشاطاً منذ 3 أيام`));
        return events.length ? events : ['🔹 لا توجد أحداث حديثة'];
    },

    /**
     * عدد الطلاب النشطاء اليوم
     */
    async getDailyActiveStudents() {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const history = await getGameHistory();
        const activeIds = new Set();
        history.forEach(g => {
            if (g.timestamp >= oneDayAgo && g.participants) {
                g.participants.forEach(id => activeIds.add(String(id)));
            }
        });
        return activeIds.size;
    },

    /**
     * أفضل 5 دروس
     */
    async getTopLessons(limit = 5) {
        const ranking = await this.getAllLessonsRanking();
        return ranking.slice(0, limit);
    },

    /**
     * أسوأ 5 دروس
     */
    async getBottomLessons(limit = 5) {
        const ranking = await this.getAllLessonsRanking();
        const filtered = ranking.filter(l => l.total >= 3);
        if (filtered.length >= limit) return filtered.slice(-limit).reverse();
        return ranking.slice(-limit).reverse();
    },

    /**
     * ترتيب جميع الدروس
     */
    async getAllLessonsRanking() {
        const students = await getStudents();
        const lessonStats = {};
        
        for (const s of students) {
            const stats = await getStudentStats(s.id);
            if (stats?.lessonStats) {
                for (const [lesson, total] of Object.entries(stats.lessonStats)) {
                    if (!lessonStats[lesson]) lessonStats[lesson] = { total: 0, correct: 0 };
                    lessonStats[lesson].total += total;
                    lessonStats[lesson].correct += (stats.correctByLesson?.[lesson] || 0);
                }
            }
        }
        
        // حل احتياطي: استخدام categoryStats إذا لم توجد lessonStats
        if (Object.keys(lessonStats).length === 0) {
            for (const s of students) {
                const stats = await getStudentStats(s.id);
                if (stats?.categoryStats) {
                    for (const [cat, total] of Object.entries(stats.categoryStats)) {
                        if (!lessonStats[cat]) lessonStats[cat] = { total: 0, correct: 0 };
                        lessonStats[cat].total += total;
                        lessonStats[cat].correct += (stats.correctByCategory?.[cat] || 0);
                    }
                }
            }
        }
        
        const ranking = [];
        for (const [lesson, data] of Object.entries(lessonStats)) {
            const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
            ranking.push({
                lesson,
                total: data.total,
                correct: data.correct,
                wrong: data.total - data.correct,
                accuracy: Math.round(accuracy)
            });
        }
        ranking.sort((a, b) => b.accuracy - a.accuracy);
        return ranking;
    },

    /**
     * تفاصيل درس معين
     */
    async getLessonDetails(lessonName) {
        const ranking = await this.getAllLessonsRanking();
        const found = ranking.find(r => r.lesson === lessonName);
        if (found) {
            return { total: found.total, correct: found.correct, wrong: found.wrong, accuracy: found.accuracy };
        }
        return { total: 0, correct: 0, wrong: 0, accuracy: 0 };
    },

    /**
     * أفضل الطلاب في درس معين
     */
    async getTopStudentsForLesson(lessonName, limit = 5) {
        const ranking = await this.getLessonStudentsRanking(lessonName);
        return ranking.slice(0, limit);
    },

    /**
     * أسوأ الطلاب في درس معين
     */
    async getBottomStudentsForLesson(lessonName, limit = 5) {
        const ranking = await this.getLessonStudentsRanking(lessonName);
        const filtered = ranking.filter(r => r.total >= 3);
        if (filtered.length >= limit) return filtered.slice(-limit).reverse();
        return ranking.slice(-limit).reverse();
    },

    /**
     * ترتيب الطلاب في درس معين
     */
    async getLessonStudentsRanking(lessonName) {
        const students = await getStudents();
        const studentStatsList = [];
        
        for (const s of students) {
            const stats = await getStudentStats(s.id);
            let total = 0, correct = 0;
            if (stats?.lessonStats && stats.lessonStats[lessonName]) {
                total = stats.lessonStats[lessonName];
                correct = stats.correctByLesson?.[lessonName] || 0;
            } else if (stats?.categoryStats && stats.categoryStats[lessonName]) {
                total = stats.categoryStats[lessonName];
                correct = stats.correctByCategory?.[lessonName] || 0;
            }
            if (total > 0) {
                const accuracy = (correct / total) * 100;
                studentStatsList.push({
                    student: s,
                    total,
                    correct,
                    wrong: total - correct,
                    accuracy: Math.round(accuracy)
                });
            }
        }
        studentStatsList.sort((a, b) => b.accuracy - a.accuracy);
        return studentStatsList;
    }
    
};