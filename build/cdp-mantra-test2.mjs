// 咒語分頁：雙向跳轉驗收（咒語→經文、經文→咒語）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/index.html';
const outPng = process.argv[3] || '';
const port = 12433 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mt2-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', url,
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
await sleep(2500);

const TEST = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  // 1) 打開咒語頁，點 M1.01 的 Namaḥ 那一列
  document.querySelector('#tabs2 button[data-t="mantra"]').click();
  await sleep(60);
  const cards = document.getElementById('cards');
  const u1 = cards.querySelector('[data-mt-unit="M1.01"]');
  const row = u1.querySelector('tr.mt-row');
  out.rowJump = row.getAttribute('data-mt-jump') + '|' + row.getAttribute('data-mt-char');
  row.click();
  await sleep(250);
  const sel = document.querySelector('.sent.sel');
  out.selU = sel ? sel.getAttribute('data-u') : null;
  const hl = document.querySelector('mark.mt-hl');
  out.hlText = hl ? hl.textContent : null;
  out.sheetOpen = !document.getElementById('sheet').classList.contains('closed');
  out.tabAfterJump = document.querySelector('#tabs2 button.on') ? document.querySelector('#tabs2 button.on').dataset.t : null;
  await sleep(1900);
  out.hlGone = !document.querySelector('mark.mt-hl');
  // 2) 選句列上的「咒」按鈕
  const mtBtn = document.querySelector('.actbar button.mt-link');
  out.hasRuBtn = !!mtBtn;
  if (mtBtn) {
    mtBtn.click();
    await sleep(120);
    out.tabAfterRu = document.querySelector('#tabs2 button.on').dataset.t;
    const focused = document.querySelector('.mt-unit.flash') || document.querySelector('[data-mt-unit="M1.01"]');
    out.focusUnit = focused ? focused.getAttribute('data-mt-unit') : null;
    out.focusAsm = document.querySelector('.mt-asm.on') ? document.querySelector('.mt-asm.on').textContent.trim() : null;
  }
  // 3) 沒咒語資料的句子不應該有「咒」
  out.noRuOnOther = !document.querySelector('.actbar button.mt-link[data-mantra="4"]');
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
