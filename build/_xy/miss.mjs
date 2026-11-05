import fs from 'node:fs';
const ROOT = 'D:\\2026\\vcpp';
const code = fs.readFileSync('lossless.js', 'utf8');
const win = {};
new Function('window', `${code};return window.LOSSLESS;`)(win);
const canon = win.LOSSLESS.canon;
const norm2 = (s) => canon(s);
const HAN = /[\u3400-\u9fff]/;
const hanOnly = (s) => { let o = ''; for (const ch of s) if (HAN.test(ch)) o += ch; return o; };

const D = JSON.parse(fs.readFileSync(ROOT + '\\zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const units = D.versions[0].sents.map((s) => s.t);
let T = '';
units.forEach((t) => { let off = 0; for (const ch of t) { if (HAN.test(ch)) T += norm2(ch); off++; } });

const raw = ['001', '002'].map((v) => fs.readFileSync(`build/_xy/KR6c0075_${v}.txt`, 'utf8')).join('\n');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) blocks.push(m[1] != null ? { t: 'S', v: m[1].replace(/\s+/g, '') } : { t: 'J', v: m[2].replace(/\s+/g, '') });
const sents = [];
blocks.forEach((b, bi) => { if (b.t === 'S') for (const s of b.v.split('。').map((x) => x.trim()).filter(Boolean)) sents.push({ s, n: norm2(s), bi }); });

const targets = process.argv.slice(2);
for (const name of targets) {
  const idx = sents.findIndex((x) => x.n.slice(1) === name || x.n === name);
  if (idx < 0) { console.log(`\n${name}: 疏文裡找不到這個科名`); continue; }
  const bi = sents[idx].bi;
  console.log(`\n${name}: si=${idx} bi=${bi}`);
  const after = blocks.map((b, i) => (b.t === 'J' ? i : -1)).filter((i) => i > bi).slice(0, 4);
  for (const jb of after) {
    const q = hanOnly(norm2(blocks[jb].v));
    console.log(`   J${jb} ${q.slice(0, 26)} → idx ${T.indexOf(q.slice(0, 8))}`);
  }
}
