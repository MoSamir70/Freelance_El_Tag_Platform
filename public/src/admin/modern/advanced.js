// src/admin/modern/advanced.js
// الإعدادات المتقدمة – مع دعم صلاحيات المساعدين (كامل)

import { db as firestoreDb, collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp, query, where, orderBy, writeBatch } from '../../firebase/init.js';
import { getTeachersList } from '../../firebase/auth.js';
import { loadQuestionsFromIndexedDB, saveQuestionsToIndexedDB } from '../../db/indexeddb.js';
import { getAllStudents, showNotification, escapeHtml, addAuditLog, EGYPT_SUBJECTS, EGYPT_GRADES, hasPermission, applyUIPermissions } from './utils.js';
import { getMaintenanceData, enableMaintenance, disableMaintenance } from '../../services/maintenanceService.js';
import { ADMIN_SECRET_KEY } from '../../config.js';
import { renderTeachers } from './teachers.js';

// ========== الإعدادات المتقدمة – الهيكل الرئيسي ==========
export async function renderAdvancedSettings() {
    if (!hasPermission('advanced', 'view')) {
        document.getElementById('advancedPane').innerHTML = `
            <div class="glass-card p-5 text-center">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <h3 class="text-xl font-bold text-red-400">غير مصرح</h3>
                <p class="text-gray-400">ليس لديك صلاحية للوصول إلى الإعدادات المتقدمة.</p>
            </div>`;
        return;
    }
    const teachers = await getTeachersList();
    const html = `
        <div class="glass-card p-5">
            <h3 class="text-2xl font-bold text-yellow-400 mb-5"><i class="fas fa-cogs ml-2"></i> الإعدادات المتقدمة والتحكم الكامل</h3>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="space-y-5">
                    <!-- ========== وضع الصيانة (النظام الجديد) ========== -->
                    <div class="bg-white/5 p-4 rounded-2xl">
                        <div class="flex justify-between items-center mb-3">
                            <label class="block font-bold text-yellow-400"><i class="fas fa-shield-alt"></i> وضع الصيانة</label>
                            <span id="maintenanceStatusBadge" class="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">🟢 غير نشط</span>
                        </div>
                        <div class="space-y-3">
                            <label class="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" id="maintenanceModeCheckbox" class="w-5 h-5 accent-red-500">
                                <span class="text-sm">🔒 تعطيل الدخول للمستخدمين العاديين (المعلمين والطلاب)</span>
                            </label>
                            <div id="maintenanceMessageGroup" class="hidden">
                                <label class="block text-sm text-gray-300 mb-1">📝 رسالة الصيانة (تظهر للمستخدمين)</label>
                                <textarea id="maintenanceMessage" rows="2" class="w-full bg-black/40 border border-white/20 rounded-xl p-2 text-sm" placeholder="سيتم تحديث المنصة. الرجاء المحاولة لاحقاً."></textarea>
                                <div class="text-xs text-gray-400 mt-1">✏️ سيتم عرض هذه الرسالة للمستخدمين عند محاولة الدخول أو أثناء الجلسة.</div>
                            </div>
                            <div id="maintenanceTimerGroup" class="hidden">
                                <label class="block text-sm text-gray-300 mb-1">⏰ وقت العودة المتوقع (اختياري)</label>
                                <input type="datetime-local" id="maintenanceEndTime" class="w-full bg-black/40 border border-white/20 rounded-xl p-2 text-sm">
                                <div class="text-xs text-gray-400 mt-1">📅 سيتم عرض الوقت المتبقي للمستخدمين.</div>
                            </div>
                            <div class="flex gap-3 pt-2">
                                <button id="saveMaintenanceBtn" class="btn-primary text-sm px-4 py-1.5"><i class="fas fa-save"></i> حفظ الإعدادات</button>
                                <button id="testMaintenanceBtn" class="btn-secondary text-sm px-4 py-1.5"><i class="fas fa-bell"></i> إرسال إشعار تجريبي</button>
                            </div>
                            <div class="text-xs text-gray-500 border-t border-white/10 pt-3 mt-2">
                                <i class="fas fa-info-circle ml-1"></i> ملاحظة:
                                <ul class="list-disc pr-5 mt-1 space-y-1">
                                    <li>✅ المطور (كود 29910141300038) يتجاوز وضع الصيانة ويمكنه الدخول دائماً.</li>
                                    <li>📢 عند تفعيل الصيانة، سيتم إرسال إشعار فوري لجميع المستخدمين النشطين وسيتم تسجيل خروجهم خلال 30 ثانية.</li>
                                    <li>🔄 الإعدادات محفوظة في قاعدة البيانات (Firestore) وتؤثر على جميع المستخدمين فوراً.</li>
                                    <li>🕒 يمكنك تحديد وقت عودة متوقع وسيظهر للمستخدمين الوقت المتبقي.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <!-- باقي الأقسام -->
                    <div class="bg-white/5 p-4 rounded-2xl"><label class="block mb-2 font-bold text-yellow-400"><i class="fas fa-bullhorn"></i> إشعار عام للمعلمين</label><textarea id="globalNotice" rows="2" class="w-full bg-black/40 border rounded-xl p-2" placeholder="رسالة تظهر للمعلمين عند تسجيل الدخول"></textarea><button id="sendGlobalNoticeBtn" class="btn-primary mt-2 text-sm"><i class="fas fa-paper-plane"></i> إرسال الإشعار</button></div>
                    <div class="bg-white/5 p-4 rounded-2xl"><label class="block mb-2 font-bold text-yellow-400"><i class="fas fa-gift"></i> ترقية مؤقتة لفئة المعلمين</label><select id="upgradePlanSelect" class="filter-select w-full mb-2"><option value="free">مجاني → فضي</option><option value="silver">فضي → ذهبي</option></select><input type="number" id="upgradeDays" placeholder="عدد الأيام" class="filter-input w-full mb-2"><button id="applyTempUpgradeBtn" class="btn-primary w-full text-sm"><i class="fas fa-rocket"></i> تطبيق الترقية</button></div>
                    <div class="bg-white/5 p-4 rounded-2xl"><label class="block mb-2 font-bold text-yellow-400"><i class="fas fa-calendar-plus"></i> تمديد اشتراك معلم محدد</label><input type="text" id="extendTeacherId" placeholder="كود المعلم" class="filter-input w-full mb-2"><input type="date" id="extendNewDate" class="filter-input w-full mb-2"><button id="extendTeacherBtn" class="btn-primary w-full text-sm"><i class="fas fa-hourglass-start"></i> تمديد الاشتراك</button></div>
                </div>
                <div class="space-y-5">
                    <div class="bg-white/5 p-4 rounded-2xl"><label class="block mb-2 font-bold text-yellow-400"><i class="fas fa-ticket-alt"></i> كوبونات الخصم (جلسات محدودة)</label>
                        <div class="flex gap-2 mb-2"><input type="text" id="couponCode" class="filter-input flex-1" placeholder="رمز الكوبون (اتركه للتوليد التلقائي)"><button id="generateCouponCodeBtn" class="bg-indigo-600 px-3 py-1 rounded text-sm hover:bg-indigo-500 transition">🎲 توليد تلقائي</button></div>
                        <div class="flex gap-2 mb-2"><select id="couponTargetPlan" class="filter-select"><option value="free">مجاني</option><option value="silver">فضي</option><option value="gold">ذهبي</option></select><input type="number" id="couponUses" placeholder="الفائزون " class="filter-input w-28" min="1" value="1"></div>
                        <div class="flex gap-2 mb-2"><label class="text-sm text-gray-300">المدة بالساعات:</label><select id="couponDurationHours" class="filter-select w-32"><option value="1">1 ساعة</option><option value="3">3 ساعات</option><option value="6">6 ساعات</option><option value="12">12 ساعة</option><option value="24" selected>24 ساعة</option><option value="48">48 ساعة</option><option value="72">72 ساعة</option><option value="168">168 ساعة</option><option value="336">336 ساعة</option><option value="720">720 ساعة</option></select><div class="flex gap-2 mb-2"><label class="text-sm text-gray-300">مدة الاشتراك (بالأيام):</label><input type="number" id="couponSubscriptionDays" class="filter-input w-28" min="1" value="30" placeholder="عدد الأيام"></div></div>
                        <button id="createCouponBtn" class="btn-primary w-full text-sm"><i class="fas fa-plus"></i> إنشاء كوبون</button><button id="listCouponsBtn" class="btn-secondary w-full mt-2 text-sm"><i class="fas fa-list"></i> عرض الكوبونات</button><button id="viewCouponUsagesBtn" class="btn-secondary w-full mt-2 text-sm"><i class="fas fa-history"></i> سجل استخدام الكوبونات</button>
                    </div>
                    <div class="bg-white/5 p-4 rounded-2xl"><label class="block mb-2 font-bold text-yellow-400"><i class="fas fa-clock"></i> جدولة المهام</label><select id="taskType" class="filter-select w-full mb-2"><option value="reminder">تذكير أسبوعي</option><option value="report">تقرير شهري</option></select><input type="time" id="taskTime" class="filter-input w-full mb-2"><select id="taskDay" class="filter-select w-full mb-2"><option value="1">السبت</option><option value="2">الأحد</option><option value="3">الاثنين</option><option value="4">الثلاثاء</option><option value="5">الأربعاء</option><option value="6">الخميس</option><option value="7">الجمعة</option></select><button id="scheduleTaskBtn" class="btn-primary w-full text-sm"><i class="fas fa-save"></i> جدولة</button><div id="scheduledTasksList" class="mt-3 text-sm text-gray-300 max-h-40 overflow-y-auto"></div></div>
                </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div class="bg-white/5 p-4 rounded-2xl"><label class="block mb-2 font-bold text-yellow-400"><i class="fas fa-database"></i> النسخ الاحتياطي والاستعادة</label><button id="backupDataBtn" class="btn-primary text-sm w-full mb-2"><i class="fas fa-download"></i> تحميل نسخة احتياطية كاملة (JSON)</button><input type="file" id="restoreFileInput" accept=".json" class="filter-input w-full mb-2"><button id="restoreDataBtn" class="btn-secondary text-sm w-full"><i class="fas fa-upload"></i> استعادة من نسخة احتياطية</button></div>
                <div class="bg-white/5 p-4 rounded-2xl"><label class="block mb-2 font-bold text-yellow-400"><i class="fas fa-envelope-open-text"></i> قوالب البريد الإلكتروني</label><select id="emailTemplateSelect" class="filter-select w-full mb-2"><option value="welcome">الترحيب</option><option value="expiry">اقتراب انتهاء الاشتراك</option><option value="custom">قالب مخصص</option></select><textarea id="emailTemplateContent" rows="4" class="w-full bg-black/40 border rounded-xl p-2" placeholder="محتوى القالب..."></textarea><button id="saveEmailTemplateBtn" class="btn-primary w-full text-sm mt-2"><i class="fas fa-save"></i> حفظ القالب</button></div>
            </div>
            <div class="mt-6 bg-white/5 p-4 rounded-2xl"><label class="block mb-3 font-bold text-yellow-400"><i class="fas fa-book"></i> إدارة المواد والصفوف الافتراضية</label><div class="flex flex-wrap gap-3"><button id="resetDefaultSubjectsBtn" class="btn-secondary text-sm"><i class="fas fa-undo-alt"></i> إعادة المواد</button><button id="resetDefaultGradesBtn" class="btn-secondary text-sm"><i class="fas fa-undo-alt"></i> إعادة الصفوف</button><button id="addCustomSubjectBtn" class="btn-primary text-sm"><i class="fas fa-plus"></i> إضافة مادة</button><button id="addCustomGradeBtn" class="btn-primary text-sm"><i class="fas fa-plus"></i> إضافة صف</button></div></div>
        </div>
    `;
    document.getElementById('advancedPane').innerHTML = html;
    applyUIPermissions();  // تطبيق الصلاحيات على الأزرار

    // تهيئة دوال وضع الصيانة
    await loadMaintenanceSettingsNew();
    bindMaintenanceEventsNew();

    // إشعار عام
    document.getElementById('sendGlobalNoticeBtn')?.addEventListener('click', async () => {
        const msg = document.getElementById('globalNotice').value.trim();
        if (!msg) { Swal.fire('تنبيه', 'الرجاء كتابة نص الإشعار', 'warning'); return; }
        try {
            await addDoc(collection(firestoreDb, 'globalNotifications'), { message: msg, timestamp: serverTimestamp(), readBy: [] });
            await addAuditLog('إرسال إشعار عام', msg.substring(0,100));
            Swal.fire('تم الإرسال', 'سيظهر الإشعار للمعلمين فوراً', 'success');
            showNotification('📢 تم إرسال الإشعار العام بنجاح', 'success');
            document.getElementById('globalNotice').value = '';
        } catch(err) { Swal.fire('خطأ', 'فشل إرسال الإشعار: '+err.message, 'error'); }
    });

    // ترقية مؤقتة
    document.getElementById('applyTempUpgradeBtn')?.addEventListener('click', async () => {
        const planType = document.getElementById('upgradePlanSelect').value;
        const days = parseInt(document.getElementById('upgradeDays').value);
        if(!days) { Swal.fire('خطأ','أدخل عدد الأيام','error'); return; }
        let targetTeachers = planType === 'free' ? teachers.filter(t=>t.plan==='free') : teachers.filter(t=>t.plan==='silver');
        if(targetTeachers.length===0) { Swal.fire('تنبيه','لا يوجد معلمون في هذه الفئة','info'); return; }
        const batch = writeBatch(firestoreDb);
        for(let t of targetTeachers){
            const teacherRef = doc(firestoreDb, 'teachers', t.id);
            const newExpiry = new Date(); newExpiry.setDate(newExpiry.getDate()+days);
            batch.update(teacherRef, { expiryDate: newExpiry.toISOString(), plan: planType==='free'?'silver':'gold' });
        }
        await batch.commit();
        await addAuditLog('ترقية مؤقتة', `${planType} -> ${days} يوماً (${targetTeachers.length} معلم)`);
        Swal.fire('تمت الترقية',`تمت ترقية ${targetTeachers.length} معلماً`,'success');
        showNotification(`✨ تمت ترقية ${targetTeachers.length} معلماً`, 'success');
        await renderTeachers();
    });

    // تمديد اشتراك معلم محدد
    document.getElementById('extendTeacherBtn')?.addEventListener('click', async () => {
        const teacherId = document.getElementById('extendTeacherId').value;
        const newDate = document.getElementById('extendNewDate').value;
        if(!teacherId || !newDate) { Swal.fire('خطأ','أدخل كود المعلم والتاريخ','error'); return; }
        const teacherRef = doc(firestoreDb, 'teachers', teacherId);
        const teacherSnap = await getDoc(teacherRef);
        if(teacherSnap.exists()){
            await updateDoc(teacherRef, { expiryDate: new Date(newDate).toISOString() });
            await addAuditLog('تمديد اشتراك', `${teacherSnap.data().name} حتى ${newDate}`);
            Swal.fire('تم التمديد','','success');
            showNotification(`✅ تم تمديد اشتراك المعلم ${teacherSnap.data().name}`, 'success');
            await renderTeachers();
        } else Swal.fire('خطأ','المعلم غير موجود','error');
    });

    // كوبونات
    document.getElementById('generateCouponCodeBtn')?.addEventListener('click', () => {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        document.getElementById('couponCode').value = `TAJ-${randomNum}`;
    });
    document.getElementById('createCouponBtn')?.addEventListener('click', createCoupon);
    document.getElementById('listCouponsBtn')?.addEventListener('click', listCoupons);
    document.getElementById('viewCouponUsagesBtn')?.addEventListener('click', viewCouponUsages);

    // جدولة المهام
    document.getElementById('scheduleTaskBtn')?.addEventListener('click', () => {
        const type = document.getElementById('taskType').value;
        const time = document.getElementById('taskTime').value;
        const day = document.getElementById('taskDay').value;
        if(!time) { Swal.fire('خطأ','حدد الوقت','error'); return; }
        const tasks = JSON.parse(localStorage.getItem('scheduled_tasks') || '[]');
        tasks.push({ id: Date.now(), type, time, day });
        localStorage.setItem('scheduled_tasks', JSON.stringify(tasks));
        loadScheduledTasks();
        addAuditLog('جدولة مهمة', `${type} - ${time}`);
        Swal.fire('تمت الجدولة','','success');
        showNotification(`📅 تمت جدولة مهمة ${type} في اليوم ${day} الساعة ${time}`, 'success');
    });
    loadScheduledTasks();

    // النسخ الاحتياطي
    document.getElementById('backupDataBtn')?.addEventListener('click', backupData);
    document.getElementById('restoreDataBtn')?.addEventListener('click', () => {
        const input = document.getElementById('restoreFileInput');
        input.click();
        input.onchange = async (event) => {
            await restoreData(event.target.files[0]);
            input.value = '';
        };
    });

    // قوالب البريد الإلكتروني
    document.getElementById('saveEmailTemplateBtn')?.addEventListener('click', () => {
        const type = document.getElementById('emailTemplateSelect').value;
        const content = document.getElementById('emailTemplateContent').value;
        if(!content) { Swal.fire('خطأ','أدخل محتوى القالب','error'); return; }
        const templates = JSON.parse(localStorage.getItem('email_templates') || '{}');
        templates[type] = content;
        localStorage.setItem('email_templates', JSON.stringify(templates));
        addAuditLog('حفظ قالب بريد', type);
        Swal.fire('تم حفظ القالب','','success');
        showNotification('📧 تم حفظ قالب البريد الإلكتروني', 'success');
    });

    // المواد والصفوف
    document.getElementById('resetDefaultSubjectsBtn')?.addEventListener('click', () => { Swal.fire('تم','إعادة تعيين المواد','success'); });
    document.getElementById('resetDefaultGradesBtn')?.addEventListener('click', () => { Swal.fire('تم','إعادة تعيين الصفوف','success'); });
    document.getElementById('addCustomSubjectBtn')?.addEventListener('click', async () => {
        const { value: newSubj } = await Swal.fire({ title:'إضافة مادة جديدة', input:'text', background:'#0f172a', color:'#fff' });
        if(newSubj) { EGYPT_SUBJECTS.push(newSubj); addAuditLog('إضافة مادة', newSubj); Swal.fire('تمت الإضافة','','success'); showNotification(`📚 تمت إضافة مادة جديدة: ${newSubj}`, 'success'); }
    });
    document.getElementById('addCustomGradeBtn')?.addEventListener('click', async () => {
        const { value: newGrade } = await Swal.fire({ title:'إضافة صف جديد', input:'text', background:'#0f172a', color:'#fff' });
        if(newGrade) { EGYPT_GRADES.push(newGrade); addAuditLog('إضافة صف', newGrade); Swal.fire('تمت الإضافة','','success'); showNotification(`🎓 تمت إضافة صف جديد: ${newGrade}`, 'success'); }
    });
}

// ========== دوال وضع الصيانة الجديدة ==========
async function loadMaintenanceSettingsNew() {
    try {
        const data = await getMaintenanceData();
        const checkbox = document.getElementById('maintenanceModeCheckbox');
        const messageGroup = document.getElementById('maintenanceMessageGroup');
        const timerGroup = document.getElementById('maintenanceTimerGroup');
        const messageTextarea = document.getElementById('maintenanceMessage');
        const endTimeInput = document.getElementById('maintenanceEndTime');
        const statusBadge = document.getElementById('maintenanceStatusBadge');
        if (checkbox) checkbox.checked = data.enabled;
        if (messageGroup) messageGroup.classList.toggle('hidden', !data.enabled);
        if (timerGroup) timerGroup.classList.toggle('hidden', !data.enabled);
        if (messageTextarea) messageTextarea.value = data.message || '';
        if (endTimeInput && data.endTime) endTimeInput.value = data.endTime.toISOString().slice(0, 16);
        else if (endTimeInput) endTimeInput.value = '';
        if (statusBadge) {
            if (data.enabled) {
                statusBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 animate-pulse';
                statusBadge.innerHTML = '🔴 نشط (يمنع الدخول)';
            } else {
                statusBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400';
                statusBadge.innerHTML = '🟢 غير نشط';
            }
        }
    } catch (err) {
        console.error('❌ فشل تحميل إعدادات الصيانة:', err);
        showNotification('حدث خطأ في تحميل إعدادات الصيانة', 'error');
    }
}

async function saveMaintenanceSettingsNew() {
    const enabled = document.getElementById('maintenanceModeCheckbox')?.checked || false;
    const message = document.getElementById('maintenanceMessage')?.value.trim() || 'المنصة تحت الصيانة حالياً. نعتذر عن الإزعاج.';
    let endTime = null;
    const endTimeInput = document.getElementById('maintenanceEndTime');
    if (endTimeInput && endTimeInput.value) {
        endTime = new Date(endTimeInput.value);
        if (isNaN(endTime.getTime())) endTime = null;
    }
    const developerCode = sessionStorage.getItem('peak_teacher_code') || ADMIN_SECRET_KEY;
    let success;
    if (enabled) success = await enableMaintenance(message, endTime, developerCode);
    else success = await disableMaintenance(developerCode);
    if (success) {
        const messageGroup = document.getElementById('maintenanceMessageGroup');
        const timerGroup = document.getElementById('maintenanceTimerGroup');
        const statusBadge = document.getElementById('maintenanceStatusBadge');
        if (messageGroup) messageGroup.classList.toggle('hidden', !enabled);
        if (timerGroup) timerGroup.classList.toggle('hidden', !enabled);
        if (statusBadge) {
            if (enabled) {
                statusBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 animate-pulse';
                statusBadge.innerHTML = '🔴 نشط (يمنع الدخول)';
            } else {
                statusBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400';
                statusBadge.innerHTML = '🟢 غير نشط';
            }
        }
        showNotification(enabled ? '✅ تم تفعيل وضع الصيانة' : '✅ تم إلغاء وضع الصيانة', 'success');
    } else {
        showNotification('❌ فشل حفظ الإعدادات', 'error');
    }
}

async function sendTestNotificationNew() {
    try {
        const data = await getMaintenanceData();
        await addDoc(collection(firestoreDb, 'globalNotifications'), {
            title: '🧪 إشعار تجريبي من المطور',
            message: `هذا إشعار تجريبي للتحقق من نظام الإشعارات.${data.enabled ? '\n\n⚠️ ملاحظة: وضع الصيانة مفعل حالياً.' : ''}`,
            timestamp: serverTimestamp(),
            type: 'test',
            readBy: []
        });
        Swal.fire('تم الإرسال', 'تم إرسال إشعار تجريبي لجميع المستخدمين النشطين', 'success');
    } catch (err) {
        console.error(err);
        Swal.fire('خطأ', 'فشل إرسال الإشعار: ' + err.message, 'error');
    }
}

function bindMaintenanceEventsNew() {
    const checkbox = document.getElementById('maintenanceModeCheckbox');
    const saveBtn = document.getElementById('saveMaintenanceBtn');
    const testBtn = document.getElementById('testMaintenanceBtn');
    if (checkbox) checkbox.addEventListener('change', () => saveMaintenanceSettingsNew());
    if (saveBtn) saveBtn.addEventListener('click', () => saveMaintenanceSettingsNew());
    if (testBtn) testBtn.addEventListener('click', () => sendTestNotificationNew());
    const messageTextarea = document.getElementById('maintenanceMessage');
    if (messageTextarea) {
        let timeout;
        messageTextarea.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => saveMaintenanceSettingsNew(), 1500);
        });
    }
    const endTimeInput = document.getElementById('maintenanceEndTime');
    if (endTimeInput) endTimeInput.addEventListener('change', () => saveMaintenanceSettingsNew());
}

// ========== دوال الكوبونات ==========
const couponsCollection = collection(firestoreDb, 'coupons');

async function createCoupon() {
    let code = document.getElementById('couponCode').value.trim();
    const targetPlan = document.getElementById('couponTargetPlan').value;
    const uses = parseInt(document.getElementById('couponUses').value);
    const durationHours = parseInt(document.getElementById('couponDurationHours').value);
    const subscriptionDays = parseInt(document.getElementById('couponSubscriptionDays').value) || 30;
    if (!code) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        code = `TAJ-${randomNum}`;
        document.getElementById('couponCode').value = code;
    }
    if (isNaN(uses) || uses <= 0) {
        Swal.fire('خطأ', 'عدد الاستخدامات مطلوب وأكبر من صفر', 'error');
        return;
    }
    if (isNaN(durationHours) || durationHours <= 0) {
        Swal.fire('خطأ', 'المدة بالساعات غير صحيحة', 'error');
        return;
    }
    const existingQuery = query(couponsCollection, where('code', '==', code));
    const existingSnap = await getDocs(existingQuery);
    if (!existingSnap.empty) {
        Swal.fire('خطأ', 'هذا الكود موجود بالفعل', 'error');
        return;
    }
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + durationHours);
    const firestoreTimestamp = Timestamp.fromDate(expiryDate);
    await setDoc(doc(couponsCollection, code), {
        code: code,
        targetPlan: targetPlan,
        usesLeft: uses,
        totalUses: uses,
        expiry: firestoreTimestamp,
        durationHours: durationHours,
        subscriptionDays: subscriptionDays,
        createdAt: serverTimestamp(),
        createdBy: 'admin',
        usedBy: []
    });
    await addAuditLog('إنشاء كوبون', `${code} - ${uses} جلسة - مدة ${durationHours} ساعة - اشتراك ${subscriptionDays} يوم (${targetPlan})`);
    Swal.fire({
        icon: 'success',
        title: 'تم إنشاء الكوبون',
        html: `<p>الكود: <strong style="font-size:1.2rem;">${code}</strong></p><p>ينتهي الكوبون بعد <strong>${durationHours}</strong> ساعة</p><p>مدة الاشتراك: <strong>${subscriptionDays}</strong> يوم</p><p>عدد الاستخدامات: ${uses}</p>`,
        background: '#0f172a',
        color: '#fff'
    });
    showNotification(`🎟️ تم إنشاء كوبون ${code}`, 'success');
    document.getElementById('couponCode').value = '';
    document.getElementById('couponUses').value = '';
    document.getElementById('couponTargetPlan').value = 'silver';
    document.getElementById('couponDurationHours').value = '24';
    document.getElementById('couponSubscriptionDays').value = '30';
}

async function listCoupons() {
    const snapshot = await getDocs(query(couponsCollection, orderBy('createdAt', 'desc')));
    const coupons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (coupons.length === 0) {
        Swal.fire('لا توجد كوبونات', '', 'info');
        return;
    }
    let html = `<div style="max-height:550px; overflow-y:auto; padding:0.5rem;"><div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
    for (const c of coupons) {
        const remaining = c.usesLeft || 0;
        const totalUses = c.totalUses || remaining;
        const usedCount = (c.usedBy?.length) || 0;
        let expiryDisplay = 'غير محدد';
        let isExpired = false;
        if (c.expiry) {
            const expiryDate = c.expiry.toDate ? c.expiry.toDate() : new Date(c.expiry);
            expiryDisplay = expiryDate.toLocaleString('ar-EG');
            isExpired = expiryDate < new Date();
        }
        const subscriptionDays = c.subscriptionDays || 30;
        let planClass = '', planIcon = '', planBg = '';
        if (c.targetPlan === 'gold') {
            planClass = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
            planIcon = '👑';
            planBg = 'from-yellow-900/30 to-amber-900/20';
        } else if (c.targetPlan === 'silver') {
            planClass = 'text-blue-300 bg-blue-500/10 border-blue-500/30';
            planIcon = '🥈';
            planBg = 'from-blue-900/30 to-slate-900/20';
        } else {
            planClass = 'text-green-400 bg-green-500/10 border-green-500/30';
            planIcon = '🆓';
            planBg = 'from-green-900/30 to-emerald-900/20';
        }
        let statusBadge = '', statusColor = '';
        if (isExpired) {
            statusBadge = '<span class="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-bold">⛔ منتهي</span>';
            statusColor = 'border-red-500/30';
        } else if (remaining <= 0) {
            statusBadge = '<span class="bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full text-xs font-bold">📭 نفدت الاستخدامات</span>';
            statusColor = 'border-gray-500/30';
        } else {
            statusBadge = '<span class="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">✅ نشط</span>';
            statusColor = 'border-emerald-500/30';
        }
        const usagePercent = totalUses > 0 ? (remaining / totalUses) * 100 : 0;
        html += `
            <div class="rounded-2xl bg-gradient-to-br ${planBg} border ${statusColor} p-4 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-20 h-20 bg-yellow-500/5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-3xl">${planIcon}</span>
                        <div>
                            <div class="font-black text-lg text-white">${escapeHtml(c.code)}</div>
                            <div class="text-xs text-gray-400">تم الإنشاء: ${c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('ar-EG') : 'تاريخ غير معروف'}</div>
                        </div>
                    </div>
                    ${statusBadge}
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3 text-sm">
                    <div class="bg-black/20 rounded-lg p-2 text-center"><div class="text-gray-400 text-xs">الخطة</div><div class="font-bold ${planClass.split(' ')[0]}">${c.targetPlan === 'gold' ? 'ذهبية' : (c.targetPlan === 'silver' ? 'فضية' : 'مجانية')}</div></div>
                    <div class="bg-black/20 rounded-lg p-2 text-center"><div class="text-gray-400 text-xs">مدة الاشتراك</div><div class="font-bold text-yellow-400">${subscriptionDays} يوم</div></div>
                    <div class="bg-black/20 rounded-lg p-2 text-center"><div class="text-gray-400 text-xs">صلاحية الكوبون</div><div class="font-bold text-cyan-400 text-sm">${expiryDisplay}</div></div>
                    <div class="bg-black/20 rounded-lg p-2 text-center"><div class="text-gray-400 text-xs">المدة (ساعات)</div><div class="font-bold text-white">${c.durationHours || '?'}</div></div>
                </div>
                <div class="mb-3"><div class="flex justify-between text-xs text-gray-400 mb-1"><span>الاستخدامات المتبقية</span><span>${remaining} / ${totalUses}</span></div><div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden"><div class="h-full rounded-full ${usagePercent > 30 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : 'bg-red-500'}" style="width: ${usagePercent}%"></div></div></div>
                ${usedCount > 0 ? `<div class="mb-3 text-xs"><details><summary class="cursor-pointer text-gray-400 hover:text-yellow-400 transition">📋 المستخدمون (${usedCount})</summary><div class="mt-2 max-h-28 overflow-y-auto space-y-1 bg-black/20 p-2 rounded-lg">${(c.usedBy || []).map(uid => `<div class="text-gray-300 text-[11px] font-mono">🆔 ${escapeHtml(uid)}</div>`).join('')}</div></details></div>` : '<div class="text-xs text-gray-500 mb-3">📭 لم يستخدمه أحد بعد</div>'}
                <div class="flex gap-2 mt-2">
                    <button class="editCouponBtn flex-1 bg-blue-600/70 hover:bg-blue-600 text-white py-1.5 rounded-full text-sm transition flex items-center justify-center gap-1" data-code="${c.code}"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="deleteCouponBtn flex-1 bg-red-600/70 hover:bg-red-600 text-white py-1.5 rounded-full text-sm transition flex items-center justify-center gap-1" data-code="${c.code}"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>
        `;
    }
    html += `</div></div>`;
    Swal.fire({
        title: '🎟️ قائمة الكوبونات النشطة',
        html: html,
        width: '1000px',
        background: '#0f172a',
        color: '#fff',
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        cancelButtonColor: '#6b7280',
        didOpen: () => {
            document.querySelectorAll('.editCouponBtn').forEach(btn => btn.addEventListener('click', async (e) => {
                Swal.close();
                await editCoupon(btn.dataset.code);
            }));
            document.querySelectorAll('.deleteCouponBtn').forEach(btn => btn.addEventListener('click', async (e) => {
                Swal.close();
                await deleteCoupon(btn.dataset.code);
            }));
        }
    });
}

async function editCoupon(code) {
    const couponRef = doc(firestoreDb, 'coupons', code);
    const snap = await getDoc(couponRef);
    if (!snap.exists()) { Swal.fire('خطأ', 'الكوبون غير موجود', 'error'); return; }
    const data = snap.data();
    const currentExpiry = data.expiry?.toDate ? data.expiry.toDate() : (data.expiry ? new Date(data.expiry) : null);
    const expiryStr = currentExpiry ? currentExpiry.toISOString().slice(0, 16) : '';
    const durationHours = data.durationHours || 24;
    const subscriptionDays = data.subscriptionDays || 30;
    const { value: newData } = await Swal.fire({
        title: `تعديل الكوبون ${code}`,
        html: `
            <input id="newUses" type="number" class="swal2-input" value="${data.usesLeft}" placeholder="العدد المتبقي">
            <select id="newDurationHours" class="swal2-select">
                <option value="1" ${durationHours === 1 ? 'selected' : ''}>1 ساعة</option>
                <option value="3" ${durationHours === 3 ? 'selected' : ''}>3 ساعات</option>
                <option value="6" ${durationHours === 6 ? 'selected' : ''}>6 ساعات</option>
                <option value="12" ${durationHours === 12 ? 'selected' : ''}>12 ساعة</option>
                <option value="24" ${durationHours === 24 ? 'selected' : ''}>24 ساعة</option>
                <option value="48" ${durationHours === 48 ? 'selected' : ''}>48 ساعة</option>
                <option value="72" ${durationHours === 72 ? 'selected' : ''}>72 ساعة</option>
                <option value="168" ${durationHours === 168 ? 'selected' : ''}>168 ساعة</option>
                <option value="336" ${durationHours === 336 ? 'selected' : ''}>336 ساعة</option>
                <option value="720" ${durationHours === 720 ? 'selected' : ''}>720 ساعة</option>
            </select>
            <input id="newSubscriptionDays" type="number" class="swal2-input" value="${subscriptionDays}" placeholder="مدة الاشتراك (أيام)">
            <input id="newExpiryDatetime" type="datetime-local" class="swal2-input" value="${expiryStr}" placeholder="تاريخ انتهاء الكوبون (اختياري)">
        `,
        preConfirm: () => {
            const usesLeft = parseInt(document.getElementById('newUses').value);
            const newDuration = parseInt(document.getElementById('newDurationHours').value);
            const newSubscriptionDays = parseInt(document.getElementById('newSubscriptionDays').value);
            const expiryDatetime = document.getElementById('newExpiryDatetime').value;
            if (isNaN(usesLeft) || usesLeft < 0) { Swal.showValidationMessage('أدخل عدد صحيح'); return false; }
            let expiry = null;
            if (expiryDatetime) expiry = Timestamp.fromDate(new Date(expiryDatetime));
            return { usesLeft, durationHours: newDuration, subscriptionDays: newSubscriptionDays, expiry };
        },
        background: '#0f172a', color: '#fff'
    });
    if (newData) {
        const updates = { usesLeft: newData.usesLeft, durationHours: newData.durationHours, subscriptionDays: newData.subscriptionDays };
        if (newData.expiry) updates.expiry = newData.expiry;
        await updateDoc(couponRef, updates);
        await addAuditLog('تعديل كوبون', `${code} - العدد المتبقي: ${newData.usesLeft}، المدة: ${newData.durationHours} ساعة، الاشتراك: ${newData.subscriptionDays} يوم`);
        Swal.fire('تم التعديل', '', 'success');
        showNotification(`✏️ تم تعديل الكوبون ${code}`, 'info');
        await listCoupons();
    }
}

async function deleteCoupon(code) {
    const confirm = await Swal.fire({ title: 'تأكيد الحذف', text: `هل أنت متأكد من حذف الكوبون ${code}؟`, icon: 'warning', showCancelButton: true, background: '#0f172a', color: '#fff' });
    if (confirm.isConfirmed) {
        await deleteDoc(doc(firestoreDb, 'coupons', code));
        await addAuditLog('حذف كوبون', code);
        Swal.fire('تم الحذف', '', 'success');
        showNotification(`🗑️ تم حذف الكوبون ${code}`, 'info');
        await listCoupons();
    }
}

async function viewCouponUsages() {
    const snapshot = await getDocs(query(collection(firestoreDb, 'couponUsages'), orderBy('usedAt', 'desc')));
    const usages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (!usages.length) {
        Swal.fire('لا توجد سجلات', '', 'info');
        return;
    }
    let html = '<div style="max-height:500px; overflow-y:auto;"><table style="width:100%; text-align:right; border-collapse:collapse;"><thead><tr><th>الكود</th><th>المعلم</th><th>الهاتف</th><th>الخطة</th><th>مدة الاشتراك</th><th>تاريخ الانتهاء</th><th>وقت الاستخدام</th><th>IP</th></tr></thead><tbody>';
    usages.forEach(u => {
        const planName = u.plan === 'gold' ? 'ذهبي' : (u.plan === 'silver' ? 'فضي' : 'مجاني');
        html += `<tr><td>${escapeHtml(u.couponCode)}</td><td>${escapeHtml(u.teacherName)}</td><td>${escapeHtml(u.phone)}</td><td>${planName}</td><td>${u.subscriptionDays || '?'} يوم</td><td>${u.expiryDate?.toDate().toLocaleDateString() || '-'}</td><td>${u.usedAt?.toDate().toLocaleString()}</td><td>${escapeHtml(u.ip)}</td></tr>`;
    });
    html += '</tbody>}</table></div>';
    Swal.fire({
        title: 'سجل استخدام الكوبونات',
        html: html,
        width: '1100px',
        background: '#0f172a',
        color: '#fff'
    });
}

// ========== جدولة المهام (وظيفة مساعدة) ==========
function loadScheduledTasks() {
    const tasks = JSON.parse(localStorage.getItem('scheduled_tasks') || '[]');
    const container = document.getElementById('scheduledTasksList');
    if (container) {
        if (tasks.length === 0) container.innerHTML = '<div class="text-gray-400">لا توجد مهام مجدولة</div>';
        else container.innerHTML = tasks.map(t => `<div class="flex justify-between p-2 bg-white/5 rounded mb-1"><span>🕒 ${t.type==='reminder'?'تذكير':'تقرير'} - اليوم ${t.day} الساعة ${t.time}</span><button class="deleteTaskBtn text-red-400" data-id="${t.id}"><i class="fas fa-times-circle"></i></button></div>`).join('');
        document.querySelectorAll('.deleteTaskBtn').forEach(btn => btn.addEventListener('click', () => {
            const newTasks = tasks.filter(task => task.id != btn.dataset.id);
            localStorage.setItem('scheduled_tasks', JSON.stringify(newTasks));
            loadScheduledTasks();
            showNotification('تم حذف المهمة المجدولة', 'info');
        }));
    }
}

// ========== النسخ الاحتياطي ==========
async function backupData() {
    Swal.fire('جاري التحميل...', 'الرجاء الانتظار', 'info');
    const teachers = await getTeachersList();
    const students = await getAllStudents();
    let allQuestionsFirestore = [];
    const gradesSet = new Set(students.map(s => s.grade));
    for (const grade of gradesSet) {
        const questions = await loadQuestionsFromIndexedDB(grade);
        allQuestionsFirestore.push(...questions.map(q => ({ ...q, grade })));
    }
    const messagesSnap = await getDocs(collection(firestoreDb, 'messages'));
    const messages = messagesSnap.docs.map(doc => doc.data());
    const violationsSnap = await getDocs(collection(firestoreDb, 'violations'));
    const violations = violationsSnap.docs.map(doc => doc.data());
    const couponsSnap = await getDocs(collection(firestoreDb, 'coupons'));
    const coupons = couponsSnap.docs.map(doc => doc.data());
    const backup = {
        version: '1.0',
        timestamp: Date.now(),
        teachers,
        students,
        questions: allQuestionsFirestore,
        messages,
        violations,
        coupons
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full_backup_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Swal.fire('تم التصدير', 'تم حفظ نسخة احتياطية كاملة', 'success');
    showNotification('📦 تم تصدير النسخة الاحتياطية الكاملة', 'success');
}

async function restoreData(file) {
    if (!file) return;
    const result = await Swal.fire({
        title: '⚠️ تحذير شديد ⚠️',
        html: '<p style="color:red;">سيتم استبدال جميع البيانات الحالية بالبيانات الموجودة في ملف النسخة الاحتياطية.<br><strong>لا يمكن التراجع عن هذه العملية.</strong></p><p>هل أنت متأكد من المتابعة؟</p>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، استعادة',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff'
    });
    if (!result.isConfirmed) return;
    Swal.fire({ title: 'جارٍ الاستعادة...', text: 'الرجاء الانتظار', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (!backup.version || !backup.teachers) throw new Error('ملف نسخة احتياطية غير صالح');
        const batch = writeBatch(firestoreDb);
        const existingTeachers = await getTeachersList();
        for (const t of existingTeachers) batch.delete(doc(firestoreDb, 'teachers', t.id));
        const existingStudents = await getAllStudents();
        for (const s of existingStudents) batch.delete(doc(firestoreDb, 'students', s.id));
        const existingMessages = await getDocs(collection(firestoreDb, 'messages'));
        existingMessages.forEach(d => batch.delete(d.ref));
        const existingViolations = await getDocs(collection(firestoreDb, 'violations'));
        existingViolations.forEach(d => batch.delete(d.ref));
        const existingCoupons = await getDocs(collection(firestoreDb, 'coupons'));
        existingCoupons.forEach(d => batch.delete(d.ref));
        await batch.commit();
        const addBatch = writeBatch(firestoreDb);
        for (const t of backup.teachers) addBatch.set(doc(firestoreDb, 'teachers', t.id), t);
        for (const s of backup.students) addBatch.set(doc(firestoreDb, 'students', s.id), s);
        for (const q of backup.questions) {
            const questions = await loadQuestionsFromIndexedDB(q.grade);
            const existingQ = questions.filter(question => question.id !== q.id);
            existingQ.push(q);
            await saveQuestionsToIndexedDB(q.grade, existingQ);
        }
        for (const m of backup.messages) addBatch.set(doc(collection(firestoreDb, 'messages')), m);
        for (const v of backup.violations) addBatch.set(doc(collection(firestoreDb, 'violations')), v);
        for (const c of backup.coupons) addBatch.set(doc(firestoreDb, 'coupons', c.code), c);
        await addBatch.commit();
        Swal.fire('تمت الاستعادة', 'تم استعادة البيانات بنجاح، سيتم تحديث الصفحة', 'success');
        showNotification('🔄 تمت استعادة النسخة الاحتياطية، يتم تحديث الصفحة...', 'success');
        setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
        Swal.fire('خطأ', 'فشل استعادة البيانات: ' + e.message, 'error');
    }
}