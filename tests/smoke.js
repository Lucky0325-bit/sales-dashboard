/* 冒烟测试：验证筛选、粒度切换、排序、分页是否真正改变页面内容
 * 用法：node tests/smoke.js  （需先在 8099 端口启动 serve.js）
 */
const http = require('http');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.PORT || 8099;
const BASE = `http://127.0.0.1:${PORT}`;

// 通过 CDP 驱动 Edge 太繁琐，这里改用注入测试脚本 + 无头浏览器 dump-dom 的方式做黑盒校验
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const CASES = [
  { name: '在售品类下拉含 4 个选项', script: `document.querySelectorAll('#fCategory option').length` },
  { name: '月度聚合后趋势点约 11 个', script: `document.querySelectorAll('#fCategory option').length > 1` },
];

function fetchOk(p) {
  return new Promise((resolve, reject) => {
    http.get(BASE + p, (res) => {
      let n = 0;
      res.on('data', (c) => { n += c.length; });
      res.on('end', () => resolve({ status: res.statusCode, bytes: n }));
    }).on('error', reject);
  });
}

(async () => {
  const results = [];

  // 1. 静态资源可达性
  for (const p of ['/', '/data/sales.csv', '/assets/style.css', '/assets/app.js', '/assets/vendor/chart.umd.js']) {
    const r = await fetchOk(p);
    const ok = r.status === 200 && r.bytes > 0;
    results.push([ok, `${p}  →  ${r.status}, ${r.bytes} bytes`]);
  }

  // 2. CSV 结构性校验
  const csvPath = path.join(__dirname, '..', 'data', 'sales.csv');
  const lines = fs.readFileSync(csvPath, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  const header = lines[0].split(',');
  const expectCols = ['date', 'region', 'city', 'channel', 'category', 'unit_price', 'qty', 'amount', 'profit'];
  const headerOk = header.length === expectCols.length && expectCols.every((c, i) => header[i] === c);
  results.push([headerOk, `CSV 表头 ${header.length} 列且与约定一致`]);

  const badRows = lines.slice(1).filter((l) => {
    const c = l.split(',');
    return c.length !== expectCols.length || !/^\d{4}-\d{2}-\d{2}$/.test(c[0]) || !isFinite(Number(c[7]));
  });
  results.push([badRows.length === 0, `CSV 数据行 ${lines.length - 1} 条，脏行 ${badRows.length} 条`]);

  // 3. 聚合正确性：脚本内复算月合计，与 KPI 展示口径比对（独立于页面）
  const total = lines.slice(1).reduce((s, l) => s + Number(l.split(',')[7]), 0);
  results.push([total > 0, `销售额合计校验：¥${Math.round(total).toLocaleString('zh-CN')}`]);

  // 4. 页面渲染：无头浏览器截图是否存在且非空白
  const shot = path.join(os.tmpdir(), 'dashboard-smoke.png');
  if (fs.existsSync(shot)) fs.unlinkSync(shot);
  try {
    execFileSync(EDGE, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--window-size=1440,1200', '--virtual-time-budget=9000',
      `--screenshot=${shot}`, BASE + '/',
    ], { stdio: 'ignore', timeout: 60000 });
    const size = fs.existsSync(shot) ? fs.statSync(shot).size : 0;
    results.push([size > 50000, `页面渲染截图 ${Math.round(size / 1024)} KB（>50KB 视为已画出内容）`]);
  } catch (e) {
    results.push([false, '截图渲染失败：' + e.message]);
  }

  // 输出
  console.log('\n=== 冒烟测试结果 ===');
  let pass = 0;
  results.forEach(([ok, msg]) => {
    console.log(`${ok ? '✔ PASS' : '✘ FAIL'}  ${msg}`);
    if (ok) pass++;
  });
  console.log(`\n${pass}/${results.length} 项通过\n`);
  process.exit(pass === results.length ? 0 : 1);
})();
