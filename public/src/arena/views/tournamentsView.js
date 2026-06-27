// src/arena/views/tournamentsView.js
// شاشة البطولات (قيد التطوير) – تظهر للطلاب فقط

export async function render(container, currentUser, role) {
    // إذا كان المستخدم معلماً، نظهر رسالة منفصلة (اختياري)
    if (role.isTeacher) {
        container.innerHTML = `
            <div class="text-center py-16">
                <i class="fas fa-trophy text-6xl text-gray-600 mb-4"></i>
                <h3 class="text-xl font-bold text-gray-400">🏆 البطولات قيد التطوير</h3>
                <p class="text-gray-500 mt-2">سيتم إضافة نظام البطولات قريبًا</p>
            </div>
        `;
        return;
    }
    
    // عرض خاص بالطالب
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="relative">
                <i class="fas fa-trophy text-7xl text-yellow-500/30 mb-4 animate-pulse"></i>
                <span class="absolute top-0 right-0 text-2xl">🏗️</span>
            </div>
            <h3 class="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent mb-3">
                البطولات قريباً
            </h3>
            <div class="max-w-sm bg-white/5 rounded-2xl p-6 border border-yellow-500/20">
                <p class="text-gray-300 mb-4">
                    ⭐ استعد للمنافسة في بطولات دورية مع طلاب من جميع أنحاء المنصة.
                </p>
                <p class="text-gray-400 text-sm">
                    📅 سيتم الإعلان عن موعد انطلاق البطولات قريبًا. تابعنا!
                </p>
                <div class="mt-4 flex justify-center gap-2 text-yellow-400">
                    <i class="fas fa-medal"></i>
                    <i class="fas fa-users"></i>
                    <i class="fas fa-calendar-alt"></i>
                </div>
            </div>
            <button id="notify-me-btn" class="mt-6 bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full text-sm font-bold transition">
                <i class="fas fa-bell ml-2"></i> أريد إشعاراً عند التفعيل
            </button>
        </div>
    `;
    
    const notifyBtn = document.getElementById('notify-me-btn');
    if (notifyBtn) {
        notifyBtn.addEventListener('click', () => {
            Swal.fire({
                title: '📢 تم التسجيل',
                text: 'سنرسل لك إشعاراً عند تفعيل البطولات',
                icon: 'success',
                confirmButtonText: 'حسناً',
                background: '#0f172a',
                color: '#fff'
            });
        });
    }
}