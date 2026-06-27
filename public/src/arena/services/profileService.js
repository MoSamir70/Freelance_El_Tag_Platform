// src/arena/services/profileService.js
// خدمات جلب بيانات وإحصائيات الطالب

import { getStudentById } from '../../services/dataService.js';
import { getStudentStats } from '../../services/dataService.js';

export async function getStudentProfile(studentId) {
    const student = await getStudentById(studentId);
    if (!student) return null;
    
    const stats = await getStudentStats(studentId);
    const correct = stats?.correctAnswers || 0;
    const total = stats?.totalAnswers || 0;
    const wrong = total - correct;
    const wins = stats?.wins || 0;
    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
    const bestStreak = stats?.bestStreak || 0;
    const avgSpeed = stats?.speedAvg || 0;
    const totalMatches = stats?.totalMatches || 0;
    
    return {
        id: student.id,
        name: student.name,
        grade: student.grade,
        img: student.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        score: student.score || 0,
        correct,
        wrong,
        total,
        wins,
        accuracy,
        bestStreak,
        avgSpeed,
        totalMatches,
        teacherId: student.teacherId
    };
}