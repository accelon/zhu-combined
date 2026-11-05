#!/usr/bin/env node
// 幕布《金剛般若波羅密經（六譯本對照）》的科判 → kepan/shiba.json
//
// 這家的科判是「十八住處」系（無著《金剛般若論》的十八住，甲乙丙…標層），
// 幕布文檔把它細分到 99 條，並與經文句排在同一棵樹裡：科判節點底下第一個
// 非【xx】的節點就是該科的經文首句。所以錨點不必另外猜——取那句話的前幾個
// 漢字，在 zhu-data 的羅什全文裡單調地找。
//
// 來源：build/_mubu-5EzhFDPiNin.json（由 vcpp 的 build/fetch-mubu.mjs 抓）
// 幕布是簡體，科名要用 opencc s2t 轉繁體（s2t.py）；沒有 python／opencc 時保留簡體並警告。
// 用法：node build/kepan/mubu.mjs --root D:\2026\vcpp
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { norm } from './lib.mjs';

const ROOT = (() => {
  const i = process.argv.indexOf('--root');
  const root = (i >= 0 ? process.argv[i + 1] : null) || process.env.VCPP_ROOT;
  if (!root) { console.error('用法：node build/kepan/mubu.mjs --root <資料工作區>'); process.exit(1); }
  return path.resolve(root);
})();
const SRC = path.join(ROOT, 'build', '_mubu-5EzhFDPiNin.json');
const OUT = path.join(ROOT, 'kepan', 'shiba.json');

// 幕布用「恆河」，T0235 用「恒河」；lib.mjs 的異體表沒有這一組，這裡補上。
const EXTRA = [[/恆/g, '恒'], [/於/g, '于']];
const fold = (s) => {
  let t = norm(s);
  for (const [re, to] of EXTRA) t = t.replace(re, to);
  return t;
};

const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8')
  .replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const base = D.versions[0];
const units = base.sents.map((s) => s.t);

// 目標字串：215 句接起來（只留漢字），並記回 (u, off)
let T = '';
const back = [];
units.forEach((t, u) => {
  let off = 0;
  for (const ch of t) {
    if (/[\u3400-\u9fff]/.test(ch)) {
      const f = fold(ch);
      if (f) { T += f; back.push([u, off]); }
    }
    off++;
  }
});
const unitOf = (p) => back[p];
const endOfText = [units.length - 1, units[units.length - 1].length];

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const KEPAN_RE = /^([甲乙丙丁戊己庚辛壬癸])([一二三四五六七八九十]+)、\s*(.*)$/;
const isTrans = (t) => /^【\d\d/.test(t);
const isMissing = (t) => /^（缺）/.test(t);

// ---- 1. 建樹（文件序）----
const all = [];
const stack = [];
for (const n of raw.nodes) {
  const text = (n.text || '').trim();
  const m = text.match(KEPAN_RE);
  const nd = { i: all.length, depth: n.depth, text, kepan: !!m, m, par: null, ch: [] };
  while (stack.length && stack[stack.length - 1].depth >= nd.depth) stack.pop();
  if (stack.length) { nd.par = stack[stack.length - 1].i; all[stack[stack.length - 1].i].ch.push(nd.i); }
  all.push(nd);
  stack.push(nd);
}
const kep = all.filter((n) => n.kepan);
if (kep.length !== 99) console.warn(`注意：科判節點 ${kep.length} 個（預期 99）`);

// ---- 2. 每個科判節點的第一句經文 ----
function firstText(k) {
  let found = null;
  (function walk(n) {
    for (const c of n.ch) {
      if (found) return;
      const cn = all[c];
      if (cn.kepan) { walk(cn); continue; }
      if (isTrans(cn.text) || isMissing(cn.text) || !cn.text) continue;
      found = cn.text;
      return;
    }
  })(k);
  return found;
}

const LEN = [24, 16, 12, 10, 8, 6];
let cursor = 0;
const problems = [];
kep.forEach((k, idx) => {
  const s = firstText(k);
  if (!s) { problems.push([k, '底下沒有經文句']); return; }
  const q = fold(s);
  let p = -1, used = 0;
  for (const L of LEN) {
    if (q.length < L) continue;
    p = T.indexOf(q.slice(0, L), cursor);
    if (p >= 0) { used = L; break; }
  }
  if (p < 0) { problems.push([k, '在經文裡找不到']); return; }
  const [u, off] = unitOf(p);
  k.anchor = { u, off, p, L: used };
  cursor = p;
});

// 找不到的，退而用「下一個找得到的科判」的錨點（並記下來）
for (let i = 0; i < kep.length; i++) {
  if (kep[i].anchor) continue;
  let j = i + 1;
  while (j < kep.length && !kep[j].anchor) j++;
  const a = j < kep.length ? kep[j].anchor : { u: endOfText[0], off: endOfText[1] };
  kep[i].anchor = { ...a, fallback: true };
}

// ---- 3. 組節點 ----
// 不加空根：三分（甲一／甲二／甲三）就是三個根，跟宗密一樣。
// （加了空根，麵包屑第一格會變「（無名）」，介面不好看。）
const nodes = [];
const push = (k, par) => {
  const id = nodes.length;
  const lv = '甲乙丙丁戊己庚辛壬癸'.indexOf(k.m[1]) + 1;
  const lab = k.m[1] + k.m[2];
  const nm = k.m[3].replace(/\s{2,}/g, ' ').trim();
  const node = { id, lv, lab, nm, par, ch: [], u: k.anchor.u, off: k.anchor.off };
  nodes.push(node);
  if (par != null) nodes[par].ch.push(id);
  for (const c of k.ch) if (all[c].kepan) push(all[c], id);
  return id;
};
for (const c of all[0].ch) if (all[c].kepan) push(all[c], null);

// ---- 3b. 科名簡 → 繁（幕布是簡體；版面其餘都是繁體） ----
let toTrad = true;
try {
  const tmp = path.join(os.tmpdir(), `mubu-names-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(nodes.map((n) => n.nm)), 'utf8');
  execFileSync('python', [path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 's2t.py'), tmp], { stdio: 'pipe' });
  const conv = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  nodes.forEach((n, i) => { n.nm = conv[i]; });
  fs.rmSync(tmp, { force: true });
} catch (e) {
  toTrad = false;
  console.warn('注意：python/opencc 不可用，科名保留簡體（' + String(e.message).slice(0, 80) + '）');
}

// 迄點＝文件序下一個「起點更後面」的科判；沒有就到全文末
// （父子常常同起點，例如「丙四、離障礙住處」與它第一住的第一句，所以要比嚴格大）
const posOf = (n) => [n.u, n.off];
const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
for (let i = 0; i < nodes.length; i++) {
  const cur = posOf(nodes[i]);
  let end = endOfText;
  for (let j = i + 1; j < nodes.length; j++) {
    if (cmp(posOf(nodes[j]), cur) > 0) { end = posOf(nodes[j]); break; }
  }
  nodes[i].u2 = end[0]; nodes[i].o2 = end[1];
}

// ---- 4. 驗證 ----
let err = 0;
for (const n of nodes) {
  if (n.par != null) {
    const p = nodes[n.par];
    if (p.lv >= n.lv) { console.error(`#${n.id} 層級 ${n.lv} 不深於父 ${p.lv}`); err++; }
  }
  if (n.u < 0 || n.u >= units.length) { console.error(`#${n.id} u 越界`); err++; }
  else if (n.off < 0 || n.off > units[n.u].length) { console.error(`#${n.id} off 越界`); err++; }
  const endOk = n.u2 > n.u || (n.u2 === n.u && n.o2 > n.off);
  if (n.id !== nodes.length - 1 && !endOk) { console.error(`#${n.id} 範圍為空 (${n.u},${n.off})-(${n.u2},${n.o2})`); err++; }
}
for (let i = 1; i < nodes.length; i++) {
  const a = nodes[i - 1], b = nodes[i];
  if (b.u < a.u || (b.u === a.u && b.off < a.off)) { console.error(`#${b.id} 起點倒退`); err++; }
}
if (problems.length) console.warn('錨點有問題：', problems.map(([k, w]) => `${k.text}（${w}）`).join('；'));
if (err) { for (const n of nodes) console.log(n.id, n.lv, n.par, n.u, n.off, n.u2, n.o2, n.nm.slice(0,24)); throw new Error(`${err} 個問題，未寫檔`); }

// ---- 5. 輸出 ----
const out = {
  id: 'shiba',
  title: '十八住處科判（無著論系）',
  short: '十八住',
  author: '幕布整理本（科判參考：妙境長老、林崇安）',
  date: '',
  year: null,
  order: 100,
  ordStyle: '',
  note: '科判用天干標層（甲一…辛二，共八層），骨架是無著《金剛般若論》十八住處：分三分，正宗分下分十八住，住以下再分。99 條。',
  source: {
    text: '幕布《金剛般若波羅密經（六譯本對照）》',
    base: 'mubu.com/explore/5EzhFDPiNin',
    via: 'build/fetch-mubu.mjs（vcpp 工作區）',
    file: 'build/_mubu-5EzhFDPiNin.json',
  },
  generated: new Date().toISOString(),
  nodes: nodes.map((n) => ({
    id: n.id, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch,
    u: n.u, off: n.off, u2: n.u2, o2: n.o2,
  })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`寫出 ${OUT}：${nodes.length} 節（含根）、最深 lv${Math.max(...nodes.map((n) => n.lv))}、${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
if (problems.length) console.log(`（${problems.length} 個節點用下一個錨點退讓）`);
