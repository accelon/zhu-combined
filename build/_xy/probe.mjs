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
const back = [];
units.forEach((t, u) => { let off = 0; for (const ch of t) { if (HAN.test(ch)) { T += norm2(ch); back.push([u, off]); } off++; } });

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
  tree.push({ depth: mm[1].length / 2, raw: mm[2].trim(), name: norm2(name) });
}
tree.forEach((n, i) => { n.id = i; n.par = null; n.ch = []; });
{
  const st = [];
  tree.forEach((n, i) => {
    while (st.length && tree[st[st.length - 1]].depth >= n.depth) st.pop();
    if (st.length) { n.par = st[st.length - 1]; tree[n.par].ch.push(i); }
    st.push(i);
  });
}
const leaves = tree.filter((n) => !n.ch.length);
console.log('leaves', leaves.length, 'roots', tree.filter((n) => n.par == null).length);

function ed(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) { const up = prev[j]; prev[j] = Math.min(up + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1)); diag = up; }
  }
  return prev[b.length];
}
const stripOrd = (s) => {
  if (s.startsWith('初')) return { ord: 1, rest: s.slice(1) };
  const mm = s.match(/^(十[一二三四五六七八九]?|[一二三四五六七八九])/);
  if (!mm) return { ord: 0, rest: s };
  const t = mm[1];
  const n = t.length === 1 ? '一二三四五六七八九'.indexOf(t) + 1 : 10 + '一二三四五六七八九'.indexOf(t[1]) + 1;
  return { ord: n, rest: s.slice(t.length) };
};
let cur = 0;
for (const n of tree) {
  let best = -1;
  for (const W of [120, 400, 900]) {
    const window = Math.min(sents.length, cur + W);
    best = -1;
    for (let i = cur; i < window; i++) {
      const { rest } = stripOrd(sents[i].n);
      if (!rest || rest.length > n.name.length + 3) continue;
      if (ed(n.name, rest) <= 1) { best = i; break; }
    }
    if (best >= 0) break;
  }
  n.si = best;
  if (best >= 0) { n.xname = stripOrd(sents[best].n).rest; cur = best; }
}
console.log('宣告句', tree.filter((n) => n.si >= 0).length, '/', tree.length);
console.log('樣本：', tree.slice(0, 6).map((n) => `${n.raw.slice(0, 10)}→${n.xname || '∅'}`).join(' | '));

const jing = blocks.map((b, i) => (b.t === 'J' ? i : -1)).filter((i) => i >= 0);
let lastJb = -1, cursor = 0, anchored = 0;
const miss = [];
for (const n of leaves) {
  if (n.si < 0) { miss.push(n.xname || n.raw); continue; }
  const bi = sents[n.si].bi;
  let found = null, used = -1;
  for (const jb of jing.filter((x) => x > Math.max(bi, lastJb)).slice(0, 3)) {
    const q = hanOnly(norm2(blocks[jb].v));
    for (const L of [24, 16, 12, 10, 8]) {
      if (q.length < L) continue;
      const p = T.indexOf(q.slice(0, L), cursor);
      if (p >= 0 && p - cursor < 1200) { found = { p, L }; used = jb; break; }
    }
    if (found) break;
  }
  if (!found) { miss.push(n.xname || n.raw); continue; }
  n.u = back[found.p][0]; n.off = back[found.p][1];
  cursor = found.p; lastJb = used; anchored++;
}
console.log('葉科錨點', anchored, '/', leaves.length, ' 缺', miss.length);
console.log('缺：', miss.slice(0, 12).join(' | '));

