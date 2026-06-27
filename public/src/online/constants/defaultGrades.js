// src/online/constants/defaultGrades.js
// إعادة تصدير الصفوف الافتراضية من الملف الأصلي للمنصة
// عشان نحافظ على مصدر واحد للحقيقة

import { DEFAULT_GRADES as ORIGINAL_GRADES } from '../../constants.js';

// إعادة تصدير نفس القيمة
export const DEFAULT_GRADES = ORIGINAL_GRADES;

/**
 * الحصول على قائمة الصفوف المتاحة (قد نوسعها لاحقاً لتشمل الصفوف المضافة)
 * حالياً نرجع الافتراضية، لكن بعدين هنستدعي dataService.getAllGrades()
 * @returns {Promise<string[]>}
 */
export async function getAvailableGrades() {
  // TODO: في المرحلة القادمة هنستبدل ده بـ dataService.getAllGrades()
  return DEFAULT_GRADES;
}