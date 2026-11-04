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
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { renderBoot } from './build/boot-template.mjs';
import { writePWA } from './build/pwa.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
// 閱讀器程式在這一支所在的目錄；內容（zhu-data.js 等）在 --root 指定的工作區。
const SELF = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.resolve(opt('root', process.cwd()));

const limitArg = String(opt('limit', 'all')).toLowerCase();
const LIMIT = (limitArg === 'all' || limitArg === '0') ? Infinity : +limitArg;
const MAX_MB = +opt('max', 8);
const OUT = path.resolve(opt('out', path.join(CONTENT, 'vcpp.html')));
// 輕量版要保留全文的 work id（由內容工作區用 --keep 指定；預設不保留）
const KEEP = new Set(String(opt('keep', '')).split(',').map((x) => x.trim()).filter(Boolean));

const html = fs.readFileSync(path.join(SELF, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(SELF, 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(SELF, 'app.js'), 'utf8');
const lossless = fs.readFileSync(path.join(SELF, 'lossless.js'), 'utf8');
const tourPath = path.join(CONTENT, 'tour.js');
const tour = fs.existsSync(tourPath) ? fs.readFileSync(tourPath, 'utf8') : '';
const dataSrc = fs.readFileSync(path.join(CONTENT, 'zhu-data.js'), 'utf8');
const gunzip = fs.readFileSync(path.join(SELF, 'build', 'gunzip.js'), 'utf8');
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

// 書名／副標由內容工作區指定（--title／--sub），閱讀器本身保持中立
const META_TITLE = opt('title', '');
const META_SUB = opt('sub', '');
if (META_TITLE || META_SUB) D.meta = Object.assign({}, D.meta, { title: META_TITLE || (D.meta && D.meta.title), sub: META_SUB || (D.meta && D.meta.sub) });
// 辭典（可選）：工作區根目錄有 glossary.json 就一併內嵌
const glossPath = path.join(CONTENT, 'glossary.json');
if (fs.existsSync(glossPath)) {
  try { D.glossary = JSON.parse(fs.readFileSync(glossPath, 'utf8')); console.log('辭典 ' + (D.glossary.entries || []).length + ' 條'); }
  catch (e) { console.warn('glossary.json 解析失敗，略過：' + e.message); }
}
const json = JSON.stringify(D);
const gz = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
const b64 = gz.toString('base64');

let out = html;
out = out.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>');
out = out.replace(/<script src="lossless\.js"><\/script>\s*<script src="zhu-data\.js"><\/script>\s*<script src="app\.js"><\/script>\s*<script src="tour\.js"><\/script>/, '');
if (META_TITLE) out = out.replace(/<title>[^<]*<\/title>/, '<title>' + META_TITLE + '</title>');

// PWA：manifest／sw.js／圖示，跟單檔放同一個目錄
const pwa = writePWA({ outFile: OUT, title: META_TITLE || '經注閱讀器', sub: META_SUB || '', startUrl: opt('start', '') });
out = out.replace('</head>', '<link rel="manifest" href="' + pwa.manifestName + '">\n</head>');

const EARLY_TICK = '<script>(function(){var n=0;var t=setInterval(function(){var b=document.getElementById("bootBar"),l=document.getElementById("bootNum");if(!b){clearInterval(t);return;}n=Math.min(86,n+2.4);b.style.width=n.toFixed(1)+"%";if(l)l.textContent=Math.round(n)+"%…";},120);window.__bootTickStop=function(){clearInterval(t);};})();</scr' + 'ipt>';
const dataTag = '<script id="zhu-b64" type="text/plain">' + b64 + '</script>';
const appCode = app.replace(/<\/script/gi, '<\\/script');
const tourCode = tour.replace(/<\/script/gi, '<\\/script');
const boot = renderBoot({ gunzip: gunzip, lossless: lossless, app: app, tour: tour });

out = out.replace('</body>', EARLY_TICK + dataTag + boot + '\n</body>');

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
