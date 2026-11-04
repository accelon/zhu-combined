// 由繁體母稿 sanjie.html 生成簡體版，再輸出整圖與上下兩張。
// 用法：node kepan/build.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const src = path.join(dir, 'sanjie.html');
const zhs = path.join(dir, '科文经文注文.html');

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) { console.error('failed:', cmd, args.join(' ')); process.exit(r.status || 1); }
};

run('python', [path.join(dir, 't2s.py'), src, zhs]);

const jobs = [
  ['', '科文经文注文-全图.png'],
  ['?part=1', '科文经文注文-上.png'],
  ['?part=2', '科文经文注文-下.png'],
];
for (const [q, out] of jobs) {
  run('node', [path.join(dir, 'render.mjs'), zhs + q, path.join(dir, out)]);
}
console.log('done');
