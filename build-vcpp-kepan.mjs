// 產生單檔 vcpp-kepan.html：經文＋別譯＋注疏＋科文（江味農、印順），全部內嵌。
//
// 與 build-vcpp.mjs 的差別只有三點：
//   1. 多內嵌 kepan/kepan-data.js（window.KEPAN）與 src/kepan/ 的介面（CSS＋JS）。
//   2. 資料改成一個 gzip blob：{ zhu, kepan }。
//   3. 舊檔（index.html／app.js／style.css／tour.js）只讀不改，科文介面是額外一層。
//
// 用法：
//   node build-vcpp-kepan.mjs                 # 收全部全文（約 3MB）
//   node build-vcpp-kepan.mjs --limit 40000   # 輕量版
//   node build-vcpp-kepan.mjs --max 16
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { renderBoot } from './build/boot-template.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
// 閱讀器程式（index.html／app.js／style.css／tour.js／src/kepan）在這一支的目錄；
// 內容（zhu-data.js、kepan/kepan-data.js）在 --root 指定的工作區。
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.resolve(opt('root', process.cwd()));

const limitArg = String(opt('limit', 'all')).toLowerCase();
const LIMIT = (limitArg === 'all' || limitArg === '0') ? Infinity : +limitArg;
const MAX_MB = +opt('max', 8);
const OUT = path.resolve(opt('out', path.join(CONTENT, 'vcpp-kepan.html')));
// 輕量版要保留全文的 work id（由內容工作區用 --keep 指定；預設不保留）
const KEEP = new Set(String(opt('keep', '')).split(',').map((x) => x.trim()).filter(Boolean));

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('index.html');
const css = read('style.css');
const kepanCss = read('src/kepan/kepan.css');
const kepanJs = read('src/kepan/kepan.js');
const tourFile = path.join(CONTENT, 'tour.js');
const tour = fs.existsSync(tourFile) ? fs.readFileSync(tourFile, 'utf8') : '';
const lossless = read('lossless.js');
const gunzip = read('build/gunzip.js');

/**
 * app.js 只在「這個單檔」裡做幾處行為修補（磁碟上的 app.js 不動，舊站照原樣）：
 *   1. 注疏／別譯 同一次最多由 3 家放寬到 5 家
 *   2. 還沒挑過注疏時，先掛上僧肇（沒有僧肇就掛最早的那一家）
 * 每一處都要求「恰好命中一次」，app.js 改了就會在建置時報錯，不會默默失效。
 * 注文分頁與書籤在 app.js 本體，這裡不再處理。
 */
function patchApp(src) {
  src = src.replace(/\r\n/g, '\n');   // app.js 是 CRLF，先正規化
  const reps = [
    ['rep 注疏上限 3 → 5',
      'if (state.pick.length >= 3) return null; // 已滿',
      'if (state.pick.length >= 5) return null; // 已滿（最多同時五家）'],
    ['rep 別譯上限 3 → 5',
      'else { if (state.altPick.length >= 3) return; state.altPick.unshift(i); }',
      'else { if (state.altPick.length >= 5) return; state.altPick.unshift(i); }'],
    ['rep 空狀態文案',
      '<p class="empty">點上面的作者名看注疏（可同時開 1–3 家）。</p>',
      '<p class="empty">點上面的作者名看注疏（可同時開 1–5 家）。</p>'],
    ['add 預設僧肇',
      '    const picks = pickEntries(u);\n    const ids = new Set(picks.map((x) => x.w.id));',
      '    const picks = pickEntries(u);\n' +
      '    // 還沒有挑過任何注疏：先掛上僧肇（最早的一家；沒有僧肇就掛最早的一家）\n' +
      '    if (!picks.length && list.length && !state.pick.length && !state.pickTouched) {\n' +
      "      const sz = list.filter((x) => /僧肇/.test(x.w.author || ''))[0] || list[0];\n" +
      '      if (sz) { state.pick.push(sz.w.id); picks.push(sz); }\n' +
      '    }\n' +
      '    const ids = new Set(picks.map((x) => x.w.id));'],
    ['add pickTouched',
      '  function togglePick(id) {\n    const i = state.pick.indexOf(id);',
      '  function togglePick(id) {\n    state.pickTouched = true;\n    const i = state.pick.indexOf(id);'],
    ['add 作者簡稱規則',
      '  function renderCards(u) {',
      '  /* 作者簡稱：一排按鈕只放「作者」本人。\n' +
      '     - 並列（宗密·子璿、翁春·王錫琯）只取第一個名字，去掉前綴「釋」與後綴「菩薩」\n' +
      '     - 兩家簡稱撞名時（宗密·子璿 / 宗密·子璿·大璸）補上最後一個名字好區分\n' +
      '     - 註文標題仍用全名，滑過去看得到 */\n' +
      '  const nbBase = (w) => String(authorShort(w.author).split(\'·\')[0] || \'\')\n' +
      '    .replace(/^釋/, \'\').replace(/菩薩$/, \'\').replace(/法師$/, \'\');\n' +
      '  function nbLabels(list) {\n' +
      '    const cnt = {};\n' +
      '    list.forEach((x) => { const b = nbBase(x.w); cnt[b] = (cnt[b] || 0) + 1; });\n' +
      '    return (w) => {\n' +
      '      const parts = authorShort(w.author).split(\'·\').filter(Boolean);\n' +
      '      const b = nbBase(w);\n' +
      '      return cnt[b] > 1 && parts.length > 1 ? b + \'·\' + parts[parts.length - 1] : b;\n' +
      '    };\n' +
      '  }\n' +
      '  function renderCards(u) {'],
    ['add 時代色',
      '  function renderCards(u) {',
      '  /* 注疏按鈕的時代色：東晉 317（色相 20°）→ 民國 1942（320°），與科判的層深色同一套做法 */\n' +
      '  const NB_Y0 = 317, NB_Y1 = 1942;\n' +
      '  const nbHue = (y) => {\n' +
      '    const yy = Math.max(NB_Y0, Math.min(NB_Y1, +y || NB_Y0));\n' +
      '    return Math.round(20 + (yy - NB_Y0) / (NB_Y1 - NB_Y0) * 300) % 360;\n' +
      '  };\n' +
      '  function renderCards(u) {'],
    ['add 按鈕時代色相',
      'data-w="${esc(x.w.id)}" title="${esc(x.w.author)}《${esc(x.w.title)}》"',
      'data-w="${esc(x.w.id)}" style="--nb-hue:${nbHue(x.w.year)}" title="${esc(x.w.author)}《${esc(x.w.title)}》"'],
    ['add 按鈕用簡稱規則',
      '    let html = \'<div class="note-bar">\' + list.map((x) =>',
      '    const labelOf = nbLabels(list);\n' +
      '    let html = \'<div class="note-bar">\' + list.map((x) =>'],
    ['add 按鈕標籤',
      '>${esc(authorShort(x.w.author))}</button>`',
      '>${esc(labelOf(x.w))}</button>`'],
  ];
  let out = src;
  for (const [label, find, repl] of reps) {
    const n = out.split(find).length - 1;
    if (n !== 1) throw new Error(`patchApp：${label} 應該命中 1 次，實際 ${n} 次（app.js 被改過？）`);
    out = out.replace(find, repl);
  }
  console.log('app.js 修補 ' + reps.length + ' 處');
  return out;
}
const app = patchApp(read('app.js'));


/**
 * 單檔的 head：換標題、補 description 與 og（孵化區規定要寫；index.html 不動）。
 */
function patchHead(src) {
  const TITLE = opt('title', '') || '經注閱讀器 · 科文版';
  const DESC = opt('desc', '') || '經注對讀：分章、別譯、注疏、梵藏逐詞與科判。純靜態單頁。';
  const tags = [
    '<meta name="description" content="' + DESC + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + TITLE + '">',
    '<meta property="og:description" content="' + DESC + '">',
    '<meta name="theme-color" content="#f8f3e9" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#1b1815" media="(prefers-color-scheme: dark)">',
  ].join('\n');
  return src
    .replace(/<title>[^<]*<\/title>/, '<title>' + (opt('title', '') || TITLE) + '</title>\n' + tags)
    .replace('<meta name="viewport" content="width=device-width,initial-scale=1">',
             '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">');
}

const D = JSON.parse(fs.readFileSync(path.join(CONTENT, 'zhu-data.js'), 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const KP = JSON.parse(fs.readFileSync(path.join(CONTENT, 'kepan', 'kepan-data.js'), 'utf8').replace(/^window\.KEPAN=/, '').replace(/;\s*$/, ''));

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

KP.build = new Date().toISOString();   // 頁面上的「建置」時間，用來確認有沒有重新載入
// 書名／副標由內容工作區指定（--title／--sub）
const META_TITLE = opt('title', '');
const META_SUB = opt('sub', '');
if (META_TITLE || META_SUB) D.meta = Object.assign({}, D.meta, { title: META_TITLE || (D.meta && D.meta.title), sub: META_SUB || (D.meta && D.meta.sub) });
const payload = JSON.stringify({ zhu: D, kepan: KP });
const gz = zlib.gzipSync(Buffer.from(payload, 'utf8'), { level: 9 });
const b64 = gz.toString('base64');

let out = html;
out = out.replace('<link rel="stylesheet" href="style.css">',
  '<style>\n' + css + '\n</style>\n<style>\n' + kepanCss + '\n</style>');
out = out.replace(
  /<script src="lossless\.js"><\/script>\s*<script src="zhu-data\.js"><\/script>\s*<script src="app\.js"><\/script>\s*<script src="tour\.js"><\/script>/,
  '');
out = patchHead(out);   // 標題、description、og（孵化區規定）
// 標題列按鈕（書籤／導覽／明暗）在第一次繪製前就搬到最左上，避免載入後由右跳到左
const earlyMove = `
<script>
(function () {
  document.body.classList.add('kb-layer');
  var top = document.getElementById('top');
  if (!top) return;
  var box = top.querySelector('.kb-utils');
  if (!box) { box = document.createElement('div'); box.className = 'kb-utils'; }
  ['fsBtn', 'bmBtn', 'theme', 'simBtn'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.parentNode !== box) box.appendChild(el);
  });
  if (!box.parentNode && box.childNodes.length) top.insertBefore(box, top.firstChild);
})();
</script>`;
out = out.replace('</header>', '</header>' + earlyMove);


const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const dataTag = '<script id="zhu-b64" type="text/plain">' + b64 + '</script>';
const boot = renderBoot({ gunzip: gunzip, lossless: lossless, app: app, tour: tour, kepanJs: kepanJs });

out = out.replace('</body>', dataTag + boot + '\n</body>');

fs.writeFileSync(OUT, out);
const bytes = fs.statSync(OUT).size;
console.log('寫出 ' + OUT);
console.log('大小 ' + (bytes / 1048576).toFixed(2) + ' MiB（' + bytes + ' bytes），上限 ' + MAX_MB + ' MiB');
console.log('gzip 資料 ' + (gz.length / 1048576).toFixed(2) + ' MiB；base64 ' + (b64.length / 1048576).toFixed(2) + ' MiB');
console.log('科判 ' + KP.editions.length + ' 家：' + KP.editions.map((e) => e.short + '(' + e.nodes.length + ')').join('、'));
console.log('全文上限 ' + (LIMIT === Infinity ? '不限' : LIMIT + ' 字') +
  '；去掉 ' + dropped.length + ' 部大部頭' +
  (dropped.length ? '：' + dropped.map((x) => x.id + '(' + x.chars + ')').join(', ') : ''));
if (bytes > MAX_MB * 1024 * 1024) {
  console.error('✗ 超過 ' + MAX_MB + ' MiB，請降低 --limit 或用 --max 放寬');
  process.exit(1);
}
