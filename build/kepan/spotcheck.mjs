// 抽查：隨機取幾個節點，印出它的整條祖先鏈與它所在的原文段，人工核對
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const t = JSON.parse(fs.readFileSync('kepan/zongmi-tree.json', 'utf8'));
const nodes = t.nodes;
const byId = new Map(nodes.map((n) => [n.id, n]));

const path = (n) => {
  const out = [];
  for (let p = n; p; p = byId.get(p.par)) out.push(p.name);
  return out.reverse();
};

// 取「有名字 ≥3 字、lv ≥ 12」的節，均勻抽 5 個
const pool = nodes.filter((n) => n.name && n.name.length >= 3 && n.lv >= 12);
const pick = [0, 0.25, 0.5, 0.75, 0.99].map((f) => pool[Math.floor(f * (pool.length - 1))]).filter(Boolean);
for (const n of pick) {
  const raw = (segs[n.seg] || '').split('【疏】')[0].split('【記】')[0].slice(0, 70).replace(/\s+/g, ' ');
  console.log('◆ ' + n.name + '（lv' + n.lv + '，段' + n.seg + '）');
  console.log('   祖先：' + path(n).join(' › '));
  console.log('   原文：' + raw);
  console.log('');
}
