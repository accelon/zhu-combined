// 驗收：注疏「讀更多」（預設補到句末，再點展開到同家下一段之前）
//   node build/cdp-note-more.mjs <file://單檔> [...]
// 驗五件事：
//   1. 預設那段以句末標點收尾（原本 0% 收尾，這是客戶回報的「斷半句」）
//   2. 「更多（還有 N 字）」按下去：文字變長、原本的內容完整保留（前綴）、沒有截掉
//   3. 「更多」與「頁碼」不會同時出現在同一段注文上（兩套機制不疊）
//   4. 「收起」回原狀；換句再換回來，展開狀態還在（記 w@u，不是只記作者）
//   5. 展開後不會把下一段的開頭重複貼一次（延伸上限＝同家下一個錨點之前）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = process.env.CDP_OUT || path.join(process.cwd(), 'build', '_note-more-report.json');
const pages = process.argv.slice(2).filter((x) => /^(file|https?):/.test(x));
if (!pages.length) { console.error('用法：node build/cdp-note-more.mjs <file:// 或 https:// 頁面> [...]'); process.exit(2); }

const port = 11400 + Math.floor(Math.random() * 90);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-more-'));
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', 'about:blank'],
  { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 120; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
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
    if (i === 60) console.log('    …仍在等就緒（60 次取樣）');
  }
  await sleep(1500);
}
const wait = (ms) => `new Promise(function(r){setTimeout(r,${ms});})`;

// 找一句「多家有注疏、且至少一段能出現更多」的句子，逐家開起來再看結果
const FIND = `(async function(){
  var D = window.ZHU, W = (D.works||[]).filter(function(w){ return w.text && w.kind !== '科判'; });
  var pick = null;
  for (var i = 0; i < W.length; i++) {
    var as = W[i].anchors || [];
    for (var j = 0; j < as.length; j++) { if (as[j][0] > 60) { pick = { id: W[i].id, u: as[j][0] }; break; } }
    if (pick) break;
  }
  return JSON.stringify(pick || { id: W[0] && W[0].id, u: 61 });
})()`;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: 'window.__errs=[];addEventListener("error",function(e){window.__errs.push(String(e.message))});',
});

for (const base of pages) {
  console.log('\n============ ' + base.split('/').pop() + ' ============');
  await goto(base, '載入');
  const seed = await ev(FIND);
  info('這一頁測試用的是 ' + seed.id + ' 第 ' + seed.u + ' 句');

  // 選句 → 開幾家注疏 → 收集每一段的狀態
  const probe = await ev(`(async function(){
    var ids = (window.ZHU.works || []).filter(function(w){ return w.text && w.kind !== '科判'; }).map(function(w){ return w.id; }).slice(0, 5);
    window.ZHU_APP.selectUnit(${seed.u});
    await ${wait(600)};
    // 直接用內部的 togglePick 太繞，改點作者名按鈕
    var clicked = [];
    ids.forEach(function(id){
      var b = document.querySelector('.notebtn[data-w="' + id + '"]');
      if (b) { b.click(); clicked.push(id); }
    });
    await ${wait(700)};
    var out = [];
    document.querySelectorAll('#cards .note-open').forEach(function(card){
      var p = card.querySelector('p.ex'); if (!p) return;
      var btn = p.querySelector('button.ex-more');
      var pager = p.querySelector('.pager');
      // 只取文字節點：按鈕標籤（更多（還有 N 字））不該算進注文長度
      var txt = (p.firstChild ? p.firstChild.textContent : p.textContent || '').replace(/\\s+/g, '');
      out.push({ w: p.dataset.w, len: txt.length, tail: txt.slice(-1), hasBtn: !!btn,
        rest: btn ? btn.textContent : null, hasPager: !!pager, nopag: p.dataset.nopag || null });
    });
    return JSON.stringify({ clicked: clicked, rows: out, errs: (window.__errs||[]).slice(0,3) });
  })()`);
  check('注疏卡片有長出來', probe.rows.length > 0, probe.rows.length, '>0');
  check('載入沒有錯誤', !probe.errs.length, probe.errs, '[]');

  const paged = probe.rows.filter((r) => r.hasPager);
  const withBtn = probe.rows.filter((r) => r.hasBtn);
  check('「更多」與「頁碼」不會同時出現', !probe.rows.some((r) => r.hasBtn && r.hasPager),
    JSON.stringify(probe.rows.map((r) => ({ w: r.w, btn: r.hasBtn, pager: r.hasPager }))), '沒有並存');
  info('這段有「更多」的 ' + withBtn.length + ' 家、走頁碼的 ' + paged.length + ' 家');

  // 句末收尾率：沒按鈕也沒頁碼的短段，理應以句末標點收尾
  const bare = probe.rows.filter((r) => !r.hasBtn && !r.hasPager && r.len > 4);
  check('不需要延伸的段落以句末收尾', bare.every((r) => '。！？；'.indexOf(r.tail) >= 0),
    JSON.stringify(bare.map((r) => ({ w: r.w, tail: r.tail }))), '句末標點');

  // 點「更多」：前綴保留、變長、而且是原文裡「連續的一段」（不是把下一段又貼一次）
  if (withBtn.length) {
    const t = await ev(`(async function(){
      var btn = document.querySelector('#cards p.ex button.ex-more');
      var host = btn.closest('p.ex');
      var w = host.dataset.w;
      var flat = function(s){ return String(s || '').replace(/\\s+/g, ''); };
      var before = flat(host.firstChild ? host.firstChild.textContent : host.textContent);
      btn.click(); await ${wait(800)};
      var host2 = document.querySelector('#cards p.ex[data-w="' + w + '"]');
      var after = flat(host2.firstChild ? host2.firstChild.textContent : host2.textContent);
      var btn2 = host2.querySelector('button.ex-more');
      var T = flat((window.ZHU.works.filter(function(x){ return x.id === w; })[0] || {}).text);
      var head = after.slice(0, 20), tail = after.slice(-20);
      var i0 = T.indexOf(head), i1 = T.indexOf(tail);
      return JSON.stringify({ beforeLen: before.length, afterLen: after.length,
        prefixKept: after.slice(0, before.length) === before,
        contiguous: i0 >= 0 && i1 === i0 + after.length - 20,
        tailChar: after.slice(-1), lessBtn: btn2 ? btn2.textContent : null, w: w });
    })()`);
    check('點「更多」→ 文字變長', t.afterLen > t.beforeLen, JSON.stringify({ before: t.beforeLen, after: t.afterLen }), '變長');
    check('點「更多」→ 原本那段完整保留在前面', t.prefixKept === true, t.prefixKept, true);
    check('點「更多」→ 展開的是原文連續一段（不重複貼下一段）', t.contiguous === true, t.contiguous, true);
    check('點「更多」→ 展開後以句末收尾', '。！？；'.indexOf(t.tailChar) >= 0, t.tailChar, '句末標點');
    check('點「更多」→ 按鈕變成「收起」', /收起/.test(t.lessBtn || ''), t.lessBtn, '收起');
    // 收起 → 回原狀；換句再回來，展開狀態還在
    const back = await ev(`(async function(){
      var flat = function(s){ return String(s || '').replace(/\\s+/g, ''); };
      var btn = document.querySelector('#cards p.ex button.ex-more.less');
      if (btn) { btn.click(); await ${wait(600)}; }
      var w = btn ? btn.closest('p.ex').dataset.w : null;
      var short = w ? flat((document.querySelector('#cards p.ex[data-w="' + w + '"]').firstChild || {}).textContent) .length : 0;
      btn = document.querySelector('#cards p.ex button.ex-more');
      if (!btn) return JSON.stringify({ skip: true });
      w = btn.closest('p.ex').dataset.w;
      btn.click(); await ${wait(600)};
      var keepLen = flat((document.querySelector('#cards p.ex[data-w="' + w + '"]').firstChild || {}).textContent).length;
      window.ZHU_APP.selectUnit(${seed.u} + 3); await ${wait(600)};
      window.ZHU_APP.selectUnit(${seed.u}); await ${wait(800)};
      var nowLen = flat((document.querySelector('#cards p.ex[data-w="' + w + '"]') || { firstChild: {} }).firstChild.textContent).length;
      return JSON.stringify({ w: w, short: short, keepLen: keepLen, nowLen: nowLen, errs: (window.__errs||[]).slice(0,3) });
    })()`);
    if (!back.skip) {
      check('「收起」回到短版（比展開短）', back.short < back.keepLen, JSON.stringify({ short: back.short, keep: back.keepLen }), '較短');
      check('換句再回來，展開狀態還在', back.nowLen === back.keepLen, JSON.stringify({ now: back.nowLen, keep: back.keepLen }), back.keepLen);
      check('這一輪沒有錯誤', !back.errs.length, back.errs, '[]');
    }
  } else info('這一頁這一句沒有可展開的段落，「更多」的互動檢查跳過');

  // 換到一句「只有短注」的地方，確認不會出現無意義的按鈕
  const noise = await ev(`(async function(){
    var n = 0, tiny = 0, sample = [];
    var D = window.ZHU, us = D.versions[0].sents.slice(0, 40).map(function(s){ return s.u; });
    for (var i = 0; i < us.length; i++) {
      window.ZHU_APP.selectUnit(us[i]); await ${wait(120)};
      document.querySelectorAll('#cards p.ex').forEach(function(p){
        var b = p.querySelector('button.ex-more'); if (!b) return;
        n++;
        var m = /還有\\s*([0-9]+)\\s*字/.exec(b.textContent || '');
        if (m && +m[1] < 9) { tiny++; if (sample.length < 3) sample.push(b.textContent); }
      });
    }
    return JSON.stringify({ btn: n, tiny: tiny, sample: sample });
  })()`);
  check('出按鈕的門檻（<9 字就不該出）不會亂出', noise.tiny === 0, JSON.stringify(noise), 'tiny=0');
  info('掃了 40 句：出現「更多」' + noise.btn + ' 次');
}

console.log('\n合計 ' + pass + ' 項通過、' + fail + ' 項未通過');
fs.writeFileSync(OUT, JSON.stringify({ pass, fail, results }, null, 2), 'utf8');
console.log('報表：' + OUT);
// 用 CDP 關瀏覽器：只 kill node 會讓無頭 Edge 留下來搶 CPU
try { await send('Browser.close'); } catch (e) { child.kill(); }
await Promise.race([new Promise((r) => child.once('exit', r)), sleep(4000)]);
if (child.exitCode === null) child.kill();
process.exit(fail ? 1 : 0);
