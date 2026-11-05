// 手機（375px）驗收：咒語頁不橫向溢出、詞表變卡片、五會可滑
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/index.html';
const outPng = process.argv[3] || '';
const port = 12733 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mt3-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=375,800', '--no-first-run', '--no-default-browser-check', url,
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
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true });
await sleep(2500);

const TEST = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { vw: innerWidth };
  const b0 = document.getElementById('boot'); if (b0) b0.remove();
  document.querySelector('#tabs2 button[data-t="mantra"]').click();
  await sleep(150);
  const cards = document.getElementById('cards');
  const tr = cards.querySelector('tr.mt-row');
  out.trDisplay = getComputedStyle(tr).display;
  const td = tr.querySelector('td');
  out.tdDisplay = getComputedStyle(td).display;
  out.lexDetails = getComputedStyle(cards.querySelector('.mt-lex')).display;
  // 溢出檢查：面板與文件
  const panel = document.querySelector('#sheet .panel');
  out.docOverflow = document.documentElement.scrollWidth - innerWidth;
  out.panelOverflow = panel ? panel.scrollWidth - panel.clientWidth : null;
  const asms = cards.querySelector('.mt-asms');
  out.asmScrollable = asms ? asms.scrollWidth > asms.clientWidth : null;
  return JSON.stringify(out);
})()
`;

const r = await send('Runtime.evaluate', { expression: TEST, returnByValue: true, awaitPromise: true });
const val = r.result?.result?.value;
console.log(val || JSON.stringify(r.result?.exceptionDetails || r.result, null, 1));
if (outPng) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPng, Buffer.from(shot.result.data, 'base64'));
  console.log('shot -> ' + outPng);
}
child.kill();

