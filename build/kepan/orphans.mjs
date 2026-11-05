// 診斷：列出「孤兒根」中最靠前的幾個，並印出它那一段的科文
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const t = JSON.parse(fs.readFileSync('kepan/zongmi-tree.json', 'utf8'));
const nodes = t.nodes;
const kids = new Map();
for (const n of nodes) if (n.par != null) { if (!kids.has(n.par)) kids.set(n.par, []); kids.get(n.par).push(n.id); }
const size = (id) => { let c = 1; for (const k of (kids.get(id) || [])) c += size(k); return c; };
const MAIN = ['標題目', '序宗旨', '解本文'];
const orphans = nodes.filter((n) => n.par === null && !MAIN.includes(n.name)).sort((a, b) => a.seg - b.seg);
console.log('孤兒 ' + orphans.length + ' 個，段號最小的 6 個：');
for (const o of orphans.slice(0, 6)) {
  const raw = segs[o.seg] || '';
  const kp = raw.split('【疏】')[0].split('【記】')[0].slice(0, 100).replace(/\s+/g, ' ');
  console.log('  段' + o.seg + '  lv' + o.lv + '  「' + o.name + '」子樹 ' + size(o.id));
  console.log('     科文：' + kp);
}
