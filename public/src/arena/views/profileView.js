// src/arena/views/profileView.js
// عرض الملف الشخصي للطالب (إحصائيات، صورة، نقاط)

import { getStudentProfile } from '../services/profileService.js';
import { getTeacherDocumentByCode } from '../../services/dataService.js';

export async function render(container, currentUser, role) {
    // التأكد من أن المستخدم طالب وليس معلماً
    if (role.isTeacher) {
        container.innerHTML = `<div class="text-center text-red-400 py-10">هذه الصفحة مخصصة للطلاب فقط</div>`;
        return;
    }
    
    container.innerHTML = `<div class="flex justify-center items-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-4 border-yellow-400 border-t-transparent"></div></div>`;
    
    const profile = await getStudentProfile(currentUser.id);
    if (!profile) {
        container.innerHTML = `<div class="text-center text-red-400 py-10">حدث خطأ في تحميل ملفك الشخصي</div>`;
        return;
    }
    
    // جلب اسم المعلم
    let teacherName = 'غير معروف';
    if (profile.teacherId) {
        const teacherDoc = await getTeacherDocumentByCode(profile.teacherId);
        if (teacherDoc) teacherName = teacherDoc.data.name;
    }
    
    container.innerHTML = `
        <div class="max-w-2xl mx-auto">
            <!-- بطاقة الملف الشخصي -->
            <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-6">
                <div class="flex flex-col items-center text-center">
                    <img src="${profile.img}" class="w-28 h-28 rounded-full border-4 border-yellow-500 object-cover shadow-xl mb-4">
                    <h2 class="text-2xl font-bold text-white">${escapeHtml(profile.name)}</h2>
                    <p class="text-yellow-400 text-sm">${escapeHtml(profile.grade)}</p>
                    <p class="text-gray-400 text-xs mt-1">👨‍🏫 المعلم: ${escapeHtml(teacherName)}</p>
                    <div class="mt-3 bg-yellow-500/20 px-4 py-1 rounded-full">
                        <span class="text-yellow-400 font-bold text-xl">${profile.score}</span>
                        <span class="text-gray-300 text-sm"> نقطة</span>
                    </div>
                </div>
            </div>
            
            <!-- إحصائيات اللعب -->
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-white/5 rounded-xl p-4 text-center">
                    <div class="text-green-400 text-2xl font-bold">${profile.correct}</div>
                    <div class="text-xs text-gray-400">✅ إجابات صحيحة</div>
                </div>
                <div class="bg-white/5 rounded-xl p-4 text-center">
                    <div class="text-red-400 text-2xl font-bold">${profile.wrong}</div>
                    <div class="text-xs text-gray-400">❌ إجابات خاطئة</div>
                </div>
                <div class="bg-white/5 rounded-xl p-4 text-center">
                    <div class="text-yellow-400 text-2xl font-bold">${profile.accuracy}%</div>
                    <div class="text-xs text-gray-400">🎯 نسبة الدقة</div>
                </div>
                <div class="bg-white/5 rounded-xl p-4 text-center">
                    <div class="text-cyan-400 text-2xl font-bold">${profile.wins}</div>
                    <div class="text-xs text-gray-400">🏆 عدد الانتصارات</div>
                </div>
                <div class="bg-white/5 rounded-xl p-4 text-center">
                    <div class="text-purple-400 text-2xl font-bold">${profile.totalMatches}</div>
                    <div class="text-xs text-gray-400">⚔️ إجمالي المباريات</div>
                </div>
                <div class="bg-white/5 rounded-xl p-4 text-center">
                    <div class="text-orange-400 text-2xl font-bold">${profile.bestStreak}</div>
                    <div class="text-xs text-gray-400">🔥 أطول سلسلة صحيحة</div>
                </div>
            </div>
            
            <!-- شريط تقدم المستوى (تقديري) -->
            <div class="bg-white/5 rounded-xl p-4">
                <div class="flex justify-between text-sm mb-1">
                    <span>⭐ مستوى النقاط</span>
                    <span>${profile.score} / 5000</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full" style="width: ${Math.min(100, (profile.score / 5000) * 100)}%"></div>
                </div>
                <p class="text-xs text-gray-400 mt-3 text-center">✨ استمر في التحدي لترفع نقاطك ومستواك</p>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}