// src/stats/components/ChartRenderer.js
// واجهة موحدة لرسم المخططات باستخدام ECharts

export class ChartRenderer {
  static charts = {};

  /**
   * تهيئة المخطط (إنشاء جديد أو إعادة استخدام)
   * @param {string} elementId
   * @returns {ECharts}
   */
  static initChart(elementId) {
    const existing = this.charts[elementId];
    if (existing && !existing.isDisposed()) return existing;
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`Element #${elementId} not found`);
    if (typeof echarts === 'undefined') throw new Error('ECharts not loaded');
    const chart = echarts.init(element);
    this.charts[elementId] = chart;
    return chart;
  }

  /**
   * رسم مخطط خطي
   * @param {string} elementId
   * @param {Array} labels
   * @param {Array} data
   * @param {string} yName
   * @returns {ECharts}
   */
  static line(elementId, labels, data, yName = 'القيم') {
    const chart = this.initChart(elementId);
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 30, left: 50, right: 20, bottom: 30 },
      xAxis: { type: 'category', data: labels, axisLabel: { rotate: 30, color: '#cbd5e1' } },
      yAxis: { type: 'value', name: yName, axisLabel: { color: '#cbd5e1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
      series: [{ type: 'line', data, smooth: true, lineStyle: { color: '#facc15', width: 3 }, areaStyle: { opacity: 0.1, color: '#facc15' }, symbol: 'circle', symbolSize: 6 }]
    });
    return chart;
  }

  /**
   * تحديث مخطط خطي (دون إعادة إنشائه)
   */
  static updateLine(elementId, labels, data) {
    const chart = this.charts[elementId];
    if (chart && !chart.isDisposed()) {
      chart.setOption({ xAxis: { data: labels }, series: [{ data }] });
    } else {
      this.line(elementId, labels, data);
    }
  }

  /**
   * رسم مخطط دائري
   * @param {string} elementId
   * @param {Array} labels
   * @param {Array} data
   * @returns {ECharts}
   */
  static pie(elementId, labels, data) {
    const chart = this.initChart(elementId);
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', left: 'left', textStyle: { color: '#cbd5e1' } },
      series: [{
        type: 'pie',
        radius: '55%',
        data: labels.map((l, i) => ({ name: l, value: data[i] })),
        label: { show: true, formatter: '{b}: {d}%', color: '#fff' },
        itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 2 }
      }]
    });
    return chart;
  }

  /**
   * رسم مخطط شريطي (عمودي)
   * @param {string} elementId
   * @param {Array} labels
   * @param {Array} data
   * @returns {ECharts}
   */
  static bar(elementId, labels, data) {
    const chart = this.initChart(elementId);
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 30, left: 50, right: 20, bottom: 50 },
      xAxis: { type: 'category', data: labels, axisLabel: { rotate: 30, color: '#cbd5e1' } },
      yAxis: { type: 'value', axisLabel: { color: '#cbd5e1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
      series: [{ type: 'bar', data, itemStyle: { borderRadius: [4,4,0,0], color: '#facc15' } }]
    });
    return chart;
  }

  /**
   * تدمير مخطط معين
   * @param {string} elementId
   */
  static dispose(elementId) {
    const chart = this.charts[elementId];
    if (chart && !chart.isDisposed()) {
      chart.dispose();
      delete this.charts[elementId];
    }
  }

  /**
   * تدمير جميع المخططات
   */
  static disposeAll() {
    Object.keys(this.charts).forEach(id => this.dispose(id));
  }
}