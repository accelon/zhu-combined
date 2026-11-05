// 單檔煙霧測試：開頁、等載入、回報分頁／資料規模／有無 JS 例外。
//   node build/cdp-smoke.mjs <url> [waitMs]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const wait = +(process.argv[3] || 9000);
const port = 14533 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-smoke-'));
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
const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await sleep(wait);

const TEST = String.raw`
(() => {
  const D = window.ZHU || {};
  return JSON.stringify({
    boot: !!document.getElementById('boot'),
    tabs: [...document.querySelectorAll('#tabs2 button')].map((b) => b.textContent),
    title: document.title,
    h1: (document.querySelector('#top h1') || {}).textContent || null,
    sent: document.querySelectorAll('#reader .sent').length,
    secs: (D.sections || []).length,
    works: (D.works || []).length,
    versions: (D.versions || []).length,
    kepan: window.KEPAN ? window.KEPAN.editions.map((e) => e.short + '(' + e.nodes.length + ')').join(' ') : null,
    glossary: D.glossary ? D.glossary.entries.length : 0,
    mantra: window.MANTRA ? window.MANTRA.units.length : 0,
  });
})()
`;
const r = await send('Runtime.evaluate', { expression: TEST, returnByValue: true });
console.log(r.result?.result?.value || JSON.stringify(r.result?.exceptionDetails || r.result));
if (errors.length) console.log('EXCEPTIONS:', JSON.stringify(errors.slice(0, 3)));
child.kill();
