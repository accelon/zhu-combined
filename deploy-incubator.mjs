// 把孵化區清單（projects.json）同步到兩站
//
//   node deploy-incubator.mjs --check    # 只比對兩站現況
//   node deploy-incubator.mjs            # 上傳並驗證
//
// 只換 /var/www/html/incubator/projects.json 一個檔（上傳 .tmp → 備份 .prev → mv -f），
// 不動 incubator/index.html 與其他項目。憑證與 deploy.mjs 共用 .local/server.env。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LOCAL = 'D:\\2026\\zhu-combined\\.local';
const PSCP = 'C:\\Program Files\\PuTTY\\pscp.exe';
const PLINK = 'C:\\Program Files\\PuTTY\\plink.exe';
const SOURCE = 'D:\\nissaya.cn\\html\\incubator\\projects.json';
const REMOTE_DIR = '/var/www/html/incubator';
const REMOTE_FILE = 'projects.json';

const CHECK = process.argv.includes('--check');
const die = (m) => { console.error('✗ ' + m); process.exit(1); };
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

const env = {};
for (const line of fs.readFileSync(path.join(LOCAL, 'server.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1].toUpperCase()] = m[2].trim().replace(/^["']|["']$/g, '');
}
if (!env.HOST || !env.USER || !env.PASS) die('server.env 缺少 HOST／USER／PASS');
if (!fs.existsSync(SOURCE)) die('找不到 ' + SOURCE);

// 先自己檢查一次（會呼叫官方的 check.mjs）
const check = spawnSync('node', ['D:\\nissaya.cn\\html\\incubator\\check.mjs', SOURCE], { encoding: 'utf8' });
process.stdout.write(check.stdout || '');
if (check.status !== 0) die('清單不合格，不上傳');

const targets = [{ id: 'primary', label: '主站', host: env.HOST, port: env.PORT || '22', hostkey: path.join(LOCAL, 'hostkey.txt'), base: 'https://shutonggui.cn/incubator/' }];
if (env.MIRROR_HOST) {
  const hk = path.join(LOCAL, `hostkey-${env.MIRROR_HOST}.txt`);
  if (fs.existsSync(hk)) targets.push({ id: 'mirror', label: '鏡像', host: env.MIRROR_HOST, port: env.MIRROR_PORT || env.PORT || '22', hostkey: hk, base: 'https://nissaya.cn/incubator/' });
}

function run(cmd, label) {
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  if (r.error) die(label + '：' + r.error.message);
  if (r.status !== 0) die(label + '（exit ' + r.status + '）\n' + (r.stdout || '') + (r.stderr || ''));
  return (r.stdout || '').trim();
}

for (const t of targets) {
  console.log(`\n== ${t.label} ${t.host}:${REMOTE_DIR}`);
  const fp = fs.readFileSync(t.hostkey, 'utf8').trim();
  if (!/^SHA256:/.test(fp)) die(t.hostkey + ' 格式不正確');
  const pwFile = path.join(os.tmpdir(), `.incubator-pw-${process.pid}-${t.id}.tmp`);
  fs.writeFileSync(pwFile, env.PASS + '\n', { mode: 0o600 });
  const plink = (script, label) => {
    const f = path.join(os.tmpdir(), `.incubator-${process.pid}-${t.id}.sh`);
    fs.writeFileSync(f, script);
    try {
      return run([PLINK, '-batch', '-ssh', '-P', t.port, '-l', env.USER, '-hostkey', fp, '-pwfile', pwFile, '-m', f, t.host], label);
    } finally { fs.rmSync(f, { force: true }); }
  };
  try {
    if (CHECK) {
      console.log(plink(['ls -l ' + shq(REMOTE_DIR + '/' + REMOTE_FILE), 'md5sum ' + shq(REMOTE_DIR + '/' + REMOTE_FILE)].join('\n'), '現況'));
      continue;
    }
    run([PSCP, '-batch', '-P', t.port, '-hostkey', fp, '-pwfile', pwFile, SOURCE, `${env.USER}@${t.host}:${REMOTE_DIR}/.tmp-${REMOTE_FILE}`], '上傳');
    console.log(plink([
      'set -e', 'cd ' + shq(REMOTE_DIR),
      `[ -f ${REMOTE_FILE} ] && cp -f ${REMOTE_FILE} ${REMOTE_FILE}.prev || true`,
      `mv -f .tmp-${REMOTE_FILE} ${REMOTE_FILE}`,
      'chmod a+rX ' + REMOTE_FILE,
      'ls -l ' + REMOTE_FILE, 'echo DEPLOYED',
    ].join('\n'), '切換'));
    const res = await fetch(t.base + 'projects.json?v=' + Date.now(), { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) die('驗證失敗 ' + t.base + 'projects.json → HTTP ' + res.status);
    const j = JSON.parse(text);
    const g = j.projects.find((x) => x.id === 'jingang');
    console.log(`✓ ${t.base}projects.json  HTTP ${res.status}  ${Buffer.byteLength(text)} bytes`);
    console.log(`  jingang.url=${g && g.url}  舊版連結=${g && g.links && g.links[0] && g.links[0].href}`);
  } finally {
    fs.rmSync(pwFile, { force: true });
  }
}
console.log('\n完成。');
