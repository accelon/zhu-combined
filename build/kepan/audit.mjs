// 科文資料檢查：單調性、覆蓋率、每分是否有科文起點、與經文對得上的抽樣。
//   node build/kepan/audit.mjs [--show 12]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:\\2026\\zhu-combined';
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const KP = JSON.parse(fs.readFileSync(path.join(ROOT, 'kepan', 'kepan-data.js'), 'utf8').replace(/^window\.KEPAN=/, '').replace(/;\s*$/, ''));
const S = D.versions[0].sents;
const secOf = [];
S.forEach((s) => { secOf[s.u] = s.s; });

let bad = 0;
for (const ed of KP.editions) {
  const nodes = ed.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const live = [];
  (function dfs(ids) {
    for (const id of ids) {
      const n = byId.get(id);
      if (!n) continue;
      if (!n.nk) live.push(n);
      if (n.ch.length) dfs(n.ch);
    }
  })(ed.roots);

  // 1. 單調
  let pu = -1, po = -1, back = 0;
  for (const n of live) {
    if (n.u < pu || (n.u === pu && n.off < po)) { back++; if (back <= 3) console.log(`  ⚠ 倒退 #${n.id} ${n.nm} u${n.u}.${n.off}`); }
    if (n.u > pu) { pu = n.u; po = n.off; } else po = Math.max(po, n.off);
  }

  // 2. 每分有沒有科文起點
  const perSec = new Array(33).fill(0);
  for (const n of live) perSec[secOf[n.u]]++;
  const empty = [];
  for (let s = 1; s <= 32; s++) if (!perSec[s]) empty.push(s);

  // 3. 範圍是否合理（起 < 迄）
  let zero = 0, overlap = 0;
  for (const n of live) {
    if (n.u2 < n.u || (n.u2 === n.u && n.o2 <= n.off)) zero++;
  }
  // 4. 兄弟重疊（前一個的迄 > 後一個的起）
  for (const n of nodes) {
    for (let i = 1; i < n.ch.length; i++) {
      const a = byId.get(n.ch[i - 1]), b = byId.get(n.ch[i]);
      if (!a || !b || a.nk || b.nk) continue;
      if (a.u2 > b.u || (a.u2 === b.u && a.o2 > b.off)) overlap++;
    }
  }

  console.log(`${ed.short}：${nodes.length} 節（連經文 ${live.length}）`);
  console.log(`  單調倒退 ${back}；空範圍 ${zero}；兄弟重疊 ${overlap}`);
  console.log(`  每分科文起點：${perSec.slice(1).join(' ')}`);
  console.log(`  沒有科文起點的分：${empty.length ? empty.join(',') : '（無）'}`);
  if (back || zero) bad++;
}

// 抽樣：把節點起點對到經文，印前幾個字
const show = +(process.argv[process.argv.indexOf('--show') + 1] || 0);
if (show) {
  for (const ed of KP.editions) {
    console.log(`\n— ${ed.short} 抽樣`);
    const nodes = ed.nodes.filter((n) => !n.nk);
    for (let i = 0; i < nodes.length; i += Math.max(1, Math.floor(nodes.length / show))) {
      const n = nodes[i];
      console.log(`  [${String(n.lv).padStart(2)}] ${(n.lab + n.nm).slice(0, 22).padEnd(24, ' ')} u${n.u}.${n.off}  ${JSON.stringify(S[n.u].t.slice(n.off, n.off + 20))}`);
    }
  }
}
console.log(bad ? '\n✗ 有問題' : '\n✓ 結構檢查通過');
process.exit(bad ? 1 : 0);
