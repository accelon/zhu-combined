// 驗 vcpp-kepan.html：科文條／目錄／字元級標記／聯動，並截圖。
//   node build/cdp-kepan.mjs [url] [outdir]
// 會依序做：
//   1. 載入、等經文
//   2. 檢查 #kepanBar、ZHU_KEPAN、科文條內容
//   3. 點第一句 → 條要跟著變（反查科文）
//   4. ZHU_KEPAN.go(深層節點) → 選到該節起點的句子、條更新、經文出現 kb-mark
//   5. 開目錄浮層 → 截圖
//   6. 切到印順 → 條與標記重畫
//   7. 手機尺寸再看一次
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const args = process.argv.slice(2);
const url = args[0] || 'file:///D:/2026/zhu-combined/vcpp-kepan.html';
const OUT = args[1] || 'D:\\2026\\zhu-combined\\screenshots';
fs.mkdirSync(OUT, { recursive: true });

const port = 12600 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-kepan-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: ['ignore','ignore','pipe'] });
child.stderr.on('data', (d) => { const t = String(d).trim(); if (t) console.log('  [edge] ' + t.slice(0, 160)); });

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
const raweval = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (r.result && r.result.exceptionDetails) {
    throw new Error('eval error: ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text));
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
  console.log('  截圖', name);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });

let ok = 0, bad = 0;
const check = (label, cond, extra) => {
  if (cond) { ok++; console.log('  ✓ ' + label + (extra ? '  ' + extra : '')); }
  else { bad++; console.log('  ✗ ' + label + (extra ? '  ' + extra : '')); }
};

// 1. 等資料
for (let i = 0; i < 80; i++) {
  await sleep(300);
  const n = await raweval("document.querySelectorAll('#reader .sent').length");
  if (n > 0) break;
}
await sleep(400);
console.log('— 載入');
check('經文已渲染', (await raweval("document.querySelectorAll('#reader .sent').length")) > 0);
check('科文資料已載入', await raweval("!!window.KEPAN && window.KEPAN.editions.length"));
check('科文條存在', await raweval("!!document.getElementById('kepanBar')"));
check('科文 API 存在', await raweval("!!window.ZHU_KEPAN"));

const bar0 = await raweval("document.getElementById('kbTrail').innerText");
console.log('  條：', JSON.stringify(bar0));
check('條上有路徑或提示', !!bar0 && bar0.length > 0);
const edCount = await raweval("document.getElementById('kbEd').options.length");
const edNow = await raweval("document.getElementById('kbEd').selectedOptions[0].textContent");
const flatMarks = await raweval("document.querySelectorAll('#reader .kb-mark').length");
console.log('  家：', edCount, edNow, '（單層科判不插標記：' + flatMarks + '）');
check('家選單有四家（昭明、江味農、印順、宗密科會）', edCount === 4);
check('預設是昭明', edNow === '昭明');
check('昭明是單層：經文不插科文標記', flatMarks === 0);
check('昭明也有深度字色（整分一色）', (await raweval("document.querySelectorAll('#reader .kb-t').length")) > 0);

// 2. 點一句 → 反查科文
console.log('— 從經文反查科文');
const before = await raweval("document.getElementById('kbTrail').innerText");
await raweval(`(function(){
  var e = document.querySelectorAll('#reader .sent[data-u]')[3];
  if (!e) return false;
  var t = e.querySelector('.kb-t') || e;
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
})()`);
await sleep(500);
const after = await raweval("document.getElementById('kbTrail').innerText");
const selAfter = await raweval("document.querySelectorAll('#reader .sent.sel').length");
const fanAfter = await raweval("(function(){var f=document.querySelector('#reader .ifan'); return f? getComputedStyle(f).display : 'none';})()");
const sheetAfter = await raweval("!document.getElementById('sheet').classList.contains('closed')");
const cardsAfter = await raweval("document.querySelectorAll('#cards .notebtn').length");
console.log('  點句後：', JSON.stringify(after), '選句', selAfter, '面板', sheetAfter, '注家', cardsAfter, '梵文顯示', fanAfter);
check('點句後條有更新', after !== before || (after || '').length > 0);
check('科判模式點句會開注疏／別譯', selAfter === 1 && sheetAfter === true && cardsAfter > 0);
check('科判模式不展開梵藏（display:none）', fanAfter === 'none');
await raweval(`(function(){
  var e = document.querySelector('#reader .sent.sel');
  if (!e) return false;
  var t = e.querySelector('.kb-t') || e;
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
})()`);
await sleep(400);
const stillOpen = await raweval("!document.getElementById('sheet').classList.contains('closed')");
const stillSel = await raweval("document.querySelectorAll('#reader .sent.sel').length");
check('再點同一句，注疏仍開著', stillOpen === true && stillSel === 1);
// 點 .badge 也要能看注疏
await raweval("(function(){var b=document.querySelector('#reader .sent[data-u] sup.badge'); if(b) b.click(); return !!b})()");
await sleep(500);
const sheetBadge = await raweval("!document.getElementById('sheet').classList.contains('closed')");
const tabBadge = await raweval("(document.querySelector('#tabs2 button.on')||{}).dataset ? document.querySelector('#tabs2 button.on').dataset.t : ''");
console.log('  點 badge：面板', sheetBadge, '分頁', tabBadge);
check('點 .badge 顯示注疏（注疏分頁）', sheetBadge === true && tabBadge === 'works');

// 3. 跳到一個深層節點（江味農 癸四 更明所以）
console.log('— 換到江味農，再從科文跳經文');
await raweval("(function(){var s=document.getElementById('kbEd'); var eds=window.ZHU_KEPAN.editions; var ix=-1; for(var i=0;i<eds.length;i++) if(eds[i].id==='jiang') ix=i; s.value=String(ix); s.dispatchEvent(new Event('change'));})()");
await sleep(400);
const tgt = await raweval(`(function(){
  var eds = window.ZHU_KEPAN.editions;
  var j = eds.filter(function(e){ return e.id === 'jiang'; })[0], pick = null;
  j.nodes.forEach(function(n){ if(!n.nk && n.lv>=9 && (!pick || n.lv>pick.lv)) pick = n; });
  return pick ? JSON.stringify({id:pick.id,lv:pick.lv,lab:pick.lab,nm:pick.nm,u:pick.u,off:pick.off}) : 'null';
})()`);
console.log('  目標節點：', tgt);
const tn = JSON.parse(tgt);
await raweval(`window.ZHU_KEPAN.go(${tn.id})`);
await sleep(600);
const sel = await raweval("(window.ZHU_APP&&window.ZHU_APP.state().selected)");
const inView = await raweval(`(function(){var e=document.querySelector('#reader .sent[data-u="${tn.u}"]'); if(!e) return 'no-el'; var r=e.getBoundingClientRect(); return (r.top>=0 && r.top<window.innerHeight) ? 'yes' : 'no:'+Math.round(r.top);})()`);
console.log('  選到的句：', sel, '（科文開時不選句）', '；目標句在視窗內：', inView);
check('科文開時跳轉不選句', sel === null || sel === undefined);
check('目標句被帶到眼前', inView === 'yes');
const bar1 = await raweval("document.getElementById('kbTrail').innerText");
console.log('  條：', JSON.stringify(bar1));
check('條顯示該節名字', (bar1 || '').indexOf((tn.nm || '').slice(0, 2)) >= 0);
const marks = await raweval("document.querySelectorAll('#reader .kb-mark').length");
const hls = await raweval("document.querySelectorAll('#reader .kb-t').length");
console.log('  標記數：', marks, '高亮段：', hls);
check('經文出現科文標記', marks > 0);
check('目前這一節有深度字色', hls > 0);
check('只有目前這一節有字背景', (await raweval("document.querySelectorAll('#reader .kb-t.cur').length")) > 0);
await shot('kepan-1-jump.png');

// 3a. 分導覽在標題列（不會被經文捲走）
console.log('— 分導覽搬到標題列');
const navInHeader = await raweval("document.querySelectorAll('#top #kbNav .kb-step').length");
const navInReader = await raweval("(function(){var n=document.querySelector('#reader .chapter-nav'); return n? getComputedStyle(n).display : 'none';})()");
const navText = await raweval("(function(){var c=document.querySelector('#kbNav [data-cur]'); return c? c.innerText : ''})()");
const selHidden = await raweval("(function(){var s=document.getElementById('sec-select'); return s? getComputedStyle(s).display : 'none'})()");
console.log('  標題列分導覽按鈕：', navInHeader, '；經文裡剩：', navInReader, '；中間：', JSON.stringify(navText), '；下拉：', selHidden);
check('分導覽在標題列、經文裡那條已收起', navInReader === 'none' && navInHeader === 2 && !!navText);
check('分章不再用下拉（sec-select 隱藏）', selHidden === 'none');
const secBefore = await raweval("window.ZHU_APP.state().section");
await raweval("(function(){var b=document.querySelector('#kbNav [data-step=\"1\"]'); if(b && !b.disabled) b.click(); return true})()");
await sleep(600);
const secAfter = await raweval("window.ZHU_APP.state().section");
const navInReader2 = await raweval("(function(){var n=document.querySelector('#reader .chapter-nav'); return n? getComputedStyle(n).display : 'none';})()");
console.log('  按下一分：', secBefore, '→', secAfter, '；經文裡的分導覽：', navInReader2);
check('標題列的下一分可用', secAfter === secBefore + 1);
check('換分後分導覽仍在標題列（經文裡那條仍收起）', navInReader2 === 'none');
await raweval("window.ZHU_APP.setSection(1)");
await sleep(400);
// 中間那格＝開科判目錄（不用下拉也能跳到別的分）
await raweval("document.querySelector('#kbNav [data-cur]').click()");
await sleep(400);
check('點中間那格會開科判目錄', (await raweval("!document.getElementById('kepanPanel').hidden")) === true);
// 章末那一份
const bNav = await raweval("(function(){var b=document.getElementById('kbNavBottom'); if(!b) return 'none'; var s=document.querySelector('#reader .sec'); return JSON.stringify({inReader: !!b.closest('#reader'), afterSec: s && s.nextSibling === b, cur: (b.querySelector('[data-cur]')||{}).innerText, steps: b.querySelectorAll('[data-step]').length});})()");
console.log('  章末分導覽：', bNav);
const bObj = JSON.parse(bNav);
check('每章經文末尾也有分導覽（中間顯示昭明分章）', bObj.inReader && bObj.afterSec && bObj.steps === 2 && /法會因由/.test(bObj.cur || ''));
await raweval("document.getElementById('kbPanelX').click()");
await sleep(200);

// 3b. 點科文標記 → 聯動 breadcrumb
console.log('— 點科文標記：聯動 breadcrumb');
await raweval("window.ZHU_APP.setSection(1)");
await sleep(400);
const barBefore = await raweval("document.getElementById('kbTrail').innerText");
const clicked = await raweval("(function(){var m=document.querySelector('#reader .kb-mark'); if(!m) return false; m.click(); return true})()");
await sleep(500);
const barAfter = await raweval("document.getElementById('kbTrail').innerText");
console.log('  條：', JSON.stringify(barBefore), '→', JSON.stringify(barAfter));
check('點科文標記會聯動條', clicked === true && barAfter === barBefore);
await shot('kepan-12-notes.png');

// 4. 目錄浮層
console.log('— 目錄浮層');
await raweval("document.getElementById('kbTree').click()");
await sleep(400);
check('浮層開啟', await raweval("!document.getElementById('kepanPanel').hidden"));
const rows = await raweval("document.querySelectorAll('#kepanPanel .kb-node').length");
console.log('  節點列：', rows);
check('浮層有節點列', rows > 50);
await shot('kepan-2-tree.png');
await raweval("document.getElementById('kbPanelX').click()");
await sleep(200);

// 5. 切到印順
console.log('— 切到印順');
await raweval("(function(){var s=document.getElementById('kbEd'); var eds=window.ZHU_KEPAN.editions; var ix=-1; for(var i=0;i<eds.length;i++) if(eds[i].id==='yinshun') ix=i; s.value=String(ix); s.dispatchEvent(new Event('change'));})()");
await sleep(500);
const bar2 = await raweval("document.getElementById('kbTrail').innerText");
console.log('  條：', JSON.stringify(bar2));
check('換家後條有內容', !!bar2);
const marks2 = await raweval("document.querySelectorAll('#reader .kb-mark').length");
console.log('  標記數：', marks2);
check('換家後標記重畫', marks2 > 0);
await shot('kepan-3-yinshun.png');

// 5a. 科文總開關
console.log('— 科文開關（kb-tag toggle）');
const onMarks = await raweval("document.querySelectorAll('#reader .kb-mark').length");
const swEvents = await raweval("(function(){var w=document.querySelector('#reader .ifan .sw'); return w? getComputedStyle(w).pointerEvents : 'none'})()");
check('科文開時經文有標記', onMarks > 0);
check('科文開時梵文詞不可點', swEvents === 'none', 'pointer-events=' + swEvents);
await raweval("document.getElementById('kbToggle').click()");
await sleep(400);
const offMarks = await raweval("document.querySelectorAll('#reader .kb-mark').length");
const offHl = await raweval("document.querySelectorAll('#reader .kb-t').length");
const swEvents2 = await raweval("(function(){var w=document.querySelector('#reader .ifan .sw'); return w? getComputedStyle(w).pointerEvents : 'auto'})()");
const barStill = await raweval("!!document.getElementById('kbTrail').innerText");
check('科文關時標記與深度字色都不見', offMarks === 0 && offHl === 0, 'marks=' + offMarks + ' t=' + offHl);
check('科文關時梵文詞可點', swEvents2 !== 'none', 'pointer-events=' + swEvents2);
check('科文關時麵包屑仍在', barStill === true && (await raweval("document.body.classList.contains('kb-plain')")));
await shot('kepan-9-plain.png');
await raweval("document.getElementById('kbToggle').click()");
await sleep(400);
check('再打開標記回來', (await raweval("document.querySelectorAll('#reader .kb-mark').length")) > 0);

// 5b. 科文關 → 梵文回來（可選句、可 hover）；再打開科文要把選句收掉
console.log('— 科文關：梵文閱讀模式');
await raweval("document.getElementById('kbToggle').click()");   // 關
await sleep(300);
await raweval(`(function(){
  if (window.ZHU_APP.state().section !== 7) window.ZHU_APP.setSection(7);
  var e = document.querySelector('#reader .sent[data-u="38"]');
  if (e) e.click();
  return !!e;
})()`);
await sleep(500);
const selWord = await raweval("document.querySelectorAll('#reader .sent.sel').length");
const hasWord = await raweval("document.querySelectorAll('#reader .ifan .sw').length");
console.log('  選句', selWord, '梵文詞數：', hasWord);
check('科文關時點句會選句並長出梵文', selWord === 1 && hasWord > 0);
if (hasWord > 0) {
  let gl = 0;
  for (let i = 0; i < hasWord && !gl; i++) {
    await raweval("(function(){var w=document.querySelectorAll('#reader .ifan .sw')[" + i + "]; if(w) w.dispatchEvent(new PointerEvent('pointerover',{bubbles:true})); return !!w})()");
    await sleep(250);
    gl = await raweval("document.querySelectorAll('#reader .sent mark.gl').length");
  }
  console.log('  mark.gl：', gl);
  check('科文關時 hover 梵文詞照常高亮', gl > 0);
  await shot('kepan-6-hover.png');
}
// 再打開科文：選句要被收掉（不會留一段點不動的梵文）
await raweval("document.getElementById('kbToggle').click()");
await sleep(500);
const selAfterOn = await raweval("document.querySelectorAll('#reader .sent.sel').length");
const fanAfterOn = await raweval("document.querySelectorAll('#reader .ifan').length");
console.log('  打開科文後 選句', selAfterOn, '梵文', fanAfterOn);
check('打開科文會收掉選句與梵文', selAfterOn === 0 && fanAfterOn === 0);

// 5c. 操作導覽還能開
console.log('— 操作導覽');
await raweval("document.getElementById('tourEntry').click()");
await sleep(700);
const tb = await raweval("(!document.getElementById('tourBubble').hidden) || (!document.getElementById('tourBox').hidden)");
check('導覽選單打得開', tb === true);
await raweval("(function(){var b=document.getElementById('tourClose'); if(b) b.click();})()");
await sleep(200);

// 6. 手機
console.log('— 手機 390×844');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.reload', { ignoreCache: false });
for (let i = 0; i < 60; i++) {
  await sleep(300);
  if (await raweval("document.querySelectorAll('#reader .sent').length")) break;
}
await sleep(600);
check('手機也載入科文條', await raweval("!!document.getElementById('kepanBar')"));
const box = await raweval("JSON.stringify(document.getElementById('kepanBar').getBoundingClientRect())");
console.log('  條位置：', box);
// 麵包屑現在允許換行（整條路徑全部列出），所以不看高度，改看「有沒有橫向溢出」
const noOverflow = await raweval("(function(){var b=document.getElementById('kepanBar');return b.scrollWidth <= b.clientWidth + 2 && document.documentElement.scrollWidth <= window.innerWidth + 2})()");
check('手機條不橫向溢出', noOverflow === true, '高 ' + Math.round(JSON.parse(box).height) + 'px');
check('麵包屑全部列出（沒有「…」摺疊）', (await raweval("document.querySelectorAll('#kbTrail .kb-more').length")) === 0);
await shot('kepan-4-mobile.png');
await raweval("document.getElementById('kbTree').click()");
await sleep(500);
const mRows = await raweval("document.querySelectorAll('#kepanPanel .kb-node').length");
const mFont = await raweval("(function(){var n=document.querySelector('#kepanPanel .kb-node'); return n? getComputedStyle(n).fontSize : ''})()");
console.log('  手機目錄列：', mRows, '字級', mFont);
check('手機目錄可用（字級 ≥ 15px）', mRows > 50 && parseFloat(mFont) >= 15);
await shot('kepan-11-mobile-tree.png');
await raweval("document.getElementById('kbPanelX').click()");
await sleep(300);
await raweval("window.ZHU_KEPAN.go(" + tn.id + ")");
await sleep(600);
await shot('kepan-5-mobile-jump.png');

// 7. 深連結
console.log('— 深連結 ?kepan=jiang&k=283');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: url.split('?')[0] + '?kepan=jiang&k=283' });
for (let i = 0; i < 60; i++) { await sleep(300); if (await raweval("document.querySelectorAll('#reader .sent').length")) break; }
await sleep(800);
const dlSel = await raweval("(window.ZHU_APP&&window.ZHU_APP.state().selected)");
const dlBar = await raweval("document.getElementById('kbTrail').innerText");
const dlView = await raweval("(function(){var e=document.querySelector('#reader .sent[data-u=\"166\"]'); if(!e) return 'no-el'; var r=e.getBoundingClientRect(); return (r.top>=0 && r.top<window.innerHeight) ? 'yes' : 'no';})()");
console.log('  選到：', dlSel, ' 條：', JSON.stringify(dlBar), ' 在視窗內：', dlView);
check('深連結直接跳到該節（科文開，不選句）', dlSel == null && /示說法無念/.test(dlBar || '') && dlView === 'yes');
await shot('kepan-7-deeplink.png');

// 8. ?kepan=off
console.log('— ?kepan=off');
await send('Page.navigate', { url: url.split('?')[0] + '?kepan=off' });
for (let i = 0; i < 60; i++) { await sleep(300); if (await raweval("document.querySelectorAll('#reader .sent').length")) break; }
await sleep(500);
check('kepan=off 時沒有科文條', (await raweval("!!document.getElementById('kepanBar')")) === false);
const offSel = await raweval("(function(){var s=document.getElementById('sec-select'); return s? getComputedStyle(s).display : 'none'})()");
const offNav = await raweval("(function(){var n=document.querySelector('#reader .chapter-nav'); return n? getComputedStyle(n).display : 'none'})()");
console.log('  kepan=off 時分下拉：', offSel, '；經文分導覽：', offNav);
check('kepan=off 時分下拉與分導覽都回來', offSel !== 'none' && offNav !== 'none');
check('kepan=off 時經文照常', (await raweval("document.querySelectorAll('#reader .sent').length")) > 0);

console.log(`\n結果：${ok} 過 / ${bad} 不過`);
child.kill();
process.exit(bad ? 1 : 0);
