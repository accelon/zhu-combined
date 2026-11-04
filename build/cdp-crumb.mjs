// 專測 breadcrumb 點擊：晶片、下拉、目錄鈕、分導覽中間
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'file:///D:/2026/zhu-combined/vcpp-kepan.html';
const port = 14100 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-crumb-'));
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
await send('Page.enable'); await send('Runtime.enable');
const MOB = process.argv.includes('--mobile');
if (MOB) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url });
for (let i = 0; i < 60; i++) { await sleep(300); if (await ev("document.querySelectorAll('#reader .sent').length")) break; }
await sleep(900);

console.log('初始條：', await ev("document.getElementById('kbTrail').innerText"));
console.log('晶片數：', await ev("document.querySelectorAll('#kbTrail .kb-chip').length"));

// 0b. 晶片有沒有被別的東西蓋住？menu 開在哪？
console.log('0 幾何：', await ev(`(function(){
  var b=document.querySelector('#kbTrail .kb-chip');
  if(!b) return 'no chip';
  var r=b.getBoundingClientRect();
  var cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  var hit=document.elementFromPoint(cx,cy);
  b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  var m=document.getElementById('kepanMenu');
  var mr=m.getBoundingClientRect();
  return JSON.stringify({chip:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
    hit: hit? (hit.id||hit.className||hit.tagName):'null', isChip: hit===b || b.contains(hit),
    menu:[Math.round(mr.left),Math.round(mr.top),Math.round(mr.width),Math.round(mr.height)], menuHidden:m.hidden});
})()`));
await sleep(200);
await ev("document.getElementById('kepanMenu').hidden=true");

// 1. 點最後一個晶片（目前那一節）：應該開同層下拉
const r1 = await ev(`(function(){
  var cs = document.querySelectorAll('#kbTrail .kb-chip');
  var b = cs[cs.length-1];
  if (!b) return 'no chip';
  b.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
  return 'clicked';
})()`);
await sleep(400);
console.log('1 點晶片：', r1, '→ menu hidden?', await ev("document.getElementById('kepanMenu').hidden"),
  '項目數', await ev("document.querySelectorAll('#kepanMenu .kb-item').length"));

// 2. 點下拉裡的第 3 項
const r2 = await ev(`(function(){
  var it = document.querySelectorAll('#kepanMenu .kb-item')[2];
  if (!it) return 'no item';
  it.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
  return 'clicked item';
})()`);
await sleep(700);
console.log('2 點項目：', r2, '→ 條', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")),
  '句子數', await ev("document.querySelectorAll('#reader .sent').length"));

// 3. 目錄鈕
await ev("document.getElementById('kbTree').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))");
await sleep(400);
console.log('3 目錄鈕 → 面板開?', await ev("!document.getElementById('kepanPanel').hidden"));
await ev("document.getElementById('kbPanelX').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))");
await sleep(200);

// 4. 分導覽中間
await ev("document.querySelector('#kbNav [data-cur]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))");
await sleep(400);
console.log('4 分導覽中間 → 面板開?', await ev("!document.getElementById('kepanPanel').hidden"));

// 5. 目錄列點一個節點
if (await ev("!document.getElementById('kepanPanel').hidden")) {
  const r5 = await ev(`(function(){
    var rows = document.querySelectorAll('#kepanPanel .kb-node');
    if (!rows.length) return 'no rows';
    rows[Math.min(6, rows.length-1)].dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
    return rows.length + ' rows';
  })()`);
  await sleep(700);
  console.log('5 目錄列：', r5, '→ 條', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")));
}
// 6. 先選一句（開注疏），再點麵包屑
console.log('— 選句後再點麵包屑');
await ev("window.ZHU_APP.reset()");
await sleep(300);
await ev(`(function(){var e=document.querySelector('#reader .sent[data-u]'); var t=e.querySelector('.kb-t')||e; t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true})()`);
await sleep(500);
console.log('  選句：', await ev("window.ZHU_APP.state().selected"), '面板', await ev("!document.getElementById('sheet').classList.contains('closed')"));
const r6 = await ev(`(function(){var cs=document.querySelectorAll('#kbTrail .kb-chip'); var b=cs[cs.length-1]; if(!b) return 'no chip'; b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 'clicked'})()`);
await sleep(400);
console.log('6 點晶片：', r6, '→ menu hidden?', await ev("document.getElementById('kepanMenu').hidden"), '項目', await ev("document.querySelectorAll('#kepanMenu .kb-item').length"));
const r7 = await ev(`(function(){var it=document.querySelectorAll('#kepanMenu .kb-item')[4]; if(!it) return 'no item'; it.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 'ok'})()`);
await sleep(700);
console.log('7 點項目：', r7, '→ 條', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")), '句子', await ev("document.querySelectorAll('#reader .sent').length"), '選句', await ev("window.ZHU_APP.state().selected"));

// 8. 換到江味農：多層麵包屑，點祖先
await ev("(function(){var s=document.getElementById('kbEd'); var eds=window.ZHU_KEPAN.editions; var ix=-1; for(var i=0;i<eds.length;i++) if(eds[i].id==='jiang') ix=i; s.value=String(ix); s.dispatchEvent(new Event('change'));})()");
await sleep(600);
console.log('8 江味農條：', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")), '晶片', await ev("document.querySelectorAll('#kbTrail .kb-chip').length"));
const r9 = await ev(`(function(){var cs=document.querySelectorAll('#kbTrail .kb-chip'); if(cs.length<2) return 'too few'; cs[1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 'clicked 2nd'})()`);
await sleep(400);
console.log('9 點第 2 個晶片：', r9, '→ menu hidden?', await ev("document.getElementById('kepanMenu').hidden"), '項目', await ev("document.querySelectorAll('#kepanMenu .kb-item').length"));
// 10. 江味農：逐個晶片都點一次，看有沒有反應
console.log('— 逐個晶片（江味農）');
const nChips = await ev("document.querySelectorAll('#kbTrail .kb-chip').length");
for (let i = 0; i < nChips; i++) {
  await ev("document.getElementById('kepanMenu').hidden = true; window.ZHU_APP.reset()");
  await sleep(200);
  const before = await ev("document.getElementById('kbTrail').innerText + '|' + (window.ZHU_APP.state().section)");
  const r = await ev("(function(){var cs=document.querySelectorAll('#kbTrail .kb-chip'); var b=cs[" + i + "]; if(!b) return 'none'; b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return b.textContent})()");
  await sleep(350);
  const menuOpen = await ev("!document.getElementById('kepanMenu').hidden");
  const items = await ev("document.querySelectorAll('#kepanMenu .kb-item').length");
  const after = await ev("document.getElementById('kbTrail').innerText + '|' + (window.ZHU_APP.state().section)");
  console.log('  晶片 ' + i + ' 「' + r + '」 → 下拉 ' + menuOpen + '（' + items + ' 項）' + (menuOpen ? '' : '；條/分 ' + (before === after ? '沒變' : before + ' → ' + after)));
  if (menuOpen) {
    // 點第一項，確認跳得動
    await ev("(function(){var it=document.querySelectorAll('#kepanMenu .kb-item')[0]; if(it) it.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true})()");
    await sleep(400);
    const sec2 = await ev("window.ZHU_APP.state().section");
    console.log('      點第 1 項 → 分 ' + sec2 + '、句子 ' + (await ev("document.querySelectorAll('#reader .sent').length")));
  }
}
// 11. 科判關掉之後，麵包屑還要能點
console.log('— 科判關掉後點麵包屑');
await ev("(function(){ if(!document.body.classList.contains('kb-plain')) document.getElementById('kbToggle').click(); return true})()");
await sleep(400);
console.log('  現在 plain？', await ev("document.body.classList.contains('kb-plain')"), '；條', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")));
const r11 = await ev("(function(){var cs=document.querySelectorAll('#kbTrail .kb-chip'); var b=cs[cs.length-1]; if(!b) return 'none'; b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 'clicked'})()");
await sleep(400);
console.log('  點晶片：', r11, '→ 下拉', await ev("!document.getElementById('kepanMenu').hidden"), '項目', await ev("document.querySelectorAll('#kepanMenu .kb-item').length"));
const before11 = await ev("window.ZHU_APP.state().section");
await ev("(function(){var it=document.querySelectorAll('#kepanMenu .kb-item')[2]; if(it) it.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true})()");
await sleep(600);
console.log('  點項目 → 分', before11, '→', await ev("window.ZHU_APP.state().section"), '；選句', await ev("window.ZHU_APP.state().selected"), '；條', JSON.stringify(await ev("document.getElementById('kbTrail').innerText")));
child.kill();
