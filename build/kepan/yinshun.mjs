#!/usr/bin/env node
// 抽印順《般若經講記》金剛經部分的科判 → kepan/yinshun.json
//
// 來源：D:\2026\adb-converter\build\ys-text-full.txt（D:\2026\ys 建置的全文，唯讀）
//   科文標記是 `<章 t="節,項." u="文">…</章>`／`<節 …>`／`<項 …>`；
//   標題文字自帶層級：「甲一 序分」「乙一 證信序」…（天干），懸論那三項是「一 釋經題」。
//
// 對到經文：把羅什經文（查詢）單調對到講記本文（目標）——講記依序引用經文，
//   所以每個科文標題「之後的第一個錨點」就是它所指的經文起點（字元級）。
//
// 用法：node build/kepan/yinshun.mjs [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import { LEVEL_CHARS, normMap, buildChain, extendBack } from './lib.mjs';

const ROOT = 'D:\\2026\\zhu-combined';
const YS = 'D:\\2026\\adb-converter\\build\\ys-text-full.txt';
const OUT = path.join(ROOT, 'kepan', 'yinshun.json');
const VERBOSE = process.argv.includes('--verbose');

const raw = fs.readFileSync(YS, 'utf8');
const START = '<章 t="節,項." u="文">金剛般若波羅蜜經講記</章>';
const END = '<章 t="節,項." u="文">般若波羅蜜多心經講記</章>';
const i0 = raw.indexOf(START);
const i1 = raw.indexOf(END);
if (i0 < 0 || i1 < 0 || i1 <= i0) throw new Error('找不到金剛經講記的起訖');
const chunk = raw.slice(i0, i1);

/* ---------------------------------------------------------------- 逐字掃描 */
// 把標記換成控制字元，邊掃邊記：標題位置（漢字序）、頁碼位置。
const KEP_OPEN = '\u0003', KEP_CLOSE = '\u0004', TAGSEP = '\u0005';
let s = chunk.replace(/<頁 id="([^"]+)"\/>/g, (_, id) => `\u0001${id}\u0002`);
s = s.replace(/<(項|節|章)([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) =>
  (/u="文"/.test(attrs) ? KEP_OPEN + tag + TAGSEP + inner + KEP_CLOSE : ''));

const heads = [];
const pages = [];
const paras = [];        // <段/> 段落：{ at, text }
let text = '';
let hanAt = 0;           // 目前累積的漢字數（＝ norm 座標）
let curHead = null;
let curPar = null;
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  if (ch === KEP_OPEN) { curHead = { at: hanAt, text: '', tag: '' }; continue; }
  if (ch === KEP_CLOSE) { if (curHead) { heads.push(curHead); curHead = null; } continue; }
  if (ch === '\u0001') {
    const b = s.indexOf('\u0002', i);
    pages.push({ id: s.slice(i + 1, b), at: hanAt });
    i = b;
    continue;
  }
  if (curHead) {
    if (ch === TAGSEP) { curHead.tag = curHead.text; curHead.text = ''; } else curHead.text += ch;
    continue;
  }
  if (ch === '<') {
    const b = s.indexOf('>', i);
    if (b > 0) {
      if (s.slice(i, b + 1) === '<段/>') { curPar = { at: hanAt, text: '' }; paras.push(curPar); }
      i = b;
      continue;
    }
  }
  const ent = /^&[A-Za-z0-9#]+;/.exec(s.slice(i, i + 12));
  if (ent) { i += ent[0].length - 1; continue; }
  if (/\s/.test(ch)) continue;
  text += ch;
  if (curPar) curPar.text += ch;
  if (/[\u3400-\u9fff]/.test(ch)) hanAt++;
}

/* ---------------------------------------------------------------- 核對講記本文 */
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8')
  .replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const base = D.versions[0];
const y01 = D.works.find((w) => w.id === 'Y01');
if (!y01) throw new Error('zhu-data 沒有 Y01');
if (y01.text !== text) {
  let k = 0;
  while (k < Math.min(text.length, y01.text.length) && text[k] === y01.text[k]) k++;
  console.warn(`⚠ 講記本文與 zhu-data 的 Y01 不完全相同（${text.length} vs ${y01.text.length}），第一處不同在 ${k}`);
  console.warn('  ', JSON.stringify(text.slice(k - 15, k + 15)), '／', JSON.stringify(y01.text.slice(k - 15, k + 15)));
}

/* ---------------------------------------------------------------- 建樹 */
const nodes = [];
const stack = [];
function newNode(lv, label, name, at, tag) {
  const n = { id: nodes.length, lv, lab: label, nm: name, par: null, ch: [], at, tag, u: 0 };
  nodes.push(n);
  return n;
}
const root = newNode(0, '', '', 0, '章');
stack.push(root);

for (const h of heads) {
  const t = h.text.trim();
  if (!t) continue;
  let lv, label = '', name = t;
  const g = LEVEL_CHARS.indexOf(t[0]);
  if (g >= 0) {
    lv = 3 + g;                       // 甲一 → 3，乙一 → 4 …
    label = t.slice(0, 2).trim();     // 「甲一」
    name = t.slice(2).trim();
  } else if (h.tag === '章') { lv = 1; name = t; }
  else if (h.tag === '節') { lv = 2; name = t; }
  else { lv = 3; name = t; }

  const n = newNode(lv, label, name, h.at, h.tag);
  let parent = null;
  for (let k = stack.length - 1; k >= 0; k--) if (stack[k].lv < lv) { parent = stack[k]; break; }
  n.par = parent ? parent.id : null;
  if (parent) parent.ch.push(n.id);
  while (stack.length && stack[stack.length - 1].lv >= lv) stack.pop();
  stack.push(n);
}

/* ---------------------------------------------------------------- 對到經文 */
const S = base.sents.map((x) => x.t).join('');
const nm = normMap(S);
const unitStarts = [];
{
  let acc = 0;
  for (const x of base.sents) { unitStarts.push(acc); acc += normMap(x.t).text.length; }
}
const unitEnds = unitStarts.map((x, i) => x + normMap(base.sents[i].t).text.length);
const unitRaw = base.sents.map((x) => normMap(x.t).map);
function toUnit(pos) {
  let lo = 0, hi = unitStarts.length - 1, best = 0;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (unitStarts[mid] <= pos) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  return best;
}
const TN = normMap(text).text;
const { chain } = buildChain(nm.text, TN);
console.log(`經文 ${nm.text.length} 字，講記 ${TN.length} 字，錨點 ${chain.length}，段落 ${paras.length}`);
for (const p of paras) p.norm = normMap(p.text).text;

const chainP = chain.map((c) => c.p);
function chainAnchor(at) {
  let lo = 0, hi = chain.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (chainP[mid] >= at) { best = mid; hi = mid - 1; } else lo = mid + 1;
  }
  if (best < 0) return null;
  return extendBack(TN, chain[best].p, nm.text, chain[best].j);
}

/**
 * 標題所指的經文起點。
 *
 * 8 字窗錨點在講記裡會誤中「解說文字裡重述的經句」（例如「果報亦不可思議」在
 * 註解裡又出現一次），所以先用段落定位：科文標題後面那一段幾乎就是它所引的經文，
 * 直接拿段落開頭去經文裡找（跳過開頭 0–4 字，容忍引文從句中起）。
 * 這一段找不到（是解說不是經文）就換下一段，試滿 6 段才退回 8 字窗錨點。
 */
let lastPos = 0;   // 上一個節點在經文中的位置（講記依序引經，所以只往前）
let fromPar = 0, fromChain = 0;
function anchorAt(at) {
  const floor = Math.max(0, lastPos - 20);
  let tried = 0;
  for (let k = 0; k < paras.length && tried < 6; k++) {
    const p = paras[k];
    if (p.at < at) continue;
    tried++;
    const t = p.norm || '';
    for (let skip = 0; skip <= 4; skip++) {
      const s2 = t.slice(skip);
      for (const len of [16, 12, 10, 8]) {
        if (s2.length < len) continue;
        const i = nm.text.indexOf(s2.slice(0, len), floor);
        if (i < 0) continue;
        let pos = i, kk = skip;
        while (kk > 0 && pos > 0 && nm.text[pos - 1] === t[kk - 1]) { pos--; kk--; }
        if (pos < floor) continue;
        lastPos = pos;
        fromPar++;
        return pos;
      }
    }
  }
  fromChain++;
  const c = chainAnchor(at);
  if (c != null && c >= floor) { lastPos = c; return c; }
  return lastPos;
}

// 懸論（正釋之前）不是對某段經文的分科 → 不連經文
const ZHENGSHI = nodes.find((n) => n.nm === '正釋' && n.lv === 2);
const CUT = ZHENGSHI ? ZHENGSHI.at : 0;
for (const n of nodes) {
  n.nolink = n.at < CUT ? 1 : 0;
  if (!n.nolink) {
    const pos = anchorAt(n.at);
    if (pos == null) { n.nolink = 1; n.u = -1; n.off = 0; }
    else {
      const u = toUnit(pos);
      const offN = Math.max(0, pos - unitStarts[u]);
      const map = unitRaw[u];
      n.u = u;
      n.off = offN >= map.length ? base.sents[u].t.length : map[offN];
    }
  } else { n.u = -1; n.off = 0; }
}

/* ---------------------------------------------------------------- 範圍 */
const order = [];
(function dfs(list) {
  for (const id of list) { const n = nodes[id]; order.push(n); if (n.ch.length) dfs(n.ch); }
})(nodes.filter((n) => n.par == null).map((n) => n.id));
const live = order.filter((n) => !n.nolink);
const lastU = base.sents.length - 1;
for (let k = 0; k < live.length; k++) {
  const n = live[k];
  let endU = lastU, endOff = base.sents[lastU].t.length;
  for (let j = k + 1; j < live.length; j++) {
    const m2 = live[j];
    if (m2.u > n.u || (m2.u === n.u && m2.off > n.off)) { endU = m2.u; endOff = m2.off; break; }
  }
  n.u2 = endU; n.u2off = endOff;
}
for (const n of nodes) {
  if (n.u2 == null) { n.u2 = n.u; n.u2off = 0; }
}

/* ---------------------------------------------------------------- 檢查 */
const depths = {};
for (const n of nodes) depths[n.lv] = (depths[n.lv] || 0) + 1;
console.log(`節點 ${nodes.length}；標題 ${heads.length}；層級分佈 ${JSON.stringify(depths)}`);
console.log(`不連經文（懸論）${nodes.filter((n) => n.nolink).length}；末節點 u${live[live.length - 1].u}`);
// 單調性：文件序上的起點不可倒退
let bad = 0;
let pu = -1, po = -1;
for (const n of live) {
  if (n.u < pu || (n.u === pu && n.off < po)) { bad++; if (VERBOSE) console.log('  ⚠ 倒退', n.id, n.nm, n.u, n.off, 'prev', pu, po); }
  if (n.u > pu) { pu = n.u; po = n.off; } else po = Math.max(po, n.off);
}
console.log('單調性倒退', bad, '；段落錨定', fromPar, '；退回 8 字窗', fromChain);
if (VERBOSE) {
  const at = (u, off) => (base.sents[u] ? base.sents[u].t : '').slice(off, off + 18);
  for (const n of nodes.slice(0, 30)) console.log(' '.repeat(Math.max(0, n.lv - 1)) + n.lab + n.nm, 'u' + n.u + '.' + n.off, n.nolink ? '(總論)' : '「' + at(n.u, n.off) + '」');
}

/* ---------------------------------------------------------------- 輸出 */
const out = {
  id: 'yinshun',
  title: '印順《般若經講記》金剛經科判',
  short: '印順',
  author: '釋印順講 演培記',
  date: '民國31年（1942）',
  year: 1942,
  note: '科判用天干（甲一…壬一）；另有章（講記）／節（懸論、正釋）兩層，懸論不對應經文。',
  source: {
    text: '印順《般若經講記》',
    base: '妙雲集·上編①（正聞出版社）',
    via: 'D:\\2026\\ys 建置的 ys.adb 全文',
    file: 'ys-text-full.txt',
  },
  generated: new Date().toISOString(),
  nodes: nodes.map((n) => ({
    id: n.id, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch,
    u: n.nolink ? -1 : n.u, off: n.nolink ? 0 : n.off,
    u2: n.nolink ? -1 : n.u2, o2: n.nolink ? 0 : n.u2off,
    nolink: n.nolink,
  })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('寫出', OUT, (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB');
