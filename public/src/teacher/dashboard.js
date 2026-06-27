// src/teacher/dashboard.js
// دوال خاصة بواجهة المعلم – لوحة التحكم، اسم المعلم، وعرض اشتراكه
// تم تعطيل بطاقة الاشتراك لأنها تسبب تشوه في الواجهة
// ✅ تم إصلاح تكرار تعريف teacherCode وإزالة الكود المكرر

import { getTeacherSubscription, resetTeacherMonthlyCountersIfNeeded } from '../services/dataService.js';
import { showFloatingNotification } from '../utils.js';
// استيراد Firebase للوصول المباشر إلى Firestore
import { db, collection, query, where, getDocs } from '../firebase/init.js';

export function updateTeacherDisplayName() {
    const name = sessionStorage.getItem('peak_teacher_name') || 'معلم';
    const el = document.getElementById('teacher-display-name');
    if (el) el.innerText = 'أستاذ: ' + name;
}

// عرض بطاقة الاشتراك في واجهة المعلم (تم تعطيلها)
export function renderSubscriptionCard(teacherCode) {
    // تم التعطيل، لا حاجة لإعادة تعريف المتغير
    return;
}

export function refreshTeacherSubscriptionUI() {
    return;
}

// عرض معلومات الاشتراك في نافذة منبثقة (معدلة بالكامل)
export async function showSubscriptionInfo() {
    const teacherCode = sessionStorage.getItem('peak_teacher_code');
    if (!teacherCode) {
        if (typeof showFloatingNotification === 'function') {
            showFloatingNotification('يجب تسجيل الدخول كمعلم', 'error');
        }
        return;
    }

    // 1. جلب بيانات المعلم من Firestore مباشرة (للتأكد من expiryDate الصحيح)
    let teacherData = null;
    try {
        const teachersRef = collection(db, 'teachers');
        const q = query(teachersRef, where('code', '==', teacherCode));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            teacherData = querySnapshot.docs[0].data();
        }
    } catch (error) {
        console.error('خطأ في جلب بيانات المعلم:', error);
    }

    // 2. جلب بيانات الاشتراك من localStorage (للاستخدام في الخطط والقيود)
    resetTeacherMonthlyCountersIfNeeded(teacherCode);
    const sub = getTeacherSubscription(teacherCode);

    // 3. حساب تاريخ الانتهاء والمدة المتبقية
    let expiryDate = null;
    if (teacherData && teacherData.expiryDate) {
        expiryDate = new Date(teacherData.expiryDate);
    } else if (sub.expiryDate) {
        expiryDate = new Date(sub.expiryDate);
    }

    let expiryText = 'غير محدد';
    let remainingDays = 'غير محدد';
    if (expiryDate && !isNaN(expiryDate.getTime())) {
        expiryText = expiryDate.toLocaleDateString('ar-EG');
        const now = new Date();
        const diffTime = expiryDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
            remainingDays = `${diffDays} يوم`;
        } else if (diffDays === 0) {
            remainingDays = 'ينتهي اليوم';
        } else {
            remainingDays = 'منتهي';
        }
    } else {
        remainingDays = 'غير محدد (لا يوجد تاريخ انتهاء)';
    }

    // 4. تحديد لون ونص الخطة بناءً على sub.plan
    let planText = '';
    let planColor = '';
    let limitsHtml = '';

    switch (sub.plan) {
        case 'free':
            planText = 'مجاني';
            planColor = '#94a3b8';
            limitsHtml = `
                <div style="margin-top: 12px; font-size: 0.9rem;">❌ غير مسموح بإنشاء غرف أونلاين</div>
                <div style="font-size: 0.9rem;">📚 مادة واحدة (${sub.allowedSubject || 'لم تحدد'})</div>
                <div style="font-size: 0.9rem;">📊 عدد الأسئلة: ${sub.totalQuestionsCount || 0}/150</div>
            `;
            break;
        case 'silver':
            planText = 'فضي';
            planColor = '#c0c0c0';
            const remainingRoomsSilver = Math.max(0, 10 - (sub.onlineRoomsUsedThisMonth || 0));
            limitsHtml = `
                <div style="margin-top: 12px; font-size: 0.9rem;">📡 الغرف المتبقية: ${remainingRoomsSilver}/10</div>
                <div style="font-size: 0.9rem;">🔒 مادة مقفلة: ${sub.lockedSubject || 'لم تحدد'} (لا يمكن تغييرها)</div>
                <div style="font-size: 0.9rem;">📊 عدد الأسئلة: ${sub.totalQuestionsCount || 0}/1000</div>
            `;
            break;
        case 'gold':
            planText = 'ذهبي';
            planColor = '#facc15';
            limitsHtml = `<div style="margin-top: 12px; font-size: 0.9rem;">♾️ جميع الميزات غير محدودة (ذهبية)</div>`;
            break;
        case 'developer':
            planText = 'مطور (صلاحية كاملة)';
            planColor = '#c084fc';
            limitsHtml = `<div style="margin-top: 12px; font-size: 0.9rem;">⚡ صلاحية مطلقة على المنصة، بدون أي قيود</div>`;
            break;
        default:
            planText = 'غير محدد';
            planColor = '#64748b';
            limitsHtml = `<div style="margin-top: 12px; font-size: 0.9rem;">⚠️ لم يتم تحديد خطة</div>`;
            break;
    }

    // 5. عرض النافذة المنبثقة
    Swal.fire({
        title: '📌 بيانات اشتراكي',
        html: `
            <div style="text-align: right;">
                <div style="font-size: 1.2rem; color: ${planColor};">📋 الخطة: ${planText}</div>
                <div style="margin-top: 8px;">📅 تاريخ الانتهاء: ${expiryText}</div>
                <div>⏳ المدة المتبقية: ${remainingDays}</div>
                ${limitsHtml}
                <hr style="margin: 16px 0; border-color: rgba(250,204,21,0.3);">
                <div style="display: flex; justify-content: center; gap: 16px;">
                    <a href="https://wa.me/201126081946" target="_blank" style="color: #25D366; text-decoration: none;">📞 واتساب</a>
                    <a href="https://www.facebook.com/ahm.mohamed98" target="_blank" style="color: #1877F2; text-decoration: none;">💬 فيسبوك</a>
                </div>
                <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 12px;">للترقية، تواصل مع الدعم الفني</div>
            </div>
        `,
        icon: 'info',
        confirmButtonText: 'حسناً',
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#facc15'
    });
}