// 檢查 PWA 能不能安裝：Page.getAppManifest＋Page.getInstallabilityErrors。
//   node build/cdp-pwa.mjs <url>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const port = 11333 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-pwa-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1200,900',
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

await send('Page.enable');
await sleep(3000);

const man = await send('Page.getAppManifest');
if (man.result && man.result.errors && man.result.errors.length) {
  console.log('manifest 錯誤：' + JSON.stringify(man.result.errors));
} else {
  console.log('manifest OK：' + (man.result && man.result.url));
}
const inst = await send('Page.getInstallabilityErrors');
const errs = (inst.result && inst.result.installabilityErrors) || [];
console.log('installability: ' + (errs.length ? JSON.stringify(errs.map((e) => e.errorId + ' ' + (e.errorArguments || '').join(','))) : 'OK（可安裝）'));

// service worker 狀態
const sw = await send('Runtime.evaluate', { expression: 'navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>r.active?"active":r.installing?"installing":r.waiting?"waiting":"none"))', awaitPromise: true, returnByValue: true });
console.log('service worker: ' + JSON.stringify(sw.result && sw.result.result && sw.result.result.value));

try { child.kill(); } catch (e) {}
process.exit(0);
