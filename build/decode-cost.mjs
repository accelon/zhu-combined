// 解壓鏈各段耗時（桌機數字；手機大概 ×6–10）
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2] || 'vcpp-kepan.html';
const h = fs.readFileSync(file, 'utf8');
const i = h.indexOf('id="zhu-b64"');
const s = h.indexOf('>', i) + 1;
const e = h.indexOf('</script>', s);
const b64 = h.slice(s, e);

let t = process.hrtime.bigint();
const raw = Buffer.from(b64, 'base64');
const tDec = Number(process.hrtime.bigint() - t) / 1e6;

t = process.hrtime.bigint();
const un = zlib.gunzipSync(raw);
const tGun = Number(process.hrtime.bigint() - t) / 1e6;

t = process.hrtime.bigint();
const str = un.toString('utf8');
const tStr = Number(process.hrtime.bigint() - t) / 1e6;

t = process.hrtime.bigint();
const obj = JSON.parse(str);
const tParse = Number(process.hrtime.bigint() - t) / 1e6;

const num = (n) => n.toLocaleString('en-US');
console.log('base64 長度   ', num(b64.length));
console.log('解 base64     ', tDec.toFixed(1), 'ms →', num(raw.length), 'bytes');
console.log('gunzip        ', tGun.toFixed(1), 'ms →', num(un.length), 'bytes（JSON 字串）');
console.log('轉 UTF-8 字串 ', tStr.toFixed(1), 'ms');
console.log('JSON.parse    ', tParse.toFixed(1), 'ms');
console.log('─────────────');
console.log('合計          ', (tDec + tGun + tStr + tParse).toFixed(1), 'ms（桌機；老手機 ×6–10）');
console.log('works', obj.zhu.works.length, '｜pdf', obj.zhu.pdf.length,
  '｜kepan', obj.kepan.editions.map((x) => x.id + ':' + x.nodes.length).join(' '));
