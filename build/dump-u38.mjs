// 把第 7 分最後一句（u=38）的注疏全部印出來，檢查它們怎麼解「差別」。
//   node build/dump-u38.mjs [unit]
import { readFileSync } from 'node:fs';

const U = +(process.argv[2] || 38);
const src = readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, '');
const D = JSON.parse(src);
const rows = [];
for (const w of D.works) {
  for (const [u, a, b] of (w.anchors || [])) {
    if (u !== U) continue;
    const t = String(w.text || '').slice(a, b).replace(/\s+/g, ' ').trim();
    if (!t) continue;
    rows.push({ year: w.year || 9999, author: w.author, title: w.title, len: b - a, t });
  }
}
rows.sort((x, y) => x.year - y.year);
console.log(`u=${U}  共 ${rows.length} 家`);
const hit = /差別|差別|高下|優劣|淺深|所顯|顯現|無為法/;
for (const [i, r] of rows.entries()) {
  const m = r.t.match(hit);
  const at = m ? Math.max(0, r.t.indexOf(m[0]) - 60) : 0;
  const snip = r.t.slice(at, at + 220);
  console.log(`\n${String(i + 1).padStart(2, '0')} ${r.author}《${r.title}》 len=${r.len}`);
  console.log(`   ${snip}`);
}
