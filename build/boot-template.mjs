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

const safe = (s) => String(s == null ? '' : s).replace(/<\/script/gi, '<\\/script');

export function renderBoot({ gunzip, lossless, app, tour, kepanJs }) {
  return `
<script>
${safe(gunzip)}
function __startApp(){
${safe(lossless)}
${safe(app)}
${safe(tour)}
}
${kepanJs ? 'function __startKepan(){\n' + safe(kepanJs) + '\n}' : ''}
(function () {
  var el = document.getElementById('zhu-b64');
  if (!el) return;

  var boot = document.getElementById('boot');
  var bar = document.getElementById('bootBar');
  var label = document.getElementById('bootNum');
  var t0 = Date.now();
  // ?bootlog=1：把進度取樣記在 window.__bootLog（測試用）
  var LOG = /[?&]bootlog=1/.test(location.search);

  function setPct(p, text) {
    if (LOG) (window.__bootLog = window.__bootLog || []).push([Date.now() - t0, Math.round(p * 10) / 10]);
    if (bar) bar.style.width = Math.max(0, Math.min(100, p)).toFixed(1) + '%';
    if (label) label.textContent = text != null ? text : Math.round(p) + '%';
  }
  function busy(text) {
    if (bar) bar.style.width = '35%';
    if (bar && bar.parentNode) bar.parentNode.classList.add('is-busy');
    if (label) label.textContent = text || '解壓中…';
  }
  function hideBoot() {
    if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
  }

  setPct(0, '0%');

  // 分幾段解 base64，讓畫面有機會更新
  var bin = '';
  try {
    var CHUNK = 1 << 20;
    for (var i = 0; i < el.textContent.length; i += CHUNK) {
      bin += atob(el.textContent.substr(i, CHUNK).replace(/\\s+/g, ''));
      setPct(6 * Math.min(1, (i + CHUNK) / el.textContent.length));
    }
  } catch (e) {
    bin = atob(el.textContent.trim());
  }
  var bytes = new Uint8Array(bin.length);
  for (var k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  bin = null;

  // gzip 尾端 4 bytes = 原始大小（小於 4GB 時可靠）
  var total = 0;
  if (bytes.length >= 18) {
    var n = bytes.length;
    total = ((bytes[n - 4] | (bytes[n - 3] << 8) | (bytes[n - 2] << 16) | (bytes[n - 1] << 24)) >>> 0);
  }

  function start(text) {
    setPct(96, '準備畫面…');
    var pack = JSON.parse(text);
    if (pack && pack.zhu && pack.kepan !== undefined && typeof __startKepan === 'function') {
      window.ZHU = pack.zhu;
      window.KEPAN = pack.kepan;
    } else {
      window.ZHU = pack;
    }
    __startApp();
    if (typeof __startKepan === 'function') {
      try { __startKepan(); } catch (e) { console.error('科文介面載入失敗', e); }
    }
    setPct(100, '完成');
    // 讓最後一格跑完再收
    requestAnimationFrame(function () { setTimeout(hideBoot, 120); });
    try { console.log('資料載入 ' + (Date.now() - t0) + ' ms'); } catch (e) {}
  }
  function fail(msg) {
    hideBoot();
    document.body.innerHTML = '<p style="padding:2rem;font:16px/1.8 sans-serif">資料載入失敗：' +
      (msg && msg.message ? msg.message : msg) +
      '<br>請換新版 Chrome、Edge 或 Safari 開啟，或回報給作者。</p>';
  }

  function fallback() {
    busy('解壓中…（舊瀏覽器，稍等）');
    setTimeout(function () {
      try { start(new TextDecoder('utf-8').decode(__gunzip(bytes))); }
      catch (e) { fail(e); }
    }, 30);
  }

  // 測試用：?slowboot=1500 會延後解壓，方便看遮罩與進度（不影響正常載入）
  var slow = /[?&]slowboot=(\\d+)/.exec(location.search);
  function decompress() {
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
            setPct(6 + 90 * p,
              Math.round(got / 1024) + ' KB' + (total ? ' / ' + Math.round(total / 1024) + ' KB' : ''));
          }
          ctrl.enqueue(chunk);
        },
      });
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).pipeThrough(counter);
      new Response(stream).text().then(start).catch(fallback);
    } catch (e) {
      fallback();
    }
  } else {
    fallback();
  }
  }
  if (slow) setTimeout(decompress, +slow[1]); else decompress();
})();
</script>`;
}
