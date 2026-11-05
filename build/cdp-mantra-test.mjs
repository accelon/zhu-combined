// 咒語分頁驗收：開 index.html，跑一段測試 JS，印 JSON；可另存截圖。
//   node build/cdp-mantra-test.mjs [url] [outPng]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/index.html';
const outPng = process.argv[3] || '';
const width = +(process.env.CDP_W || 1440);
const port = 12133 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mt-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${width},1000`, '--no-first-run', '--no-default-browser-check', url,
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
(() => {
  const out = {};
  const b0 = document.getElementById('boot'); if (b0) b0.remove();   // 開發頁的遮罩（與本功能無關）
  const tabs = () => [...document.querySelectorAll('#tabs2 button')].map((b) => b.dataset.t);
  out.t1_hasTab = tabs().includes('mantra');
  // 沒選句也能開
  const btn = document.querySelector('#tabs2 button[data-t="mantra"]');
  btn.click();
  const cards = document.getElementById('cards');
  out.t2_opened = !document.getElementById('sheet').classList.contains('closed');
  out.t2_units = cards.querySelectorAll('.mt-unit').length;
  out.t2_asms = cards.querySelectorAll('.mt-asm').length;
  out.t2_asmsDisabled = [...cards.querySelectorAll('.mt-asm')].filter((b) => b.disabled).map((b) => b.textContent.trim());
  const g = cards.querySelector('[data-mt-unit="M1.06"]');
  out.t3_gapClass = g ? g.className : null;
  out.t3_gapText = g ? (g.querySelector('.mt-gapn') || {}).textContent : null;
  const u1 = cards.querySelector('[data-mt-unit="M1.01"]');
  const rows1 = u1 ? [...u1.querySelectorAll('tr.mt-row')] : [];
  out.t4_rows = rows1.map((r) => [...r.children].map((td) => td.textContent.trim()));
  out.t4_rowspan = rows1.map((r) => { const td = r.querySelector('.mt-c-lit'); return td ? td.getAttribute('rowspan') : null; });
  const u4 = cards.querySelector('[data-mt-unit="M1.04"]');
  out.t5_m104 = u4 ? [...u4.querySelectorAll('tr.mt-row')].map((r) => [...r.children].map((td) => td.textContent.trim())) : [];
  // 高頻詞
  const chip = cards.querySelector('.mt-chip');
  out.t8_lexCount = cards.querySelectorAll('.mt-chip').length;
  const lemma = chip ? chip.dataset.mtLex : null;
  chip.click();
  const cards2 = document.getElementById('cards');
  out.t8_chipOn = !!cards2.querySelector('.mt-chip.on');
  out.t8_hits = cards2.querySelectorAll('tr.mt-row.hit').length;
  cards2.querySelector('.mt-chip.on').click();
  out.t8_cleared = document.getElementById('cards').querySelectorAll('tr.mt-row.hit').length;
  // 本會無：點一個不在本會的 lemma
  const ext = document.getElementById('cards').querySelector('.mt-chip.ext');
  if (ext) {
    ext.click();
    out.t8b_lemma = ext.dataset.mtLex;
    const c3 = document.getElementById('cards');
    out.t8b_note = c3.querySelector('.mt-note') ? c3.querySelector('.mt-note').textContent : null;
    out.t8b_hits = c3.querySelectorAll('tr.mt-row.hit').length;
  }
  // 換會：第五會 17 unit，且高頻詞跟著換
  const asmBtn = [...document.getElementById('cards').querySelectorAll('.mt-asm')].find((b) => /第五會/.test(b.textContent));
  if (asmBtn) {
    asmBtn.click();
    const c4 = document.getElementById('cards');
    out.t9_units = c4.querySelectorAll('.mt-unit').length;
    out.t9_on = c4.querySelector('.mt-asm.on').textContent.trim();
    out.t9_chips = c4.querySelectorAll('.mt-chip').length;
    const back = [...c4.querySelectorAll('.mt-asm')].find((b) => /第一會/.test(b.textContent));
    if (back) back.click();
  }
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


