// 多步互動測試：Steps 依次執行 [js, 截圖檔名 or null]，每步之間等待。
// 用法：node build/cdp-seq.mjs <url> <w> <h> <outdir> <steps.json>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [url, wArg, hArg, outDir, stepsFile] = process.argv.slice(2);
const W = +wArg || 390, H = +hArg || 844;
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const port = 9733 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-cdp-'));
fs.mkdirSync(outDir, { recursive: true });

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, '--no-first-run', '--no-default-browser-check', url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
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
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id;
  pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 900 });
await send('Emulation.setTouchEmulationEnabled', { enabled: W < 900, maxTouchPoints: 5 });
await sleep(1600);

for (const st of steps) {
  if (st.js) {
    const r = await send('Runtime.evaluate', { expression: st.js, awaitPromise: true, returnByValue: true });
    const v = r.result && r.result.result;
    const val = v && (v.value !== undefined ? v.value : v.description);
    if (val !== undefined) console.log('[' + (st.name || '') + ']', JSON.stringify(val));
  }
  await sleep(st.wait || 500);
  if (st.shot) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const p = path.join(outDir, st.shot);
    fs.writeFileSync(p, Buffer.from(shot.result.data, 'base64'));
    console.log('wrote', p);
  }
}
ws.close();
child.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
