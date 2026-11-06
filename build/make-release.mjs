// 出「給內容工作區」的閱讀器發行包（zip，帶日期）。
//
//   node build/make-release.mjs                  # → dist/zhu-combined-reader-YYYY-MM-DD.zip
//   node build/make-release.mjs --tag b          # → …-YYYY-MM-DD-b.zip（同一天出第二包）
//   node build/make-release.mjs --out D:\x.zip   # 自訂輸出路徑
//   node build/make-release.mjs --check          # 只列出會裝哪些檔、不打包
//
// 為什麼要這支：拿到包的人（佛教研究者）不用 git，只會解壓、跑 node。
// 所以每次更新閱讀器或規則，就重出一包、檔名押日期；舊包留著對照。
//
// 包裡不放：資料（zhu-data.js、kepan/kepan-data.js、mantra/）、.git、截圖、
// 建置中間檔（build/_*、*.png、build/rev）。那些在各自工作區產生。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (name, fb) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fb;
};
const CHECK = args.includes('--check');
const ALLOW_DIRTY = args.includes('--allow-dirty');
const NAME = 'zhu-combined-reader';

const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const DATE = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TAG = opt('tag', '');
const VERSION = TAG ? `${DATE}-${TAG}` : DATE;
const FOLDER = `${NAME}-${VERSION}`;
const OUT = path.isAbsolute(opt('out', ''))
  ? opt('out')
  : path.join(HERE, opt('out', path.join('dist', `${FOLDER}.zip`)));

const git = (a) => {
  const r = spawnSync('git', a, { cwd: HERE, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
};
const COMMIT = git(['rev-parse', '--short', 'HEAD']) || 'nogit';
const DIRTY = git(['status', '--porcelain']) ? '（工作區有未提交變更）' : '';
// 工作區不乾淨就預設不出包：別人（或自己）改到一半的檔案不該發給讀者。
if (DIRTY && !ALLOW_DIRTY && !CHECK) {
  console.error('✗ 工作區有未提交變更，先 commit（或另一個人正在改）再出包。');
  console.error('  只是要自己看內容：--check；確定要帶髒樹出包：--allow-dirty');
  console.error(git(['status', '--short']));
  process.exit(1);
}

// 要裝哪些檔：改這裡就好，不要用 git add -A 的心態整包掃。
const ROOT_FILES = [
  'index.html', 'app.js', 'style.css', 'lossless.js',
  'README.md', 'KEPAN.md', 'zhu-combined-skill.md', 'LICENSE',
  'apps.json', 'build-all.mjs', 'build-kepan.mjs', 'build-vcpp.mjs',
  'build-tour.mjs', 'tour.config.ts',
];
const DIRS = ['assets', 'src', 'docs'];
const BUILD_FILES = [
  'boot-template.mjs', 'gunzip.js', 'make-lossless.mjs', 'pwa.mjs',
  'serve.mjs', 'split-content.mjs', 'sync-mirror.mjs', 'remote-ls.mjs',
  'shots-deck.mjs', 'shots-walk.mjs',
];
const list = (dir, re) => (fs.existsSync(path.join(HERE, dir))
  ? fs.readdirSync(path.join(HERE, dir)).filter((f) => re.test(f)).map((f) => path.posix.join(dir, f))
  : []);

const files = [
  ...ROOT_FILES,
  ...BUILD_FILES.map((f) => 'build/' + f),
  ...list('build', /^cdp-.*\.mjs$/),
  ...list('build/kepan', /\.mjs$/),
];

const missing = files.filter((f) => !fs.existsSync(path.join(HERE, f)));
if (missing.length) {
  console.error('✗ 找不到：' + missing.join('、'));
  process.exit(1);
}

const stage = path.join(os.tmpdir(), 'zhu-release-' + process.pid, FOLDER);
const cleanup = () => { try { fs.rmSync(path.dirname(stage), { recursive: true, force: true }); } catch (e) {} };

function copyInto(rel) {
  const src = path.join(HERE, rel);
  const dst = path.join(stage, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

let count = 0;
for (const rel of files) { copyInto(rel); count++; }
for (const dir of DIRS) {
  const p = path.join(HERE, dir);
  if (!fs.existsSync(p)) continue;
  copyInto(dir);
  const walk = (q) => fs.readdirSync(q, { withFileTypes: true }).forEach((e) => {
    const full = path.join(q, e.name);
    if (e.isDirectory()) walk(full);
    else count++;
  });
  walk(p);
}

// START-HERE：從版控裡的樣板產生，押上日期與 commit，讓對方知道我給的是哪一版
const tplPath = path.join(HERE, 'docs/release/START-HERE.template.md');
if (!fs.existsSync(tplPath)) { console.error('✗ 找不到樣板 ' + tplPath); process.exit(1); }
const startHere = fs.readFileSync(tplPath, 'utf8')
  .replace(/\{\{DATE\}\}/g, DATE)
  .replace(/\{\{VERSION\}\}/g, VERSION)
  .replace(/\{\{COMMIT\}\}/g, COMMIT)
  .replace(/\{\{FILES\}\}/g, String(count));
fs.writeFileSync(path.join(stage, 'START-HERE.md'), startHere);

fs.writeFileSync(path.join(stage, 'VERSION.txt'), [
  'zhu-combined 閱讀器發行包',
  '發行日      ' + DATE,
  '版本        ' + VERSION,
  'commit      ' + COMMIT + (DIRTY ? ' ' + DIRTY : ''),
  '檔案數      ' + count,
  '單檔上限    5 MiB（5,242,880 bytes）＝ 資料＋閱讀器打包後',
  '打包器預設  8 MiB（其他專案用；華嚴一律 --max 5）',
  '來源        https://github.com/accelon/zhu-combined ' + COMMIT,
  '',
  '更新閱讀器或規則時會重出一包，檔名與資料夾都帶日期，舊包留著對照。',
  '閱讀器本體不要在這裡改；有問題回 D:\\2026\\zhu-combined。',
].join('\n') + '\n');

if (CHECK) {
  console.log(FOLDER + '（' + count + ' 檔）→ ' + OUT);
  console.log(files.join('\n'));
  cleanup();
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.rmSync(OUT, { force: true });
// Windows 內建 bsdtar 就能寫 zip，不必裝 7z／powershell 模組
let r = spawnSync('tar', ['-a', '-c', '-f', OUT, '-C', path.dirname(stage), FOLDER], { encoding: 'utf8' });
if (r.status !== 0 || !fs.existsSync(OUT)) {
  console.error('✗ tar 打包失敗：' + (r.stderr || r.status));
  cleanup();
  process.exit(1);
}
cleanup();

const bytes = fs.statSync(OUT).size;
console.log('寫出 ' + OUT);
console.log('  ' + FOLDER + '（' + count + ' 檔，' + (bytes / 1024).toFixed(0) + ' KB）');
console.log('  發行日 ' + DATE + '　commit ' + COMMIT + (DIRTY ? ' ' + DIRTY : ''));
console.log('  單檔上限 5 MiB（資料＋閱讀器）；打包指令要帶 --max 5');

