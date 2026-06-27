// src/stats/components/TableBuilder.js
// بناء الجداول الديناميكية مع خيارات الفرز والترقيم

import { escapeHtml } from '../../utils.js';

export class TableBuilder {
  /**
   * إنشاء جدول من البيانات
   * @param {Object} options
   * @param {Array} options.columns - [{ key, label, sortable, formatter }]
   * @param {Array} options.data - مصفوفة من الكائنات
   * @param {string} options.tableClass - كلاس إضافي للجدول
   * @param {number} options.pageSize - عدد الصفوف في الصفحة (0 لإلغاء الترقيم)
   * @returns {HTMLElement}
   */
  static create({ columns, data, tableClass = '', pageSize = 0 }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper overflow-x-auto';
    
    const table = document.createElement('table');
    table.className = `w-full text-right border-collapse ${tableClass}`;
    
    // الرأس
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.className = 'border-b border-yellow-500/30';
    columns.forEach(col => {
      const th = document.createElement('th');
      th.className = 'p-3 text-yellow-400 font-bold';
      th.textContent = col.label;
      if (col.sortable) {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => this.sortTable(data, col.key, th));
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // الجسم
    const tbody = document.createElement('tbody');
    tbody.id = `table-body-${Date.now()}`;
    table.appendChild(tbody);
    wrapper.appendChild(table);
    
    // تخزين البيانات والعمود لاستخدامها في الترقيم
    wrapper._tableData = data;
    wrapper._tableColumns = columns;
    wrapper._pageSize = pageSize;
    wrapper._currentPage = 1;
    
    this.renderPage(wrapper, 1);
    
    if (pageSize > 0) {
      const pagination = this.createPagination(wrapper);
      wrapper.appendChild(pagination);
    }
    
    return wrapper;
  }
  
  static renderPage(wrapper, page) {
    const data = wrapper._tableData;
    const columns = wrapper._tableColumns;
    const pageSize = wrapper._pageSize;
    const tbody = wrapper.querySelector('tbody');
    if (!tbody) return;
    
    let start = 0, end = data.length;
    if (pageSize > 0) {
      start = (page - 1) * pageSize;
      end = Math.min(start + pageSize, data.length);
      wrapper._currentPage = page;
    }
    
    const pageData = data.slice(start, end);
    tbody.innerHTML = pageData.map(row => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-white/10 hover:bg-white/5 transition';
      columns.forEach(col => {
        const td = document.createElement('td');
        td.className = 'p-3 text-gray-200';
        let value = row[col.key];
        if (col.formatter) value = col.formatter(value, row);
        else if (typeof value === 'number') value = value.toLocaleString();
        else value = escapeHtml(String(value || ''));
        td.innerHTML = value;
        tr.appendChild(td);
      });
      return tr;
    }).join('');
  }
  
  static createPagination(wrapper) {
    const totalPages = Math.ceil(wrapper._tableData.length / wrapper._pageSize);
    const container = document.createElement('div');
    container.className = 'flex justify-center gap-2 mt-4';
    
    const update = (page) => {
      this.renderPage(wrapper, page);
      this.updatePaginationButtons(container, page, totalPages);
    };
    
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.className = `px-3 py-1 rounded-full transition ${i === wrapper._currentPage ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-white/20'}`;
      btn.addEventListener('click', () => update(i));
      container.appendChild(btn);
    }
    
    wrapper._paginationContainer = container;
    return container;
  }
  
  static updatePaginationButtons(container, currentPage, totalPages) {
    const btns = container.querySelectorAll('button');
    btns.forEach((btn, idx) => {
      const page = idx + 1;
      if (page === currentPage) {
        btn.className = 'px-3 py-1 rounded-full bg-yellow-500 text-black';
      } else {
        btn.className = 'px-3 py-1 rounded-full bg-white/10 hover:bg-white/20';
      }
    });
  }
  
  static sortTable(data, key, thElement) {
    const direction = thElement.dataset.sort === 'asc' ? 'desc' : 'asc';
    thElement.dataset.sort = direction;
    data.sort((a, b) => {
      let valA = a[key], valB = b[key];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    // إعادة عرض الصفحة الحالية
    const wrapper = thElement.closest('.table-wrapper');
    if (wrapper) this.renderPage(wrapper, wrapper._currentPage || 1);
  }
}