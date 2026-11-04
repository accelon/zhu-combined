// 對「已上線」的頁面做孵化區門檻檢查（discipline §2／§7）
//   node build/cdp-live.mjs https://shutonggui.cn/huixintang/ [寬度]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'https://shutonggui.cn/huixintang/';
const W = +(process.argv[3] || 390);
const port = 15600 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-live-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl); if (p) return p; } catch (e) {}
    await sleep(250);
  }
  throw new Error('no target');
}
const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push('exception: ' + ((d.exception && d.exception.description) || d.text || '').split('\n')[0]);
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push('console.error: ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 160));
  }
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return 'ERR ' + (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description); return r.result && r.result.result ? r.result.result.value : undefined; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 2, mobile: W < 700 });
await send('Page.navigate', { url });
for (let i = 0; i < 80; i++) { await sleep(300); if (await ev("document.querySelectorAll('#reader .sent').length")) break; }
await sleep(1500);

let ok = 0, bad = 0;
const check = (l, c, x) => { if (c) { ok++; console.log('  ✓ ' + l + (x ? '  ' + x : '')); } else { bad++; console.log('  ✗ ' + l + (x ? '  ' + x : '')); } };

console.log('網址：', url, `（視窗 ${W}px）`);
const info = JSON.parse(await ev(`JSON.stringify({
  title: document.title,
  desc: (document.querySelector('meta[name="description"]')||{}).content || '',
  trail: !!document.getElementById('kbTrail'),
  chips: document.querySelectorAll('#kbTrail .kb-chip').length,
  docW: document.documentElement.scrollWidth,
  winW: window.innerWidth,
  font: getComputedStyle(document.querySelector('#reader .sent')||document.body).fontSize,
  bar: getComputedStyle(document.querySelector('#kepanBar')||document.body).height
})`));
check('title 有寫', !!info.title, info.title);
check('description 有寫', info.desc.length > 40, info.desc.slice(0, 40) + '…');
check('科判層有起來（kbTrail 有晶片）', info.trail && info.chips > 0, info.chips + ' 個');
check('沒有橫向溢出', info.docW <= info.winW + 1, `${info.docW} / ${info.winW}`);
check('經文字級 ≥ 16px', parseFloat(info.font) >= 16, info.font);
check('頁面載入 3 秒內沒有 console error', errors.length === 0, errors.slice(0, 3).join(' | '));

// 手機：點第一句要能開面板
// .sent 是行內元素，getBoundingClientRect 的中心可能落在兩行之間的空隙；
// 取「第一個行盒」的中間才點得到字。
const btn = await ev(`(function(){
  var b = document.querySelector('#reader .sent[data-u]');
  if (!b) return 'none';
  var rs = b.getClientRects();
  var r = rs.length ? rs[0] : b.getBoundingClientRect();
  return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)});
})()`);
if (btn !== 'none') {
  const p = JSON.parse(btn);
  console.log('  點擊位置：', JSON.stringify(p), '命中：', await ev(`(function(){
    var h = document.elementFromPoint(${p.x}, ${p.y});
    if (!h) return 'null';
    return (h.id ? '#' + h.id : h.tagName + '.' + (h.className || '')) + ' / 父 ' +
      (h.closest('.sent[data-u]') ? 'sent[' + h.closest('.sent[data-u]').dataset.u + ']' : 'none');
  })()`));
  const base = { x: p.x, y: p.y, button: 'left', clickCount: 1 };
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  await sleep(700);
  const sel = await ev("window.ZHU_APP ? window.ZHU_APP.state().selected : -1");
  const cards = await ev("document.querySelectorAll('#cards .note-open').length");
  check('手機點句會選句並開注疏', sel != null && cards > 0, `選 ${sel}、注疏 ${cards} 家`);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
const out = 'D:\\2026\\zhu-combined\\screenshots\\live-' + (W < 700 ? 'mobile' : 'desktop') + '.png';
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('截圖：', out);
console.log(`\n結果：${ok} 過 / ${bad} 不過`);
child.kill();
process.exit(bad ? 1 : 0);
