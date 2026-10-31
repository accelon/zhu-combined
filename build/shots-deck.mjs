// 拍「第七分 · 最後一句」的五張圖（給 build/series/tour-walkthrough.html）：
//   01 讀經（整分）  02 點句＋點詞  03 注疏（印順／慧能／僧肇）  04 詞組（hetoḥ 另見 5·5-3）  05 別譯
//   node build/shots-deck.mjs <url> <outdir>
// 會印出 01／03 兩張要裁到哪裡（CSS px），再交給 Python 裁。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/index.html?theme=light';
const outDir = process.argv[3] || 'build/series';
const W = 390, H = 844, DPR = 3, SEC = 7;
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^\d\d-.*\.png$/.test(f)) fs.unlinkSync(path.join(outDir, f));

const port = 10733 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-cdp-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, '--no-first-run', '--no-default-browser-check', url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await r.json();
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
const evalIn = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  const rr = r.result && r.result.result;
  if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text + ' ' + (rr && rr.description));
  return rr && rr.value;
};
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(s.result.data, 'base64'));
  console.log('wrote', name);
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await sleep(1600);
for (let i = 0; i < 80; i++) {
  if (await evalIn('!!(window.ZHU_APP && ZHU_APP.state().ready)')) break;
  await sleep(250);
}
await evalIn("document.getElementById('tourHint')?.remove()");

// 01 點最後一句 ＋ 點 asaṃskṛta-prabhāvitā（第 4 個詞）
await evalIn(`ZHU_APP.setSection(${SEC})`);
await sleep(500);
const crops = {};
await evalIn(`(function(){const s=[...document.querySelectorAll('.sent[data-u]')]; s[s.length-1].click();})()`);
await sleep(600);
await evalIn(`(function(){const s=document.querySelector('.sent.sel');
  const head=document.getElementById('top').getBoundingClientRect().height;
  window.scrollTo({top:Math.max(0,scrollY+s.getBoundingClientRect().top-head-10),behavior:'instant'});})()`);
await sleep(300);
await evalIn(`(function(){const w=document.querySelector('.ifan .sw[data-i="3"]');
  w.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'touch'}));})()`);
await sleep(500);
crops['02-word'] = await evalIn(`(function(){const f=document.getElementById('foot').getBoundingClientRect();
  return Math.round(f.bottom + 16);})()`);
await shot('02-word');

// 03 注疏：依序點 釋印順·演培 → 慧能 → 僧肇，裁到「提可證得嗎？二、」
await evalIn("document.getElementById('foot').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
await evalIn('ZHU_APP.openPanel("works")');
await sleep(500);
await evalIn(`(function(){const pick=(n)=>{const b=[...document.querySelectorAll('#cards .notebtn')]
  .find(x=>x.textContent.replace(/\\s/g,'').startsWith(n)); b&&b.click();};
  pick('釋印順'); pick('慧能'); pick('僧肇');})()`);
await sleep(600);
crops['03-notes'] = await evalIn(`(function(){
  const ex=[...document.querySelectorAll('.note-open .ex')].find(p=>p.textContent.includes('提可證得嗎'));
  if(!ex) return 0;
  const t=ex.textContent.indexOf('提可證得嗎');
  const node=ex.firstChild; const r=document.createRange();
  r.setStart(node,t); r.setEnd(node,Math.min(node.data.length,t+9));
  return Math.round(r.getBoundingClientRect().bottom + 4);})()`);
await shot('03-notes');

// 04 詞組：hetoḥ → 另見 5·5-3
await evalIn('ZHU_APP.openPanel("phrase")');
await sleep(500);
await evalIn(`(function(){const row=[...document.querySelectorAll('.ph-row')]
  .find(r=>/^heto/.test((r.querySelector('.ph-w')||{}).textContent||''));
  const a=[...row.querySelectorAll('.ph-occ a')].find(x=>x.textContent.replace(/\\s/g,'')==='5·5-3');
  a&&a.click();})()`);
await sleep(600);
crops['04-phrase'] = await evalIn(`(function(){const last=[...document.querySelectorAll('.ph-row')].pop();
  return Math.round(last.getBoundingClientRect().bottom + 44);})()`);
await shot('04-phrase');

// 05 別譯：最後一句，玄奘＋真諦＋羅什
await evalIn('ZHU_APP.openPanel("alt")');
await sleep(400);
await evalIn(`(function(){const pick=(n)=>{const b=[...document.querySelectorAll('.altbtn')].find(x=>x.textContent.startsWith(n)); b&&b.click();};
  pick('羅什'); pick('Muller'); pick('笈多'); pick('玄奘');})()`);
await sleep(500);
crops['05-alt'] = await evalIn(`(function(){const panes=[...document.querySelectorAll('.alt-pane')];
  const last=panes[panes.length-1];
  return Math.round(last.getBoundingClientRect().bottom + 56);})()`);
await shot('05-alt');

fs.writeFileSync(path.join(outDir, '_crop.json'), JSON.stringify({ crops, dpr: DPR }, null, 1));
console.log(JSON.stringify(crops));
console.log('state:', JSON.stringify(await evalIn('({sec:ZHU_APP.state().section, sel:ZHU_APP.state().selected})')));
ws.close();
child.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
