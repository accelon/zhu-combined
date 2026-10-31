// 一次做完操作導覽的兩步（避免只改了 .tour 卻忘了重新打包）：
//   1. 編譯 tours/*.tour → src/tour/tour-data.ts
//   2. 打包 src/tour/app.ts → tour.js（單檔建置會把它內嵌）
//
//   bun run build-tour.mjs           # 編譯＋打包
//   bun run build-tour.mjs --check   # tour-data 是否最新，且 tour.js 裡是不是同一份劇本
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const bun = process.execPath; // 用同一支 bun，Windows 不必找 PATH
const args = process.argv.slice(2);
const check = args.includes('--check');

const run = (argv) => {
  const r = spawnSync(bun, argv, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run(['run', 'src/tour/build-tours.ts', '--config', 'tour.config.ts', ...args]);

if (!check) {
  run(['build', 'src/tour/app.ts', '--target', 'browser', '--format=iife', '--outfile', 'tour.js']);
  process.exit(0);
}

// --check：比對內容而不是 mtime（clone 之後 mtime 沒有意義）
if (!existsSync('tour.js')) {
  console.error('沒有 tour.js：跑一次 `bun run build-tour.mjs`');
  process.exit(1);
}
const data = readFileSync('src/tour/tour-data.ts', 'utf8');
const bundled = readFileSync('tour.js', 'utf8');
const blobs = [...data.matchAll(/'([A-Za-z0-9+/=]{40,})'/g)].map((m) => m[1]);
const stale = blobs.filter((b) => !bundled.includes(b));
if (stale.length) {
  console.error(`tour.js 裡的劇本不是最新的（${stale.length} 份沒打包）：跑一次 \`bun run build-tour.mjs\``);
  process.exit(1);
}
console.log('tour.js 與劇本同步');
