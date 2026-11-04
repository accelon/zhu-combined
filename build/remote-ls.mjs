// 遠端巡檢：列出 incubator 與 huixintang 的檔案與 .prev（不印帳密）。
//   node build/remote-ls.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LOCAL = path.join('D:\\2026\\zhu-combined', '.local');
const PLINK = 'C:\\Program Files\\PuTTY\\plink.exe';

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m) env[m[1].toUpperCase()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnv(path.join(LOCAL, 'server.env'));
const targets = [
  { id: 'primary', host: env.HOST, key: path.join(LOCAL, 'hostkey.txt') },
  { id: 'mirror', host: env.MIRROR_HOST || 'nissaya.cn', key: path.join(LOCAL, 'hostkey-nissaya.cn.txt') },
];

const cmd = process.argv[2] || 'ls -la --time-style=long-iso /var/www/html/incubator | head -30; echo ---; ls -la --time-style=long-iso /var/www/html/huixintang | head -30';

for (const t of targets) {
  const r = spawnSync(PLINK, [
    '-batch', '-ssh', '-P', env.PORT || '22',
    '-hostkey', fs.readFileSync(t.key, 'utf8').trim(),
    '-pw', env.PASS, `${env.USER}@${t.host}`, cmd,
  ], { encoding: 'utf8' });
  console.log('===== ' + t.id + ' ' + t.host);
  console.log((r.stdout || '').trim());
  if (r.stderr && r.stderr.trim()) console.log('[stderr] ' + r.stderr.trim());
}
