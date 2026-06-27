// src/services/auditLog.js
import { db, collection, addDoc, serverTimestamp } from '../firebase/init.js';

export async function addAuditLog(action, details) {
    try {
        await addDoc(collection(db, 'auditLog'), {
            action,
            details,
            timestamp: serverTimestamp(),
            admin: sessionStorage.getItem('peak_teacher_code') || 'system'
        });
    } catch (e) {
        console.error('Audit log error:', e);
    }
}