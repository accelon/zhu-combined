// 依 apps.json 打包應用。
//
//   node build-all.mjs                 # 只打包 default（心經）
//   node build-all.mjs --all           # 更新所有應用
//   node build-all.mjs --app vcpp      # 只打包金剛經
//   node build-all.mjs --list          # 看清單
//
// 每個應用的打包腳本在它自己的工作區（build.mjs），呼叫閱讀器的打包器，
// 資料與書名／副標／頁尾都在該工作區。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const reg = JSON.parse(fs.readFileSync(path.join(HERE, 'apps.json'), 'utf8'));
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : null;
};

if (arg('list')) {
  for (const a of reg.apps) {
    console.log(`${a.id === reg.default ? '*' : ' '} ${a.id.padEnd(10)} ${a.name}  ${a.workspace}`);
  }
  console.log('（* = 不指定時只打包這個）');
  process.exit(0);
}

let targets;
const appId = arg('app');
if (argv.includes('--all')) targets = reg.apps;
else if (appId) targets = reg.apps.filter((a) => a.id === appId);
else targets = reg.apps.filter((a) => a.id === reg.default);

if (!targets.length) {
  console.error('沒有這個應用：' + appId + '（用 --list 看清單）');
  process.exit(1);
}

const results = [];
for (const app of targets) {
  const dir = app.workspace;
  if (!fs.existsSync(dir)) {
    results.push({ app, ok: false, why: '工作區不存在：' + dir });
    continue;
  }
  const script = path.join(dir, app.build || 'build.mjs');
  if (!fs.existsSync(script)) {
    results.push({ app, ok: false, why: '找不到 ' + script });
    continue;
  }
  console.log(`\n== 打包 ${app.id}（${app.name}）==`);
  const r = spawnSync(process.execPath, [script], { stdio: 'inherit', cwd: dir });
  const ok = r.status === 0;
  const outs = (app.outputs || []).map((f) => {
    const p = path.join(dir, f);
    return fs.existsSync(p) ? `${f} ${fs.statSync(p).size.toLocaleString('en-US')}` : `${f}（缺）`;
  });
  results.push({ app, ok, outs });
}

console.log('\n== 結果 ==');
for (const r of results) {
  console.log(r.ok ? `✓ ${r.app.id}  ${(r.outs || []).join('  ')}` : `✗ ${r.app.id}  ${r.why}`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
