// 把主站 incubator/ 的 vcpp.html 與 vcpp.html.gz 原樣同步到鏡像（避免兩站版本不一致）。
//   node build/sync-mirror.mjs [--dry]
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = 'D:\\2026\\zhu-combined';
const LOCAL = path.join(ROOT, '.local');
const PSCP = 'C:\\Program Files\\PuTTY\\pscp.exe';
const PLINK = 'C:\\Program Files\\PuTTY\\plink.exe';
const DRY = process.argv.includes('--dry');

const env = {};
for (const line of fs.readFileSync(path.join(LOCAL, 'server.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1].toUpperCase()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const HOST = env.HOST;
const MIRROR = env.MIRROR_HOST || 'nissaya.cn';
const USER = env.USER;
const PASS = env.PASS;
const PORT = env.PORT || '22';
const keyP = fs.readFileSync(path.join(LOCAL, 'hostkey.txt'), 'utf8').trim();
const keyM = fs.readFileSync(path.join(LOCAL, 'hostkey-nissaya.cn.txt'), 'utf8').trim();
const DIR = '/var/www/html/incubator';

const pwFile = path.join(os.tmpdir(), `.sync-pw-${process.pid}.tmp`);
fs.writeFileSync(pwFile, PASS + '\n', { mode: 0o600 });
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

function run(cmd, label) {
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('✗ ' + label + '\n' + (r.stdout || '') + (r.stderr || ''));
    process.exit(1);
  }
  return (r.stdout || '').trim();
}
const pscpGet = (host, key, remote, local) =>
  run([PSCP, '-batch', '-P', PORT, '-hostkey', key, '-pwfile', pwFile, `${USER}@${host}:${remote}`, local], `pscp get ${host} ${path.basename(remote)}`);
const pscpPut = (host, key, local, remote) =>
  run([PSCP, '-batch', '-P', PORT, '-hostkey', key, '-pwfile', pwFile, local, `${USER}@${host}:${remote}`], `pscp put ${host} ${path.basename(remote)}`);
const plink = (host, key, script) => {
  const f = path.join(os.tmpdir(), `.sync-${process.pid}.sh`);
  fs.writeFileSync(f, script);
  try { return run([PLINK, '-batch', '-ssh', '-P', PORT, '-hostkey', key, '-pwfile', pwFile, '-m', f, `${USER}@${host}`], `plink ${host}`); }
  finally { fs.rmSync(f, { force: true }); }
};

try {
  const tmpHtml = path.join(os.tmpdir(), `sync-vcpp-${process.pid}.html`);
  const tmpGz = path.join(os.tmpdir(), `sync-vcpp-${process.pid}.html.gz`);

  console.log('1) 從主站抓檔');
  pscpGet(HOST, keyP, `${DIR}/vcpp.html`, tmpHtml);
  pscpGet(HOST, keyP, `${DIR}/vcpp.html.gz`, tmpGz);
  const html = fs.readFileSync(tmpHtml);
  const gz = fs.readFileSync(tmpGz);
  console.log(`   vcpp.html ${html.length.toLocaleString('en-US')} bytes  md5 ${md5(html)}`);
  console.log(`   vcpp.html.gz ${gz.length.toLocaleString('en-US')} bytes  md5 ${md5(gz)}`);
  const prim = plink(HOST, keyP, `cd ${DIR} && md5sum vcpp.html vcpp.html.gz`);
  console.log('   主站 md5sum：\n' + prim.split(/\r?\n/).map((l) => '     ' + l).join('\n'));

  if (DRY) { console.log('（--dry：不上傳）'); process.exit(0); }

  console.log('2) 上傳到鏡像（.tmp → mv）');
  pscpPut(MIRROR, keyM, tmpHtml, `${DIR}/.tmp-vcpp.html`);
  pscpPut(MIRROR, keyM, tmpGz, `${DIR}/.tmp-vcpp.html.gz`);
  const out = plink(MIRROR, keyM, [
    'set -e',
    `cd ${DIR}`,
    'mv -f .tmp-vcpp.html vcpp.html',
    'mv -f .tmp-vcpp.html.gz vcpp.html.gz',
    'chmod a+r vcpp.html vcpp.html.gz',
    'ls -l vcpp.html vcpp.html.gz',
    'md5sum vcpp.html vcpp.html.gz',
  ].join('\n'));
  console.log(out.split(/\r?\n/).map((l) => '   ' + l).join('\n'));

  const got = {};
  for (const l of out.split(/\r?\n/)) {
    const m = /^([0-9a-f]{32})\s+(.+)$/.exec(l.trim());
    if (m) got[m[2]] = m[1];
  }
  const okHtml = got['vcpp.html'] === md5(html);
  const okGz = got['vcpp.html.gz'] === md5(gz);
  console.log(`3) 比對：vcpp.html ${okHtml ? '✓' : '✗'}  vcpp.html.gz ${okGz ? '✓' : '✗'}`);
  if (!okHtml || !okGz) process.exit(1);
  fs.rmSync(tmpHtml, { force: true });
  fs.rmSync(tmpGz, { force: true });
} finally {
  fs.rmSync(pwFile, { force: true });
}
