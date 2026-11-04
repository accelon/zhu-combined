// 把《金剛經合注》的內容從閱讀器（zhu-combined）剝離到內容工作區（vcpp）。
//   node build/split-content.mjs [--dry]
// 只搬內容與內容專用管線；閱讀器程式、導覽、打包器留在 zhu-combined。
import fs from 'node:fs';
import path from 'node:path';

const READER = 'D:\\2026\\zhu-combined';
const CONTENT = 'D:\\2026\\vcpp';
const DRY = process.argv.includes('--dry');

// 根目錄：內容與其成品、部署（部署跟內容走）
const ROOT_FILES = [
  'zhu-data.js',
  'pdf-entries.json', 'pdf-text.txt',
  'conze-blocks.json', 'conze-en.json', 'conze-raw.txt',
  'ctzen.json', 'chengguan.json', 'jinyi.json', 'muller.json',
  'gloss-overrides.tsv',
  'shuzheng-u38.md', '書證-影片來源.txt', 'moshuyuan.md', 'docx-text.txt',
  'alignment-skill.md', 'KEPAN.md',
  'deploy.mjs', 'deploy-incubator.mjs', 'deploy.md',
  'vcpp-kepan.html', 'vcpp-nokepan.html',
];

// 整個目錄搬（資料、語料管線、成品、憑證）
const DIRS = ['kepan', 'vendor', '.local', 'deploy'];

// build/ 裡屬於「這一經群」的管線（其餘 cdp-* 等開發工具留在閱讀器）
const BUILD_FILES = [
  'build-data.ts', 'align-sections.py', 'research.ts',
  'parse_chengguan.py', 'extract_english.py', 'fetch_jinyi.py', 'make_cizhou.py',
  'conze_lib.py', 'conze-align.py', 'conze-blocks.py', 'conze-check.py',
  'conze-extract.py', 'conze-range.py', 'conze-starts.py',
  'conze-cuts.json', 'conze-ranges.json',
  'fetch_moshuyuan.mjs', 'kepan-parse.mjs', 'scan-kepan.mjs',
  'dump-pdf-u.mjs', 'dump-u38.mjs', 'tib-75.mjs',
  'decode-cost.mjs', 'size-report.mjs', 'size-scenarios.mjs', 'perf.mjs',
  'cdp-kepan.mjs', 'cdp-live.mjs', 'cdp-notes.mjs', 'cdp-real.mjs', 'cdp-stable.mjs', 'cdp-trail.mjs', 'cdp-crumb.mjs',
];

// build/ 的成品（長圖）
const BUILD_DIRS = ['series'];

function moveFile(rel, fromRoot, toRoot) {
  const src = path.join(fromRoot, rel);
  const dst = path.join(toRoot, rel);
  if (!fs.existsSync(src)) { console.log('（略過，沒有）' + rel); return; }
  if (DRY) { console.log('搬 ' + rel); return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  console.log('搬 ' + rel);
}

function moveDir(rel, fromRoot, toRoot) {
  const src = path.join(fromRoot, rel);
  const dst = path.join(toRoot, rel);
  if (!fs.existsSync(src)) { console.log('（略過，沒有）' + rel); return; }
  if (DRY) { console.log('搬 ' + rel + '/'); return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  console.log('搬 ' + rel + '/');
}

for (const f of ROOT_FILES) moveFile(f, READER, CONTENT);
for (const d of DIRS) moveDir(d, READER, CONTENT);
for (const f of BUILD_FILES) moveFile(path.join('build', f), READER, CONTENT);
for (const d of BUILD_DIRS) moveDir(path.join('build', d), READER, CONTENT);

console.log(DRY ? '（dry run）' : '搬完了');
