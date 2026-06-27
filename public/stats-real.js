// stats-real.js
import { getStudents, getGameHistory, getAllGrades, getQuestions, getStudentStats } from './src/services/dataService.js';
import { calculateExcellenceIndex, getDailyActiveStudents, getTopLessons, getBottomLessons, getLessonStudentsRanking, getLessonDetails, generateInsights, getRecentEvents, getStudentBadges } from './src/stats/analytics/core.js';

export async function fetchRealStatsData() {
    const students = await getStudents();
    const history = await getGameHistory();
    const grades = await getAllGrades();
    const allQuestions = {};
    for (const grade of grades) {
        const qs = await getQuestions(grade);
        allQuestions[grade] = qs.length;
    }
    const studentStats = {};
    for (const s of students) {
        studentStats[s.id] = await getStudentStats(s.id);
    }
    let sumIndex = 0;
    for (const s of students) {
        sumIndex += await calculateExcellenceIndex(s.id);
    }
    const avgIndex = students.length ? Math.round(sumIndex / students.length) : 0;
    const dailyActive = await getDailyActiveStudents();
    let totalCorrect = 0, totalAnswers = 0;
    for (const s of students) {
        const st = studentStats[s.id] || {};
        totalCorrect += st.correctAnswers || 0;
        totalAnswers += st.totalAnswers || 0;
    }
    const avgAccuracy = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
    const topLessons = await getTopLessons(5);
    const bottomLessons = await getBottomLessons(5);
    const recentEvents = await getRecentEvents();
    const insights = await generateInsights();
    return {
        students, history, grades, allQuestions, studentStats, avgIndex, dailyActive,
        avgAccuracy, totalMatches: history.length, totalStudents: students.length,
        topLessons, bottomLessons, recentEvents, insights
    };
}