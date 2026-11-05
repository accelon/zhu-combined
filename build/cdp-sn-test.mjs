// 句下「›」按鈕（.sn-btn.sn-next）穩定度：連點 5 次，記錄捲動、節點數、nav 是否重建。
//   node build/cdp-sn-test.mjs <url> [u]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const startU = +(process.argv[3] || 500);
const port = 13633 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-sn-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', '--no-first-run', url], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 80; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl); if (p) return p; } catch (e) {}
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
await send('Page.enable'); await send('Runtime.enable'); await sleep(4500);

const TEST = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { steps: [] };
  document.getElementById('boot') && document.getElementById('boot').remove();
  window.ZHU_APP.selectUnit(${startU}, { scroll: true });
  await sleep(300);
  // 監看 #reader 被重畫的次數
  let paints = 0;
  const mo = new MutationObserver(() => { paints++; });
  mo.observe(document.getElementById('reader'), { childList: true, subtree: false });
  const snap = (label) => out.steps.push({
    label,
    scrollY: Math.round(scrollY),
    readerH: Math.round(document.getElementById('reader').getBoundingClientRect().height),
    navs: document.querySelectorAll('.sheet-nav').length,
    sel: document.querySelectorAll('.sent.sel').length,
    selTop: (() => { const e = document.querySelector('.sent.sel'); return e ? Math.round(e.getBoundingClientRect().top) : null; })(),
    sheetTop: Math.round(document.getElementById('sheet').getBoundingClientRect().top),
    keep: window.__keepPos || null,
  });
  snap('before');
  for (let i = 0; i < 18; i++) {
    const b = document.querySelector('.sn-btn.sn-next');
    if (!b) { out.steps.push({ label: 'no-btn' }); break; }
    const u0 = window.ZHU_APP.state().selected;
    b.click();
    await sleep(220);
    snap('after' + (i + 1));
    out.steps[out.steps.length - 1].u = window.ZHU_APP.state().selected;
    out.steps[out.steps.length - 1].u0 = u0;
  }
  out.paints = paints;
  return JSON.stringify(out);
})()
`;
const r = await send('Runtime.evaluate', { expression: TEST, returnByValue: true, awaitPromise: true });
console.log(r.result?.result?.value || JSON.stringify(r.result?.exceptionDetails || r.result));
child.kill();


