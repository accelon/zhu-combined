// 量「老手機」上的載入時間：用 CDP 的 CPU 降速模擬
//   node build/perf.mjs [vcpp.html] [throttle]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const file = process.argv[2] || 'file:///D:/2026/zhu-combined/vcpp-kepan.html';
const RATE = +(process.argv[3] || 4);
const port = 20400 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-perf-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=390,844', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl); if (p) return p; } catch (e) {}
    await sleep(200);
  }
  throw new Error('no target');
}
const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setCPUThrottlingRate', { rate: RATE });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

// 在頁面載入前掛計時器
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__t0 = performance.now();
  window.__marks = [];
  (function tick(){
    var q = function (s) { return !!document.querySelector(s); };
    if (!window.__m1 && q('#reader .sent')) { window.__m1 = performance.now(); }
    if (!window.__m2 && window.ZHU_APP && window.ZHU_APP.state && window.ZHU_APP.state().ready) { window.__m2 = performance.now(); }
    if (!window.__m3 && q('#kepanBar')) { window.__m3 = performance.now(); }
    if (!window.__m2) requestAnimationFrame(tick);
  })();`,
});
await send('Page.navigate', { url: file });
for (let i = 0; i < 240; i++) { await sleep(100); if (await ev('!!window.__m2')) break; }
await sleep(600);
const t = await ev(`JSON.stringify({
  sents: window.__m1 ? Math.round(window.__m1 - window.__t0) : null,
  ready: window.__m2 ? Math.round(window.__m2 - window.__t0) : null,
  bar: window.__m3 ? Math.round(window.__m3 - window.__t0) : null,
  paint: Math.round(performance.getEntriesByType('paint').map(p=>p.startTime).pop() || 0)
})`);
console.log(`CPU 降速 ${RATE}×：`, t);
const nav = await ev("JSON.stringify((performance.getEntriesByType('navigation')[0]||{}).toJSON ? performance.getEntriesByType('navigation')[0].toJSON() : {})");
try { const n = JSON.parse(nav); console.log('  DOMContentLoaded', Math.round(n.domContentLoadedEventEnd), 'ms｜load', Math.round(n.loadEventEnd), 'ms'); } catch (e) {}
child.kill();
