// 把 kepan/*.html 渲染成整頁 PNG（2x）與單頁 PDF。
// 用法：node kepan/render.mjs <html> <out.png> [out.pdf] [width]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [input, outPng, outPdf, widthArg] = process.argv.slice(2);
const WIDTH = +(widthArg || 1080);
const [filePart, query] = input.split('?');
const url = 'file:///' + encodeURI(path.resolve(filePart).replace(/\\/g, '/')) + (query ? '?' + query : '');
const port = 9400 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-render-'));

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--font-render-hinting=none',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${WIDTH},1200`, '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
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
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id;
  pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result && r.result.result && r.result.result.value;
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 1200, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url });
await sleep(1200);
await evalJs('document.fonts.ready.then(()=>1)');
await sleep(400);
await evalJs("document.querySelectorAll('img').forEach(i=>{i.loading='eager'})");
await sleep(300);

const size = await evalJs('({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})');
console.log('page size', size);

if (process.env.BOXES) {
  const boxes = await evalJs(`[...document.querySelectorAll('${process.env.BOXES}')].map((el,i)=>{const r=el.getBoundingClientRect();return {i, cls:el.className, y:Math.round(r.top+scrollY), h:Math.round(r.height)}})`);
  console.log(JSON.stringify(boxes, null, 0));
}

const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: size.w, height: size.h, scale: 1 },
});
fs.writeFileSync(outPng, Buffer.from(shot.result.data, 'base64'));
console.log('wrote', outPng, size.w * 2 + 'x' + size.h * 2);

if (outPdf) {
  const pdf = await send('Page.printToPDF', {
    printBackground: true,
    paperWidth: size.w / 96,
    paperHeight: size.h / 96,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    scale: 1,
  });
  fs.writeFileSync(outPdf, Buffer.from(pdf.result.data, 'base64'));
  console.log('wrote', outPdf);
}

ws.close();
child.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
