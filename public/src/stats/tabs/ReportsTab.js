// src/stats/tabs/ReportsTab.js
// تبويب التقارير والتصدير (PDF، Excel)
// ✅ تم تعديل النص التحذيري ليتوافق مع الخطط: ذهبي أو مطور
// ✅ تم إزالة أي ذكر لـ "ماسية" أو "platinum" نهائياً

import { BaseTab } from './BaseTab.js';
import { StatsCalculator } from '../core/StatsCalculator.js';

export class ReportsTab extends BaseTab {
  async render() {
    const data = await this.getData();
    if (!data) {
      this.showError('فشل تحميل بيانات التقارير');
      return;
    }

    const { grades, students } = data;

    this.container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-yellow-400">📎 التقارير والتصدير</h2>
        <button id="refresh-reports-btn" class="action-btn"><i class="fas fa-sync-alt"></i> تحديث</button>
      </div>
      <div class="glass-panel p-6">
        <div class="premium-reports-grid">
          <div class="report-card" id="parent-report-btn">
            <i class="fa-solid fa-file-invoice"></i>
            <h4>تقرير ولي الأمر</h4>
            <p>تصدير تقرير أداء مفصل لطالب معين</p>
          </div>
          <div class="report-card" id="class-report-btn">
            <i class="fa-solid fa-school-flag"></i>
            <h4>تقرير الصف الكامل</h4>
            <p>تصدير تقرير شامل لجميع طلاب صف معين</p>
          </div>
          <div class="report-card" id="students-csv-btn">
            <i class="fa-solid fa-file-excel"></i>
            <h4>تصدير الطلاب (CSV)</h4>
            <p>تصدير قائمة الطلاب إلى ملف Excel</p>
          </div>
          <div class="report-card" id="questions-export-btn">
            <i class="fa-solid fa-database"></i>
            <h4>تصدير الأسئلة</h4>
            <p>تصدير بنك الأسئلة إلى ملف Excel</p>
          </div>
        </div>
        <div class="text-center text-gray-500 text-sm mt-6">
          ⚠️ تتطلب هذه الميزات الباقة الذهبية أو المطور
        </div>
      </div>
    `;

    // ربط الأحداث (سيتم ربطها بالدوال الموجودة في analytics/export.js)
    const parentBtn = document.getElementById('parent-report-btn');
    if (parentBtn) {
      parentBtn.addEventListener('click', async () => {
        const { printStudentReport } = await import('../../students/analysis.js');
        const grade = await this.selectGrade(grades);
        if (grade) {
          const studentsInGrade = students.filter(s => s.grade === grade && !s.isTeacher);
          if (studentsInGrade.length) {
            const { value: studentId } = await Swal.fire({
              title: 'اختر الطالب',
              input: 'select',
              inputOptions: Object.fromEntries(studentsInGrade.map(s => [s.id, s.name])),
              showCancelButton: true,
              customClass: { popup: 'swal-custom-popup' }
            });
            if (studentId) printStudentReport(studentId, 'all');
          }
        }
      });
    }

    const classBtn = document.getElementById('class-report-btn');
    if (classBtn) {
      classBtn.addEventListener('click', async () => {
        const { exportGradeReport } = await import('../analytics/export.js');
        const grade = await this.selectGrade(grades);
        if (grade) exportGradeReport(grade, { period: 'all' });
      });
    }

    const studentsCsvBtn = document.getElementById('students-csv-btn');
    if (studentsCsvBtn) {
      studentsCsvBtn.addEventListener('click', () => {
        this.exportStudentsToCSV(students);
      });
    }

    const questionsBtn = document.getElementById('questions-export-btn');
    if (questionsBtn) {
      questionsBtn.addEventListener('click', () => {
        if (window.exportQuestionsToExcel) window.exportQuestionsToExcel();
        else Swal.fire('تنبيه', 'هذه الميزة قيد التطوير', 'info');
      });
    }

    document.getElementById('refresh-reports-btn').addEventListener('click', async () => {
      await this.manager.refreshData();
      await this.render();
    });
  }

  async selectGrade(grades) {
    if (!grades.length) {
      Swal.fire('تنبيه', 'لا توجد صفوف', 'info');
      return null;
    }
    const { value: grade } = await Swal.fire({
      title: 'اختر الصف',
      input: 'select',
      inputOptions: Object.fromEntries(grades.map(g => [g, g])),
      showCancelButton: true,
      customClass: { popup: 'swal-custom-popup' }
    });
    return grade;
  }

  exportStudentsToCSV(students) {
    const headers = ['الاسم', 'المعرف', 'الصف', 'النقاط', 'المعلم'];
    const rows = students.map(s => [s.name, s.id, s.grade, s.score || 0, s.teacherName || '']);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'students.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Swal.fire('تم التصدير', 'تم تصدير قائمة الطلاب', 'success');
  }
}