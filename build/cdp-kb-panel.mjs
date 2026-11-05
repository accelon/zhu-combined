// 科判目錄：點小三角（.kb-tgl）會不會把面板關掉／拋例外。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const port = 14833 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-kb-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', '--no-first-run', url], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 120; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl); if (p) return p; } catch (e) {}
    await sleep(250);
  }
  throw new Error('no target');
}
const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text);
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await sleep(10000);

const TEST = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const ok = !!(window.ZHU_KEPAN && window.ZHU_KEPAN.tree);
  out.hasApi = ok;
  if (ok) window.ZHU_KEPAN.tree();
  await sleep(300);
  const panel = document.getElementById('kepanPanel');
  out.afterOpen = { hidden: panel.hidden, rows: document.querySelectorAll('#kepanPanel .kb-row').length };
  const tgl = document.querySelector('#kepanPanel .kb-tgl[data-tgl]');
  out.hasTgl = !!tgl;
  if (tgl) {
    tgl.click();
    await sleep(300);
    out.afterTgl = { hidden: panel.hidden, rows: document.querySelectorAll('#kepanPanel .kb-row').length };
  }
  const outside = document.createElement('div'); outside.id='zz-out'; document.body.appendChild(outside); outside.click(); await sleep(200); out.outsideCloses = panel.hidden; outside.remove();
  const node = document.querySelector('#kepanPanel .kb-node[data-k]');
  if (node) {
    node.click();
    await sleep(400);
    out.afterNode = { hidden: panel.hidden, rows: document.querySelectorAll('#kepanPanel .kb-row').length };
  }
  return JSON.stringify(out);
})()
`;
const r = await send('Runtime.evaluate', { expression: TEST, returnByValue: true, awaitPromise: true });
console.log(r.result?.result?.value || JSON.stringify(r.result?.exceptionDetails || r.result));
if (errors.length) console.log('EXCEPTIONS:', errors.slice(0, 3).map((e) => String(e).split('\n')[0]));
child.kill();


