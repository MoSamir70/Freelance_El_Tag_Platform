// src/admin/modern/violations.js
// سجل المخالفات والأجهزة – مع دعم صلاحيات المساعدين

import { db, collection, getDocs, getDoc, doc, updateDoc, query, orderBy, where, serverTimestamp } from '../../firebase/init.js';
import { getTeachersList } from '../../firebase/auth.js';
import { getTeacherDocumentByCode } from '../../services/dataService.js';
import { showNotification, escapeHtml, addAuditLog, hasPermission, applyUIPermissions } from './utils.js';
import { showTeacherCard } from './teachers.js';

// ========== العرض الرئيسي ==========
export async function renderViolations() {
    if (!hasPermission('violations', 'view')) {
        document.getElementById('violationsPane').innerHTML = `
            <div class="glass-card p-5 text-center">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <h3 class="text-xl font-bold text-red-400">غير مصرح</h3>
                <p class="text-gray-400">ليس لديك صلاحية لعرض المخالفات.</p>
            </div>`;
        return;
    }
    const violationsSnapshot = await getDocs(query(collection(db, 'violations'), orderBy('timestamp', 'desc')));
    const violations = violationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const teachers = await getTeachersList();
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.name]));
    const html = `
        <div class="glass-card p-5">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-2xl font-bold text-yellow-400"><i class="fas fa-exclamation-triangle ml-2"></i> سجل المخالفات والأجهزة</h3>
                <button id="refreshViolationsBtn" class="btn-secondary text-sm px-3 py-1" data-perm="violations.view">🔄 تحديث</button>
            </div>
            <div class="overflow-x-auto">
                <table class="admin-table">
                    <thead>
                        <tr><th>المعلم</th><th>نوع المخالفة</th><th>التفاصيل</th><th>التاريخ</th><th>الحالة</th><th>الإجراءات</th></tr>
                    </thead>
                    <tbody id="violationsTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('violationsPane').innerHTML = html;
    applyUIPermissions();
    document.getElementById('refreshViolationsBtn')?.addEventListener('click', () => renderViolations());
    renderViolationsTable(violations, teacherMap);
}

export function renderViolationsTable(violations, teacherMap) {
    const tbody = document.getElementById('violationsTableBody');
    if (!tbody) return;
    if (violations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-8">لا توجد مخالفات مسجلة</td></tr>';
        return;
    }
    tbody.innerHTML = violations.map(v => {
        const isDeviceViolation = v.type === 'multiple_devices';
        const teacherCode = v.teacherId;
        const teacherName = teacherMap[teacherCode] || v.teacherName || teacherCode;
        const statusBadge = v.resolved
            ? '<span class="text-green-400">✓ محلولة</span>'
            : '<span class="text-red-400 animate-pulse">⚠️ قيد المراجعة</span>';
        const deviceShort = v.deviceFingerprint ? v.deviceFingerprint.substring(0, 12) + '...' : '-';
        const ipDisplay = v.ip || '-';
        let actionsHtml = '';
        if (!v.resolved && isDeviceViolation) {
            actionsHtml = `
                <div class="flex flex-wrap gap-1">
                    ${hasPermission('violations', 'unsuspend') ? `<button class="unsuspend-teacher-btn bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-xs transition" data-code="${teacherCode}" data-violation-id="${v.id}">🔓 رفع التعليق</button>` : ''}
                    ${hasPermission('violations', 'resolve') ? `<button class="allow-device-btn bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs transition" data-code="${teacherCode}" data-violation-id="${v.id}" data-device="${v.deviceFingerprint || ''}" data-ip="${v.ip || ''}">📱 السماح بالجهاز الجديد</button>` : ''}
                    ${hasPermission('violations', 'resolve') ? `<button class="add-note-btn bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded text-xs transition" data-violation-id="${v.id}">📝 إضافة ملاحظة</button>` : ''}
                    ${hasPermission('violations', 'resolve') ? `<button class="resolve-violation-btn bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-xs transition" data-violation-id="${v.id}">✓ حل</button>` : ''}
                </div>
            `;
        } else if (!v.resolved) {
            actionsHtml = `
                <div class="flex flex-wrap gap-1">
                    ${hasPermission('violations', 'resolve') ? `<button class="add-note-btn bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded text-xs transition" data-violation-id="${v.id}">📝 إضافة ملاحظة</button>` : ''}
                    ${hasPermission('violations', 'resolve') ? `<button class="resolve-violation-btn bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-xs transition" data-violation-id="${v.id}">✓ حل</button>` : ''}
                </div>
            `;
        } else {
            actionsHtml = '<span class="text-gray-500 text-xs">تم الحل</span>';
        }
        const notesHtml = v.notes ? `
            <tr class="violation-notes-row bg-white/5">
                <td colspan="6" class="text-sm text-gray-400 p-3 border-t border-white/10">
                    <i class="fas fa-sticky-note text-yellow-400 ml-1"></i> ملاحظات: ${escapeHtml(v.notes)}
                </td>
              </tr>
        ` : '';
        return `
            <tr data-violation-id="${v.id}" class="violation-main-row hover:bg-white/5 transition">
                <td>
                    <span class="teacher-link text-blue-400 cursor-pointer hover:underline" data-code="${teacherCode}">${escapeHtml(teacherName)}</span>
                    ${isDeviceViolation ? `<div class="text-[10px] text-gray-500 mt-1">📱 ${deviceShort} | IP: ${ipDisplay}</div>` : ''}
                  </td>
                <td>${isDeviceViolation ? '<i class="fas fa-laptop-code ml-1"></i> جهاز جديد' : escapeHtml(v.type)}</td>
                <td>${escapeHtml(v.details)}</td>
                <td class="whitespace-nowrap text-sm">${new Date(v.timestamp?.toMillis ? v.timestamp.toMillis() : v.timestamp).toLocaleString()}</td>
                <td>${statusBadge}</td>
                <td>${actionsHtml}</td>
              </tr>
            ${notesHtml}
        `;
    }).join('');
    
    // ربط الأحداث
    document.querySelectorAll('.teacher-link').forEach(link => {
        link.removeEventListener('click', window._teacherLinkHandler);
        window._teacherLinkHandler = () => showTeacherCard(link.dataset.code);
        link.addEventListener('click', window._teacherLinkHandler);
    });
    
    if (hasPermission('violations', 'unsuspend')) {
        document.querySelectorAll('.unsuspend-teacher-btn').forEach(btn => {
            btn.removeEventListener('click', window._unsuspendHandler);
            window._unsuspendHandler = async () => {
                const teacherCode = btn.dataset.code;
                const violationId = btn.dataset.violationId;
                await unsuspendTeacherHandler(teacherCode, violationId);
            };
            btn.addEventListener('click', window._unsuspendHandler);
        });
    }
    
    if (hasPermission('violations', 'resolve')) {
        document.querySelectorAll('.allow-device-btn').forEach(btn => {
            btn.removeEventListener('click', window._allowDeviceHandler);
            window._allowDeviceHandler = async () => {
                const teacherCode = btn.dataset.code;
                const violationId = btn.dataset.violationId;
                const device = btn.dataset.device;
                const ip = btn.dataset.ip;
                await allowNewDeviceHandler(teacherCode, violationId, device, ip);
            };
            btn.addEventListener('click', window._allowDeviceHandler);
        });
        
        document.querySelectorAll('.add-note-btn').forEach(btn => {
            btn.removeEventListener('click', window._addNoteHandler);
            window._addNoteHandler = async () => {
                const violationId = btn.dataset.violationId;
                await addNoteToViolationHandler(violationId);
            };
            btn.addEventListener('click', window._addNoteHandler);
        });
        
        document.querySelectorAll('.resolve-violation-btn').forEach(btn => {
            btn.removeEventListener('click', window._resolveHandler);
            window._resolveHandler = async () => {
                const violationId = btn.dataset.violationId;
                await resolveViolationHandler(violationId);
            };
            btn.addEventListener('click', window._resolveHandler);
        });
    }
}

// ========== دوال المعالجة (كلها محمية بصلاحيات) ==========

async function unsuspendTeacherHandler(teacherCode, violationId) {
    if (!hasPermission('violations', 'unsuspend')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لرفع التعليق', 'error');
        return;
    }
    const result = await Swal.fire({
        title: 'رفع التعليق عن المعلم',
        text: 'هل أنت متأكد؟ سيتم تنشيط الحساب وسيظل الجهاز المسجل كما هو.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم، ارفع التعليق',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff'
    });
    if (!result.isConfirmed) return;
    
    try {
        const teacherDoc = await getTeacherDocumentByCode(teacherCode);
        if (!teacherDoc) throw new Error('المعلم غير موجود');
        await updateDoc(teacherDoc.ref, { status: 'active' });
        
        const violationRef = doc(db, 'violations', violationId);
        await updateDoc(violationRef, { resolved: true, resolvedAt: serverTimestamp() });
        
        await addAuditLog('رفع تعليق عن معلم', teacherCode);
        Swal.fire('تم', 'تم رفع التعليق وحل المخالفة', 'success');
        await renderViolations();
    } catch (err) {
        console.error(err);
        Swal.fire('خطأ', 'فشل رفع التعليق: ' + err.message, 'error');
    }
}

async function allowNewDeviceHandler(teacherCode, violationId, deviceFingerprint, ip) {
    if (!hasPermission('violations', 'resolve')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية للسماح بجهاز جديد', 'error');
        return;
    }
    const result = await Swal.fire({
        title: 'السماح بالجهاز الجديد',
        html: `<div class="text-right">
            <p>سيتم تسجيل الجهاز التالي كجهاز معتمد للمعلم:</p>
            <p class="text-xs text-gray-400 bg-black/30 p-2 rounded-lg mt-2">
                📱 بصمة: <span class="font-mono">${deviceFingerprint?.substring(0, 24) || 'غير معروف'}...</span><br>
                🌐 IP: ${ip || 'غير معروف'}
            </p>
            <p class="text-yellow-400 mt-3">⚠️ سيتم رفع التعليق عن الحساب وسيتمكن المعلم من الدخول من هذا الجهاز فقط.</p>
            <p class="text-red-400 text-xs mt-2">الجهاز القديم لن يعمل بعد الآن.</p>
        </div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، السماح بهذا الجهاز',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff'
    });
    if (!result.isConfirmed) return;
    
    try {
        const teacherDoc = await getTeacherDocumentByCode(teacherCode);
        if (!teacherDoc) throw new Error('المعلم غير موجود');
        await updateDoc(teacherDoc.ref, {
            registeredDevice: deviceFingerprint,
            registeredIP: ip,
            status: 'active',
            lastDeviceSeen: new Date().toISOString()
        });
        
        const violationRef = doc(db, 'violations', violationId);
        await updateDoc(violationRef, { resolved: true, resolvedAt: serverTimestamp() });
        
        await addAuditLog('السماح بجهاز جديد للمعلم', `${teacherCode} - بصمة: ${deviceFingerprint}`);
        Swal.fire('تم', 'تم السماح بالجهاز الجديد ورفع التعليق', 'success');
        await renderViolations();
    } catch (err) {
        console.error(err);
        Swal.fire('خطأ', 'فشل السماح بالجهاز: ' + err.message, 'error');
    }
}

async function addNoteToViolationHandler(violationId) {
    if (!hasPermission('violations', 'resolve')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لإضافة ملاحظة', 'error');
        return;
    }
    const { value: note } = await Swal.fire({
        title: 'إضافة ملاحظة على المخالفة',
        input: 'textarea',
        inputPlaceholder: 'اكتب ملاحظتك هنا (سيظهر في سجل المخالفة)...',
        inputAttributes: { maxlength: 500 },
        showCancelButton: true,
        confirmButtonText: 'إضافة',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff',
        preConfirm: (text) => {
            if (!text || text.trim() === '') {
                Swal.showValidationMessage('الرجاء إدخال نص الملاحظة');
                return false;
            }
            return text.trim();
        }
    });
    if (!note) return;
    
    try {
        const violationRef = doc(db, 'violations', violationId);
        const violationSnap = await getDoc(violationRef);
        if (!violationSnap.exists()) {
            Swal.fire('خطأ', 'المخالفة غير موجودة', 'error');
            return;
        }
        const currentNotes = violationSnap.data().notes || '';
        const timestamp = new Date().toLocaleString('ar-EG');
        const newNotes = currentNotes + (currentNotes ? '\n' : '') + `[${timestamp}] ${note}`;
        await updateDoc(violationRef, { notes: newNotes });
        await addAuditLog('إضافة ملاحظة مخالفة', `للمعلم ${violationSnap.data().teacherId}`);
        Swal.fire('تمت الإضافة', '', 'success');
        showNotification(`📝 تمت إضافة ملاحظة على المخالفة`, 'info');
        await renderViolations();
    } catch (err) {
        console.error(err);
        Swal.fire('خطأ', 'فشل إضافة الملاحظة: ' + err.message, 'error');
    }
}

async function resolveViolationHandler(violationId) {
    if (!hasPermission('violations', 'resolve')) {
        Swal.fire('غير مصرح', 'ليس لديك صلاحية لحل المخالفة', 'error');
        return;
    }
    const result = await Swal.fire({
        title: 'حل المخالفة',
        text: 'هل أنت متأكد من أن هذه المخالفة قد تمت معالجتها؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم، حل',
        cancelButtonText: 'إلغاء',
        background: '#0f172a', color: '#fff'
    });
    if (!result.isConfirmed) return;
    
    try {
        const violationRef = doc(db, 'violations', violationId);
        await updateDoc(violationRef, { resolved: true, resolvedAt: serverTimestamp() });
        await addAuditLog('حل مخالفة', violationId);
        Swal.fire('تم', 'تم حل المخالفة', 'success');
        await renderViolations();
    } catch (err) {
        console.error(err);
        Swal.fire('خطأ', 'فشل حل المخالفة: ' + err.message, 'error');
    }
}