// 單檔啟動腳本：先顯示「載入數據中」，邊解壓邊更新進度，解完才啟動 App。
//
// 由 build-vcpp.mjs／build-vcpp-kepan.mjs 呼叫；回傳一整段 <script>。
// 進度來源：
//   1. base64 解碼（0–6%）
//   2. 解壓（6–96%）：gzip 尾端 4 bytes 是原始大小（ISIZE），拿它當分母；
//      用 TransformStream 邊解邊數 bytes，約每 100ms 更新一次畫面
//   3. JSON.parse＋啟動（96–100%）
// 舊 Safari 沒有 DecompressionStream 時走純 JS 解壓：同步、無法回報細進度，
// 改顯示「解壓中…」的不確定動畫。
//
// 執行順序：lossless → tour → app。tour.js 先把 window.tourState 掛上，
// app 初始化時才不會以為「沒有導覽」而把 🦮 收起來（2026-11-04 修）。

const safe = (s) => String(s == null ? '' : s).replace(/<\/script/gi, '<\\/script');

export function renderBoot({ gunzip, lossless, app, tour, kepanJs, mantraJs }) {
  return `
<script>
${safe(gunzip)}
function __startApp(){
${safe(lossless)}
${safe(tour)}
${safe(app)}
}
${kepanJs ? 'function __startKepan(){\n' + safe(kepanJs) + '\n}' : ''}
${mantraJs ? 'function __startMantra(){\n' + safe(mantraJs) + '\n}' : ''}
(function () {
  var el = document.getElementById('zhu-b64');
  if (!el) return;

  var boot = document.getElementById('boot');
  var bar = document.getElementById('bootBar');
  var label = document.getElementById('bootNum');
  var t0 = Date.now();
  var LOG = /[?&]bootlog=1/.test(location.search);

  var shown = bar ? (parseFloat(bar.style.width) || 0) : 0,   // 接手早期假進度，不讓它倒退
      fakeTimer = null,
      fake = 0,
      done = false;

  function paint(p, text) {
    p = Math.max(0, Math.min(100, p));
    shown = Math.max(shown, p);
    if (LOG) (window.__bootLog = window.__bootLog || []).push([Date.now() - t0, Math.round(shown * 10) / 10]);
    if (bar) bar.style.width = shown.toFixed(1) + '%';
    if (label) label.textContent = text != null ? text : Math.round(shown) + '%';
  }
  function busy(text) {
    if (bar) { bar.style.width = '100%'; if (bar.parentNode) bar.parentNode.classList.add('is-busy'); }
    if (label) label.textContent = text || '解壓中…';
  }
  function hideBoot() {
    done = true;
    if (fakeTimer) { clearInterval(fakeTimer); fakeTimer = null; }
    if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
  }
  /** 假進度：先自己慢慢爬到 88%，真實進度只往上蓋，不會停在 0% */
  function startFake() {
    fake = 0;
    paint(2, '讀取資料…');
    fakeTimer = setInterval(function () {
      if (done) return;
      fake = Math.min(88, fake + (fake < 30 ? 3.5 : fake < 60 ? 1.8 : 0.9));
      if (fake > shown) paint(fake, Math.round(fake) + '%…');
    }, 120);
  }
  function phase(x) { if (LOG) window.__bootPhase = x; }
  function setReal(p, text) {
    if (p > shown) paint(p, text);
  }

  try { window.__bootTickStop && window.__bootTickStop(); } catch (e) {}
  startFake();

  function toBytes(bin) {
    var a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }

  // gzip 尾端 4 bytes = 原始大小（小於 4GB 時可靠）
  function isizeOf(bytes) {
    if (bytes.length < 18) return 0;
    var n = bytes.length;
    return ((bytes[n - 4] | (bytes[n - 3] << 8) | (bytes[n - 2] << 16) | (bytes[n - 1] << 24)) >>> 0);
  }

  function start(text) {
    phase('start');
    paint(96, '準備畫面…');
    var pack = JSON.parse(text);
    if (pack && pack.zhu) {
      window.ZHU = pack.zhu;
      if (pack.kepan !== undefined) window.KEPAN = pack.kepan;
      if (pack.mantra) window.MANTRA = pack.mantra;
    } else {
      window.ZHU = pack;
    }
    // 咒語介面要在 app 的 buildTabs() 之前就緒（它讀 window.MANTRA）
    if (typeof __startMantra === 'function') {
      try { __startMantra(); } catch (e) { console.error('咒語介面載入失敗', e); }
    }
    __startApp();
    if (typeof __startKepan === 'function') {
      try { __startKepan(); } catch (e) { console.error('科文介面載入失敗', e); }
    }
    paint(100, '完成');
    // 載入很快時也讓遮罩至少停留一下，不要一閃而過
    var left = Math.max(0, 420 - (Date.now() - t0));
    setTimeout(function () { try { hideBoot(); } catch (e) {} }, left);
    try { console.log('資料載入 ' + (Date.now() - t0) + ' ms'); } catch (e) {}
  }
  function fail(msg) {
    hideBoot();
    document.body.innerHTML = '<p style="padding:2rem;font:16px/1.8 sans-serif">資料載入失敗：' +
      (msg && msg.message ? msg.message : msg) +
      '<br>請換新版 Chrome、Edge 或 Safari 開啟，或回報給作者。</p>';
  }

  function fallback(bytes) {
    phase('fallback');
    busy('解壓中…（舊瀏覽器，稍等）');
    setTimeout(function () {
      try { start(new TextDecoder('utf-8').decode(__gunzip(bytes))); }
      catch (e) { fail(e); }
    }, 30);
  }

  // 測試用：?slowboot=1500 會延後解壓，方便看遮罩與進度
  var slow = /[?&]slowboot=(\\d+)/.exec(location.search);

  function decompress(bytes) {
    phase('decompress:' + bytes.length);
    var total = isizeOf(bytes);
    if ('DecompressionStream' in window) {
      try {
        var got = 0, last = 0;
        var counter = new TransformStream({
          transform: function (chunk, ctrl) {
            got += chunk.byteLength;
            var now = Date.now();
            if (now - last > 100) {
              last = now;
              var p = total ? Math.min(1, got / total) : 0;
              setReal(88 + 8 * p, '解壓 ' + Math.round(6 + 90 * p) + '%');
            }
            ctrl.enqueue(chunk);
          },
        });
        var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).pipeThrough(counter);
        new Response(stream).text().then(start).catch(function () { fallback(bytes); });
      } catch (e) {
        fallback(bytes);
      }
    } else {
      fallback(bytes);
    }
  }

  // 分塊解 base64（每塊 256KB、必須是 4 的倍數），每塊之間讓瀏覽器有機會重畫
  function decode() {
    phase('decode');
    var text = el.textContent;
    var len = text.length;
    var CHUNK = 1 << 18;
    var parts = [];
    var bytesTotal = 0;
    var i = 0;
    function step() {
      var end = Math.min(len, i + CHUNK);
      var bin = atob(text.slice(i, end).replace(/\\s+/g, ''));
      var arr = toBytes(bin);
      parts.push(arr);
      bytesTotal += arr.length;
      i = end;
      setReal(6 * i / Math.max(1, len));
      if (i < len) { setTimeout(step, 0); return; }
      var bytes = new Uint8Array(bytesTotal);
      var off = 0;
      for (var k = 0; k < parts.length; k++) { bytes.set(parts[k], off); off += parts[k].length; }
      parts = null;
      if (slow) setTimeout(function () { decompress(bytes); }, +slow[1] || 0);
      else decompress(bytes);
    }
    step();
  }

  // 先讓外殼（標題列／版面）畫一帧，再做解碼與解壓這種重活
  requestAnimationFrame(function () {
    setTimeout(function () {
      try { decode(); } catch (e) { fail(e); }
    }, 0);
  });
})();
</script>`;
}
