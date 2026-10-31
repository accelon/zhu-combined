// 把一個 HTML 整頁拍下來（長圖用）：node build/cdp-page.mjs <url> <out.png> [width]
// 以指定 CSS 寬度排版，DPR 1，截到文件底部。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [url, out, wArg] = process.argv.slice(2);
const W = +wArg || 1080;
const port = 10533 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-cdp-'));

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${W},900`, '--no-first-run', '--no-default-browser-check', url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await r.json();
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

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.reload', { ignoreCache: true });
await sleep(1500);
await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
// 等圖片都有尺寸
for (let i = 0; i < 40; i++) {
  const done = await send('Runtime.evaluate', {
    expression: "[...document.images].every(i => i.complete && i.naturalWidth > 0)",
    returnByValue: true,
  });
  if (done.result?.result?.value) break;
  await sleep(250);
}
await sleep(400);

const hRes = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true });
const H = hRes.result.result.value;
console.log('page height', H);

const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
});
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');

ws.close();
child.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
