#!/usr/bin/env node
// 《金剛新眼疏》科判（信解行證四分）→ kepan/xinyan.json
//
// 底本：清·通理述《金剛新眼疏經偈合釋》（CBETA X487；文字用 Kanripo KR6c0075 的兩卷本，
// 它保留了【疏】「經文」的分段，科文就寫在疏文的句末）。
//
// 做法：
//   1. 骨架用幕布本〈金剛經科判〉的樹（187 節，已核對＝道源講記的 188 個標題）
//   2. 依文件序在 X487 疏文裡找每個科名的宣告句（允許 1 字異文：幕布本有錯字，
//      如「誡聽」作「誠聽」、「徵釋」作「證釋」），科名改用 X487 的寫法
//   3. 錨點＝宣告句之後第一段能在羅什經文裡對上的「」引文
//
// 用法：node build/kepan/xinyan.mjs --root D:\2026\vcpp
import fs from 'node:fs';
import path from 'node:path';

const ROOT = (() => {
  const i = process.argv.indexOf('--root');
  const root = (i >= 0 ? process.argv[i + 1] : null) || process.env.VCPP_ROOT;
  if (!root) { console.error('用法：node build/kepan/xinyan.mjs --root <資料工作區>'); process.exit(1); }
  return path.resolve(root);
})();
const SRC_DIR = path.join(process.cwd(), 'build', '_xy');
const OUT = path.join(ROOT, 'kepan', 'xinyan.json');

// ---------- 繁簡／異體 ----------
const code = fs.readFileSync(path.join(process.cwd(), 'lossless.js'), 'utf8');
const win = {};
new Function('window', `${code};return window.LOSSLESS;`)(win);
const canon = win.LOSSLESS.canon;
const EXTRA = [[/讚/g, '赞'], [/讃/g, '赞'], [/歎/g, '叹'], [/祇/g, '祗']];
const norm2 = (s) => { let t = canon(s); for (const [re, to] of EXTRA) t = t.replace(re, to); return t; };

// ---------- 經文（羅什本） ----------
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8')
  .replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const units = D.versions[0].sents.map((s) => s.t);
let T = '';
const back = [];
units.forEach((t, u) => {
  let off = 0;
  for (const ch of t) {
    if (/[\u3400-\u9fff]/.test(ch)) { T += norm2(ch); back.push([u, off]); }
    off++;
  }
});
const unitOf = (p) => back[p];
const endOfText = [units.length - 1, units[units.length - 1].length];

// ---------- X487（Kanripo 001+002） ----------
const raw = ['001', '002'].map((v) => fs.readFileSync(path.join(SRC_DIR, `KR6c0075_${v}.txt`), 'utf8')).join('\n');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let mm;
while ((mm = re.exec(body))) {
  blocks.push(mm[1] != null ? { t: 'S', v: mm[1].replace(/\s+/g, '') } : { t: 'J', v: mm[2].replace(/\s+/g, '') });
}
const sents = [];
blocks.forEach((b, bi) => {
  if (b.t !== 'S') return;
  for (const s of b.v.split('。').map((x) => x.trim()).filter(Boolean)) sents.push({ s, n: norm2(s), bi });
});

// ---------- 幕布樹（骨架） ----------
const md = fs.readFileSync(path.join(process.cwd(), 'mubu-kepan', 'docs', '20-金刚经科判.md'), 'utf8').split('\n');
const tree = [];
for (const line of md) {
  const m = line.match(/^( *)- (.*)$/);
  if (!m) continue;
  let name = m[2].replace(/\*\*/g, '').trim()
    .replace(/^第[一二三四五六七八九十]+、/, '')
    .replace(/^[甲乙丙丁戊己庚辛壬癸][一二三四五六七八九十]+、/, '')
    .replace(/（[^）]*）\s*$/, '');
  if (/——/.test(name)) name = name.split('——')[0];
  tree.push({ depth: m[1].length / 2, raw: m[2].trim(), name: norm2(name) });
}

// ---------- 編輯距離 ----------
function ed(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(up + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}
const ORD = /^[初一二三四五六七八九十]{1,2}/;

// ---------- 1. 依序找宣告句 ----------
let cur = 0;
let hit = 0;
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
  if (best >= 0) { n.xname = sents[best].s.replace(ORD, ''); cur = best; hit++; }
}
console.log(`宣告句：${hit}/${tree.length}`);

// ---------- 2. 找錨點（宣告句之後第一段對得上經文的引文） ----------
let cursor = 0;
let anchored = 0;
const jing = blocks.map((b, i) => (b.t === 'J' ? i : -1)).filter((i) => i >= 0);
for (const n of tree) {
  if (n.si < 0) { n.u = null; continue; }
  const bi = sents[n.si].bi;
  let found = null;
  for (const jb of jing.filter((x) => x > bi).slice(0, 3)) {
    const q = norm2(blocks[jb].v).replace(/[^\u3400-\u9fff]/g, "");
    for (const L of [24, 16, 12, 10, 8]) {
      if (q.length < L) continue;
      const p = T.indexOf(q.slice(0, L), cursor);
      if (p >= 0) { found = { p, L }; break; }
    }
    if (found) break;
  }
  if (!found) { n.u = null; continue; }
  const [u, off] = unitOf(found.p);
  n.u = u; n.off = off;
  cursor = found.p;
  anchored++;
}
console.log(`錨點：${anchored}/${tree.length}`);

// ---------- 3. 組樹 ----------
const nodes = [];
const stack = [];
tree.forEach((n) => {
  const id = nodes.length;
  const labm = n.raw.match(/^([甲乙丙丁戊己庚辛壬癸])([一二三四五六七八九十]+)、/);
  const nd = {
    id, lv: n.depth + 1,
    lab: labm ? labm[1] + labm[2] : '',
    nm: (n.xname || n.raw.replace(/^.*、/, '')).replace(/[（(].*$/, '').trim(),
    par: null, ch: [], u: n.u, off: n.u == null ? null : n.off,
  };
  while (stack.length && nodes[stack[stack.length - 1]].lv >= nd.lv) stack.pop();
  if (stack.length) { nd.par = stack[stack.length - 1]; nodes[nd.par].ch.push(id); }
  nodes.push(nd);
  stack.push(id);
});

// 沒錨到的（多數是幕布本多出來的小節，如「解人題」）：起點借用下一個有錨的節點，
// 這樣範圍才不會為空、也不會倒退。
for (let i = nodes.length - 1; i >= 0; i--) {
  if (nodes[i].u != null) continue;
  let j = i + 1;
  while (j < nodes.length && nodes[j].u == null) j++;
  if (j < nodes.length) { nodes[i].u = nodes[j].u; nodes[i].off = nodes[j].off; }
  else { nodes[i].u = endOfText[0]; nodes[i].off = 0; }
}

// 迄點
const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
for (let i = 0; i < nodes.length; i++) {
  const a = [nodes[i].u, nodes[i].off];
  let end = endOfText;
  for (let j = i + 1; j < nodes.length; j++) {
    if (cmp([nodes[j].u, nodes[j].off], a) > 0) { end = [nodes[j].u, nodes[j].off]; break; }
  }
  nodes[i].u2 = end[0]; nodes[i].o2 = end[1];
}

// ---------- 4. 驗證 ----------
let err = 0;
for (const n of nodes) {
  if (n.par != null && nodes[n.par].lv >= n.lv) { console.error(`#${n.id} 層級不深於父`); err++; }
  if (n.u < 0 || n.u >= units.length) { console.error(`#${n.id} u 越界`); err++; }
  const ok = n.u2 > n.u || (n.u2 === n.u && n.o2 > n.off);
  if (!ok) { console.error(`#${n.id} ${n.lab}${n.nm} 範圍空 (${n.u},${n.off})-(${n.u2},${n.o2})`); err++; }
}
for (let i = 1; i < nodes.length; i++) {
  const a = nodes[i - 1], b = nodes[i];
  if (cmp([b.u, b.off], [a.u, a.off]) < 0) { console.error(`#${b.id} ${b.lab}${b.nm} 起點倒退`); err++; }
}
if (err) throw new Error(`${err} 個問題，未寫檔`);

// ---------- 5. 輸出 ----------
const out = {
  id: 'xinyan',
  title: '金剛新眼疏科判（信解行證四分）',
  short: '新眼疏',
  author: '清 通理述',
  date: '清',
  year: null,
  order: 60,
  ordStyle: 'ganzhi',
  note: '清·通理《金剛新眼疏經偈合釋》的科判：正宗分依信、解、行、證分四。科文取自 X487 原文（Kanripo 兩卷本），層級與道源法師《金剛經講記》的排印本一致；幕布本〈金剛經科判〉是同一棵樹的轉抄。',
  source: {
    text: '《金剛新眼疏經偈合釋》',
    base: 'CBETA 卍新纂續藏經 第 25 冊 No. 487（清·通理述）',
    via: 'Kanripo KR6c0075（卷一、卷二文字）',
    file: 'build/_xy/KR6c0075_001.txt, KR6c0075_002.txt',
  },
  generated: new Date().toISOString(),
  nodes: nodes.map((n) => ({ id: n.id, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: n.off, u2: n.u2, o2: n.o2 })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`寫出 ${OUT}：${nodes.length} 節、最深 lv${Math.max(...nodes.map((n) => n.lv))}、${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);






