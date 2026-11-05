// 逐家檢查科判載入偵測：切到每一家，看 #kbWarn 有沒有叫。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const wait = +(process.argv[3] || 12000);
const port = 15233 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-kbw-'));
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
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
await send('Runtime.enable');
await sleep(wait);

const TEST = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sel = document.getElementById('kbEd');
  if (!sel) return JSON.stringify({ error: 'no #kbEd' });
  const out = [];
  for (let i = 0; i < sel.options.length; i++) {
    sel.value = String(i);
    sel.dispatchEvent(new Event('change'));
    await sleep(120);
    window.ZHU_KEPAN.tree();
    await sleep(120);
    const w = document.getElementById('kbWarn');
    out.push({ ed: sel.options[i].textContent, warn: w && !w.hidden ? w.textContent : '' });
    document.getElementById('kbPanelX').click();
    await sleep(60);
  }
  return JSON.stringify(out);
})()
`;
const r = await send('Runtime.evaluate', { expression: TEST, returnByValue: true, awaitPromise: true });
console.log(r.result?.result?.value || JSON.stringify(r.result?.exceptionDetails || r.result));
child.kill();
