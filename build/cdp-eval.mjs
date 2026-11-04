// 開頁面、跑一段 JS，把結果印出來（開發檢查用）。
//   node build/cdp-eval.mjs <url> "<js>" [waitMs]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [url, js, waitArg] = process.argv.slice(2);
const WAIT = Math.max(800, +waitArg || 2500);
const port = 11133 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-eval-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1440,1000',
  '--no-first-run', '--no-default-browser-check', url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('no devtools target');
}
const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Runtime.enable');await send('Runtime.enable');
// CDP_INIT：在頁面腳本之前注入一段 JS（測試用，例如偽裝已安裝）
if (process.env.CDP_INIT) {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: process.env.CDP_INIT });
}
await send('Runtime.enable');
// CDP_MEDIA="display-mode:fullscreen" → 模擬安裝後的顯示模式
if (process.env.CDP_MEDIA) {
  const [name, value] = String(process.env.CDP_MEDIA).split(':');
  await send('Emulation.setEmulatedMedia', { features: [{ name, value }] });
}

// CDP_CPU=6 → 模擬慢手機（CPU 節流 6 倍）
if (process.env.CDP_CPU) {
  await send('Emulation.setCPUThrottlingRate', { rate: +process.env.CDP_CPU || 1 });
}
// 覆寫類的設定（CDP_INIT／CDP_MEDIA）要重新載入頁面才會生效
if (process.env.CDP_INIT || process.env.CDP_MEDIA) {
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(1500);
}

// 先把載入期間的錯誤收起來
await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__errs=[];window.__bootLog=[];addEventListener('error',function(e){window.__errs.push(String(e.message))});" });

const win = (process.env.CDP_WIN || '').split(',').map((x) => +x);
if (win.length === 2 && win[0] > 0) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: win[0], height: win[1], deviceScaleFactor: 2, mobile: win[0] < 700,
  });
  await send('Page.reload', { ignoreCache: true });
  await sleep(1200);
}
await sleep(WAIT);
const r = await send('Runtime.evaluate', {
  expression: `Promise.resolve().then(function(){ return (${js}); }).then(function(v){ return JSON.stringify(v); }, function(e){ return 'ERR ' + e; })`,
  returnByValue: true,
  awaitPromise: true,
});
console.log(r.result?.result?.value ?? JSON.stringify(r.result));
child.kill();
