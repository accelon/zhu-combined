// 產生單檔 vcpp.html：把 CSS／JS／資料全部內嵌（gzip + base64）。
//
// 預設收全部全文（--limit all）。要回到「去掉大部頭」的輕量版用 --limit 40000。
// 印順《般若經講記》不論門檻都會保留。
//
// 大小上限預設 8 MiB（舊版硬性 2 MiB）；用 --max 改，超過才報錯。
//
// 用法：
//   node build-vcpp.mjs                       # 預設：--limit all --max 8（約 2.7MB）
//   node build-vcpp.mjs --limit 40000         # 輕量版（約 1.6MB）
//   node build-vcpp.mjs --max 16 --limit 80000
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = 'D:\\2026\\zhu-combined';
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const limitArg = String(opt('limit', 'all')).toLowerCase();
const LIMIT = (limitArg === 'all' || limitArg === '0') ? Infinity : +limitArg;
const MAX_MB = +opt('max', 8);
const OUT = path.join(ROOT, opt('out', 'vcpp.html'));
const KEEP = new Set(['Y01']);

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const dataSrc = fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8');
const D = JSON.parse(dataSrc.replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));

const dropped = [];
for (const w of D.works) {
  if (!w.text) continue;
  if (w.text.length > LIMIT && !KEEP.has(w.id)) {
    dropped.push({ id: w.id, title: w.title, chars: w.text.length });
    w.text = '';
    w.lite = 1;
  }
}
D.lite = {
  limit: LIMIT === Infinity ? 'all' : LIMIT,
  dropped: dropped.map((x) => x.id),
  note: dropped.length ? '大部頭全文未收錄' : '全文收錄',
};

const json = JSON.stringify(D);
const gz = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
const b64 = gz.toString('base64');

let out = html;
out = out.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>');
out = out.replace(/<script src="zhu-data\.js"><\/script>\s*<script src="app\.js"><\/script>/, '');
out = out.replace('<title>金剛經合注 · zhu-combined</title>', '<title>金剛經合注 · vcpp</title>');

const dataTag = '<script id="zhu-b64" type="text/plain">' + b64 + '</script>';
const appCode = app.replace(/<\/script/gi, '<\\/script');
const boot = `
<script>
function __startApp(){
${appCode}
}
(function () {
  var el = document.getElementById('zhu-b64');
  if (!el) return;
  if (!('DecompressionStream' in window)) {
    document.body.innerHTML = '<p style="padding:2rem;font:16px/1.8 sans-serif">此瀏覽器不支援內建解壓，請用新版 Chrome、Edge 或 Safari 開啟。</p>';
    return;
  }
  var bin = atob(el.textContent.trim());
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  new Response(stream).text().then(function (text) {
    window.ZHU = JSON.parse(text);
    __startApp();
  }).catch(function (err) {
    document.body.innerHTML = '<p style="padding:2rem;font:16px/1.8 sans-serif">資料解壓失敗：' + err + '</p>';
  });
})();
</script>`;
out = out.replace('</body>', dataTag + boot + '\n</body>');

fs.writeFileSync(OUT, out);
const bytes = fs.statSync(OUT).size;
console.log('寫出 ' + OUT);
console.log('大小 ' + (bytes / 1048576).toFixed(2) + ' MiB（' + bytes + ' bytes），上限 ' + MAX_MB + ' MiB');
console.log('gzip 資料 ' + (gz.length / 1048576).toFixed(2) + ' MiB；base64 ' + (b64.length / 1048576).toFixed(2) + ' MiB');
console.log('全文上限 ' + (LIMIT === Infinity ? '不限' : LIMIT + ' 字') +
  '；去掉 ' + dropped.length + ' 部大部頭' +
  (dropped.length ? '：' + dropped.map((x) => x.id + '(' + x.chars + ')').join(', ') : ''));
if (bytes > MAX_MB * 1024 * 1024) {
  console.error('✗ 超過 ' + MAX_MB + ' MiB，請降低 --limit 或用 --max 放寬');
  process.exit(1);
}
