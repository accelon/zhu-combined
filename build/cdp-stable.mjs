// 畫面穩定度／耗電檢查：畫面靜止時不應該有任何 DOM 變動與執行中的動畫
//   node build/cdp-stable.mjs [url] [idle秒]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/vcpp-kepan.html';
const IDLE = (process.argv[3] || 3) * 1000;
const port = 20800 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-stable-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=390,844', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl); if (p) return p; } catch (e) {}
    await sleep(200);
  }
  throw new Error('no target');
}
const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return 'ERR ' + r.result.exceptionDetails.text; return r.result && r.result.result ? r.result.result.value : undefined; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url });
for (let i = 0; i < 120; i++) { await sleep(250); if (await ev("document.querySelectorAll('#reader .sent').length")) break; }
await sleep(2000);   // 等畫面完全穩定

let ok = 0, bad = 0;
const check = (l, c, x) => { if (c) { ok++; console.log('  ✓ ' + l + (x ? '  ' + x : '')); } else { bad++; console.log('  ✗ ' + l + (x ? '  ' + x : '')); } };

// 靜止期間計數
await ev(`(function () {
  window.__cnt = { reader: 0, bar: 0, body: 0, cur: 0, frames: 0 };
  var obs = function (el, key, opts) {
    if (!el) return;
    new MutationObserver(function (ms) { window.__cnt[key] += ms.length; }).observe(el, opts);
  };
  obs(document.getElementById('reader'), 'reader', { childList: true, subtree: true, attributes: true, characterData: true });
  obs(document.getElementById('kepanBar'), 'bar', { childList: true, subtree: true, attributes: true, characterData: true });
  document.querySelectorAll('.kb-nav [data-cur]').forEach(function (c) {
    new MutationObserver(function (ms) { window.__cnt.cur += ms.length; }).observe(c, { childList: true, subtree: true, characterData: true, attributes: true });
  });
  (function loop() { window.__cnt.frames++; if (window.__cnt.frames < 100000) requestAnimationFrame(loop); })();
  return true;
})()`);
await sleep(IDLE);
const c1 = JSON.parse(await ev('JSON.stringify(window.__cnt)'));
console.log(`靜止 ${IDLE / 1000} 秒：`, JSON.stringify(c1));
check('經文區完全不動', c1.reader === 0, c1.reader + ' 次變動');
check('科判條完全不動', c1.bar === 0, c1.bar + ' 次變動');
check('分導覽 .kb-cur 完全不動', c1.cur === 0, c1.cur + ' 次變動');
const anim = await ev("document.getAnimations ? document.getAnimations().length : 0");
check('沒有殘留的動畫／transition', anim === 0, anim + ' 個');

// 選一句之後也應該很快靜下來
await ev("(function(){var s=document.querySelector('#reader .sent[data-u]'); var t=s&&(s.querySelector('.kb-t')||s); if(t) t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true})()");
await sleep(1500);
await ev("window.__cnt.reader=0; window.__cnt.bar=0; window.__cnt.cur=0");
await sleep(IDLE);
const c2 = JSON.parse(await ev('JSON.stringify(window.__cnt)'));
console.log(`選句後靜止 ${IDLE / 1000} 秒：`, JSON.stringify(c2));
check('選句後畫面也是靜止的', c2.reader === 0 && c2.bar === 0 && c2.cur === 0, JSON.stringify(c2));

// 滾動一次之後也一樣
await ev("window.scrollBy(0, 300)");
await sleep(900);
await ev("window.__cnt.reader=0; window.__cnt.bar=0; window.__cnt.cur=0");
await sleep(IDLE);
const c3 = JSON.parse(await ev('JSON.stringify(window.__cnt)'));
console.log(`滾動後靜止 ${IDLE / 1000} 秒：`, JSON.stringify(c3));
check('滾動後畫面也是靜止的', c3.reader === 0 && c3.bar === 0 && c3.cur === 0, JSON.stringify(c3));

console.log(`\n結果：${ok} 過 / ${bad} 不過`);
child.kill();
process.exit(bad ? 1 : 0);
