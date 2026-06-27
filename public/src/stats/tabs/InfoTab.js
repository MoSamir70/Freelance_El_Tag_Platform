// src/stats/tabs/InfoTab.js
// تبويب معلومات المعلم والاشتراك
// ✅ تم تعديله لدعم الخطط: مجاني، فضي، ذهبي، مطور
// ✅ تم إزالة أي ذكر لـ "platinum" أو "ماسي" نهائياً

import { BaseTab } from './BaseTab.js';

export class InfoTab extends BaseTab {
  async render() {
    const teacherName = sessionStorage.getItem('peak_teacher_name') || 'معلم';
    const teacherCode = sessionStorage.getItem('peak_teacher_code') || 'غير محدد';
    let plan = sessionStorage.getItem('teacher_plan') || 'free';
    
    // ✅ توافق مع القديم: تحويل أي خطة "platinum" إلى "gold"
    if (plan === 'platinum') plan = 'gold';
    
    let planText = '', badgeClass = '', planColor = '', planIcon = '';
    let limitsHtml = '';
    
    switch (plan) {
      case 'free':
        planText = 'مجانية';
        badgeClass = 'badge-free';
        planColor = '#94a3b8';
        planIcon = '🔓';
        limitsHtml = `
          <div class="mt-3 text-sm text-gray-400">
            <div>❌ غير مسموح بإنشاء غرف أونلاين</div>
            <div>📚 مادة واحدة فقط</div>
            <div>📊 حد أقصى 150 سؤالاً</div>
          </div>
        `;
        break;
      case 'silver':
        planText = 'فضية';
        badgeClass = 'badge-silver';
        planColor = '#c0c0c0';
        planIcon = '🥈';
        const roomsRemainingSilver = Math.max(0, 10 - (parseInt(sessionStorage.getItem('teacher_online_rooms_used') || '0')));
        limitsHtml = `
          <div class="mt-3 text-sm text-gray-300">
            <div>📡 الغرف المتبقية هذا الشهر: <span class="text-yellow-400 font-bold">${roomsRemainingSilver}/10</span></div>
            <div>🔒 مقفلة على مادة واحدة (لا يمكن تغييرها)</div>
            <div>📊 حد أقصى 1000 سؤال إجمالي</div>
            <div class="text-xs text-gray-500 mt-1">✨ يمكنك إنشاء غرف أونلاين ومشاهدة الغرف</div>
          </div>
        `;
        break;
      case 'gold':
        planText = 'ذهبية';
        badgeClass = 'badge-gold';
        planColor = '#fbbf24';
        planIcon = '👑';
        limitsHtml = `
          <div class="mt-3 text-sm text-gray-300">
            <div>♾️ جميع الميزات غير محدودة</div>
            <div>📚 يمكن تغيير المادة مرتين شهرياً</div>
            <div>📊 أسئلة غير محدودة</div>
            <div>👁️ يمكن مشاهدة السباقات الجارية</div>
            <div>💬 دردشة عامة مع المعلمين</div>
          </div>
        `;
        break;
      case 'developer':
        planText = 'مطور (صلاحية كاملة)';
        badgeClass = 'badge-developer';
        planColor = '#c084fc';
        planIcon = '⚡';
        limitsHtml = `
          <div class="mt-3 text-sm text-gray-300">
            <div>⭐ صلاحية مطلقة على المنصة</div>
            <div>♾️ بدون أي قيود أو حدود</div>
            <div>🛠️ يمكنه إدارة جميع المعلمين والطلاب</div>
            <div>🔓 فتح جميع الميزات دون استثناء</div>
          </div>
        `;
        break;
      default:
        planText = 'ذهبية';
        badgeClass = 'badge-gold';
        planColor = '#fbbf24';
        planIcon = '👑';
        limitsHtml = `<div class="mt-3 text-sm text-gray-400">جميع الميزات متاحة</div>`;
    }
    
    // حساب عدد الغرف المستخدمة للفضي (إن وجد)
    let roomsUsedHtml = '';
    if (plan === 'silver') {
      const used = parseInt(sessionStorage.getItem('teacher_online_rooms_used') || '0');
      roomsUsedHtml = `<div class="mt-2 text-xs text-gray-400">✅ تم استخدام ${used}/10 غرفة هذا الشهر</div>`;
    }
    
    this.container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-yellow-400">ℹ️ حسابي والباقة</h2>
        <button id="refresh-info-btn" class="action-btn"><i class="fas fa-sync-alt"></i> تحديث</button>
      </div>
      <div class="subscription-premium-card glass-panel" style="max-width: 700px; margin: 0 auto; padding: 0; overflow: hidden;">
        <div style="background: linear-gradient(135deg, ${planColor}, ${plan === 'free' ? '#64748b' : (plan === 'silver' ? '#94a3b8' : (plan === 'developer' ? '#a855f7' : '#d97706'))}); padding: 35px 30px; text-align center;">
          <div style="width: 100px; height: 100px; background: rgba(0,0,0,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 3rem; margin: 0 auto 15px auto;">
            ${planIcon}
          </div>
          <h2 style="color: #1e293b; font-weight: 900; margin-bottom: 5px; font-size: 1.8rem;">أ. ${teacherName}</h2>
          <div style="display: inline-block; background: rgba(0,0,0,0.4); color: #fef9c3; padding: 6px 16px; border-radius: 30px; font-family: monospace;">
            <i class="fa-solid fa-hashtag"></i> ${teacherCode}
          </div>
        </div>
        <div style="padding: 30px;">
          <div style="background: linear-gradient(145deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03)); padding: 24px; border-radius: 24px; border: 1px solid rgba(245,158,11,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h4 style="color: #fbbf24; font-weight: 800; font-size: 1.3rem;"><i class="fa-solid fa-gem" style="margin-left: 10px;"></i> حالة اشتراك المنصة</h4>
              <span class="info-badge ${badgeClass}" style="background: ${planColor}20; color: ${planColor}; padding: 6px 18px; border-radius: 40px;">${planText}</span>
            </div>
            ${limitsHtml}
            ${roomsUsedHtml}
            ${plan === 'free' ? '<div class="mt-4 text-center"><a href="index.html#pricing" class="text-yellow-400 underline text-sm">✨ ترقية اشتراكك الآن</a></div>' : ''}
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 24px; border-radius: 24px; margin-top: 24px;">
            <strong style="font-size:1.2rem; display:flex; align-items:center; gap:10px; margin-bottom:20px;"><i class="fa-solid fa-headset"></i> الدعم الفني</strong>
            <div class="social-btn-container" style="display: flex; gap: 16px; justify-content: center;">
              <a href="https://wa.me/201126081946" target="_blank" class="social-link-btn whatsapp" style="background: rgba(37,211,102,0.1); padding: 10px 20px; border-radius: 40px; color: #25d366; text-decoration: none;">
                <i class="fa-brands fa-whatsapp"></i> واتساب المطور
              </a>
              <a href="https://www.facebook.com/ahm.mohamed98" target="_blank" class="social-link-btn facebook" style="background: rgba(24,119,242,0.1); padding: 10px 20px; border-radius: 40px; color: #1877f2; text-decoration: none;">
                <i class="fa-brands fa-facebook-f"></i> فيسبوك
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('refresh-info-btn').addEventListener('click', async () => {
      await this.manager.refreshData();
      await this.render();
    });
  }
}