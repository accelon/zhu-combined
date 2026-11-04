// 覆蓋率統計
import fs from 'node:fs';

const t = JSON.parse(fs.readFileSync('kepan/zongmi-tree.json', 'utf8'));
const nodes = t.nodes;
const byId = new Map(nodes.map((n) => [n.id, n]));
const kids = new Map();
for (const n of nodes) if (n.par != null) { if (!kids.has(n.par)) kids.set(n.par, []); kids.get(n.par).push(n.id); }
const size = (id) => { let c = 1; for (const k of (kids.get(id) || [])) c += size(k); return c; };
const MAIN = ['標題目', '序宗旨', '解本文'];
const roots = nodes.filter((n) => n.par === null);
const main = roots.filter((r) => MAIN.includes(r.name));
const mainSum = main.reduce((a, r) => a + size(r.id), 0);
const orphans = roots.filter((r) => !MAIN.includes(r.name)).map((r) => [r, size(r.id)]).sort((a, b) => b[1] - a[1]);
const lvs = nodes.map((n) => n.lv);
console.log('節點 ' + nodes.length + '｜最深 ' + Math.max(...lvs));
console.log('三大科 ' + mainSum + '（' + (mainSum / nodes.length * 100).toFixed(1) + '%）｜根 ' + roots.length + '（3 個真根 + ' + orphans.length + ' 孤兒）');
console.log('孤兒合計 ' + orphans.reduce((a, [, s]) => a + s, 0) + ' 節：' + orphans.map(([r, s]) => r.name + '(' + s + ')').join(' '));
for (const k of ['標題目', '序宗旨', '解本文', '隨釋', '序分', '正宗分', '流通分', '證信序', '發起序', '如來正說']) {
  const n = nodes.find((x) => x.name === k);
  console.log('  ' + k.padEnd(6) + (n ? 'lv' + n.lv + ' 子' + (kids.get(n.id) || []).length + ' 父' + (n.par ? byId.get(n.par).name : '—') : '（缺）'));
}
