import fs from 'node:fs';
const ROOT = 'D:\\2026\\vcpp';
const code = fs.readFileSync('lossless.js', 'utf8');
const win = {};
new Function('window', `${code};return window.LOSSLESS;`)(win);
const norm2 = (s) => win.LOSSLESS.canon(s);
const D = JSON.parse(fs.readFileSync(ROOT + '\\zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const units = D.versions[0].sents.map((s) => s.t);
let T = '';
const back = [];
units.forEach((t, u) => { let off = 0; for (const ch of t) { if (/[\u3400-\u9fff]/.test(ch)) { T += norm2(ch); back.push([u, off]); } off++; } });

const raw = ['001', '002'].map((v) => fs.readFileSync(`build/_xy/KR6c0075_${v}.txt`, 'utf8')).join('\n');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) blocks.push(m[1] != null ? { t: 'S', v: m[1].replace(/\s+/g, '') } : { t: 'J', v: m[2].replace(/\s+/g, '') });
const sents = [];
blocks.forEach((b, bi) => { if (b.t === 'S') for (const s of b.v.split('。').map((x) => x.trim()).filter(Boolean)) sents.push({ s, n: norm2(s), bi }); });

const md = fs.readFileSync('mubu-kepan/docs/20-金刚经科判.md', 'utf8').split('\n');
const tree = [];
for (const line of md) {
  const mm = line.match(/^( *)- (.*)$/);
  if (!mm) continue;
  let name = mm[2].replace(/\*\*/g, '').trim().replace(/^第[一二三四五六七八九十]+、/, '').replace(/^[甲乙丙丁戊己庚辛壬癸][一二三四五六七八九十]+、/, '').replace(/（[^）]*）\s*$/, '');
  if (/——/.test(name)) name = name.split('——')[0];
  tree.push({ name: norm2(name) });
}
function ed(a, b) {
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) { const up = prev[j]; prev[j] = Math.min(up + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1)); diag = up; }
  }
  return prev[b.length];
}
const ORD = /^[初一二三四五六七八九十]{1,2}/;
let cur = 0;
for (const n of tree) {
  let best = -1;
  for (const W of [120, 400, 900]) {
    const window = Math.min(sents.length, cur + W);
    best = -1;
    for (let i = cur; i < window; i++) {
      const s = sents[i].n.replace(ORD, '');
      if (s.length > n.name.length + 3) continue;
      if (ed(n.name, s) <= 1) { best = i; break; }
    }
    if (best >= 0) break;
  }
  n.si = best;
  if (best >= 0) cur = best;
}
// 前 5 個節點：印出宣告句與下一個 J 區塊
let cursor = 0;
for (const n of tree.slice(0, 8)) {
  const bi = sents[n.si].bi;
  const cands = blocks.map((b, i) => (b.t === "J" ? i : -1)).filter((i) => i >= 0).filter((x) => x > bi).slice(0, 3);
  console.log(`node=${n.name} si=${n.si} bi=${bi} cands=${cands.join(",")}`);
  for (const jb of cands) {
    const q = norm2(blocks[jb].v);
    console.log("   q=", q.slice(0, 14), "p12=", T.indexOf(q.slice(0, 12), 0));
  }
}
