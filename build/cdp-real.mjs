// 用「真的滑鼠事件」（CDP Input.dispatchMouseEvent，會做命中測試）點麵包屑，
// 而不是 dispatchEvent——後者會繞過遮罩，掩蓋點不到的問題。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/vcpp-kepan.html';
const W = +(process.argv[3] || 1280);
const H = +(process.argv[4] || 900);
const port = 14400 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-real-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, `--window-size=${W},${H}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
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

await send('Page.enable'); await send('Runtime.enable');
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    console.log('!! 例外：', (d.exception && d.exception.description || d.text || '').split('\n').slice(0,3).join(' / '));
  }
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
    console.log('!! console.' + m.params.type + '：', m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0,200));
  }
});
const MOB = process.argv.includes('--mobile');
await send('Emulation.setDeviceMetricsOverride', { width: MOB ? 390 : W, height: MOB ? 844 : H, deviceScaleFactor: 1, mobile: MOB });
await send('Page.navigate', { url });
for (let i = 0; i < 60; i++) { await sleep(300); if (await ev("document.querySelectorAll('#reader .sent').length")) break; }
await sleep(900);

async function realClick(selector) {
  const box = await ev(`(function(){
    var el = document.querySelector('${selector}');
    if (!el) return 'no-el';
    var r = el.getBoundingClientRect();
    return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2), w: Math.round(r.width), h: Math.round(r.height)});
  })()`);
  if (box === 'no-el') return { ok: false, why: 'no element' };
  const p = JSON.parse(box);
  if (p.w === 0 || p.h === 0) return { ok: false, why: 'zero size' };
  const base = { x: p.x, y: p.y, button: 'left', clickCount: 1 };
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  await sleep(450);
  return { ok: true, at: [p.x, p.y] };
}

const hit = (selector) => ev(`(function(){
  var el = document.querySelector('${selector}');
  if (!el) return 'no-el';
  var r = el.getBoundingClientRect();
  var h = document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
  return h ? (h.id ? '#'+h.id : h.tagName + '.' + (h.className||'')) : 'null';
})()`);

console.log('初始條：', await ev("document.getElementById('kbTrail').innerText"));
console.log('晶片上的命中元素：', await hit('#kbTrail .kb-chip'));

// A. 未選句 → 真滑鼠點晶片
let r = await realClick('#kbTrail .kb-chip');
console.log('A 點晶片：', JSON.stringify(r), '→ menu', await ev("!document.getElementById('kepanMenu').hidden"), '項目', await ev("document.querySelectorAll('#kepanMenu .kb-item').length"));

// B. 點下拉第 3 項（真滑鼠）
if (await ev("!document.getElementById('kepanMenu').hidden")) {
  r = await realClick('#kepanMenu .kb-item:nth-child(3)');
  console.log('B 點項目：', JSON.stringify(r), '→ 條', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")));
}

// C. 選一句（真滑鼠點經文），確認面板開，再點麵包屑
console.log('— 選句後（桌面注疏開著）再點麵包屑');
await ev("window.ZHU_APP.reset()");
await sleep(300);
r = await realClick('#reader .sent[data-u]');
console.log('C 點句：', JSON.stringify(r), '→ 選', await ev("window.ZHU_APP.state().selected"), '面板', await ev("!document.getElementById('sheet').classList.contains('closed')"));
console.log('  晶片上的命中元素（面板開著時）：', await hit('#kbTrail .kb-chip'));
r = await realClick('#kbTrail .kb-chip');
console.log('D 點晶片：', JSON.stringify(r), '→ menu', await ev("!document.getElementById('kepanMenu').hidden"), '項目', await ev("document.querySelectorAll('#kepanMenu .kb-item').length"));

// M1. 手機：選句（注疏面板開）之後，麵包屑還點得到嗎
console.log('— 手機：面板開著時點麵包屑');
await ev("window.ZHU_APP.reset()");
await sleep(300);
console.log('  M0 第一句位置/命中：', await ev(`(function(){
  var e=document.querySelector('#reader .sent[data-u]'); if(!e) return 'no-sent';
  var r=e.getBoundingClientRect();
  var x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
  var h=document.elementFromPoint(x,y);
  return JSON.stringify({at:[x,y], hit: h? (h.id? '#'+h.id : h.tagName+'.'+(h.className||'')) : 'null', sel: e.className});
})()`));
r = await realClick('#reader .sent[data-u]');
console.log('M1 點句：', JSON.stringify(r), '→ 選', await ev("window.ZHU_APP.state().selected"), '面板開', await ev("!document.getElementById('sheet').classList.contains('closed')"));
console.log('  M2 晶片上的命中元素：', await hit('#kbTrail .kb-chip'));
r = await realClick('#kbTrail .kb-chip');
console.log('M3 點晶片：', JSON.stringify(r), '→ menu', await ev("!document.getElementById('kepanMenu').hidden"), '項目', await ev("document.querySelectorAll('#kepanMenu .kb-item').length"), '；面板還開著?', await ev("!document.getElementById('sheet').classList.contains('closed')"));

// F. 江味農：點「…」那格
await ev("(function(){var s=document.getElementById('kbEd'); var eds=window.ZHU_KEPAN.editions; var ix=-1; for(var i=0;i<eds.length;i++) if(eds[i].id==='jiang') ix=i; s.value=String(ix); s.dispatchEvent(new Event('change'));})()");
await sleep(600);
console.log('F 條：', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")));
console.log('  晶片：', await ev("[].map.call(document.querySelectorAll('#kbTrail .kb-chip'),function(b){return b.textContent}).join(' | ')"));
r = await realClick('#kbTrail .kb-chip.kb-more');
console.log('G 點「…」：', JSON.stringify(r), '→ menu', await ev("!document.getElementById('kepanMenu').hidden"), '項目', await ev("document.querySelectorAll('#kepanMenu .kb-item').length"));
if (await ev("!document.getElementById('kepanMenu').hidden")) {
  console.log('  項目內容：', await ev("[].map.call(document.querySelectorAll('#kepanMenu .kb-item'),function(b){return b.textContent}).join(' | ')"));
}

// E. 目錄鈕
r = await realClick('#kbTree');
console.log('E 目錄鈕：', JSON.stringify(r), '→ 面板開', await ev("!document.getElementById('kepanPanel').hidden"));
child.kill();
