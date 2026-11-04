// 宗密《金剛經疏記科會》科文 → 樹（v6：改用「宣告的父子邊」建圖，不靠游標位置）
//
// 想法：科會每一段都會宣告「這一科有 N 個子節：初、A，二、B…」，
//       所以「誰是誰的子」其實白紙黑字寫著，不需要猜游標在哪。
//       1. 掃所有段，收集邊 X → [A,B,C]（X 是該段的進入科）
//       2. 每個節的父＝唯一宣告過它為子節的那個 X（多個就取最近一次，並記衝突）
//       3. 沒有父的就是根；再算層級
//
//   node build/kepan/zongmi2.mjs            統計＋前 44 節
//   node build/kepan/zongmi2.mjs --dump     寫 kepan/zongmi-tree.json
import fs from 'node:fs';
import path from 'node:path';
import { lex } from './lex.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const work = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author || ''));
const segs = work.text.split('△').slice(1);
const kpOf = (seg) => {
  const i = [seg.indexOf('【疏】'), seg.indexOf('【記】')].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  return (i >= 0 ? seg.slice(0, i) : seg.slice(0, 40)).trim();
};

const VARIANT = { 辯: '辨', 脩: '修', 徧: '遍', 揀: '簡', 決: '决', 却: '卻', 炤: '照' };
const norm = (s) => String(s || '').replace(/[辯脩徧揀決却炤]/g, (c) => VARIANT[c] || c).replace(/\s+/g, '');

/* 節點表：以「名字」當身分（科名在本書內幾乎不重複） */
const nodes = new Map();          // name → {name, label, kids:[], parent, lv}
function node(name, label) {
  const k = norm(name);
  let n = nodes.get(k);
  if (!n) { n = { key: k, name, label, kids: [], parent: null, lv: 0, seen: 0 }; nodes.set(k, n); }
  if (label != null && n.label == null) n.label = label;
  n.seen++;
  return n;
}
const edges = [];                 // [parentKey, childKeys...]
const conflicts = [];

for (const seg of segs) {
  const kp = kpOf(seg);
  if (!kp) continue;
  const toks = lex(kp);
  let ctx = null;                 // 這一段目前「正在講」的科
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.k === 'decl' || t.k === 'enter') {
      const n = node(t.name, t.label);
      if (t.k === 'decl' && t.label == null && !ctx) ctx = n;     // 根的宣告
      else if (!ctx) ctx = n;
      else if (t.label != null) ctx = n;                          // 進入新的子科
      // 宣告子節：後面 N 個 token
      const want = t.n || 0;
      if (want > 0) {
        const kids = [];
        for (let k = 1; k <= want && i + k < toks.length; k++) {
          const it = toks[i + k];
          if (it.k !== 'item' && it.k !== 'enter') break;
          kids.push(node(it.name, it.label != null ? it.label : k));
        }
        if (kids.length) {
          edges.push([n.key, kids.map((x) => x.key)]);
          i += kids.length;
        }
      }
    }
  }
}

/* 由邊決定父（後宣告的覆蓋前面的；記衝突但保留最後一次） */
for (const [p, kids] of edges) {
  for (const k of kids) {
    const c = nodes.get(k);
    if (!c) continue;
    if (c.parent && c.parent !== p) conflicts.push(c.name + '：' + nodes.get(c.parent).name + ' → ' + nodes.get(p).name);
    c.parent = p;
    if (!nodes.get(p).kids.includes(k)) nodes.get(p).kids.push(k);
  }
}
/* 父指標指向自己或成環 → 斷開 */
for (const n of nodes.values()) {
  const seen = new Set();
  let p = n;
  while (p && p.parent) {
    if (seen.has(p.key)) { p.parent = null; break; }
    seen.add(p.key);
    p = nodes.get(p.parent);
  }
}

const roots = [...nodes.values()].filter((n) => !n.parent);
/* 分層：BFS，順便斷開環 */
{
  const seen = new Set();
  const q = roots.map((r) => [r, 1]);
  while (q.length) {
    const [n, lv] = q.shift();
    if (seen.has(n.key)) continue;
    seen.add(n.key);
    n.lv = lv;
    n.kids = n.kids.filter((k) => {
      const c = nodes.get(k);
      if (!c || seen.has(c.key)) return false;
      let p = n;
      while (p) { if (p.key === c.key) return false; p = p.parent ? nodes.get(p.parent) : null; }
      return true;
    });
    for (const k of n.kids) q.push([nodes.get(k), lv + 1]);
  }
  for (const n of nodes.values()) if (!n.lv) n.lv = 1;   // 環裡的殘節
}

const byLv = {};
for (const n of nodes.values()) byLv[n.lv] = (byLv[n.lv] || 0) + 1;
const size = (n) => 1 + n.kids.reduce((a, k) => a + size(nodes.get(k)), 0);
const top = nodes.get(norm('釋金剛經纂要疏')) || roots[0];
const main = top ? [top] : [];
const mainSum = top ? size(top) : 0;

console.log('節點', nodes.size, '｜邊', edges.length, '｜根', roots.length, '｜最深', Math.max(...Object.keys(byLv).map(Number)));
console.log('分層', JSON.stringify(byLv));
console.log('三大科子樹', mainSum, '/', nodes.size, '(' + (mainSum / nodes.size * 100).toFixed(1) + '%)');
console.log('父衝突', conflicts.length, conflicts.slice(0, 3).join(' ｜ '));
console.log('根（前 12）：' + roots.slice(0, 12).map((r) => r.label + ' ' + r.name + '(' + size(r) + ')').join(' ｜ '));

for (const k of ['標題目', '序宗旨', '解本文', '序分', '正宗分', '流通分', '證信序', '發起序']) {
  const n = nodes.get(norm(k));
  console.log('  ' + k.padEnd(4) + ' ' + (n ? 'lv ' + n.lv + '，子 ' + n.kids.length + '，父 ' + (n.parent ? nodes.get(n.parent).name : '—') : '（缺）'));
}

const lines = [];
(function show(n, d) {
  for (const k of n.kids) {
    const c = nodes.get(k);
    if (lines.length < 44) lines.push('  '.repeat(d) + (c.label != null ? c.label : '') + ' ' + c.name.slice(0, 18));
    show(c, d + 1);
  }
})({ kids: main.length ? main.map((m) => m.key) : roots.map((r) => r.key), name: '' }, 0);
console.log('\n前 44 節：');
console.log(lines.join('\n'));

if (process.argv.includes('--dump')) {
  const out = [];
  const ids = new Map();
  let id = 0;
  for (const n of nodes.values()) ids.set(n.key, ++id);
  for (const n of nodes.values()) out.push({
    id: ids.get(n.key), par: n.parent ? ids.get(n.parent) : null,
    lv: n.lv, label: n.label, name: n.name,
  });
  const f = path.join(ROOT, 'kepan', 'zongmi-tree.json');
  fs.writeFileSync(f, JSON.stringify({ work: work.id, author: work.author, title: work.title, nodes: out }, null, 1), 'utf8');
  console.log('\n寫出 ' + f + '（' + out.length + ' 節）');
}
