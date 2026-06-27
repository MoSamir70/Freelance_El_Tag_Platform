// src/admin/adminUI.js
import { 
    getAllTeachers, addTeacher, updateTeacher, deleteTeacher, toggleTeacherSuspension, upgradeTeacherPlan,
    getPlatformStats, getTeacherStats,
    getAllQuestionsFromAllTeachers, updateGlobalQuestion, deleteGlobalQuestion,
    getActiveRooms
} from './admin.js';
import { escapeHtml, showFloatingNotification } from '../utils.js';
import { getDynamicGrades } from '../db/localstorage.js';

let currentTeacherForDetails = null;

// ========== عرض لوحة التحكم الرئيسية ==========
export async function renderAdminDashboard(container) {
    const stats = await getPlatformStats();
    container.innerHTML = `
        <div class="space-y-6">
            <!-- بطاقات الإحصائيات -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="glass-panel p-4 text-center"><div class="text-3xl mb-2">👨‍🏫</div><div class="text-2xl font-bold text-yellow-400">${stats.totalTeachers}</div><div class="text-sm">إجمالي المعلمين</div><div class="text-xs text-green-400">نشط: ${stats.activeTeachers}</div></div>
                <div class="glass-panel p-4 text-center"><div class="text-3xl mb-2">🎓</div><div class="text-2xl font-bold text-yellow-400">${stats.totalStudents}</div><div class="text-sm">إجمالي الطلاب</div></div>
                <div class="glass-panel p-4 text-center"><div class="text-3xl mb-2">📚</div><div class="text-2xl font-bold text-yellow-400">${stats.totalQuestions}</div><div class="text-sm">إجمالي الأسئلة</div></div>
                <div class="glass-panel p-4 text-center"><div class="text-3xl mb-2">🏆</div><div class="text-2xl font-bold text-yellow-400">${stats.totalMatches}</div><div class="text-sm">إجمالي المباريات</div></div>
            </div>
            
            <!-- أفضل 5 طلاب -->
            <div class="glass-panel p-4">
                <h3 class="text-xl font-bold text-yellow-400 mb-3">🏅 أفضل 5 طلاب (عام)</h3>
                <div class="space-y-2">
                    ${stats.top5Students.map((s, idx) => `
                        <div class="flex justify-between items-center p-2 bg-white/5 rounded-xl">
                            <span class="text-yellow-400 font-bold">${idx+1}.</span>
                            <div class="flex items-center gap-2"><img src="${s.img}" class="w-8 h-8 rounded-full"> ${escapeHtml(s.name)}</div>
                            <span class="text-yellow-400">⭐ ${s.score}</span>
                        </div>
                    `).join('')}
                    ${stats.top5Students.length === 0 ? '<div class="text-gray-400">لا توجد بيانات</div>' : ''}
                </div>
            </div>
            
            <!-- آخر 5 مباريات -->
            <div class="glass-panel p-4">
                <h3 class="text-xl font-bold text-yellow-400 mb-3">🎮 آخر المباريات</h3>
                <div class="space-y-2">
                    ${stats.last5Matches.map(m => `
                        <div class="p-2 bg-white/5 rounded-xl">
                            <div class="flex justify-between"><span>🏆 الفائز: ${escapeHtml(m.winnerName || 'غير معروف')}</span><span class="text-xs text-gray-400">${new Date(m.timestamp).toLocaleString('ar-EG')}</span></div>
                            <div class="text-sm text-gray-300">المشاركون: ${(m.participants || []).length}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- أزرار التنقل الداخلية -->
            <div class="flex flex-wrap gap-3 justify-center border-t border-yellow-500/20 pt-4">
                <button data-admin-section="teachers" class="admin-section-btn bg-purple-600 px-4 py-2 rounded-full">👥 إدارة المعلمين</button>
                <button data-admin-section="questions" class="admin-section-btn bg-purple-600 px-4 py-2 rounded-full">📚 بنك الأسئلة العالمي</button>
                <button data-admin-section="rooms" class="admin-section-btn bg-purple-600 px-4 py-2 rounded-full">🌐 الغرف النشطة</button>
                <button data-admin-section="settings" class="admin-section-btn bg-purple-600 px-4 py-2 rounded-full">⚙️ الإعدادات العامة</button>
            </div>
            <div id="admin-section-content"></div>
        </div>
    `;
    
    // ربط الأزرار
    document.querySelectorAll('.admin-section-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const section = btn.dataset.adminSection;
            const sectionContainer = document.getElementById('admin-section-content');
            if (section === 'teachers') await renderTeachersManagement(sectionContainer);
            else if (section === 'questions') await renderGlobalQuestionsBank(sectionContainer);
            else if (section === 'rooms') renderActiveRooms(sectionContainer);
            else if (section === 'settings') renderAdminSettings(sectionContainer);
        });
    });
}

// ========== إدارة المعلمين (جدول + أزرار) ==========
async function renderTeachersManagement(container) {
    const teachers = getAllTeachers();
    container.innerHTML = `
        <div class="glass-panel p-4">
            <div class="flex justify-between mb-4">
                <h3 class="text-xl font-bold text-yellow-400">📋 قائمة المعلمين</h3>
                <button id="admin-add-teacher-btn" class="bg-green-600 px-3 py-1 rounded-full text-sm">➕ إضافة معلم</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-right border-collapse">
                    <thead>
                        <tr class="border-b border-yellow-500/20">
                            <th class="p-2">الاسم</th><th class="p-2">الكود</th><th class="p-2">الخطة</th><th class="p-2">الحالة</th><th class="p-2">تاريخ الانتهاء</th><th class="p-2">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${teachers.map(t => `
                            <tr class="border-b border-white/10">
                                <td class="p-2">${escapeHtml(t.name)}</td>
                                <td class="p-2">${t.teacherId}</td>
                                <td class="p-2">${t.plan === 'free' ? 'مجاني' : (t.plan === 'gold' ? 'ذهبي' : 'ماسي')}</td>
                                <td class="p-2">${t.status === 'active' ? '✅ نشط' : (t.status === 'suspended' ? '⛔ معلق' : '🗑️ محذوف')}</td>
                                <td class="p-2">${t.expiryDate ? new Date(t.expiryDate).toLocaleDateString('ar-EG') : 'غير محدد'}</td>
                                <td class="p-2">
                                    <button class="admin-view-teacher-btn text-blue-400" data-id="${t.teacherId}">👁️ عرض</button>
                                    <button class="admin-edit-teacher-btn text-green-400" data-id="${t.teacherId}">✏️ تعديل</button>
                                    <button class="admin-suspend-teacher-btn ${t.status === 'suspended' ? 'text-yellow-400' : 'text-orange-400'}" data-id="${t.teacherId}">${t.status === 'suspended' ? '🔓 تنشيط' : '⛔ تعليق'}</button>
                                    <button class="admin-delete-teacher-btn text-red-400" data-id="${t.teacherId}">🗑️ حذف</button>
                                </td>
                            </tr>
                        `).join('')}
                        ${teachers.length === 0 ? '<tr><td colspan="6" class="text-center p-4 text-gray-400">لا يوجد معلمون</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // ربط الأحداث
    document.querySelectorAll('.admin-view-teacher-btn').forEach(btn => {
        btn.addEventListener('click', () => showTeacherDetails(btn.dataset.id));
    });
    document.querySelectorAll('.admin-edit-teacher-btn').forEach(btn => {
        btn.addEventListener('click', () => editTeacher(btn.dataset.id));
    });
    document.querySelectorAll('.admin-suspend-teacher-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const teacher = getAllTeachers().find(t => String(t.teacherId) === id);
            if (teacher) {
                const newStatus = teacher.status === 'suspended' ? 'active' : 'suspended';
                await toggleTeacherSuspension(id, newStatus === 'suspended');
                showFloatingNotification(`تم ${newStatus === 'suspended' ? 'تعليق' : 'تنشيط'} المعلم`, 'success');
                await renderTeachersManagement(container);
            }
        });
    });
    document.querySelectorAll('.admin-delete-teacher-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const confirmed = await Swal.fire({ title: 'تأكيد الحذف', text: 'سيتم حذف المعلم وجميع بياناته. هل أنت متأكد؟', icon: 'warning', showCancelButton: true });
            if (confirmed.isConfirmed) {
                await deleteTeacher(btn.dataset.id, true);
                showFloatingNotification('تم حذف المعلم', 'success');
                await renderTeachersManagement(container);
            }
        });
    });
    
    const addBtn = document.getElementById('admin-add-teacher-btn');
    if (addBtn) addBtn.onclick = () => showAddTeacherModal(container);
}

// نافذة إضافة معلم
async function showAddTeacherModal(container) {
    const { value: formValues } = await Swal.fire({
        title: '➕ إضافة معلم جديد',
        html: `
            <input id="swal-name" class="swal2-input" placeholder="الاسم الكامل" required>
            <input id="swal-code" class="swal2-input" placeholder="كود المعلم (رقم فريد)" required>
            <input id="swal-email" class="swal2-input" placeholder="البريد الإلكتروني">
            <input id="swal-phone" class="swal2-input" placeholder="رقم الهاتف">
            <select id="swal-plan" class="swal2-select">
                <option value="free">مجاني</option><option value="gold">ذهبي</option><option value="platinum">ماسي</option>
            </select>
            <input id="swal-expiry" type="date" placeholder="تاريخ الانتهاء (اختياري)">
            <textarea id="swal-notes" class="swal2-textarea" placeholder="ملاحظات"></textarea>
        `,
        focusConfirm: false,
        preConfirm: () => {
            return {
                name: document.getElementById('swal-name').value,
                teacherId: document.getElementById('swal-code').value,
                email: document.getElementById('swal-email').value,
                phone: document.getElementById('swal-phone').value,
                plan: document.getElementById('swal-plan').value,
                expiryDate: document.getElementById('swal-expiry').value || null,
                notes: document.getElementById('swal-notes').value
            };
        }
    });
    if (formValues) {
        try {
            await addTeacher(formValues);
            showFloatingNotification('تم إضافة المعلم بنجاح', 'success');
            await renderTeachersManagement(container);
        } catch (err) {
            Swal.fire('خطأ', err.message, 'error');
        }
    }
}

// عرض تفاصيل المعلم (نافذة منبثقة)
async function showTeacherDetails(teacherId) {
    const stats = await getTeacherStats(teacherId);
    if (!stats) return;
    const t = stats.teacher;
    Swal.fire({
        title: `👨‍🏫 تفاصيل المعلم: ${escapeHtml(t.name)}`,
        html: `
            <div style="text-align:right; max-height:70vh; overflow-y:auto;">
                <img src="${t.img}" class="w-24 h-24 rounded-full mx-auto mb-3 border-2 border-yellow-500">
                <p><strong>الكود:</strong> ${t.teacherId}</p>
                <p><strong>البريد:</strong> ${t.email || '-'}</p>
                <p><strong>الهاتف:</strong> ${t.phone || '-'}</p>
                <p><strong>الخطة:</strong> ${t.plan === 'free' ? 'مجاني' : (t.plan === 'gold' ? 'ذهبي' : 'ماسي')}</p>
                <p><strong>الحالة:</strong> ${t.status === 'active' ? 'نشط' : (t.status === 'suspended' ? 'معلق' : 'محذوف')}</p>
                <p><strong>تاريخ الانتهاء:</strong> ${t.expiryDate ? new Date(t.expiryDate).toLocaleDateString('ar-EG') : 'غير محدد'}</p>
                <hr class="my-3 border-yellow-500/30">
                <h3 class="font-bold text-yellow-400">📊 إحصائيات المعلم</h3>
                <p>👥 عدد الطلاب: ${stats.studentsCount}</p>
                <p>📚 عدد الأسئلة المرفوعة: ${stats.totalQuestions}</p>
                <p>🌐 عدد الغرف المنشأة: ${stats.roomsCreated}</p>
                <p>🎮 عدد المباريات التي شارك فيها طلابه: ${stats.matchesWithStudents}</p>
                <hr class="my-3">
                <h3 class="font-bold text-yellow-400">📱 الأجهزة المسجلة</h3>
                ${stats.devices.map(d => `<div class="text-sm">🖥️ ${d.browser} - ${d.os} - آخر ظهور: ${new Date(d.lastSeen).toLocaleString()}</div>`).join('') || '<div class="text-gray-400">لا توجد أجهزة</div>'}
                <hr class="my-3">
                <h3 class="font-bold text-yellow-400">⚠️ المخالفات</h3>
                ${stats.violations.map(v => `<div class="text-sm">📌 ${v.type} - ${new Date(v.date).toLocaleString()} - ${v.details}</div>`).join('') || '<div class="text-gray-400">لا توجد مخالفات</div>'}
                <hr class="my-3">
                <h3 class="font-bold text-yellow-400">📋 سجل التصرفات</h3>
                ${stats.activityLog.slice(-10).map(log => `<div class="text-sm">🕒 ${new Date(log.timestamp).toLocaleString()} - ${log.action} ${log.details ? '('+log.details+')' : ''}</div>`).join('') || '<div class="text-gray-400">لا توجد سجلات</div>'}
            </div>
        `,
        width: '700px',
        showCloseButton: true,
        confirmButtonText: 'إغلاق'
    });
}

// تعديل معلم
async function editTeacher(teacherId) {
    const teacher = getAllTeachers().find(t => String(t.teacherId) === teacherId);
    if (!teacher) return;
    const { value: formValues } = await Swal.fire({
        title: '✏️ تعديل بيانات المعلم',
        html: `
            <input id="edit-name" class="swal2-input" value="${escapeHtml(teacher.name)}" placeholder="الاسم">
            <input id="edit-email" class="swal2-input" value="${teacher.email || ''}" placeholder="البريد">
            <input id="edit-phone" class="swal2-input" value="${teacher.phone || ''}" placeholder="الهاتف">
            <select id="edit-plan" class="swal2-select"><option value="free" ${teacher.plan==='free'?'selected':''}>مجاني</option><option value="gold" ${teacher.plan==='gold'?'selected':''}>ذهبي</option><option value="platinum" ${teacher.plan==='platinum'?'selected':''}>ماسي</option></select>
            <select id="edit-status" class="swal2-select"><option value="active" ${teacher.status==='active'?'selected':''}>نشط</option><option value="suspended" ${teacher.status==='suspended'?'selected':''}>معلق</option></select>
            <input id="edit-expiry" type="date" value="${teacher.expiryDate ? teacher.expiryDate.split('T')[0] : ''}" placeholder="تاريخ الانتهاء">
        `,
        preConfirm: () => ({
            name: document.getElementById('edit-name').value,
            email: document.getElementById('edit-email').value,
            phone: document.getElementById('edit-phone').value,
            plan: document.getElementById('edit-plan').value,
            status: document.getElementById('edit-status').value,
            expiryDate: document.getElementById('edit-expiry').value || null
        })
    });
    if (formValues) {
        await updateTeacher(teacherId, formValues);
        showFloatingNotification('تم تحديث بيانات المعلم', 'success');
        const container = document.getElementById('admin-section-content');
        if (container) await renderTeachersManagement(container);
    }
}

// ========== بنك الأسئلة العالمي ==========
async function renderGlobalQuestionsBank(container) {
    const allQuestions = await getAllQuestionsFromAllTeachers();
    const teachers = getAllTeachers();
    container.innerHTML = `
        <div class="glass-panel p-4">
            <h3 class="text-xl font-bold text-yellow-400 mb-3">📚 بنك الأسئلة العالمي (جميع المعلمين)</h3>
            <div class="flex gap-4 mb-4">
                <select id="filter-teacher" class="bg-black/60 border rounded-xl p-2"><option value="">جميع المعلمين</option>${teachers.map(t => `<option value="${t.teacherId}">${escapeHtml(t.name)}</option>`).join('')}</select>
                <select id="filter-grade" class="bg-black/60 border rounded-xl p-2"><option value="">جميع الصفوف</option></select>
                <button id="apply-question-filter" class="bg-purple-600 px-4 py-2 rounded-full">فلترة</button>
            </div>
            <div id="questions-list" class="space-y-3 max-h-[500px] overflow-y-auto">
                ${renderQuestionsList(allQuestions)}
            </div>
        </div>
    `;
    // تعبئة خيارات الصفوف
    const grades = await getDynamicGrades();
    const gradeSelect = document.getElementById('filter-grade');
    grades.forEach(g => gradeSelect.innerHTML += `<option value="${g}">${g}</option>`);
    
    document.getElementById('apply-question-filter').onclick = async () => {
        const teacherId = document.getElementById('filter-teacher').value;
        const grade = document.getElementById('filter-grade').value;
        let filtered = allQuestions;
        if (teacherId) filtered = filtered.filter(q => q.teacherId === teacherId);
        if (grade) filtered = filtered.filter(q => q.grade === grade);
        document.getElementById('questions-list').innerHTML = renderQuestionsList(filtered);
    };
}

function renderQuestionsList(questions) {
    if (questions.length === 0) return '<div class="text-gray-400 text-center">لا توجد أسئلة</div>';
    return questions.map(q => `
        <div class="p-3 bg-white/5 rounded-xl border border-white/10">
            <div class="flex justify-between">
                <span class="text-yellow-400 font-bold">${escapeHtml(q.grade)} - ${escapeHtml(q.subject || 'بدون مادة')}</span>
                <span class="text-sm text-gray-300">👨‍🏫 ${escapeHtml(q.teacherName)}</span>
            </div>
            <p class="mt-1">❓ ${escapeHtml(q.text)}</p>
            <div class="text-sm text-gray-400">الإجابة: ${q.correctAnswer}</div>
            <div class="flex gap-2 mt-2">
                <button class="edit-question-btn text-green-400" data-id="${q.id}" data-grade="${q.grade}">✏️ تعديل</button>
                <button class="delete-question-btn text-red-400" data-id="${q.id}" data-grade="${q.grade}">🗑️ حذف</button>
            </div>
        </div>
    `).join('');
}

// حذف وتعديل السؤال (يتم ربطها بعد render)
// سنضيف مستمعي الأحداث بعد إدراج الـ HTML
// يمكن إضافتها داخل apply-question-filter أو بعد التصيير

// ========== الغرف النشطة ==========
function renderActiveRooms(container) {
    const rooms = getActiveRooms();
    container.innerHTML = `
        <div class="glass-panel p-4">
            <h3 class="text-xl font-bold text-yellow-400 mb-3">🌐 الغرف النشطة حالياً</h3>
            ${rooms.length ? rooms.map(r => `<div class="p-2 border-b border-white/10">🆔 ${r.roomId} | المضيف: ${r.hostName} | عدد اللاعبين: ${r.players?.length || 0}</div>`).join('') : '<div class="text-gray-400">لا توجد غرف نشطة</div>'}
        </div>
    `;
}

// ========== الإعدادات العامة ==========
function renderAdminSettings(container) {
    container.innerHTML = `
        <div class="glass-panel p-4">
            <h3 class="text-xl font-bold text-yellow-400 mb-3">⚙️ الإعدادات العامة</h3>
            <div class="space-y-4">
                <div><label class="block">🔑 مفتاح EmailJS (Service ID)</label><input type="text" id="emailjs-service" class="w-full bg-black/60 border rounded-xl p-2" placeholder="service_id"></div>
                <div><label class="block">🔑 مفتاح EmailJS (Template ID)</label><input type="text" id="emailjs-template" class="w-full bg-black/60 border rounded-xl p-2" placeholder="template_id"></div>
                <div><label class="block">🔑 مفتاح EmailJS (Public Key)</label><input type="text" id="emailjs-public" class="w-full bg-black/60 border rounded-xl p-2" placeholder="public_key"></div>
                <div><label class="block flex items-center gap-2"><input type="checkbox" id="maintenance-mode"> 🛠️ وضع الصيانة (تعطيل الدخول للمستخدمين العاديين)</label></div>
                <button id="save-settings-btn" class="bg-green-600 px-6 py-2 rounded-full">💾 حفظ الإعدادات</button>
            </div>
        </div>
    `;
    // تحميل الإعدادات من localStorage
    document.getElementById('emailjs-service').value = localStorage.getItem('emailjs_service_id') || '';
    document.getElementById('emailjs-template').value = localStorage.getItem('emailjs_template_id') || '';
    document.getElementById('emailjs-public').value = localStorage.getItem('emailjs_public_key') || '';
    document.getElementById('maintenance-mode').checked = localStorage.getItem('maintenance_mode') === 'true';
    
    document.getElementById('save-settings-btn').onclick = () => {
        localStorage.setItem('emailjs_service_id', document.getElementById('emailjs-service').value);
        localStorage.setItem('emailjs_template_id', document.getElementById('emailjs-template').value);
        localStorage.setItem('emailjs_public_key', document.getElementById('emailjs-public').value);
        localStorage.setItem('maintenance_mode', document.getElementById('maintenance-mode').checked);
        showFloatingNotification('تم حفظ الإعدادات', 'success');
    };
}

// تصدير الدوال الرئيسية
export { renderTeachersManagement, renderGlobalQuestionsBank, renderActiveRooms, renderAdminSettings };