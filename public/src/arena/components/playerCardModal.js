// src/arena/components/playerCardModal.js
// عرض بطاقة اللاعب (مودال SweetAlert2)

import { getStudentById, getStudentStats } from '../../services/dataService.js';
import { getTeacherDocumentByCode } from '../../services/dataService.js';


export async function showPlayerCard(studentId) {
    const student = await getStudentById(studentId);
    if (!student) {
        Swal.fire('خطأ', 'لم يتم العثور على اللاعب', 'error');
        return;
    }
    
    const stats = await getStudentStats(studentId);
    const correct = stats?.correctAnswers || 0;
    const total = stats?.totalAnswers || 0;
    const wrong = total - correct;
    const wins = stats?.wins || 0;
    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
    
    // جلب اسم المعلم
    let teacherName = 'غير معروف';
    if (student.teacherId) {
        const teacherDoc = await getTeacherDocumentByCode(student.teacherId);
        if (teacherDoc) teacherName = teacherDoc.data.name || 'معلم';
    }
    
    // الحصول على الترتيب العالمي (يمكن تحسينه لاحقاً)
    const { getStudentGlobalRank } = await import('../services/leaderboardService.js');
    const globalRank = await getStudentGlobalRank(studentId);
    
    Swal.fire({
        title: student.name,
        html: `
            <div class="flex flex-col items-center">
                <img src="${student.img || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="w-24 h-24 rounded-full border-4 border-yellow-500 object-cover mb-3">
                <div class="text-sm text-gray-300 mb-2">${student.grade || 'بدون صف'}</div>
                <div class="grid grid-cols-2 gap-3 w-full text-right mt-2">
                    <div class="bg-white/10 p-2 rounded-xl"><div class="text-yellow-400 font-bold">✨ ${student.score || 0}</div><div class="text-xs text-gray-400">النقاط</div></div>
                    <div class="bg-white/10 p-2 rounded-xl"><div class="text-green-400 font-bold">🏆 ${wins}</div><div class="text-xs text-gray-400">الانتصارات</div></div>
                    <div class="bg-white/10 p-2 rounded-xl"><div class="text-emerald-400 font-bold">✅ ${correct}</div><div class="text-xs text-gray-400">صحيحة</div></div>
                    <div class="bg-white/10 p-2 rounded-xl"><div class="text-red-400 font-bold">❌ ${wrong}</div><div class="text-xs text-gray-400">خاطئة</div></div>
                </div>
                <div class="w-full mt-3 bg-white/10 p-2 rounded-xl text-center">
                    <div class="text-sm">🎯 نسبة الدقة <span class="text-cyan-400 font-bold">${accuracy}%</span></div>
                    <div class="text-sm mt-1">👨‍🏫 المعلم: <span class="text-purple-300">${escapeHtml(teacherName)}</span></div>
                    <div class="text-sm mt-1">🌍 الترتيب العالمي: <span class="text-yellow-400 font-bold">#${globalRank}</span></div>
                </div>
            </div>
        `,
        confirmButtonText: 'إغلاق',
        background: '#0f172a',
        color: '#fff',
        customClass: { popup: 'rounded-2xl border border-yellow-500/30', confirmButton: 'bg-yellow-600' }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}