// 驗收：閱讀器的「位置」寫進網址，並能從網址還原回同一屏。
// 位置＝句子(u)／分(sec)／分頁(tab)＋科判家(kb)／科文節點(k)／閱讀模式的句子(rd)與頁碼(pg)。
// 客戶回報時只要貼連結就能重現，所以每一段都要驗：會寫、能還原、舊連結不壞、query 不被洗掉。
//
//   node build/cdp-url-state.mjs <file:///.../vcpp.html> <file:///.../surangama.html>
//
// 兩頁走的介面不完全一樣：金剛經預設昭明（點句＝選句），楞嚴預設子璿（點句＝進閱讀模式）。
// 所以 rd／pg 這一路徑是「先找出這一頁會不會開閱讀模式」，會就驗，不會就明著跳過（不默過）。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = process.env.CDP_OUT || path.join(process.cwd(), 'build', '_url-state-report.json');
const pages = process.argv.slice(2).filter((x) => /^(file|https?):/.test(x));
if (!pages.length) { console.error('用法：node build/cdp-url-state.mjs <file:// 或 https:// 頁面> [...]'); process.exit(2); }

const port = 11300 + Math.floor(Math.random() * 120);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-url-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1440,1000',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

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
function info(msg) { console.log('  · ' + msg); results.push({ info: msg }); }

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

async function ev(expr, ms) {
  const LIMIT = ms || 25000;
  const call = send('Runtime.evaluate', {
    expression: `Promise.resolve().then(function(){ return (${expr}); })`,
    returnByValue: true, awaitPromise: true,
  });
  const timer = new Promise((_, rej) => setTimeout(
    () => rej(new Error('evaluate 逾時 ' + LIMIT + 'ms：' + String(expr).replace(/\s+/g, ' ').slice(0, 80))), LIMIT));
  const r = await Promise.race([call, timer]);
  const d = r.result && r.result.exceptionDetails;
  if (d) throw new Error((d.exception && d.exception.description) || d.text || JSON.stringify(d));
  const v = r.result?.result?.value;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return v; } }
  return v;
}
/** 載入一個網址，等經文畫好（單檔要解 gzip，慢機器要給它時間） */
async function goto(url, tag) {
  const t0 = Date.now();
  console.log('\n[' + tag + '] ' + url.replace(/^file:\/\/\/[^?#]*/, '…'));
  await send('Page.navigate', { url });
  let ready = false, tries = 0, lastErr = null;
  // 上限 90 秒：逾時就把「試了幾次、最近一次怎麼錯」印出來，不要再無聲地卡死
  while (Date.now() - t0 < 90000) {
    tries++;
    try {
      ready = await ev(`!!(window.ZHU_APP && window.ZHU_APP.state().ready)`);
      lastErr = null;
    } catch (e) { ready = false; lastErr = String(e.message).slice(0, 120); }
    if (ready) break;
    if (tries % 10 === 0) console.log('    …等待就緒 ' + Math.round((Date.now() - t0) / 1000) + ' 秒（' + tries + ' 次）' + (lastErr ? '：' + lastErr : ''));
    await sleep(400);
  }
  if (!ready) {
    console.log('    就緒中的狀態：tries=' + tries + ' 用時=' + Math.round((Date.now() - t0) / 1000) + 's 最近錯誤=' + lastErr);
    const dbg = await ev(`(function(){ try { return JSON.stringify({ zhu: !!window.ZHU, app: !!window.ZHU_APP,
      kpan: !!window.ZHU_KEPAN, sent: document.querySelectorAll('#reader .sent').length,
      boot: !!(document.getElementById('boot')), bootText: (document.getElementById('bootNum')||{}).textContent,
      errs: (window.__errs||[]).slice(0,3), href: location.href }); } catch(e){ return 'ERR ' + e; } })()`).catch((e) => 'evaluate 失敗：' + e.message);
    throw new Error('頁面沒就緒：' + url + '；' + JSON.stringify(dbg));
  }
  console.log('    就緒 ' + Math.round((Date.now() - t0) / 1000) + 's（' + tries + ' 次取樣）');
  await sleep(1500);   // 科判層的 setTimeout（裝飾、閱讀模式還原）都在這之後才跑完
  return true;
}
const hs = (h) => new URLSearchParams(String(h || '').replace(/^#/, ''));
const SENT = `document.querySelectorAll('#reader .sent[data-u]')`;
/** 第 n 句：金剛經第一分只有四句，夾到本分最後一句，不要越界 */
const pick = (n) => `(function(){ var s = ${SENT}; return s[Math.min(${n}, s.length - 1)]; })()`;
const wait = (ms) => `new Promise(function(r){setTimeout(r,${ms});})`;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: 'window.__errs=[];addEventListener("error",function(e){window.__errs.push(String(e.message))});',
});

try {
for (const base of pages) {
  console.log('\n============ ' + base.split('/').pop() + ' ============');

  // ---- 1. 空網址進場
  await goto(base, '1 初始');
  const boot = await ev(`JSON.stringify({ hash: location.hash, sent: ${SENT}.length,
    ed: window.ZHU_KEPAN && window.ZHU_KEPAN.edition.id,
    read: window.ZHU_KEPAN ? window.ZHU_KEPAN.read : null,
    sel: window.ZHU_APP.state().selected })`);
  const h1 = hs(boot.hash);
  check('經文有畫出來（本分有句子可點）', boot.sent > 0, boot.sent, '>0');
  check('初始就有 kb（家）', !!h1.get('kb') && h1.get('kb') === boot.ed, h1.get('kb'), boot.ed);
  check('初始不寫 rd／u（還沒動作）', h1.get('rd') == null && boot.sel == null && !boot.read.open,
    JSON.stringify({ rd: h1.get('rd'), sel: boot.sel, open: boot.read.open }), '都沒有');

  // ---- 2. 點一句經文：這一頁可能是「閱讀模式」也可能是「選句」，兩條路都要把位置寫進網址
  const click1 = await ev(`(async function(){
    var s = ${pick(5)}; var u = +s.dataset.u; s.click();
    await ${wait(700)};
    return JSON.stringify({ u: u, hash: location.hash, read: window.ZHU_KEPAN.read,
      sel: window.ZHU_APP.state().selected });
  })()`);
  const h2 = hs(click1.hash);
  if (click1.read.open) {
    check('點句 → 進閱讀模式，rd 寫進 hash', h2.get('rd') === String(click1.u), h2.get('rd'), click1.u);
  } else {
    check('點句 → 選句，u 寫進 hash', click1.sel != null && h2.get('u') === String(click1.sel),
      JSON.stringify({ sel: click1.sel, u: h2.get('u') }), click1.u);
    info('這一頁預設家（' + h2.get('kb') + '）點句走選句，不進閱讀模式');
  }

  // ---- 2b. 逐家點一句，找出會開「閱讀模式」的一家（昭明那種 flat 家不會開）
  const fam = await ev(`(async function(){
    var eds = document.getElementById('kbEd'); if (!eds) return JSON.stringify({ found: false });
    for (var i = 0; i < eds.options.length; i++) {
      eds.selectedIndex = i; eds.dispatchEvent(new Event('change'));
      await ${wait(350)};
      var s = ${pick(4)}; s.click();
      await ${wait(450)};
      if (window.ZHU_KEPAN.read.open) {
        return JSON.stringify({ found: true, id: window.ZHU_KEPAN.edition.id, u: +s.dataset.u,
          hash: location.hash, who: (document.getElementById('krWho') || {}).textContent });
      }
    }
    return JSON.stringify({ found: false });
  })()`);
  if (!fam.found) {
    info('這一頁沒有任何一家會開閱讀模式，rd／pg 的段落跳過（楞嚴頁有驗到）');
  } else {
    const hf = hs(fam.hash);
    check('閱讀模式：rd 寫進 hash', hf.get('rd') === String(fam.u), hf.get('rd'), fam.u);
    info('會開閱讀模式的第一家＝' + fam.id + '（' + fam.who + '）');

    // ---- 2c. 換句：rd 跟著走
    const step = await ev(`(async function(){
      var nx = document.querySelector('#kbRead .kr-next');
      if (!nx) return JSON.stringify({ skip: true });
      nx.click(); await ${wait(600)};
      return JSON.stringify({ after: window.ZHU_KEPAN.read, hash: location.hash });
    })()`);
    if (!step.skip) {
      const hst = hs(step.hash);
      check('閱讀模式換句 → rd 跟著走', hst.get('rd') === String(step.after.u), hst.get('rd'), step.after.u);
    }

    // ---- 2d. 換頁：挑「注文字數最多」的那一句（卷首那幾句沒有逐句注文，隨機點會找不到分頁），
    //          逐家開閱讀模式找有頁碼的一家，驗 pg 的寫入與還原
    const pged = await ev(`(async function(){
      var Z = window.ZHU, eds = document.getElementById('kbEd'); if (!eds) return JSON.stringify({ found: false });
      var pgBtn = function(){ return document.querySelector('#kbRead .kr-pg[data-d="1"]:not([disabled])'); };
      var len = {};
      (Z.works || []).forEach(function (w) { (w.anchors || []).forEach(function (a) { len[a[0]] = (len[a[0]] || 0) + (a[2] - a[1]); }); });
      var cands = Object.keys(len).sort(function (x, y) { return len[y] - len[x]; }).slice(0, 12).map(Number);
      var sents = Z.versions[0].sents, tried = 0;
      for (var c = 0; c < cands.length; c++) {
        var u = cands[c], rec = null;
        for (var i = 0; i < sents.length; i++) if (sents[i].u === u) { rec = sents[i]; break; }
        if (!rec) continue;
        if (window.ZHU_APP.state().section !== rec.s) { window.ZHU_APP.setSection(rec.s); await ${wait(400)}; }
        for (var e = 0; e < eds.options.length; e++) {
          eds.selectedIndex = e; eds.dispatchEvent(new Event('change')); await ${wait(200)};
          var el = document.querySelector('#reader .sent[data-u="' + u + '"]'); if (!el) continue;
          tried++;
          el.click(); await ${wait(250)};
          if (window.ZHU_KEPAN.read.open && pgBtn()) {
            pgBtn().click(); await ${wait(600)};
            return JSON.stringify({ found: true, u: u, id: window.ZHU_KEPAN.edition.id,
              page: window.ZHU_KEPAN.read.page, hash: location.hash, tried: tried, chars: len[u] });
          }
          if (window.ZHU_KEPAN.read.open) { var x = document.querySelector('#kbRead .kr-x'); if (x) { x.click(); await ${wait(120)}; } }
        }
      }
      return JSON.stringify({ found: false, tried: tried });
    })()`);
    if (pged.found) {
      const hpg = hs(pged.hash);
      check('注文分頁 → pg 寫進 hash（' + pged.id + ' 第 ' + pged.u + ' 句，注文 ' + pged.chars + ' 字）',
        hpg.get('pg') === String(pged.page), hpg.get('pg'), pged.page);
      await goto(base + '?theme=dark' + pged.hash, '2d 還原閱讀模式與頁碼');
      const rp = await ev(`JSON.stringify({ read: window.ZHU_KEPAN.read, ed: window.ZHU_KEPAN.edition.id,
        visible: !!document.querySelector('#kbRead:not([hidden])'), errs: (window.__errs||[]).slice(0,3) })`);
      check('還原：家、句子、頁碼一起回來，面板看得見',
        rp.ed === pged.id && rp.read.open === true && String(rp.read.page) === String(pged.page) && rp.visible === true,
        JSON.stringify({ ed: rp.ed, open: rp.read.open, page: rp.read.page, visible: rp.visible }),
        JSON.stringify({ ed: pged.id, open: true, page: pged.page, visible: true }));
      check('還原這一次載入沒有錯誤', !rp.errs.length, rp.errs, '[]');
      const keepQ = await ev(`(async function(){
        var s = ${pick(2)}; s.click(); await ${wait(600)};
        return JSON.stringify({ search: location.search, hash: location.hash });
      })()`);
      check('動作之後 query 還在（舊写法會把 ?theme=dark 洗掉）', keepQ.search === '?theme=dark', keepQ.search, '?theme=dark');
    } else info('找過 ' + pged.tried + ' 次（注文最長的 40 句 × 各家）都不需要分頁，pg 沒實測到');

    // ---- 2e. 關掉閱讀模式：rd／pg 要從網址消失
    const readClose = await ev(`(async function(){
      var x = document.querySelector('#kbRead .kr-x');
      if (!x) return JSON.stringify({ skip: true });
      x.click(); await ${wait(600)};
      return JSON.stringify({ read: window.ZHU_KEPAN.read, hash: location.hash });
    })()`);
    if (!readClose.skip) {
      const hcl = hs(readClose.hash);
      check('關閱讀模式 → hash 不再有 rd／pg',
        !readClose.read.open && hcl.get('rd') == null && hcl.get('pg') == null,
        JSON.stringify({ open: readClose.read.open, rd: hcl.get('rd'), pg: hcl.get('pg') }), '都消失');
    }
  }

  // ---- 3. 真正的「選句」：關掉科文開關時點句子走 App 原本的路徑（u 進網址）
  //        開回科文時閱讀器本來就會收起選句（KEPAN.md 四、科判開關），
  //        所以分兩個時點取樣：選句中（要有 u）與開回科文後（u 要跟著消失）。
  const sel = await ev(`(async function(){
    var K = window.ZHU_KEPAN, t = document.getElementById('kbToggle');
    // 前面幾步可能把閱讀模式開著：先關掉，才看得出「點句子選句」這條路本身的結果
    if (K && K.read.open) { var x = document.querySelector('#kbRead .kr-x'); if (x) { x.click(); await ${wait(400)}; } }
    if (t && document.body.classList.contains('kb-on')) t.click();
    await ${wait(500)};
    var before = document.body.className;
    // 金剛經一分只有四句，pick(5) 與 pick(3) 會被夾成同一句；再點同一句＝收起，
    // 所以這裡挑「跟目前已選不同」的一句，才驗得到選句這條路
    var all = ${SENT}; var cur = window.ZHU_APP.state().selected; var s = null;
    for (var q = 0; q < all.length; q++) { if (+all[q].dataset.u !== cur) { s = all[q]; break; } }
    if (!s) return JSON.stringify({ skip: true });
    var u = +s.dataset.u; s.click();
    await ${wait(700)};
    var st = window.ZHU_APP.state();
    var whileSel = location.hash;
    if (t && !document.body.classList.contains('kb-on')) t.click();
    await ${wait(600)};
    return JSON.stringify({ u: u, whileSel: whileSel, afterOn: location.hash,
      sel: st.selected, sec: st.section, tab: st.tab, selAfter: window.ZHU_APP.state().selected,
      kbPlain: document.body.classList.contains('kb-plain'), readOpen: K ? K.read.open : null,
      selCls: document.querySelectorAll('#reader .sent.sel').length,
      diag: { hasToggle: !!t, bound: !!(t && t.onclick), clsBefore: before,
        on: document.body.classList.contains('kb-on'), sentHere: ${SENT}.length },
      errs: (window.__errs||[]).slice(0,3) });
  })()`);
  if (sel.skip) info('這一分只有一句，無法再挑別句做選句檢查，步驟 3 跳過');
  else {
  const h3 = hs(sel.whileSel);
  check('選句 → App state.selected 是那一句', sel.sel === sel.u,
    JSON.stringify({ sel: sel.sel, readOpen: sel.readOpen, kbPlain: sel.kbPlain, selCls: sel.selCls, diag: sel.diag, errs: sel.errs }), sel.u);
  check('選句 → hash 的 u＝那一句', h3.get('u') === String(sel.u), h3.get('u'), sel.u);
  check('選句 → hash 的 sec＝目前這分', h3.get('sec') === String(sel.sec), h3.get('sec'), sel.sec);
  check('選句 → hash 有 tab 與 kb', !!h3.get('tab') && !!h3.get('kb'), JSON.stringify({ tab: h3.get('tab'), kb: h3.get('kb') }), '都有');
  check('開回科文（會收起選句）→ hash 的 u 也跟著消失',
    sel.selAfter == null && hs(sel.afterOn).get('u') == null,
    JSON.stringify({ selAfter: sel.selAfter, u: hs(sel.afterOn).get('u') }), '都沒有');
  }

  // ---- 4. 換一家科判
  const ed2 = await ev(`(async function(){
    var b = document.getElementById('kbEd'); if (!b || b.options.length < 2) return JSON.stringify({ skip: true });
    var i = (b.selectedIndex + 1) % b.options.length;
    b.selectedIndex = i; b.dispatchEvent(new Event('change'));
    await ${wait(700)};
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var k = p.get('k');
    return JSON.stringify({ hash: location.hash, id: window.ZHU_KEPAN.edition.id, k: k,
      kInEd: k == null ? null : (window.ZHU_KEPAN.edition.byId.get(+k) != null) });
  })()`);
  if (!ed2.skip) {
    const h4 = hs(ed2.hash);
    check('換家 → hash 的 kb 跟著換', h4.get('kb') === ed2.id, h4.get('kb'), ed2.id);
    check('換家 → k 是新家自己的節點（不是上一家的 id）', ed2.kInEd !== false, JSON.stringify({ k: ed2.k, kInEd: ed2.kInEd }), '本家的節點 id');
  }

  // ---- 5. 從麵包屑／目錄跳到某一節
  const jmp = await ev(`(async function(){
    var ed = window.ZHU_KEPAN.edition, n = null;
    for (var i = 0; i < ed.nodes.length; i++) { var x = ed.nodes[i]; if (!x.nk && x.u > 0) { n = x; break; } }
    if (!n) return JSON.stringify({ skip: true });
    window.ZHU_KEPAN.go(n.id);
    await ${wait(900)};
    var st = window.ZHU_APP.state();
    return JSON.stringify({ id: n.id, nu: n.u, off: n.off, hash: location.hash, sec: st.section,
      curNode: window.ZHU_KEPAN.node ? window.ZHU_KEPAN.node.id : null });
  })()`);
  if (!jmp.skip) {
    const h5 = hs(jmp.hash);
    check('跳節 → hash 的 k＝麵包屑末端那一節', h5.get('k') === String(jmp.curNode), h5.get('k'), jmp.curNode);
    check('跳節 → 分（sec）跟著過去', h5.get('sec') === String(jmp.sec), h5.get('sec'), jmp.sec);
    if (jmp.off > 0 && String(jmp.curNode) !== String(jmp.id)) {
      info('這一節起點在第 ' + jmp.off + ' 字（不是句首），反查到的節點是 ' + jmp.curNode + '（原 ' + jmp.id +
        '）——位置以句為準，連結照樣落在同一句，屬既有精度');
    }
    // 帶著這一節的連結再還原一次
    await goto(base + '?theme=dark' + jmp.hash, '5b 還原某一節');
    const rj = await ev(`(function(){ var p = new URLSearchParams(location.hash.replace(/^#/,''));
      return JSON.stringify({ want: { sec: p.get('sec'), kb: p.get('kb') }, sec: window.ZHU_APP.state().section,
        ed: window.ZHU_KEPAN.edition.id, chip: (document.querySelector('#kepanBar .kb-chip.cur .kb-nm') || {}).textContent || null,
        errs: (window.__errs||[]).slice(0,3) }); })()`);
    check('還原：分與家回來，麵包屑有目前這一節',
      String(rj.sec) === rj.want.sec && rj.ed === rj.want.kb && !!rj.chip,
      JSON.stringify({ sec: rj.sec, ed: rj.ed, chip: rj.chip }),
      JSON.stringify({ sec: rj.want.sec, ed: rj.want.kb, chip: '有科名' }));
    check('還原載入沒有錯誤', !rj.errs.length, rj.errs, '[]');
  }

  // ---- 6. 點經文上的科文標記
  const mark = await ev(`(async function(){
    var m = document.querySelector('#reader .kb-mark');
    if (!m) return JSON.stringify({ skip: true });
    m.click(); await ${wait(800)};
    return JSON.stringify({ hash: location.hash, cur: window.ZHU_KEPAN.node ? window.ZHU_KEPAN.node.id : null });
  })()`);
  if (!mark.skip) {
    const h6 = hs(mark.hash);
    check('點科文標記 → hash 的 k 有更新', h6.get('k') === String(mark.cur), h6.get('k'), mark.cur);
  } else info('這一頁經文上沒有科文標記（這一家 noMarks 或沒開科文），略過點擊');

  // ---- 7. 換分頁
  const tab = await ev(`(async function(){
    var all = Array.prototype.slice.call(document.querySelectorAll('#tabs2 button[data-t]'));
    var b = all.filter(function(x){ return x.dataset.t !== window.ZHU_APP.state().tab; })[0];
    if (!b) return JSON.stringify({ skip: true });
    b.click(); await ${wait(500)};
    return JSON.stringify({ want: b.dataset.t, hash: location.hash, tab: window.ZHU_APP.state().tab });
  })()`);
  if (!tab.skip) {
    const h7 = hs(tab.hash);
    check('換分頁 → hash 的 tab 有更新', h7.get('tab') === tab.want, h7.get('tab'), tab.want);
  }

  // ---- 8. 舊連結：只有 #u=
  const legacyU = await ev(`(function(){ return ${pick(1)}.dataset.u; })()`);
  await goto(base + '#u=' + legacyU, '8 舊連結 #u=');
  const leg = await ev(`(function(){ var st = window.ZHU_APP.state();
    return JSON.stringify({ sel: st.selected, hash: location.hash, errs: (window.__errs||[]).slice(0,3) }); })()`);
  check('舊連結 #u=38 照樣還原選句', leg.sel === +legacyU, leg.sel, legacyU);
  check('舊連結 #u= 載入沒有錯誤', !leg.errs.length, leg.errs, '[]');

  // ---- 9. 舊連結：?kepan=家 ＋ #k=節點
  const legacyK = await ev(`(function(){ var ed = window.ZHU_KEPAN.edition, n = null;
    for (var i = 0; i < ed.nodes.length; i++) { if (!ed.nodes[i].nk && ed.nodes[i].u > 0) { n = ed.nodes[i]; break; } }
    return JSON.stringify({ id: n ? n.id : null, ed: ed.id }); })()`);
  if (legacyK.id == null) info('這一家的節點都不連經文，跳過 ?kepan&k= 的檢查');
  else {
    await goto(base + '?kepan=' + legacyK.ed + '#k=' + legacyK.id, '9 舊連結 ?kepan&k=');
    const leg2 = await ev(`(function(){ var p = new URLSearchParams(location.hash.replace(/^#/,''));
      return JSON.stringify({ kb: p.get('kb'), k: p.get('k'), ed: window.ZHU_KEPAN.edition.id,
        sec: window.ZHU_APP.state().section, errs: (window.__errs||[]).slice(0,3) }); })()`);
    check('舊連結 ?kepan=家&k=節點 仍然跳到位', leg2.ed === legacyK.ed && leg2.sec > 0,
      leg2.ed + '/' + leg2.sec, legacyK.ed + '/有分');
    check('舊連結 k= 載入沒有錯誤', !leg2.errs.length, leg2.errs, '[]');
  }

  // ---- 10. 🔗 按鈕與取連結的介面
  const btn = await ev(`(function(){ var b = document.getElementById('linkBtn');
    if (!b) return JSON.stringify({ exists: false });
    var r = b.getBoundingClientRect();
    return JSON.stringify({ exists: true, visible: r.width > 0 && r.height > 0, title: b.title,
      inUtils: !!(b.closest && b.closest('.kb-utils')) }); })()`);
  check('標題列有 🔗 複製位置按鈕', btn.exists && btn.visible, JSON.stringify(btn), '可見的按鈕');
  const link = await ev(`JSON.stringify(window.ZHU_APP.url())`);
  check('ZHU_APP.url() 取得到目前位置的完整連結', /^(?:https?|file):\/\/.+#[&a-z]/.test(String(link)), String(link).slice(-70), '絕對網址＋#…');
}

} catch (e) {
  console.log('\n驗收中斷：' + String((e && e.message) || e));
  results.push({ aborted: String((e && e.message) || e) });
  fail++;
} finally {
  console.log('\n合計 ' + pass + ' 項通過、' + fail + ' 項未通過');
  fs.writeFileSync(OUT, JSON.stringify({ pass, fail, results }, null, 2), 'utf8');
  console.log('報表：' + OUT);
  // 只 kill node 會讓無頭 Edge 整個留下來搶 CPU（實測過：兩套同時跑就載入不動）
  // 用 CDP 的 Browser.close 關瀏覽器，等程序真正退出
  try { await send('Browser.close'); } catch (e) { child.kill(); }
  await Promise.race([new Promise((r) => child.once('exit', r)), sleep(4000)]);
  if (child.exitCode === null) child.kill();
  process.exit(fail ? 1 : 0);
}
