// teacherListeners.js - الاستماع الحي لتحديثات المعلم
import { db, collection, query, where, onSnapshot } from '../../firebase/init.js';
import { invalidateTeacherSubscriptionCache } from './subscription.js';

let teacherDataUnsubscribe = null;

export function subscribeToTeacherData(teacherCode) {
    if (teacherDataUnsubscribe) {
        teacherDataUnsubscribe();
        teacherDataUnsubscribe = null;
    }
    
    const q = query(collection(db, 'teachers'), where('code', '==', teacherCode));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) return;
        const teacherData = snapshot.docs[0].data();
        
        sessionStorage.setItem('teacher_plan', teacherData.plan || 'free');
        sessionStorage.setItem('teacher_locked_subject', teacherData.lockedSubject || '');
        sessionStorage.setItem('teacher_total_questions', (teacherData.totalQuestionsCount || 0).toString());
        sessionStorage.setItem('teacher_online_rooms_used', (teacherData.onlineRoomsUsedThisMonth || 0).toString());
        
        console.log('[TeacherData] تم تحديث sessionStorage:', {
            plan: teacherData.plan,
            lockedSubject: teacherData.lockedSubject,
            totalQuestions: teacherData.totalQuestionsCount,
            onlineRoomsUsed: teacherData.onlineRoomsUsedThisMonth
        });
        
        invalidateTeacherSubscriptionCache(teacherCode);
        
        if (typeof window.updateTeacherDisplayName === 'function') window.updateTeacherDisplayName();
        if (typeof window.renderSubscriptionCard === 'function') window.renderSubscriptionCard(teacherCode);
    }, (error) => {
        console.error('[TeacherData] خطأ في الاستماع:', error);
    });
    
    teacherDataUnsubscribe = unsubscribe;
    return unsubscribe;
}

export function unsubscribeFromTeacherData() {
    if (teacherDataUnsubscribe) {
        teacherDataUnsubscribe();
        teacherDataUnsubscribe = null;
    }
}