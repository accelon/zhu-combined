// 一次做完操作導覽的兩步（避免只改了 .tour 卻忘了重新打包）：
//   1. 編譯 tours/*.tour → src/tour/tour-data.ts
//   2. 打包 src/tour/app.ts → tour.js（單檔建置會把它內嵌）
//
//   bun run build-tour.mjs           # 編譯＋打包
//   bun run build-tour.mjs --check   # tour-data 是否最新，且 tour.js 裡是不是同一份劇本
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bun = process.execPath; // 用同一支 bun，Windows 不必找 PATH
const args = process.argv.slice(2);
const check = args.includes('--check');
const SELF = path.dirname(fileURLToPath(import.meta.url));
const rootArg = args.indexOf('--root');
const ROOT = rootArg >= 0 && args[rootArg + 1] ? path.resolve(args[rootArg + 1]) : process.cwd();
// 劇本與成品在工作區；編譯出來的 tour-data 仍放閱讀器（app.ts 從這裡 import）
const env = Object.assign({}, process.env, {
  TOUR_DIR: path.join(ROOT, 'tours'),
  TOUR_OUT: path.join(SELF, 'src', 'tour', 'tour-data.ts'),
  TOUR_TPL: path.join(SELF, 'index.html'),
});

const run = (argv) => {
  const r = spawnSync(bun, argv, { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run(['run', path.join(SELF, 'src', 'tour', 'build-tours.ts'), '--config', path.join(SELF, 'tour.config.ts'), ...args]);

if (!check) {
  run(['build', path.join(SELF, 'src', 'tour', 'app.ts'), '--target', 'browser', '--format=iife', '--outfile', path.join(ROOT, 'tour.js')]);
  process.exit(0);
}

// --check：比對內容而不是 mtime（clone 之後 mtime 沒有意義）
if (!existsSync(path.join(ROOT, 'tour.js'))) {
  console.error('沒有 tour.js：跑一次 `bun run build-tour.mjs`');
  process.exit(1);
}
const data = readFileSync(path.join(SELF, 'src', 'tour', 'tour-data.ts'), 'utf8');
const bundled = readFileSync(path.join(ROOT, 'tour.js'), 'utf8');
const blobs = [...data.matchAll(/'([A-Za-z0-9+/=]{40,})'/g)].map((m) => m[1]);
const stale = blobs.filter((b) => !bundled.includes(b));
if (stale.length) {
  console.error(`tour.js 裡的劇本不是最新的（${stale.length} 份沒打包）：跑一次 \`bun run build-tour.mjs\``);
  process.exit(1);
}
console.log('tour.js 與劇本同步');
