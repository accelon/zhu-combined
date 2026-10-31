// 手機實錄（390×844，DPR 3），不帶導覽氣泡；預設用第 7 分「無得無說」當例子。
//   node build/shots-walk.mjs <url> <outdir> [section]
// 產出 01-reader / 02-word / 03-notes / 04-alt / 05-phrase（給 build/series/tour-walkthrough.html）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/index.html?theme=light';
const outDir = process.argv[3] || 'build/series';
const SEC = +(process.argv[4] || 7);
const W = 390, H = 844, DPR = 3;
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (/^\d\d-.*\.png$/.test(f)) fs.unlinkSync(path.join(outDir, f)); // 舊的一批不要留
}

const port = 10133 + Math.floor(Math.random() * 200);
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
  const file = path.join(outDir, name + '.png');
  fs.writeFileSync(file, Buffer.from(s.result.data, 'base64'));
  console.log('wrote', file);
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

// 01 讀經：只有這一分，不選句
await evalIn(`ZHU_APP.setSection(${SEC})`);
await sleep(500);
await shot('01-reader');

// 02 點句＋點詞：梵藏展開、詞性卡留住
await evalIn('ZHU_APP.pickSentence()');
await sleep(600);
await evalIn(`(function(){const s=document.querySelector('.sent.sel');
  const head=document.getElementById('top').getBoundingClientRect().height;
  window.scrollTo({top:Math.max(0,scrollY+s.getBoundingClientRect().top-head-10),behavior:'instant'});})()`);
await sleep(350);
await evalIn(`(function(){const sw=[...document.querySelectorAll('.ifan .sw')];
  const w=sw[Math.min(3,sw.length-1)];
  w.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'touch'}));})()`);
await sleep(500);
await shot('02-word');

// 03 注疏：收掉詞卡（模擬手指點別處），開面板並展開三家
await evalIn("document.getElementById('foot').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
await evalIn('ZHU_APP.openPanel("works")');
await sleep(500);
await evalIn(`(function(){const pick=(i)=>{const b=[...document.querySelectorAll('#cards .notebtn')]; if(b[i]) b[i].click();};
  pick(0); pick(1); pick(2);})()`);
await sleep(500);
await shot('03-notes');

// 04 別譯：三家並置
await evalIn('ZHU_APP.openPanel("alt")');
await sleep(400);
await evalIn(`(function(){const pick=(n)=>{const b=[...document.querySelectorAll('.altbtn')].find(x=>x.textContent.startsWith(n)); b&&b.click();};
  pick('真諦'); pick('玄奘');})()`);
await sleep(500);
await shot('04-alt');

// 05 詞組：逐詞＋展開一則「另見」
await evalIn('ZHU_APP.openPanel("phrase")');
await sleep(400);
await evalIn("document.querySelector('.ph-occ a')?.click()");
await sleep(500);
await shot('05-phrase');

console.log('state:', JSON.stringify(await evalIn('({sec:ZHU_APP.state().section, sel:ZHU_APP.state().selected})')));
ws.close();
child.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
