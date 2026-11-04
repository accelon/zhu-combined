// 驗：麵包屑 DOM 不再一直被重畫；邊 hover 邊點也點得動
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/vcpp-kepan.html';
const port = 15000 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-trail-'));
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
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return 'ERR ' + (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description); return r.result && r.result.result ? r.result.result.value : undefined; };
const realClick = async (sel) => {
  const box = await ev(`(function(){var e=document.querySelector('${sel}'); if(!e) return 'none'; var r=e.getBoundingClientRect(); return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`);
  if (box === 'none') return false;
  const p = JSON.parse(box);
  const base = { x: p.x, y: p.y, button: 'left', clickCount: 1 };
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  return true;
};

await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url });
for (let i = 0; i < 60; i++) { await sleep(300); if (await ev("document.querySelectorAll('#reader .sent').length")) break; }
await sleep(900);

let ok = 0, bad = 0;
const check = (l, c, x) => { if (c) { ok++; console.log('  ✓ ' + l + (x ? '  ' + x : '')); } else { bad++; console.log('  ✗ ' + l + (x ? '  ' + x : '')); } };

// 計數器：觀察 #kbTrail 的子節點變動
await ev(`(function(){
  window.__trailN = 0;
  if (window.__trailObs) window.__trailObs.disconnect();
  window.__trailObs = new MutationObserver(function(ms){ window.__trailN += ms.length; });
  window.__trailObs.observe(document.getElementById('kbTrail'), { childList: true, subtree: true });
  return true;
})()`);

console.log('— 閒置 1.5 秒');
await sleep(1500);
let n = await ev("window.__trailN");
console.log('  變動次數：', n);
check('閒置時麵包屑完全沒被重畫', n === 0);

console.log('— 點句（會重畫經文、可能連帶重畫麵包屑）');
await ev("window.__trailN = 0");
await realClick('#reader .sent[data-u]');
await sleep(900);
n = await ev("window.__trailN");
console.log('  變動次數：', n, '；條', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")));
check('點同一分內的句子，麵包屑不重畫', n === 0);

console.log('— 邊 hover 邊點麵包屑');
await ev("window.__trailN = 0");
// 先把滑鼠移到梵文詞上（會觸發 App 重畫句內 HTML），再移到晶片按下
const hasWord = await ev("document.querySelectorAll('#reader .ifan .sw').length");
if (hasWord > 0) {
  const w = await ev("(function(){var e=document.querySelector('#reader .ifan .sw'); var r=e.getBoundingClientRect(); return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()");
  const p = JSON.parse(w);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await sleep(250);
}
await realClick('#kbTrail .kb-chip');
await sleep(500);
const menuOpen = await ev("!document.getElementById('kepanMenu').hidden");
const items = await ev("document.querySelectorAll('#kepanMenu .kb-item').length");
console.log('  hover 之後點晶片 → menu', menuOpen, '項目', items, '；trail 變動', await ev("window.__trailN"));
check('hover 之後點晶片仍然有反應', menuOpen === true && items > 1);

console.log(`\n結果：${ok} 過 / ${bad} 不過`);
child.kill();
process.exit(bad ? 1 : 0);
