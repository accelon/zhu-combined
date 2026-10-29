// 部署 zhu-combined 到：
//   主站 https://shutonggui.cn/huixintang/vcpp.html
//   鏡像 https://nissaya.cn/huixintang/vcpp.html
//
// 用法：
//   node deploy.mjs --check     # 只檢查兩站的目錄與權限
//   node deploy.mjs             # 上傳並驗證
//   node deploy.mjs --primary-only
//   node deploy.mjs --mirror-only
//   node deploy.mjs --max 16    # vcpp.html 大小上限（MiB，預設 8）
//
// 連線憑證沿用 D:\2026\adb-converter\.local\server.env 與 hostkey*.txt，
// 帳密不會被印出。docroot 預設由 server.env 的 DOCROOT 推得：
//   /var/www/html/accelon26 → /var/www/html/huixintang
// 可用 --docroot / --mirror-docroot 覆寫。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LOCAL = 'D:\\2026\\zhu-combined\\.local';
const PSCP = 'C:\\Program Files\\PuTTY\\pscp.exe';
const PLINK = 'C:\\Program Files\\PuTTY\\plink.exe';
const ROOT = 'D:\\2026\\zhu-combined';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const CHECK = args.includes('--check');
const PRIMARY_ONLY = args.includes('--primary-only');
const MIRROR_ONLY = args.includes('--mirror-only');
const MAX_MB = +opt('max', 8);

function die(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

const envFile = opt('env', path.join(LOCAL, 'server.env'));
if (!fs.existsSync(envFile)) die('找不到 ' + envFile);
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1].toUpperCase()] = m[2].trim().replace(/^["']|["']$/g, '');
}
if (!env.HOST || !env.USER || !env.PASS) die('server.env 缺少 HOST／USER／PASS');

const BASE_DOCROOT = (env.DOCROOT || '/var/www/html/accelon26').replace(/\/+$/, '');
const DEFAULT_DOCROOT = path.posix.join(path.posix.dirname(BASE_DOCROOT), 'huixintang');
const PRIMARY_DOCROOT = (opt('docroot', DEFAULT_DOCROOT)).replace(/\/+$/, '');

const targets = [{
  id: 'primary',
  label: '主站',
  host: env.HOST,
  port: env.PORT || '22',
  user: env.USER,
  pass: env.PASS,
  hostkey: path.join(LOCAL, 'hostkey.txt'),
  docroot: PRIMARY_DOCROOT,
  base: 'https://shutonggui.cn/huixintang/',
}];

if (env.MIRROR_HOST) {
  const mhost = env.MIRROR_HOST;
  const mirrorDocroot = (opt('mirror-docroot', env.MIRROR_DOCROOT || PRIMARY_DOCROOT)).replace(/\/+$/, '');
  const hostkey = path.join(LOCAL, `hostkey-${mhost}.txt`);
  if (fs.existsSync(hostkey)) {
    targets.push({
      id: 'mirror',
      label: '鏡像',
      host: mhost,
      port: env.MIRROR_PORT || env.PORT || '22',
      user: env.MIRROR_USER || env.USER,
      pass: env.MIRROR_PASS || env.PASS,
      hostkey,
      docroot: mirrorDocroot,
      base: 'https://nissaya.cn/huixintang/',
    });
  } else {
    console.warn('！找不到 ' + hostkey + '，略過鏡像站');
  }
}

const chosen = targets.filter((t) => (MIRROR_ONLY ? t.id === 'mirror' : PRIMARY_ONLY ? t.id === 'primary' : true));
if (!chosen.length) die(MIRROR_ONLY ? '沒有可部署的鏡像站' : '沒有可部署的站');
if (MIRROR_ONLY && !env.MIRROR_HOST) die('server.env 沒有 MIRROR_HOST');

if (!fs.existsSync(PSCP) || !fs.existsSync(PLINK)) die('找不到 PuTTY pscp.exe／plink.exe');

// local → remote 名稱；index.html 同時作為目錄首頁與 vcpp.html
const FILES = [
  { local: 'vcpp.html', remote: 'vcpp.html' },
  { local: 'vcpp.html', remote: 'index.html' },
  { local: 'shuzheng-u38.md', remote: 'shuzheng-u38.md' },
];

function shq(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

function run(cmd, label) {
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  if (r.error) die(label + '：' + r.error.message);
  if (r.status !== 0) {
    const out = (r.stdout || '').trim();
    const err = (r.stderr || '').trim();
    die(label + '（exit ' + r.status + '）' + (out ? '\n' + out : '') + (err ? '\n' + err : ''));
  }
  return (r.stdout || '').trim();
}

function makeTransport(t) {
  if (!fs.existsSync(t.hostkey)) die('找不到 ' + t.hostkey);
  const fp = fs.readFileSync(t.hostkey, 'utf8').trim();
  if (!/^SHA256:/.test(fp)) die(t.hostkey + ' 格式不正確');
  const pwFile = path.join(os.tmpdir(), `.huixintang-pw-${process.pid}-${t.id}.tmp`);
  fs.writeFileSync(pwFile, t.pass + '\n', { mode: 0o600 });
  const upload = (localPath, remotePath) => {
    run([PSCP, '-batch', '-P', t.port, '-hostkey', fp, '-pwfile', pwFile, localPath,
      t.user + '@' + t.host + ':' + remotePath], `[${t.label}] 上傳 ${path.basename(remotePath)}`);
  };
  const remote = (script, label) => {
    const f = path.join(os.tmpdir(), `.huixintang-${process.pid}-${t.id}.sh`);
    fs.writeFileSync(f, script);
    try {
      return run([PLINK, '-batch', '-ssh', '-P', t.port, '-l', t.user, '-hostkey', fp,
        '-pwfile', pwFile, '-m', f, t.host], `[${t.label}] ${label}`);
    } finally {
      fs.rmSync(f, { force: true });
    }
  };
  const done = () => fs.rmSync(pwFile, { force: true });
  return { upload, remote, done };
}

function deploy(t) {
  console.log(`\n== ${t.label} ${t.host} ${t.docroot}`);
  const tr = makeTransport(t);
  try {
    if (CHECK) {
      console.log(tr.remote([
        'set -e',
        'id',
        'ls -ld ' + shq(path.posix.dirname(t.docroot)) + ' 2>/dev/null || true',
        'ls -ld ' + shq(t.docroot) + ' 2>/dev/null || true',
        'test -w ' + shq(path.posix.dirname(t.docroot)) + ' && echo PARENT_WRITABLE=yes || echo PARENT_WRITABLE=no',
        'test -w ' + shq(t.docroot) + ' && echo DOCROOT_WRITABLE=yes || echo DOCROOT_WRITABLE=no',
      ].join('\n'), '檢查'));
      return;
    }

    for (const f of FILES) {
      if (!fs.existsSync(path.join(ROOT, f.local))) die('找不到 ' + f.local);
    }

    tr.remote([
      'set -e',
      'mkdir -p ' + shq(t.docroot),
      'rm -f ' + shq(t.docroot) + '/.tmp-*',
      'chmod a+rx ' + shq(t.docroot),
    ].join('\n'), '建立目錄');

    for (const f of FILES) {
      tr.upload(path.join(ROOT, f.local), t.docroot + '/.tmp-' + f.remote);
    }

    const moves = ['set -e', 'cd ' + shq(t.docroot)];
    for (const f of FILES) {
      moves.push('[ -f ' + shq(f.remote) + ' ] && cp -f ' + shq(f.remote) + ' ' + shq(f.remote + '.prev') + ' || true');
      moves.push('mv -f ' + shq('.tmp-' + f.remote) + ' ' + shq(f.remote));
    }
    moves.push('rm -f app.js style.css zhu-data.js app.js.prev style.css.prev zhu-data.js.prev');
    moves.push('chmod -R a+rX ' + shq(t.docroot));
    moves.push('echo DEPLOYED');
    moves.push('du -sh ' + shq(t.docroot));
    console.log(tr.remote(moves.join('\n'), '切換檔案'));
  } finally {
    tr.done();
  }
}

async function verify(t) {
  const stamp = Date.now();
  const checks = [
    ['vcpp.html', (s) => s.includes('金剛經合注') && s.includes('zhu-b64') && s.includes('__startApp')],
    ['index.html', (s) => s.includes('zhu-b64')],
    ['shuzheng-u38.md', (s) => s.length > 1000],
  ];
  for (const [name, check] of checks) {
    const url = t.base + encodeURI(name) + '?v=' + stamp;
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) die('驗證失敗 ' + url + ' → HTTP ' + res.status);
    if (!check(text)) die('內容不正確 ' + url + '（' + Buffer.byteLength(text) + ' bytes）');
    if (name === 'vcpp.html' && Buffer.byteLength(text) > MAX_MB * 1024 * 1024) die('vcpp.html 超過 ' + MAX_MB + 'MB：' + Buffer.byteLength(text) + '（可用 --max 放寬）');
    console.log('✓ ' + url + '  HTTP ' + res.status + '  ' + Buffer.byteLength(text) + ' bytes');
  }
}

for (const t of chosen) {
  deploy(t);
  if (!CHECK) await verify(t);
}
console.log('\n完成。');
