// 開一個頁面，等 window.ZHU 與經文出現；--no-ds 會先把 DecompressionStream 移除（模擬舊 Safari）。
//   node build/cdp-check.mjs <url> [--no-ds] [waitMs]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const args = process.argv.slice(2);
const url = args[0];
const noDs = args.includes('--no-ds');
const WAIT = +(args.find((a) => /^\d+$/.test(a)) || 25000);

const port = 10933 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-check-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1280,900',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
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

if (noDs) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: "try{delete window.DecompressionStream}catch(e){};" +
            "if('DecompressionStream' in window){Object.defineProperty(window,'DecompressionStream',{value:undefined,configurable:true})}",
  });
}

const t0 = Date.now();
await send('Page.navigate', { url });

let state = null;
for (let i = 0; i < Math.ceil(WAIT / 500); i++) {
  await sleep(500);
  const r = await send('Runtime.evaluate', {
    expression: "JSON.stringify({ds:('DecompressionStream' in window), zhu:!!window.ZHU, works:(window.ZHU&&window.ZHU.works||[]).length, sents:document.querySelectorAll('#reader .sent').length, body:(document.body.innerText||'').slice(0,80)})",
    returnByValue: true,
  });
  try { state = JSON.parse(r.result.result.value); } catch (e) { continue; }
  if (state.sents > 0) break;
}

const ms = Date.now() - t0;
console.log('no-ds=' + noDs, 'ms=' + ms, JSON.stringify(state));
child.kill();
process.exit(state && state.sents > 0 ? 0 : 1);
