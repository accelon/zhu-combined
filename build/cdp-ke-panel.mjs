// 驗收：右欄「科判」分頁——節點跳句、清單分批、換家重繪、連點不卡死。
// 這一路徑之前沒有任何驗收覆蓋，所以「2,282 筆全渲染＋每次選句重繪整塊」拖死瀏覽器的事沒被擋下。
//
//   node build/cdp-ke-panel.mjs <file:// 或 https:// 頁面> [...]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const pages = process.argv.slice(2).filter((x) => /^(file|https?):/.test(x));
if (!pages.length) { console.error('用法：node build/cdp-ke-panel.mjs <頁面 URL> [...]'); process.exit(2); }

const port = 11960 + Math.floor(Math.random() * 60);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-kepanel-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1440,1000', '--no-first-run',
  '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 160; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const p = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('no devtools target');
}
const results = [];
let pass = 0, fail = 0;
function check(name, ok, got, want) {
  results.push({ name, ok: !!ok, got, want });
  if (ok) pass++; else fail++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : `（得到 ${JSON.stringify(got)}，預期 ${JSON.stringify(want)}）`));
}
function info(m) { console.log('  · ' + m); results.push({ info: m }); }

const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
async function ev(expr, ms) {
  const LIMIT = ms || 25000;
  const r = await Promise.race([
    send('Runtime.evaluate', { expression: `Promise.resolve().then(function(){ return (${expr}); })`, returnByValue: true, awaitPromise: true }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate 逾時 ' + LIMIT + 'ms')), LIMIT)),
  ]);
  const d = r.result && r.result.exceptionDetails;
  if (d) throw new Error((d.exception && d.exception.description) || d.text);
  const v = r.result?.result?.value;
  return typeof v === 'string' ? JSON.parse(v) : v;
}
async function goto(url, tag) {
  const t0 = Date.now();
  console.log('\n[' + tag + '] ' + url.replace(/^file:\/\/\/[^?#]*/, '…'));
  await send('Page.navigate', { url });
  for (let i = 0; i < 180; i++) {
    let ready = false;
    try { ready = await ev(`!!(window.ZHU_APP && window.ZHU_APP.state().ready)`, 8000); } catch (e) { ready = false; }
    if (ready) { console.log('    就緒 ' + Math.round((Date.now() - t0) / 1000) + 's'); break; }
    await sleep(400);
    if (i === 90) console.log('    …仍在等就緒');
  }
  await sleep(1500);
}
const wait = (ms) => `new Promise(function(r){setTimeout(r,${ms});})`;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: 'window.__errs=[];addEventListener("error",function(e){window.__errs.push(String(e.message))});' +
    'window.__lt=[];try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__lt.push(Math.round(e.duration));});}).observe({entryTypes:["longtask"]});}catch(e){}',
});

for (const base of pages) {
  console.log('\n============ ' + base.split('/').pop().slice(0, 46) + ' ============');
  await goto(base, '載入');

  // ---- 1. 先選一句（科判分頁要有選句才畫得出來），再開分頁
  const open = await ev(`(async function(){
    var ke = document.querySelector('#tabs2 button[data-t="ke"]'); var kb = document.getElementById('keBtn'); var hasTab = !!(ke || (kb && !kb.hidden));
    if (!hasTab) return JSON.stringify({ noTab: true, hasTab: false });
    window.ZHU_APP.selectUnit(46);
    await ${wait(900)};
    var b = document.querySelector('#tabs2 button[data-t="ke"]') || document.getElementById('keBtn');
    if (b) b.click();
    await ${wait(2500)};
    var det = document.querySelector('#cards .ke-nodes');
    return JSON.stringify({
      hasTab: true,
      selected: window.ZHU_APP.state().selected,
      tab: window.ZHU_APP.state().tab,
      hasSel: !!document.getElementById('keSel'),
      keNodeBtns: document.querySelectorAll('.ke-node').length,
      dom: document.getElementsByTagName('*').length,
      cardsKB: Math.round(String((document.getElementById('cards')||{}).innerHTML||'').length/1024),
      total: det ? Number((det.querySelector('summary')||{}).textContent.replace(/[^0-9]/g,'')) : null,
      errs: (window.__errs||[]).slice(0,3),
    });
  })()`);
  if (open.noTab) {
    info('這一頁沒有「科判」分頁（資料裡沒有 D.ke）。' +
      '楞嚴在 2026-11-12 作者決定取消這一分頁（改由上方科文條提供），金剛經本來就走 kepan 層——' +
      '整組檢查跳過；若哪天重新啟用 D.ke，這 11 項會自動開始跑');
    continue;
  }
  check('科判分頁有內容', open.hasSel === true && open.cardsKB > 20, JSON.stringify({ hasSel: open.hasSel, cardsKB: open.cardsKB }), '有 keSel 與內容');
  if (open.total != null) {
    check('清單收合時不渲染全部 ' + open.total + ' 筆', open.keNodeBtns === 0,
      JSON.stringify({ keNodeBtns: open.keNodeBtns, dom: open.dom }), '0 筆');
  } else info('這一頁沒有「科文節點」清單（沒有 keNodes），跳過分批檢查');

  // ---- 2. 展開：只進一批，且有「載入更多」
  if (open.total != null) {
    const expand = await ev(`(async function(){
      var sum = document.querySelector('#cards .ke-nodes summary');
      sum.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await ${wait(1200)};
      var list = document.querySelector('.ke-node-list');
      return JSON.stringify({
        shown: Number(list.dataset.shown || 0),
        btns: document.querySelectorAll('.ke-node').length,
        more: (document.querySelector('.ke-node-more')||{}).textContent || null,
        dom: document.getElementsByTagName('*').length,
      });
    })()`);
    check('展開只渲染第一批（≤400＋載入更多）', expand.btns > 0 && expand.btns <= 401 && !!expand.more,
      JSON.stringify({ btns: expand.btns, more: expand.more }), '400 筆＋載入更多');
    const more = await ev(`(async function(){
      var before = document.querySelectorAll('.ke-node').length;
      document.querySelector('.ke-node-more').click();
      await ${wait(900)};
      var after = document.querySelectorAll('.ke-node').length;
      return JSON.stringify({ before: before, after: after, more: (document.querySelector('.ke-node-more')||{}).textContent||null });
    })()`);
    check('「載入更多」補下一批', more.after === more.before + 400 || (more.after === open.total && !more.more),
      JSON.stringify({ before: more.before, after: more.after, total: open.total }), '多 400 筆或到底');
  }

  // ---- 3. 點節點：要跳到那一句、要選起來、而且要「看得見有跳」（同 u 重複時原本完全無感）
  const jump = await ev(`(async function(){
    var n = document.querySelectorAll('.ke-node')[3] || document.querySelector('.ke-node');
    if (!n) return JSON.stringify({ skip: true });
    var u = Number(n.dataset.u);
    n.click(); await ${wait(1400)};
    var st = window.ZHU_APP.state();
    var sel = document.querySelector('#reader .sent.sel');
    var el = document.querySelector('#reader .sent[data-u="' + u + '"]');
    var r = el ? el.getBoundingClientRect() : null;
    return JSON.stringify({ want: u, got: st.selected, selU: sel && Number(sel.dataset.u),
      flashed: el ? el.classList.contains('flash') : null,
      inView: r ? (r.top >= -60 && r.top < window.innerHeight) : null,
      top: r ? Math.round(r.top) : null });
  })()`);
  if (!jump.skip) {
    check('點科文節點 → 選到那一句', jump.got === jump.want && jump.selU === jump.want,
      JSON.stringify({ want: jump.want, selected: jump.got, selU: jump.selU }), jump.want);
    check('點科文節點 → 目標句捲進視窗並閃一下', jump.inView === true && jump.flashed === true,
      JSON.stringify({ inView: jump.inView, flashed: jump.flashed, top: jump.top }), '在視窗內＋flash');
  }

  // ---- 4. 連點 12 次：長任務總量要守住（這是最初拖死瀏覽器的手法）
  const burst = await ev(`(async function(){
    window.__lt.length = 0;
    var t0 = performance.now();
    var n0 = document.querySelectorAll('.ke-node').length;
    var done = 0;
    for (var k = 0; k < 12; k++) {
      var nodes = document.querySelectorAll('.ke-node');
      var n = nodes[(k * 53) % Math.max(1, nodes.length)];
      if (!n) continue;
      n.click(); done++;
      await ${wait(70)};
    }
    await ${wait(3500)};
    var total = window.__lt.reduce(function (a, x) { return a + x; }, 0);
    return JSON.stringify({ clicked: done, wallMs: Math.round(performance.now() - t0),
      longTotal: total, longN: window.__lt.length, worst: window.__lt.length ? Math.max.apply(null, window.__lt) : 0,
      dom: document.getElementsByTagName('*').length, heapMB: Math.round(((performance.memory||{}).usedJSHeapSize||0)/1048576),
      errs: (window.__errs||[]).slice(0,3) });
  })()`);
  check('連點 12 次不被長任務拖死（合計 ≤ 1,200ms）', burst.longTotal <= 1200,
    JSON.stringify({ clicked: burst.clicked, longTotal: burst.longTotal, longN: burst.longN, worst: burst.worst }), '≤1200ms');
  info('連點這一段：牆鐘 ' + burst.wallMs + 'ms、長任務 ' + burst.longN + ' 次合計 ' + burst.longTotal +
    'ms（最單次 ' + burst.worst + 'ms）、DOM ' + burst.dom + '、heap ' + burst.heapMB + 'MB');

  // ---- 5. 換家要重繪、切走再回來不用重建
  const fam = await ev(`(async function(){
    var sel = document.getElementById('keSel'); if (!sel) return JSON.stringify({ skip: true });
    var i = sel.selectedIndex;
    sel.selectedIndex = (i + 1) % sel.options.length; sel.dispatchEvent(new Event('change'));
    await ${wait(1800)};
    var after1 = { kb: sel.value, dom: document.getElementsByTagName('*').length };
    // 切到注疏再切回來：同一家不該重建（重建就會又冒長任務）
    document.querySelector('#tabs2 button[data-t="works"]').click(); await ${wait(700)};
    window.__lt.length = 0;
    document.querySelector('#tabs2 button[data-t="ke"]').click(); await ${wait(1500)};
    var ltBack = window.__lt.reduce(function (a, x) { return a + x; }, 0);
    return JSON.stringify({ after1: after1, ltBack: ltBack, dom: document.getElementsByTagName('*').length,
      errs: (window.__errs||[]).slice(0,3) });
  })()`);
  if (!fam.skip) {
    check('切走再回科判分頁不重建面板（長任務 ≤ 300ms）', fam.ltBack <= 300, JSON.stringify({ ltBack: fam.ltBack }), '≤300ms');
    check('這一輪沒有 console 錯誤', !fam.errs.length, fam.errs, '[]');
  }

  // ---- 6. 分節按鈕（ke-jump）仍能換分
  const kj = await ev(`(async function(){
    var b = document.querySelectorAll('.ke-jump')[2] || document.querySelector('.ke-jump');
    if (!b) return JSON.stringify({ skip: true });
    var sec = Number(b.dataset.sec);
    b.click(); await ${wait(1200)};
    var st = window.ZHU_APP.state();
    // 重新取（面板可能已重繪，舊參照是被摘下的節點，classList 當然是舊的）
    var fresh = document.querySelector('.ke-jump[data-sec="' + sec + '"]');
    return JSON.stringify({ want: sec, got: st.section,
      on: fresh ? fresh.classList.contains('on') : '找不到按鈕（面板沒重繪？）',
      sameNode: fresh === b, errs: (window.__errs||[]).slice(0,3) });
  })()`);
  if (!kj.skip) check('點分節按鈕換分，且高亮跟對', kj.got === kj.want && kj.on === true,
    JSON.stringify({ want: kj.want, got: kj.got, on: kj.on, sameNode: kj.sameNode }), kj.want);

  const lastErrs = await ev(`JSON.stringify((window.__errs||[]).slice(0,5))`);
  check('這一頁全程沒有未捕捉錯誤', !lastErrs.length, lastErrs, '[]');
}

console.log('\n合計 ' + pass + ' 項通過、' + fail + ' 項未通過');
fs.writeFileSync(path.join(process.cwd(), 'build', '_ke-panel-report.json'), JSON.stringify({ pass, fail, results }, null, 2), 'utf8');
child.kill();
try { await send('Browser.close'); } catch (e) {}
await sleep(500);
process.exit(fail ? 1 : 0);
