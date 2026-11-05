import fs from 'node:fs';
const ROOT = 'D:\\2026\\vcpp';
const D = JSON.parse(fs.readFileSync(ROOT + '\\zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const K = JSON.parse(fs.readFileSync(ROOT + '\\kepan\\xinyan.json', 'utf8'));
const S = D.versions[0].sents;
const byId = new Map(K.nodes.map((n) => [n.id, n]));

// 1. 單調、空範圍
let bad = 0;
const live = K.nodes.filter((n) => !n.nk);
for (let i = 1; i < live.length; i++) {
  const a = live[i - 1], b = live[i];
  if (b.u < a.u || (b.u === a.u && b.off < a.off)) { console.log('倒退', b.id, b.nm); bad++; }
}
for (const n of live) {
  if (!(n.u2 > n.u || (n.u2 === n.u && n.o2 > n.off))) { console.log('空範圍', n.id, n.nm); bad++; }
}
console.log('單調／空範圍問題:', bad);

// 2. 每分是否有科文起點
const secStarts = new Map();
S.forEach((s) => { if (!secStarts.has(s.s)) secStarts.set(s.s, s.u); });
const covered = new Set();
for (const n of live) covered.add(S[n.u].s);
const miss = [...secStarts.keys()].filter((s) => !covered.has(s));
console.log(`分覆蓋：${secStarts.size - miss.length}/${secStarts.size}`, miss.length ? '缺 ' + miss.join(',') : '');

// 3. 抽樣：每個「分」的第一個科文
const first = new Map();
for (const n of live) if (!first.has(S[n.u].s)) first.set(S[n.u].s, n);
for (const [sec, n] of [...first].slice(0, 32)) {
  console.log(`第${sec}分 ${n.nm} 〔${n.u}:${n.off}〕${S[n.u].t.slice(n.off, n.off + 18)}`);
}
