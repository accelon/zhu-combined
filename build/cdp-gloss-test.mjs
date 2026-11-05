// 辭典（GLOSS）驗收：梵藏英列是否只在有值時出現。
//   node build/cdp-gloss-test.mjs <url>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const wait = +(process.argv[3] || 6000);
const port = 13333 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-gl-'));
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
  const g = window.ZHU.glossary;
  out.entries = g ? g.entries.length : 0;
  out.withScript = g ? g.entries.filter((e) => e.sa || e.tib || e.en).length : 0;
  const btn = document.getElementById('glossBtn');
  out.hasGlossBtn = !!btn && !btn.hidden;
  if (btn) btn.click();
  await sleep(250);
  const item = document.querySelector('.gp-item');
  out.listItems = document.querySelectorAll('.gp-item').length;
  if (item) item.click();
  await sleep(150);
  out.placeholder = (document.querySelector('.gp-in') || {}).placeholder || null;
  const rows = document.querySelector('.gp-rows');
  out.hasRows = !!rows;
  out.rowCount = rows ? rows.querySelectorAll('dt').length : 0;
  out.dts = rows ? [...rows.querySelectorAll('dt')].map((d) => d.textContent) : [];
  out.term = (document.querySelector('.gp-detail h3') || {}).textContent || null;
  return JSON.stringify(out);
})()
`;
const r = await send('Runtime.evaluate', { expression: TEST, returnByValue: true, awaitPromise: true });
console.log(r.result?.result?.value || JSON.stringify(r.result?.exceptionDetails || r.result));
child.kill();
