// 手機（375px）：點句下「›」時 #sheet 會被關掉再開（會閃）嗎？
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const port = 14233 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-sn3-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=375,800', '--no-first-run', url], { stdio: 'ignore' });
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
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true });
await sleep(4500);

const TEST = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById('boot') && document.getElementById('boot').remove();
  window.ZHU_APP.selectUnit(500, { scroll: true });
  await sleep(200);
  // 手機：叫出面板
  const b = document.querySelector('.actbar button[data-open="works"]');
  if (b) b.click();
  await sleep(250);
  const out = { before: document.getElementById('sheet').className };
  let toggles = 0;
  const st = [];
  const oldAdd = DOMTokenList.prototype.add, oldRem = DOMTokenList.prototype.remove;
  DOMTokenList.prototype.add = function (...a) { if (a.includes('closed')) st.push(['add', this.value, (new Error().stack || '').split('\n')[2]]); return oldAdd.apply(this, a); };
  DOMTokenList.prototype.remove = function (...a) { if (a.includes('closed')) st.push(['remove', this.value, (new Error().stack || '').split('\n')[2]]); return oldRem.apply(this, a); };
  const mo = new MutationObserver(() => { toggles++; });
  mo.observe(document.getElementById('sheet'), { attributes: true, attributeFilter: ['class'] });
  const nxt = document.querySelector('.sn-btn.sn-next');
  out.hasBtn = !!nxt;
  if (nxt) {
    nxt.click();
    await sleep(400);
    out.after = document.getElementById('sheet').className;
    out.toggles = toggles;
    out.u = window.ZHU_APP.state().selected;
    out.panelVisible = getComputedStyle(document.getElementById('sheet')).display !== 'none';
    out.log = window.__suLog || null;
    out.stack = st;
  }
  return JSON.stringify(out);
})()
`;
const r = await send('Runtime.evaluate', { expression: TEST, returnByValue: true, awaitPromise: true });
console.log(r.result?.result?.value || JSON.stringify(r.result?.exceptionDetails || r.result));
child.kill();


