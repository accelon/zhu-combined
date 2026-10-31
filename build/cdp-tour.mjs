// 操作導覽的整場自動走訪（手機／桌面視窗都可用）：
//   node build/cdp-tour.mjs <url> <w> <h> <outdir> [--keep]
// 會點 🦮 開始，照 tourState() 的等待型態往前推，最後列出每一場景的成敗與截圖。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [url, wArg, hArg, outDir = '.'] = process.argv.slice(2);
const W = +wArg || 390, H = +hArg || 844;
const port = 9933 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-cdp-'));
fs.mkdirSync(outDir, { recursive: true });

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
const evalIn = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  const rr = r.result && r.result.result;
  if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.text + ' ' + (rr && rr.description || '') };
  return rr && (rr.value !== undefined ? rr.value : rr.description);
};
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, 'base64'));
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 900 });
await send('Emulation.setTouchEmulationEnabled', { enabled: W < 900, maxTouchPoints: 5 });
await sleep(1800);

// 等資料就緒（單檔版要解壓）
for (let i = 0; i < 80; i++) {
  const ready = await evalIn('!!(window.ZHU_APP && ZHU_APP.state().ready)');
  if (ready === true) break;
  await sleep(250);
}

await shot('tour-0-start.png');
console.log('entry hint:', JSON.stringify(await evalIn("({hint: !!document.getElementById('tourHint'), entry: !!document.getElementById('tourEntry'), label: document.getElementById('tourEntry')?.getAttribute('aria-label')})")));
await evalIn("document.getElementById('tourEntry').click()");

const trace = [];
let done = false;
for (let i = 0; i < 260 && !done; i++) {
  const s = await evalIn('window.tourState()');
  if (!s || s.error) { console.log('state error', JSON.stringify(s)); break; }
  const buttons = (s.bubble && s.bubble.buttons) || [];
  if (s.phase === 'done') { done = true; trace.push({ done: true, scenes: s.scenes }); break; }
  const rec = {
    scene: s.scene, step: s.step, kind: s.waitKind,
    point: s.point || null,
    spot: s.spot && s.spot.visible ? s.spot.rect : null,
    overlap: s.spot && s.spot.overlapTarget,
    inView: s.spot && s.spot.rect
      ? (s.spot.rect.y > -8 && s.spot.rect.y + s.spot.rect.h < H + 8)
      : null,
    note: s.note || '',
    failed: (s.failed || []).length,
  };
  trace.push(rec);
  if (s.waitKind === 'next' && buttons.includes('tourNext')) {
    await shot('tour-scene-' + (s.scene + 1) + '.png');
    await evalIn("document.getElementById('tourNext').click()");
  } else if (s.waitKind === 'tap') {
    await evalIn("document.getElementById('foot').click()");
  } else if (s.waitKind === 'cond' || s.waitKind === 'user' || s.waitKind === 'pause') {
    console.log('  stuck:', JSON.stringify(rec));
    await evalIn("document.getElementById('tourSkip').click()");
  }
  await sleep(220);
}
await shot('tour-z-final.png');

const failedTotal = await evalIn('window.tourState().failed');
console.log('trace:');
for (const r of trace) {
  if (r.done) { console.log('  DONE scenes=' + r.scenes); continue; }
  console.log('  scene', r.scene + 1, 'step', r.step, r.kind, r.point || '(none)',
    'spot=' + (r.spot ? JSON.stringify(r.spot) : 'none'), 'overlap=' + r.overlap, 'inView=' + r.inView, r.note ? 'note=' + r.note : '');
}
console.log('failed:', JSON.stringify(failedTotal));
const outOfView = trace.filter((r) => r.spot && r.inView === false);
console.log('spotlight out of viewport:', outOfView.length);
console.log('states:', JSON.stringify(await evalIn("({sec: ZHU_APP.state().section, sel: ZHU_APP.state().selected, panel: ZHU_APP.state().panel, q: document.getElementById('q').value, theme: document.body.classList.contains('dark')})")));
ws.close();
child.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
