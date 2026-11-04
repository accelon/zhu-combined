// 單檔體積拆解：把 zhu-b64 裡的資料按「邏輯部分」拆開，各自 gzip 估一份，
// 讓作者決定要砍什麼。
//   node build/size-report.mjs [vcpp-kepan.html]
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2] || 'vcpp-kepan.html';
const html = fs.readFileSync(file, 'utf8');
const m = /<script id="zhu-b64" type="text\/plain">([\s\S]*?)<\/script>/.exec(html);
if (!m) throw new Error('找不到 zhu-b64');
const b64 = m[1];
const gz = Buffer.from(b64, 'base64');
const json = JSON.parse(zlib.gunzipSync(gz).toString('utf8'));

const raw = (s) => Buffer.byteLength(s, 'utf8');
const gzOf = (s) => zlib.gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).length;
const b64Of = (n) => Math.ceil(n / 3) * 4;

const parts = [];
const add = (name, value, note) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  const g = gzOf(s);
  parts.push({ name, raw: raw(s), gz: g, b64: b64Of(g), note: note || '' });
};

const zhu = json.zhu;
const kp = json.kepan;
const v = zhu.versions[0];

// --- 資料 ---
add('經文（昭明 32 分，sections ＋ sents）', { sections: zhu.sections, sents: v.sents });
const ifan = v.sents.map((s) => s.ifn || s.ifan || null).filter(Boolean);
if (ifan.length) add('梵文／藏文逐詞（sents[].ifn）', ifan);
add('注疏：本文（41 家 works[].text）', zhu.works.map((w) => w.text || ''));
add('注疏：錨點（works[].anchors）', zhu.works.map((w) => w.anchors || []));
add('注疏：書目（作者／書名／藏經／頁碼／年）',
  zhu.works.map((w) => ({ id: w.id, a: w.author, t: w.title, c: w.corpus, n: w.no, y: w.year, d: w.date, p: w.pages })));
add('科判（昭明／江味農／印順）', kp);
const rest = { ...zhu };
delete rest.versions; delete rest.works; delete rest.sections;
add('梵藏逐句（237 句：梵文／藏文／逐詞注解／位置）', zhu.pdf || []);

// --- 程式碼 ---
const grab = (re) => { const x = re.exec(html); return x ? x[1] : ''; };
add('app.js（程式）', grab(/<script>\s*(?=[\s\S]*?__startApp)[\s\S]*?<\/script>/) ? '' : '', '');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
const total = scripts.reduce((a, s) => a + raw(s), 0);
parts.pop();
add('頁內 JS（app.js＋tour.js＋科判層＋gunzip fallback）', scripts.join(''), scripts.length + ' 段');
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((x) => x[1]);
add('CSS（style.css＋科判層）', styles.join(''), styles.length + ' 段');
add('HTML 骨架（含說明文字、head）', html.slice(0, html.indexOf('<script')) + html.slice(html.lastIndexOf('</script>')), '');

// --- 輸出 ---
const totalFile = raw(html);
const totalB64 = b64.length;
parts.sort((a, b) => b.gz - a.gz);
const pad = (s, n) => String(s).padEnd(n, ' ');
const num = (n) => n.toLocaleString('en-US');
console.log(pad('部分', 40) + pad('原始', 11) + pad('gzip', 10) + pad('base64', 11) + '佔檔案');
console.log('-'.repeat(88));
let sumGz = 0;
for (const p of parts) {
  if (!p.raw) continue;
  sumGz += p.gz;
  const share = ((p.b64 / totalFile) * 100).toFixed(1) + '%';
  console.log(pad(p.name, 40) + pad(num(p.raw), 11) + pad(num(p.gz), 10) + pad(num(p.b64), 11) + share + (p.note ? '  ' + p.note : ''));
}
console.log('-'.repeat(88));
console.log(pad('合計（各段單獨 gzip，實際共用字典會更小）', 40) + pad('', 11) + pad(num(sumGz), 10));
console.log('');
console.log('單檔總大小        ', num(totalFile), 'bytes');
console.log('  · base64 資料段 ', num(totalB64), 'bytes（' + ((totalB64 / totalFile) * 100).toFixed(1) + '%）');
console.log('  · gzip 後的資料 ', num(gz.length), 'bytes → base64 膨脹成 4/3');
console.log('  · 程式與樣式    ', num(totalFile - totalB64), 'bytes');

// ---- 注疏逐家（可砍的候選）----
const gzOf2 = (s) => zlib.gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).length;
const works = zhu.works.map((w) => ({
  id: w.id, author: (w.author || '').replace(/\s+/g, ' '), title: w.title || '',
  chars: (w.text || '').length, gz: gzOf2(w.text || ''),
})).sort((a, b) => b.gz - a.gz);
console.log('\n注疏逐家（依 gzip 大小排序，前 20 名就佔九成）：');
console.log(pad('著作', 26) + pad('字數', 10) + pad('gzip', 9) + 'base64');
console.log('-'.repeat(64));
let acc = 0;
for (const w of works) {
  acc += w.gz;
  console.log(pad((w.author + '《' + w.title + '》').slice(0, 24), 26) + pad(num(w.chars), 10) + pad(num(w.gz), 9) + num(Math.ceil(w.gz / 3) * 4));
}
console.log('-'.repeat(64));
console.log('41 家合計 gzip ' + num(acc));

// ---- zhu 其他欄位 ----
console.log('\n「其他 zhu 欄位」細目：');
const others = Object.entries(rest).map(([k, val]) => {
  const str = JSON.stringify(val);
  return { k, raw: Buffer.byteLength(str), gz: gzOf2(str), type: Array.isArray(val) ? 'array(' + val.length + ')' : typeof val };
}).sort((a, b) => b.gz - a.gz);
for (const o of others) {
  if (o.gz < 500) continue;
  console.log('  ' + pad(o.k, 20) + pad(o.type, 14) + pad(num(o.raw), 10) + pad(num(o.gz), 9) + num(Math.ceil(o.gz / 3) * 4));
}
