// 從江味農《金剛經講義》markdown 抽出科文樹（依「（甲）初，名。次，名。」體例）。
// 用法：node build/kepan-parse.mjs [輸出路徑]
import fs from 'node:fs';

const SRC = 'D:\\2026\\wisdomlight\\sources\\jiang-weinong-jingang-jiangyi.md';
const STEM = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const nodes = [];
const stack = [];
let n = 0;
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  if (!raw || raw[0] === '>' || raw[0] === '#' || raw.startsWith('<!--')) continue;
  const m = /（([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])）(初|次|三|四|五|六|七|八|九|十)?[，,]?([^。；]{1,24}?)(?:[。；]|，分|$)/.exec(raw);
  if (!m) continue;
  // 只認「科文句」：必須在句首附近，且 label 後接序數或緊接名稱
  const pos = m.index;
  if (pos > 6 && !/科判|分三|分二|大科/.test(raw.slice(0, pos))) continue;
  const level = STEM.indexOf(m[1]) + 1;
  const ord = m[2] || '';
  let name = m[3].replace(/^[，,]/, '').replace(/\s+/g, '');
  name = name.replace(/^分[一二三四五六七八九十]+.*$/, '');
  if (!name) continue;
  while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
  const node = {
    i: n++, line: i + 1, level, label: m[1] + ord, name,
    parent: stack.length ? stack[stack.length - 1].i : null,
    children: [],
  };
  if (node.parent != null) nodes[node.parent].children.push(node.i);
  nodes.push(node);
  stack.push(node);
}

const maxLevel = Math.max(...nodes.map((x) => x.level));
const byLevel = {};
for (const x of nodes) byLevel[x.level] = (byLevel[x.level] || 0) + 1;

function chain(i) {
  const out = [];
  for (let k = i; k != null; k = nodes[k].parent) out.unshift(nodes[k]);
  return out;
}

// 指定行號所在節點的祖先鏈
const target = process.argv[3] ? +process.argv[3] : 968;
let hit = null;
for (const x of nodes) if (x.line <= target) hit = x; else break;
const out = { count: nodes.length, maxLevel, byLevel, nodes, chain: hit ? chain(hit.i) : [] };
const dest = process.argv[2] || 'D:\\2026\\zhu-combined\\kepan\\jiang-tree.json';
fs.writeFileSync(dest, JSON.stringify(out));
console.log('nodes', nodes.length, 'maxLevel', maxLevel);
console.log(JSON.stringify(byLevel));
console.log('chain@' + target + ':');
for (const c of out.chain) console.log(' '.repeat(c.level - 1) + `${c.label} ${c.name}  (L${c.line})`);
