// src/admin/modern/audit.js
// سجل التعديلات والإجراءات – مع دعم صلاحيات المساعدين

import { db, collection, getDocs, query, orderBy, limit, writeBatch, deleteDoc } from '../../firebase/init.js';
import { escapeHtml, showNotification, addAuditLog, hasPermission, applyUIPermissions } from './utils.js';

export async function renderAuditLog() {
    if (!hasPermission('audit', 'view')) {
        document.getElementById('auditPane').innerHTML = `
            <div class="glass-card p-5 text-center">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <h3 class="text-xl font-bold text-red-400">غير مصرح</h3>
                <p class="text-gray-400">ليس لديك صلاحية لعرض سجل التعديلات.</p>
            </div>`;
        return;
    }
    const logsSnapshot = await getDocs(query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'), limit(200)));
    const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const html = `
        <div class="glass-card p-5">
            <h3 class="text-2xl font-bold text-yellow-400 mb-4"><i class="fas fa-history ml-2"></i> سجل التعديلات والإجراءات</h3>
            <div class="overflow-x-auto">
                <table class="admin-table">
                    <thead><tr><th>التاريخ</th><th>الإجراء</th><th>التفاصيل</th><th>المنفذ</th></tr></thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr>
                                <td class="whitespace-nowrap">${new Date(log.timestamp?.toMillis ? log.timestamp.toMillis() : log.timestamp).toLocaleString()}</td>
                                <td><span class="badge-gold">${escapeHtml(log.action)}</span></td>
                                <td>${escapeHtml(log.details)}</td>
                                <td>${escapeHtml(log.admin)}</td>
                            </tr>
                        `).join('')}
                        ${logs.length === 0 ? '<tr><td colspan="4" class="text-center">لا توجد سجلات</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
            ${hasPermission('audit', 'delete') ? `
            <div class="flex justify-end mt-4">
                <button id="clearAuditLogBtn" class="bg-red-600 px-4 py-2 rounded-full text-sm" data-perm="audit.delete"><i class="fas fa-trash"></i> مسح السجل</button>
            </div>` : ''}
        </div>
    `;
    document.getElementById('auditPane').innerHTML = html;
    applyUIPermissions();
    if (hasPermission('audit', 'delete')) {
        document.getElementById('clearAuditLogBtn')?.addEventListener('click', async () => {
            const res = await Swal.fire({
                title: '⚠️ تأكيد مسح السجل',
                text: 'سيتم حذف سجل التعديلات بالكامل',
                icon: 'warning',
                showCancelButton: true,
                background: '#0f172a',
                color: '#fff'
            });
            if (res.isConfirmed) {
                const snapshot = await getDocs(collection(db, 'auditLog'));
                const batch = writeBatch(db);
                snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
                await batch.commit();
                await renderAuditLog();
                Swal.fire('تم المسح', '', 'success');
                showNotification('🗑️ تم مسح سجل التعديلات بالكامل', 'warning');
            }
        });
    }
}