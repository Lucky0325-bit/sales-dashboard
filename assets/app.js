/* ============================================================
 * 销售经营看板 · 主逻辑
 * 数据流：CSV(文本) → parseCSV → 清洗 → 筛选 → 聚合 → 渲染
 * 依赖：Chart.js(vendor/chart.umd.js)
 * ============================================================ */
(function () {
  'use strict';

  // ---------- 全局状态 ----------
  const state = {
    raw: [],            // 原始行（已类型转换）
    filtered: [],       // 筛选后的行
    filters: { region: '', channel: '', category: '' },
    grain: 'month',     // 趋势图粒度：day | week | month
    sort: { key: 'date', order: 'desc' },
    page: 0,
    pageSize: 20,
  };

  const charts = {};    // Chart 实例缓存

  const COLORS = {
    brand: '#2f5bea',
    brandLight: 'rgba(47, 91, 234, .12)',
    palette: ['#2f5bea', '#12a37a', '#f0a020', '#e2603f', '#8a63d2', '#3fa9c9'],
    ink2: '#5a6a80',
    ink3: '#94a3b8',
    line: '#e5eaf2',
  };

  // ---------- 工具函数 ----------
  const $ = (sel) => document.querySelector(sel);

  /** 数字 → 千分位 */
  function fmtNum(n) {
    return Math.round(n).toLocaleString('zh-CN');
  }

  /** 金额 → 万元 / 元 自动缩写 */
  function fmtMoney(n) {
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + ' 亿';
    if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1) + ' 万';
    return fmtNum(n);
  }

  /** 百分比 */
  function fmtPct(n) {
    return (n * 100).toFixed(1) + '%';
  }

  /** 同比/环比标签 */
  function trendHTML(cur, prev, label) {
    if (prev == null || prev === 0 || !isFinite(prev)) return '<span>&nbsp;</span>';
    const diff = (cur - prev) / prev;
    const cls = diff >= 0 ? 'trend-up' : 'trend-down';
    const arrow = diff >= 0 ? '▲' : '▼';
    return `${label} <span class="${cls}">${arrow} ${Math.abs(diff * 100).toFixed(1)}%</span>`;
  }

  /**
   * 极简 CSV 解析（本项目数据不含引号内逗号，因此按行/逗号切分即可）
   * 若后续数据含转义引号，需替换为完整 RFC4180 实现。
   */
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
    const header = lines[0].split(',').map((h) => h.trim());
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      if (cells.length !== header.length) continue; // 跳过脏行，避免污染聚合结果
      const obj = {};
      header.forEach((k, idx) => { obj[k] = cells[idx].trim(); });
      // 类型转换：数值列显式转 Number，防止后续 += 变成字符串拼接
      obj.unit_price = Number(obj.unit_price);
      obj.qty = Number(obj.qty);
      obj.amount = Number(obj.amount);
      obj.profit = Number(obj.profit);
      if (!obj.date || !isFinite(obj.amount)) continue;
      out.push(obj);
    }
    return out;
  }

  /** 日期字符串 → 周标签（ISO 周，形如 2026-W05） */
  function weekKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;          // 周一 = 0
    target.setDate(target.getDate() - dayNr + 3); // 移到本周周四
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const fDayNr = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - fDayNr + 3);
    const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
    return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  /** 按粒度取时间键 */
  function timeKey(dateStr, grain) {
    if (grain === 'month') return dateStr.slice(0, 7);
    if (grain === 'week') return weekKey(dateStr);
    return dateStr;
  }

  /** 分组求和 */
  function groupSum(rows, keyFn, valFn) {
    const map = new Map();
    rows.forEach((r) => {
      const k = keyFn(r);
      map.set(k, (map.get(k) || 0) + valFn(r));
    });
    return map;
  }

  /** 把 Map 按 key 排序输出为 {labels, values} */
  function toSeries(map) {
    const keys = [...map.keys()].sort();
    return { labels: keys, values: keys.map((k) => map.get(k)) };
  }

  // ---------- 数据加载 ----------
  function loadData() {
    // 使用 fetch 读取同目录 CSV；通过 http 服务或本地预览打开均可
    fetch('data/sales.csv', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then((text) => {
        state.raw = parseCSV(text);
        if (!state.raw.length) throw new Error('数据为空');
        initFilters();
        $('#metaText').textContent = `已加载 ${fmtNum(state.raw.length)} 条记录 · 本地 CSV`;
        applyFilters();
      })
      .catch((err) => {
        $('#metaText').textContent = '数据加载失败：' + err.message;
        console.error(err);
      });
  }

  // ---------- 筛选项初始化 ----------
  function initFilters() {
    const fill = (id, key, label) => {
      const opts = [...new Set(state.raw.map((r) => r[key]))].sort();
      const el = $(id);
      opts.forEach((v) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        el.appendChild(o);
      });
      el.addEventListener('change', () => {
        state.filters[label] = el.value;
        state.page = 0;
        applyFilters();
      });
    };
    fill('#fRegion', 'region', 'region');
    fill('#fChannel', 'channel', 'channel');
    fill('#fCategory', 'category', 'category');

    $('#btnReset').addEventListener('click', () => {
      state.filters = { region: '', channel: '', category: '' };
      $('#fRegion').value = '';
      $('#fChannel').value = '';
      $('#fCategory').value = '';
      state.page = 0;
      applyFilters();
    });
  }

  // ---------- 主流程：筛选 → 渲染 ----------
  function applyFilters() {
    const { region, channel, category } = state.filters;
    state.filtered = state.raw.filter((r) =>
      (!region || r.region === region) &&
      (!channel || r.channel === channel) &&
      (!category || r.category === category)
    );
    renderKPI();
    renderTrend();
    renderRegion();
    renderChannel();
    renderCategory();
    renderTable();
  }

  // ---------- KPI ----------
  function renderKPI() {
    const rows = state.filtered;
    const amount = rows.reduce((s, r) => s + r.amount, 0);
    const profit = rows.reduce((s, r) => s + r.profit, 0);
    const orders = rows.length;
    const margin = amount ? profit / amount : 0;

    // 环比对比：默认以"最后一个完整月份"与"其前一个完整月份"比较。
    // 若最后一个月只有零星几天数据（如 11 月 1 日），直接比较会得出虚假暴跌，
    // 因此要求该月天数 >= 10 天才作为有效对比月。
    const byMonth = groupSum(rows, (r) => r.date.slice(0, 7), (r) => r.amount);
    const dayCount = groupSum(rows, (r) => r.date.slice(0, 7), () => 1);
    const months = [...byMonth.keys()].sort()
      .filter((m) => (dayCount.get(m) || 0) >= 10);
    const last = months.length ? byMonth.get(months[months.length - 1]) : 0;
    const prev = months.length > 1 ? byMonth.get(months[months.length - 2]) : null;
    const lastLabel = months.length ? months[months.length - 1].slice(5) + ' 月' : '';

    $('#kpiAmount').textContent = '¥' + fmtMoney(amount);
    $('#kpiAmountFoot').innerHTML = months.length
      ? trendHTML(last, prev, `${lastLabel}环比`)
      : '<span>&nbsp;</span>';

    $('#kpiProfit').textContent = '¥' + fmtMoney(profit);
    $('#kpiProfitFoot').innerHTML = months.length
      ? `最近月 ¥${fmtMoney(last * margin)}`
      : '&nbsp;';

    $('#kpiMargin').textContent = fmtPct(margin);
    $('#kpiOrders').textContent = fmtNum(orders);
    $('#kpiOrdersFoot').innerHTML = months.length ? `完整月份 ${months.length} 个` : '&nbsp;';
    $('#kpiAov').textContent = orders ? '¥' + fmtNum(amount / orders) : '—';
  }

  // ---------- 趋势图 ----------
  function renderTrend() {
    const m = groupSum(state.filtered, (r) => timeKey(r.date, state.grain), (r) => r.amount);
    const { labels, values } = toSeries(m);

    // 末尾"不完整周期"会拉出视觉断崖：若最后一个桶内天数明显少于中位数，则改用虚线标示
    const dayCnt = groupSum(state.filtered, (r) => timeKey(r.date, state.grain), () => 1);
    const counts = [...dayCnt.values()].sort((a, b) => a - b);
    const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
    const tailKey = labels[labels.length - 1];
    const tailPartial = labels.length > 2 && (dayCnt.get(tailKey) || 0) < median * 0.6;

    const display = labels.map((l) => (state.grain === 'day' ? l.slice(5) : l));
    const pointRadius = labels.map((l) => (tailPartial && l === tailKey ? 4 : (state.grain === 'day' ? 0 : 3)));
    const pointStyle = labels.map((l) => (tailPartial && l === tailKey ? 'rectRot' : 'circle'));
    const segBorder = labels.map((l, i) => (tailPartial && i === labels.length - 1 ? [5, 4] : []));

    const cfg = {
      type: 'line',
      data: {
        labels: display,
        datasets: [{
          label: '销售额',
          data: values,
          borderColor: COLORS.brand,
          backgroundColor: COLORS.brandLight,
          borderWidth: 2,
          pointRadius,
          pointStyle,
          pointBackgroundColor: COLORS.brand,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.32,
          segment: { borderDash: (ctx) => (segBorder[ctx.p1DataIndex] || []) },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#16202e',
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (ctx) => '  ¥' + fmtNum(ctx.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COLORS.ink3, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: COLORS.line },
            border: { display: false },
            ticks: { color: COLORS.ink3, font: { size: 11 }, callback: (v) => fmtMoney(v) },
          },
        },
      },
    };
    upsertChart('chartTrend', cfg);
  }

  // ---------- 区域占比（环形） ----------
  function renderRegion() {
    const m = groupSum(state.filtered, (r) => r.region, (r) => r.amount);
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);

    const cfg = {
      type: 'doughnut',
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{
          data: entries.map((e) => e[1]),
          backgroundColor: COLORS.palette,
          borderColor: '#fff',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle', color: COLORS.ink2, font: { size: 11.5 }, padding: 12 },
          },
          tooltip: {
            backgroundColor: '#16202e',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const pct = total ? (ctx.parsed / total * 100).toFixed(1) : '0';
                return `  ${ctx.label}  ¥${fmtMoney(ctx.parsed)}（${pct}%）`;
              },
            },
          },
        },
      },
    };
    upsertChart('chartRegion', cfg);
  }

  // ---------- 渠道：柱状 + 毛利率折线（双轴） ----------
  function renderChannel() {
    const amtMap = groupSum(state.filtered, (r) => r.channel, (r) => r.amount);
    const profMap = groupSum(state.filtered, (r) => r.channel, (r) => r.profit);
    const labels = [...amtMap.keys()].sort();
    const amounts = labels.map((k) => amtMap.get(k));
    const margins = labels.map((k) => {
      const a = amtMap.get(k);
      return a ? +(profMap.get(k) / a * 100).toFixed(1) : 0;
    });

    const cfg = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '销售额',
            data: amounts,
            backgroundColor: 'rgba(47, 91, 234, .78)',
            borderRadius: 5,
            maxBarThickness: 34,
            yAxisID: 'y',
          },
          {
            label: '毛利率',
            type: 'line',
            data: margins,
            borderColor: '#f0a020',
            backgroundColor: '#f0a020',
            borderWidth: 2,
            pointRadius: 3,
            yAxisID: 'y1',
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle', color: COLORS.ink2, font: { size: 11.5 } },
          },
          tooltip: {
            backgroundColor: '#16202e',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ctx.datasetIndex === 0
                ? `  销售额  ¥${fmtMoney(ctx.parsed.y)}`
                : `  毛利率  ${ctx.parsed.y}%`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.ink3, font: { size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: COLORS.line },
            border: { display: false },
            ticks: { color: COLORS.ink3, font: { size: 11 }, callback: (v) => fmtMoney(v) },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            border: { display: false },
            ticks: { color: COLORS.ink3, font: { size: 11 }, callback: (v) => v + '%' },
          },
        },
      },
    };
    upsertChart('chartChannel', cfg);
  }

  // ---------- 品类：横向柱状 ----------
  function renderCategory() {
    const m = groupSum(state.filtered, (r) => r.category, (r) => r.amount);
    const entries = [...m.entries()].sort((a, b) => a[1] - b[1]);

    const cfg = {
      type: 'bar',
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{
          label: '销售额',
          data: entries.map((e) => e[1]),
          backgroundColor: ['#3fa9c9', '#8a63d2', '#f0a020', '#12a37a', '#2f5bea'].slice(0, entries.length),
          borderRadius: 5,
          maxBarThickness: 26,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#16202e',
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: { label: (ctx) => '  ¥' + fmtMoney(ctx.parsed.x) },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: COLORS.line },
            border: { display: false },
            ticks: { color: COLORS.ink3, font: { size: 11 }, callback: (v) => fmtMoney(v) },
          },
          y: { grid: { display: false }, ticks: { color: COLORS.ink2, font: { size: 12 } } },
        },
      },
    };
    upsertChart('chartCategory', cfg);
  }

  /** 复用 Chart 实例，避免重复创建导致内存泄漏与闪烁 */
  function upsertChart(id, cfg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (charts[id]) {
      charts[id].data = cfg.data;
      charts[id].options = cfg.options;
      charts[id].update();
    } else {
      charts[id] = new Chart(el, cfg);
    }
  }

  // ---------- 明细表 ----------
  function renderTable() {
    const rows = [...state.filtered];
    const { key, order } = state.sort;
    rows.sort((a, b) => {
      const x = a[key], y = b[key];
      const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      return order === 'asc' ? cmp : -cmp;
    });

    const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if (state.page >= pages) state.page = pages - 1;
    const start = state.page * state.pageSize;
    const slice = rows.slice(start, start + state.pageSize);

    const tbody = $('#detailTable tbody');
    tbody.innerHTML = slice.map((r) => `
      <tr>
        <td>${r.date}</td>
        <td>${r.region}</td>
        <td>${r.city}</td>
        <td>${r.channel}</td>
        <td>${r.category}</td>
        <td class="num">${fmtNum(r.qty)}</td>
        <td class="num">${fmtNum(r.amount)}</td>
        <td class="num">${fmtNum(r.profit)}</td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px">当前筛选条件下无数据</td></tr>';

    $('#tableHint').textContent = `共 ${fmtNum(rows.length)} 行`;
    $('#pageInfo').textContent = `${state.page + 1} / ${pages}`;
    $('#prevPage').disabled = state.page === 0;
    $('#nextPage').disabled = state.page >= pages - 1;
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    // 粒度切换
    $('#grainSeg').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-grain]');
      if (!btn) return;
      state.grain = btn.dataset.grain;
      [...$('#grainSeg').children].forEach((b) => b.classList.toggle('is-active', b === btn));
      renderTrend();
    });

    // 表头排序
    document.querySelectorAll('#detailTable thead th').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (state.sort.key === key) {
          state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort = { key, order: 'desc' };
        }
        document.querySelectorAll('#detailTable thead th')
          .forEach((h) => h.removeAttribute('data-order'));
        th.setAttribute('data-order', state.sort.order);
        state.page = 0;
        renderTable();
      });
    });

    // 分页
    $('#prevPage').addEventListener('click', () => { state.page--; renderTable(); });
    $('#nextPage').addEventListener('click', () => { state.page++; renderTable(); });
  }

  // ---------- 启动 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadData();
  });
})();
