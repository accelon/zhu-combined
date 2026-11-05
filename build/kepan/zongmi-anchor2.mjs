// 宗密科會：錨點 v2（用「葉科後面夾的經文」＋單調挑選）
//
// 上一版用疏文的引文，會把「先引後文再解釋」的段落認錯（多節擠在同一句）。
// 這一版改用科會真正的經文位置：△段切成科文之後**剩下的那一截**（夾在葉科後面、
// 緊接【疏】之前），那一段就是這一科所指的經句。
//
//   node build/kepan/zongmi-anchor2.mjs          統計
//   node build/kepan/zongmi-anchor2.mjs --dump   寫 kepan/zongmi.json
import fs from 'node:fs';
import path from 'node:path';
import { lex } from './lex.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const work = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = work.text.split('△').slice(1);
const tree = JSON.parse(fs.readFileSync(path.join(ROOT, 'kepan', 'zongmi-tree.json'), 'utf8')).nodes;

const SENTS = D.versions[0].sents;
const isP = (ch) => /[「」『』，。、！？：；…—－·（）()\s〈〉《》〔〕【】]/.test(ch);
const clean = (raw) => { let out = ''; for (let i = 0; i < raw.length; i++) if (!isP(raw[i])) out += raw[i]; return out; };
let text = '';
const pos = [];
for (const s of SENTS) {
  for (let i = 0; i < s.t.length; i++) {
    if (isP(s.t[i])) continue;
    text += s.t[i];
    pos.push({ u: s.u, off: i });
  }
}
const K = +(process.env.KGRAM || 6);
const gram = new Map();
for (let i = 0; i + K <= text.length; i++) {
  const g = text.slice(i, i + K);
  if (!gram.has(g)) gram.set(g, []);
  if (gram.get(g).length < 60) gram.get(g).push(i);
}
function longest(body, from = 0) {
  let best = null;
  for (let i = 0; i + K <= body.length; i++) {
    const cs = gram.get(body.slice(i, i + K));
    if (!cs) continue;
    for (const at of cs) {
      if (at < from) continue;
      let len = K;
      while (i + len < body.length && at + len < text.length && body[i + len] === text[at + len]) len++;
      if (!best || len > best.len) best = { at, len };
    }
  }
  return best;
}

/* ---- 每段的「夾經文」 ---- */
const tailOf = [];
for (let i = 0; i < segs.length; i++) {
  const seg = segs[i] || '';
  const head = seg.split('【疏】')[0].split('【記】')[0];
  const t = lex(head).tail || '';
  tailOf[i] = clean(t);
}

/* ---- 逐節按段序找位置 ---- */
const byId = new Map(tree.map((n) => [n.id, n]));
const kids = new Map();
for (const n of tree) if (n.par != null) { if (!kids.has(n.par)) kids.set(n.par, []); kids.get(n.par).push(n.id); }
const roots = tree.filter((n) => n.par == null);
const order = [];
for (const r of roots) (function walk(id) { const n = byId.get(id); order.push(n); for (const k of (kids.get(id) || [])) walk(k); })(r.id);

// 1) 每段各自找（不設下限），把結果掛到「該段最後進入的那個節」
const segNode = new Map();          // seg → node（該段最後進入的）
for (const n of order) if (n.lastSeg != null) segNode.set(n.lastSeg, n);
for (const n of segNode.values()) { n.anchor = null; n.aln = 0; }
for (const [sg, node] of segNode) {
  const t = tailOf[sg];
  if (!t) continue;
  const m = longest(t, 0);
  const MIN = +(process.env.MINLEN || 6);
  if (m && m.len >= MIN) { node.anchor = m.at; node.aln = m.len; }
}
// 1b) 尾巴沒有經文的，退而用整段（疏＋記）裡 ≥10 字的引文
for (const [sg, node] of segNode) {
  if (node.anchor != null) continue;
  const body = clean(segs[sg] || '');
  if (body.length < 10) continue;
  const m = longest(body, 0);
  if (m && m.len >= 10) { node.anchor = m.at; node.aln = m.len; }
}
// 2) LIS：挑出位置遞增的最大子集（其餘視為不確定）
const anchored = order.filter((n) => n.anchor != null);
let best = [];
{
  const n = anchored.length;
  const len = new Array(n).fill(1), prevIdx = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (anchored[j].anchor <= anchored[i].anchor && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prevIdx[i] = j; }
    }
  }
  let end = -1, mx = 0;
  for (let i = 0; i < n; i++) if (len[i] > mx) { mx = len[i]; end = i; }
  const keep = new Set();
  for (let i = end; i >= 0; i = prevIdx[i]) { keep.add(anchored[i].id); if (prevIdx[i] < 0) break; }
  for (const a of anchored) if (!keep.has(a.id)) { a.anchor = null; a.aln = 0; }
  best = [...keep];
}
// 3) 沒錨點的繼承前一個
let prev = 0;
for (const n of order) { if (n.anchor != null) { prev = n.anchor; } else { n.anchor = prev; n.aln = 0; } }
const precise = order.filter((n) => n.aln > 0).length;
/* 父節取子孫最小 */
for (let i = order.length - 1; i >= 0; i--) {
  const n = order[i];
  for (const k of (kids.get(n.id) || [])) { const c = byId.get(k); if (c.anchor < n.anchor) n.anchor = c.anchor; }
}
for (const n of order) { const p = pos[Math.min(n.anchor, pos.length - 1)]; n.u = p.u; n.off = p.off; }
for (let i = 0; i < order.length; i++) {
  const n = order[i];
  let end = { u: SENTS[SENTS.length - 1].u, off: SENTS[SENTS.length - 1].t.length };
  for (let j = i + 1; j < order.length; j++) {
    const m = order[j];
    if (m.u > n.u || (m.u === n.u && m.off > n.off)) { end = { u: m.u, off: m.off }; break; }
  }
  n.u2 = end.u; n.o2 = end.off;
}

const mono = order.filter((n, i) => i === 0 || n.u > order[i - 1].u || (n.u === order[i - 1].u && n.off >= order[i - 1].off)).length;
const distinct = new Set(order.map((n) => n.u + ':' + n.off)).size;
console.log('節點 ' + order.length + '｜夾經文錨點 ' + precise + '（' + (precise / order.length * 100).toFixed(1) + '%）');
console.log('單調 ' + mono + ' / ' + order.length + '（' + (mono / order.length * 100).toFixed(1) + '%）｜不同起點 ' + distinct);
console.log('u 範圍 ' + Math.min(...order.map((n) => n.u)) + '–' + Math.max(...order.map((n) => n.u)));
for (const k of ['標題目', '序宗旨', '解本文', '序分', '正宗分', '流通分', '證信序', '發起序', '如來正說']) {
  const n = tree.find((x) => x.name === k);
  if (n) console.log('  ' + k.padEnd(5) + ' u' + n.u + ' off' + n.off + (n.aln ? '（夾 ' + n.aln + ' 字）' : '（繼承）'));
}

if (process.argv.includes('--dump')) {
  const ch = new Map();
  for (const n of tree) if (n.par != null) { if (!ch.has(n.par)) ch.set(n.par, []); ch.get(n.par).push(n.id); }
  const out = {
    id: 'zongmi', title: '金剛經疏記科會', short: '宗密科會',
    author: '唐 宗密疏 · 宋 子璿記 · 清 大璸科會', date: '唐', year: 618,
    note: '圭峰宗密疏、長水子璿記、清大璸科會。△開科、分N：初二三列科。',
    nkRule: '',
    source: 'CBETA 金剛經疏記科會；文字取 zhu-data.js',
    generated: new Date().toISOString().slice(0, 10),
    nodes: order.map((n) => ({
      id: n.id, lv: n.lv, lab: String(n.label ?? '').replace(/\.\d+$/, ''), nm: n.name,
      par: n.par, ch: ch.get(n.id) || [], u: n.u, off: n.off, u2: n.u2, o2: n.o2, ln: n.aln || 0,
      // 沒有引文可對的節（位置是繼承來的）標 nk：目錄與麵包屑照樣出現，但不插經文標記
      nk: n.aln ? 0 : 1,
    })),
  };
  fs.writeFileSync(path.join(ROOT, 'kepan', 'zongmi.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log('\n寫出 kepan/zongmi.json');
}
