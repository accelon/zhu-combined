// 分頁回歸：逐一開 注疏／科判／別譯／辭典／詞組／咒語，記 #cards 有沒有內容。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const wait = +(process.argv[3] || 5000);
const port = 13033 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mt4-'));
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
await send('Page.enable'); await send('Runtime.enable'); await sleep(wait);

const TEST = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  if (window.ZHU_APP && window.ZHU_APP.selectUnit) { window.ZHU_APP.selectUnit(2587, { noHash: true }); await sleep(300); }
  out.selected = !!document.querySelector('.sent.sel');
  for (const t of ['works', 'ke', 'alt', 'gloss', 'phrase', 'mantra']) {
    const b = document.querySelector('#tabs2 button[data-t="' + t + '"]');
    if (!b) { out[t] = 'no-tab'; continue; }
    b.click();
    await sleep(150);
    const c = document.getElementById('cards');
    out[t] = c.children.length + '|' + c.textContent.replace(/\s+/g, ' ').trim().slice(0, 14);
  }
  out.ruBtn = !!document.querySelector('.actbar button.mt-link');
  return JSON.stringify(out);
})()
`;
const r = await send('Runtime.evaluate', { expression: TEST, returnByValue: true, awaitPromise: true });
console.log(r.result?.result?.value || JSON.stringify(r.result?.exceptionDetails || r.result));
child.kill();

