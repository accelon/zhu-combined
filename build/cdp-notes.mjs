// 驗：預設僧肇、注疏／別譯各五家、注文 100 字「…更多」分段展開
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/vcpp-kepan.html#u=38';
const port = 14700 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-notes-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl); if (p) return p; } catch (e) {}
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
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description); return r.result && r.result.result ? r.result.result.value : undefined; };
const click = async (sel) => { await ev(`(function(){var e=document.querySelector('${sel}'); if(!e) return false; e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true})()`); await sleep(350); };

await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url });
for (let i = 0; i < 60; i++) { await sleep(300); if (await ev("document.querySelectorAll('#reader .sent').length")) break; }
await sleep(900);

let ok = 0, bad = 0;
const check = (label, cond, extra) => { if (cond) { ok++; console.log('  ✓ ' + label + (extra ? '  ' + extra : '')); } else { bad++; console.log('  ✗ ' + label + (extra ? '  ' + extra : '')); } };

// 1. 一進來就有僧肇
const authors = await ev("[].map.call(document.querySelectorAll('#cards .note-open b'), function(b){return b.textContent}).join('、')");
const picked = await ev("[].map.call(document.querySelectorAll('#cards .notebtn.on'), function(b){return b.textContent}).join('、')");
console.log('— 預設注疏');
console.log('  已開：', JSON.stringify(authors), '｜按鈕 on：', JSON.stringify(picked));
check('沒挑過注疏時自動開僧肇', /僧肇/.test(authors) && /僧肇/.test(picked));

console.log("— 作者簡稱與時代色");
// 天親／無著只在前幾句有疏文，先回到第 1 分點第一句看
await ev("window.ZHU_APP.reset(); window.ZHU_APP.setSection(1)");
await new Promise(r => setTimeout(r, 500));
const CLICK_U = (u) => `(function(){var s=document.querySelector('#reader .sent[data-u="${u}"]'); var t=s && (s.querySelector('.kb-t')||s); if(t) t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return !!s})()`;
await ev(CLICK_U('0'));
await new Promise(r => setTimeout(r, 700));
const labels0 = await ev("(function(){var ls=[].map.call(document.querySelectorAll('#cards .notebtn'), function(b){return b.textContent+'('+(b.style.getPropertyValue('--nb-hue')||'?')+')'}).join(' '); return ls})()");
console.log("  第一句：" + labels0);
check("作者簡稱：天親", labels0.includes("天親("));
check("作者簡稱：無著", labels0.includes("無著("));
// 回到第 38 句（在分 7）
await ev("window.ZHU_APP.reset(); window.ZHU_APP.setSection(7)");
await new Promise(r => setTimeout(r, 500));
await ev(CLICK_U('38'));
await new Promise(r => setTimeout(r, 700));
const labels = await ev("[].map.call(document.querySelectorAll('#cards .notebtn'), function(b){return b.textContent + '(' + (b.style.getPropertyValue('--nb-hue')||'?') + ')'}).join(' ')");
console.log("  " + labels);
check("作者簡稱：印順（這句有）", labels.includes("印順("));
check("每個按鈕都有時代色相", !/\?\)/.test(labels));

// 2. 最多五家
console.log('— 注疏上限五家');
await ev("window.ZHU_APP.reset()");
await sleep(200);
await click('#reader .sent[data-u="38"]');
const btns = await ev("document.querySelectorAll('#cards .notebtn').length");
console.log('  這句注家數：', btns);
for (let i = 1; i <= 8; i++) {
  await ev(`(function(){var bs=document.querySelectorAll('#cards .notebtn'); var b=bs[${i}]; if(b) b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return !!b})()`);
  await sleep(150);
}
const cnt = await ev("document.querySelectorAll('#cards .note-open').length");
console.log('  開了幾家：', cnt);
check('注疏最多同時五家', cnt === 5, '實際 ' + cnt);

// 3. 別譯最多五家
console.log('— 別譯上限五家');
await ev("document.getElementById('tabs2').querySelector('[data-t=\"alt\"]').click()");
await sleep(400);
for (let i = 0; i < 9; i++) {
  await ev(`(function(){var bs=document.querySelectorAll('#cards .altbtn'); var b=bs[${i % 9}]; if(b) b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return !!b})()`);
  await sleep(130);
}
const altSel = await ev("(window.ZHU_APP && 0, [].map.call(document.querySelectorAll('#cards .altbtn.on'), function(b){return b.textContent}).join('、'))");
console.log('  別譯 on：', JSON.stringify(await ev("(function(){return window.ZHU_APP? (document.querySelectorAll('#cards .altbtn.on').length) : 0})()")), altSel);
check('別譯最多同時五家', (await ev("document.querySelectorAll('#cards .altbtn.on').length")) <= 5);

// 4. 注文 100 字「…更多」
console.log('— 長注文分段顯示');
await ev("document.getElementById('tabs2').querySelector('[data-t=\"works\"]').click()");
await sleep(400);
const info = await ev(`(function(){
  var ps = document.querySelectorAll('#cards p.ex');
  for (var i=0;i<ps.length;i++){
    var p = ps[i];
    var shown = (p.dataset.shown ? +p.dataset.shown : (p.textContent||'').length);
    if (p.dataset.full || (p.textContent||'').length > 100) {
      return JSON.stringify({i:i, shown: shown, full:(p.dataset.full||'').length, hasBtn: !!p.querySelector('.more-txt'), btnText:(p.querySelector('.more-txt')||{}).textContent||''});
    }
  }
  return 'none';
})()`);
console.log('  長注文：', info);
if (info !== 'none') {
  const o = JSON.parse(info);
  check('超過 100 字先只顯示 100 字', o.shown === 100 && o.full > 100);
  check('有「…更多」按鈕', o.hasBtn === true, o.btnText);
  await ev("(function(){var p=document.querySelector('#cards p.ex[data-full]'); var b=p&&p.querySelector('.more-txt'); if(b) b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return !!b})()");
  await sleep(300);
  const shown2 = await ev("(function(){var p=document.querySelector('#cards p.ex[data-full]'); return p? +p.dataset.shown : -1})()");
  console.log('  按一下 →', shown2);
  check('按一下多 100 字', shown2 === 200);
  // 連按到全部
  for (let k = 0; k < 40; k++) {
    const still = await ev("(function(){var p=document.querySelector('#cards p.ex[data-full]'); return !!(p&&p.querySelector('.more-txt'))})()");
    if (!still) break;
    await ev("(function(){var p=document.querySelector('#cards p.ex[data-full]'); var b=p&&p.querySelector('.more-txt'); if(b) b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return !!b})()");
    await sleep(120);
  }
  const done = await ev("(function(){var p=document.querySelector('#cards p.ex[data-full]'); return p? JSON.stringify({shown:+p.dataset.shown, full:p.dataset.full.length, btn:!!p.querySelector('.more-txt')}) : 'none'})()");
  console.log('  按到底：', done);
  const d = JSON.parse(done);
  check('按到全部就不再顯示按鈕', d.shown === d.full && d.btn === false);
}
await sleep(300);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:\\2026\\zhu-combined\\screenshots\\notes-more.png', Buffer.from(shot.result.data, 'base64'));

console.log(`\n結果：${ok} 過 / ${bad} 不過`);
child.kill();
process.exit(bad ? 1 : 0);
