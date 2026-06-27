// src/stats/tabs/BaseTab.js
// كلاس أساسي لجميع تبويبات الإحصائيات

export class BaseTab {
  /**
   * @param {Object} manager - إشارة إلى StatsManager
   * @param {Object} config - إعدادات التبويب (icon, name, id)
   */
  constructor(manager, config = {}) {
    this.manager = manager;
    this.config = config;
    this.container = null;
    this.isActive = false;
  }

  /**
   * يتم استدعاؤها عند تنشيط التبويب
   * @param {HTMLElement} container - العنصر الذي سيتم عرض المحتوى فيه
   */
  async activate(container) {
    this.container = container;
    this.isActive = true;
    await this.render();
    this.initEvents();
  }

  /**
   * يتم استدعاؤها عند إلغاء تنشيط التبويب (لتنظيف المؤقتات، إلخ)
   */
  deactivate() {
    this.isActive = false;
    // يمكن إعادة تعريفها في التبويبات الفرعية لتنظيف الفواصل الزمنية
  }

  /**
   * دالة عرض المحتوى – يجب إعادة تعريفها في كل تبويب
   */
  async render() {
    throw new Error('يجب تنفيذ render() في التبويب الموروث');
  }

  /**
   * دالة تهيئة الأحداث – يمكن إعادة تعريفها في التبويب الفرعي
   */
  initEvents() {}

  /**
   * تحديث البيانات وإعادة العرض (اختياري)
   */
  async refresh() {
    if (this.isActive) {
      await this.render();
    }
  }

  /**
   * الحصول على البيانات من المدير (مع تحديث إذا لزم الأمر)
   */
  async getData() {
    return await this.manager.getData();
  }

  /**
   * عرض رسالة خطأ في حالة فشل تحميل البيانات
   */
  showError(message) {
    if (this.container) {
      this.container.innerHTML = `
        <div class="glass-panel p-8 text-center">
          <div class="text-red-400 text-xl mb-2">⚠️ خطأ</div>
          <p class="text-gray-400">${message}</p>
          <button class="action-btn mt-4" onclick="location.reload()">إعادة المحاولة</button>
        </div>
      `;
    }
  }

  /**
   * عرض رسالة "لا توجد بيانات"
   */
  showEmpty(message = 'لا توجد بيانات كافية لعرضها') {
    if (this.container) {
      this.container.innerHTML = `
        <div class="glass-panel p-8 text-center">
          <div class="text-gray-400 text-xl mb-2">📭</div>
          <p class="text-gray-500">${message}</p>
        </div>
      `;
    }
  }
}