#!/usr/bin/env node
// 《金剛新眼疏》科判（信解行證四分）→ kepan/xinyan.json（草稿）
//
// 底本：清·通理述《金剛新眼疏經偈合釋》（CBETA X487；文字用 Kanripo KR6c0075 兩卷本）。
// 骨架：幕布本〈金剛經科判〉的 187 節（已核對＝道源講記 188 個標題）。
//
// 1. 依文件序在 X487 疏文裡找每個科名的宣告句（容許 1 字異文，幕布本有錯字）
// 2. 只有葉科要錨點：宣告句之後第一段對得上羅什經文的「」引文
// 3. 非葉科的起點＝第一個子科的起點（科判的慣例）
//
// 用法：node build/kepan/xinyan3.mjs --root D:\2026\vcpp
import fs from 'node:fs';
import path from 'node:path';

const ROOT = (() => {
  const i = process.argv.indexOf('--root');
  const r = (i >= 0 ? process.argv[i + 1] : null) || process.env.VCPP_ROOT;
  if (!r) { console.error('用法：node build/kepan/xinyan3.mjs --root <資料工作區>'); process.exit(1); }
  return path.resolve(r);
})();
const SRC_DIR = path.join(process.cwd(), 'build', '_xy');
const OUT = path.join(ROOT, 'kepan', 'xinyan.json');

const code = fs.readFileSync(path.join(process.cwd(), 'lossless.js'), 'utf8');
const win = {};
new Function('window', `${code};return window.LOSSLESS;`)(win);
const canon = win.LOSSLESS.canon;
const EXTRA = [[/讚/g, '赞'], [/讃/g, '赞'], [/歎/g, '叹'], [/祇/g, '祗'], [/巳/g, '已']];
const norm2 = (s) => { let t = canon(s); for (const [re, to] of EXTRA) t = t.replace(re, to); return t; };
const HAN = /[\u3400-\u9fff]/;
const hanOnly = (s) => { let o = ''; for (const ch of s) if (HAN.test(ch)) o += ch; return o; };

// ---- 經文 ----
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8')
  .replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const units = D.versions[0].sents.map((s) => s.t);
let T = '';
const back = [];
units.forEach((t, u) => {
  let off = 0;
  for (const ch of t) { if (HAN.test(ch)) { T += norm2(ch); back.push([u, off]); } off++; }
});
const endOfText = [units.length - 1, units[units.length - 1].length];

// ---- X487 ----
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

// ---- 幕布樹 ----
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
  const labm = m[2].match(/^([甲乙丙丁戊己庚辛壬癸])([一二三四五六七八九十]+)、/);
  tree.push({ depth: m[1].length / 2, raw: m[2].trim(), name: norm2(name), lab: labm ? labm[1] + labm[2] : '' });
}
// 補樹（par / ch / 是否葉）
tree.forEach((n, i) => { n.id = i; n.par = null; n.ch = []; });
{
  const stack = [];
  tree.forEach((n, i) => {
    while (stack.length && tree[stack[stack.length - 1]].depth >= n.depth) stack.pop();
    if (stack.length) { n.par = stack[stack.length - 1]; tree[n.par].ch.push(i); }
    stack.push(i);
  });
}

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

// 序號：初＝1，一＝1 …十＝10；「十一」這種兩位數要整個吃掉
const stripOrd = (s) => {
  if (s.startsWith('初')) return { ord: 1, rest: s.slice(1) };
  const m = s.match(/^(十[一二三四五六七八九]?|[一二三四五六七八九])/);
  if (!m) return { ord: 0, rest: s };
  const t = m[1];
  const n = t.length === 1 ? '一二三四五六七八九'.indexOf(t) + 1 : 10 + (t.length > 1 ? '一二三四五六七八九'.indexOf(t[1]) + 1 : 0);
  return { ord: n || 0, rest: s.slice(t.length) };
};

// ---- 1. 找宣告句 ----
let cur = 0;
let hit = 0;
for (const n of tree) {
  let best = -1;
  for (const W of [120, 400, 900]) {
    const window = Math.min(sents.length, cur + W);
    best = -1;
    for (let i = cur; i < window && best < 0; i++) {
      const { rest } = stripOrd(sents[i].n);
      if (!rest || rest.length > n.name.length + 3) continue;
      if (rest === n.name) best = i;          // 先找完全相同的，避免「二果離相」被「初果離相」吃掉
    }
    for (let i = cur; i < window && best < 0; i++) {
      const { rest } = stripOrd(sents[i].n);
      if (!rest || rest.length > n.name.length + 3) continue;
      if (ed(n.name, rest) <= (n.name.length >= 6 ? 2 : 1)) best = i;
    }
    if (best >= 0) break;
  }
  n.si = best;
  if (best >= 0) { n.xname = stripOrd(sents[best].n).rest; cur = best; hit++; }
}
console.log(`宣告句：${hit}/${tree.length}`);

// ---- 2. 葉科錨點 ----
const jing = blocks.map((b, i) => (b.t === 'J' ? i : -1)).filter((i) => i >= 0);
let lastJb = -1;
let cursor = 0;
let anchored = 0;
// 釋題（總釋名題／釋經題／解人題）不連經文，標 nk 讓前端不畫標記
for (const n of tree) if (/^(总释名题|释经题|经题|解人题)/.test(n.name)) { n.nk = 1; n.u = 0; n.off = 0; }
for (const n of tree) {
  if (n.nk || n.ch.length) continue;      // 只錨葉科
  if (n.si < 0) { if (process.env.DBG) console.log('NOSI', n.name); continue; }
  const bi = sents[n.si].bi;
  let found = null, usedJb = -1;
  for (const jb of jing.filter((x) => x > Math.max(bi, lastJb)).slice(0, 3)) {
    const q = hanOnly(norm2(blocks[jb].v));
    for (const L of [24, 16, 12, 10, 8]) {
      if (q.length < L) continue;
      const p = T.indexOf(q.slice(0, L), cursor);
      if (p >= 0 && p - cursor < 1200) { found = { p, L }; usedJb = jb; break; }
    }
    if (found) break;
  }
  if (!found) { if (process.env.DBG) console.log("MISS", n.name, "bi", bi, "lastJb", lastJb); continue; }
  if (process.env.DBG) console.log("ANCH", n.name, "bi", bi, "jb", usedJb, "u", back[found.p][0], "L", found.L);
  const [u, off] = back[found.p];
  n.u = u; n.off = off;
  cursor = found.p;
  lastJb = usedJb;
  anchored++;
}
console.log(`葉科錨點：${anchored}/${tree.filter((n) => !n.ch.length).length}`);

// ---- 3. 非葉科＝首子起點 ----
const resolve = (i) => {
  const n = tree[i];
  if (n.u != null) return n.u;
  for (const c of n.ch) { const v = resolve(c); if (v != null) { n.u = v; n.off = tree[c].off; return v; } }
  return null;
};
tree.forEach((n, i) => resolve(i));

// 完全沒有錨的（例如「解人題」）：往後借
for (let i = tree.length - 1; i >= 0; i--) {
  const n = tree[i];
  if (n.u != null) continue;
  let j = i + 1;
  while (j < tree.length && tree[j].u == null) j++;
  if (j < tree.length) { n.u = tree[j].u; n.off = tree[j].off; }
  else { n.u = endOfText[0]; n.off = 0; }
}

// 流通分：一定從「佛說是經已」起（倒數第二句；最後一句是卷末的真言）
{
  const liu = tree.find((n) => /流通分/.test(n.xname || n.raw));
  const k = units.findIndex((t) => t.startsWith('佛說是經已'));
  if (liu && k >= 0) { liu.u = k; liu.off = 0; }
}

// ---- 4. 迄點 ----
const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
tree.forEach((n, i) => {
  let end = endOfText;
  for (let j = i + 1; j < tree.length; j++) {
    if (cmp([tree[j].u, tree[j].off], [n.u, n.off]) > 0) { end = [tree[j].u, tree[j].off]; break; }
  }
  n.u2 = end[0]; n.o2 = end[1];
});

// ---- 5. 驗證 ----
let err = 0;
for (const n of tree) {
  const ok = n.u2 > n.u || (n.u2 === n.u && n.o2 > n.off);
  if (!ok) { console.error(`#${n.id} ${n.lab}${n.nm || n.xname} 範圍空`); err++; }
  if (n.u < 0 || n.u >= units.length) { console.error(`#${n.id} u 越界`); err++; }
}
for (let i = 1; i < tree.length; i++) {
  if (cmp([tree[i].u, tree[i].off], [tree[i - 1].u, tree[i - 1].off]) < 0) {
    console.error(`#${i} ${tree[i].xname || ''} 起點倒退`); err++;
  }
}
if (err) throw new Error(`${err} 個問題，未寫檔`);

// ---- 6. 輸出 ----
const nodes = tree.map((n) => ({
  id: n.id, lv: n.depth + 1, lab: n.lab,
  nm: (n.xname ? n.xname.replace(/[一二三四五六七八九十]$/, '') : n.raw.replace(/^.*、/, '')).replace(/[（(].*$/, '').replace(/——.*$/, '').trim(),
  par: n.par, ch: n.ch, u: n.u, off: n.off, u2: n.u2, o2: n.o2, ...(n.nk ? { nk: 1 } : {}),
}));
const out = {
  id: 'xinyan',
  title: '金剛新眼疏科判（信解行證四分）',
  short: '新眼疏',
  author: '清 通理述',
  date: '清', year: null, order: 60, ordStyle: 'ganzhi',
  note: '清·通理《金剛新眼疏經偈合釋》科判：正宗分依信、解、行、證分四。科名取自 X487 原文（Kanripo 兩卷本），層級沿用道源法師《金剛經講記》排印本。狀態：一校草稿——114 葉科中 109 個已釘到經文，少數（如「世界無住」）可能偏一科，待覆核。',
  source: {
    text: '《金剛新眼疏經偈合釋》',
    base: 'CBETA 卍新纂續藏經 第 25 冊 No. 487（清·通理述）',
    via: 'Kanripo KR6c0075（卷一、卷二）',
    file: 'build/_xy/KR6c0075_001.txt, KR6c0075_002.txt',
  },
  generated: new Date().toISOString(),
  nodes,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`寫出 ${OUT}：${nodes.length} 節、最深 lv${Math.max(...nodes.map((n) => n.lv))}、${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);













