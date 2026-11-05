// 宗密科會：錨點 v3 — 人工釘骨幹 ＋ 等比例插入
//
// 引文法只到 13.9%（735 段裡只有 184 段夾著經文），其餘位置改用「段序等比例」：
//   1. 手工釘死的骨幹（序分、正宗分、流通分、證信序、發起序…）給定 u
//   2. 引文錨點（≥6 字）保留
//   3. 其餘節在「前一個已知點」與「後一個已知點」之間按 DFS 順序等比例插入
//
//   node build/kepan/zongmi-anchor3.mjs          統計
//   node build/kepan/zongmi-anchor3.mjs --dump   寫 kepan/draft/zongmi.json
import fs from 'node:fs';
import path from 'node:path';
import { lex } from './lex.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const work = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = work.text.split('△').slice(1);
const tree = JSON.parse(fs.readFileSync(path.join(ROOT, 'kepan', 'draft', 'zongmi-tree.json'), 'utf8')).nodes;

const SENTS = D.versions[0].sents;
const SEC_FIRST = [];
SENTS.forEach((s) => { if (SEC_FIRST[s.s] == null) SEC_FIRST[s.s] = s.u; });

const isP = (ch) => /[「」『』，。、！？：；…—－·（）()\s〈〉《》〔〕【】]/.test(ch);
const clean = (s) => { let o = ''; for (const c of s) if (!isP(c)) o += c; return o; };
let text = '';
const pos = [];
for (const s of SENTS) for (let i = 0; i < s.t.length; i++) { if (isP(s.t[i])) continue; text += s.t[i]; pos.push({ u: s.u, off: i }); }
const K = 4;
const gram = new Map();
for (let i = 0; i + K <= text.length; i++) { const g = text.slice(i, i + K); if (!gram.has(g)) gram.set(g, []); if (gram.get(g).length < 60) gram.get(g).push(i); }
const longest = (body) => {
  let best = null;
  for (let i = 0; i + K <= body.length; i++) {
    const cs = gram.get(body.slice(i, i + K)); if (!cs) continue;
    for (const at of cs) {
      let len = K;
      while (i + len < body.length && at + len < text.length && body[i + len] === text[at + len]) len++;
      if (!best || len > best.len) best = { at, len };
    }
  }
  return best;
};

/* ---- 骨幹：手工釘死（u 由分界決定） ---- */
const PIN = {
  標題目: 0, 序宗旨: 0, 解本文: 0,
  序分: 0, 證信序: 0, 發起序: SEC_FIRST[2] != null ? SEC_FIRST[1] + 1 : 1,
  正宗分: SEC_FIRST[2], 流通分: SEC_FIRST[32],
};
const byName = new Map();
for (const n of tree) if (!byName.has(n.name)) byName.set(n.name, n);
const idxOfU = (u) => { for (let i = 0; i < pos.length; i++) if (pos[i].u === u && pos[i].off === 0) return i; return 0; };

const kids = new Map();
for (const n of tree) if (n.par != null) { if (!kids.has(n.par)) kids.set(n.par, []); kids.get(n.par).push(n.id); }
const byId = new Map(tree.map((n) => [n.id, n]));
const order = [];
for (const r of tree.filter((n) => n.par == null)) (function walk(id) { const n = byId.get(id); order.push(n); for (const k of (kids.get(id) || [])) walk(k); })(r.id);

/* ---- 已知點：骨幹 ＋ 引文 ---- */
for (const n of order) {
  n.known = null;
  if (PIN[n.name] != null) n.known = idxOfU(PIN[n.name]);
}
for (const n of order) {
  if (n.known != null) continue;
  const head = (segs[n.seg] || '').split('【疏】')[0].split('【記】')[0];
  const tail = clean(lex(head).tail || '');
  const body = clean(segs[n.seg] || '');
  const m = (tail && longest(tail)) || longest(body);
  if (m && m.len >= 6) n.known = m.at;
}
/* 單調化已知點：只留遞增的（骨幹優先，不動） */
let last = 0;
for (const n of order) {
  if (n.known == null) continue;
  if (PIN[n.name] != null) { last = Math.max(last, n.known); continue; }
  if (n.known < last - 40) n.known = null; else { if (n.known < last) n.known = last; last = n.known; }
}
/* ---- 未知點：前後已知點之間等比例 ---- */
let prevIdx = 0, prevPos = 0;
for (let i = 0; i < order.length; i++) {
  const n = order[i];
  if (n.known != null) { n.anchor = n.known; prevIdx = i; prevPos = n.known; continue; }
  let nextIdx = order.length, nextPos = pos.length - 1;
  for (let j = i + 1; j < order.length; j++) if (order[j].known != null) { nextIdx = j; nextPos = order[j].known; break; }
  const f = nextIdx === prevIdx ? 0 : (i - prevIdx) / (nextIdx - prevIdx);
  n.anchor = Math.round(prevPos + (nextPos - prevPos) * f);
}

// 最後再掃一遍，保證位置單調
{
  let m = 0;
  for (const n of order) { if (n.anchor < m) n.anchor = m; else m = n.anchor; }
}
const precise = order.filter((n) => n.known != null).length;
const distinct = new Set(order.map((n) => n.anchor)).size;
const mono = order.filter((n, i) => i === 0 || n.anchor >= order[i - 1].anchor).length;
console.log('節點 ' + order.length + '｜已知點 ' + precise + '（骨幹 ' + Object.keys(PIN).length + ' ＋引文 ' + (precise - Object.keys(PIN).length) + '）');
console.log('位置 ' + distinct + ' 個｜單調 ' + mono + ' / ' + order.length);
for (const k of Object.keys(PIN)) {
  const n = byName.get(k);
  if (n) { const p = pos[Math.min(n.anchor, pos.length - 1)]; console.log('  ' + k.padEnd(5) + ' u' + p.u + ' off' + p.off + '（釘 u' + PIN[k] + '）'); }
}

if (process.argv.includes('--dump')) {
  const ch = new Map();
  for (const n of tree) if (n.par != null) { if (!ch.has(n.par)) ch.set(n.par, []); ch.get(n.par).push(n.id); }
  const mk = (n) => { const p = pos[Math.min(n.anchor, pos.length - 1)]; return { u: p.u, off: p.off }; };
  const out = {
    id: 'zongmi', title: '金剛經疏記科會', short: '宗密科會',
    author: '唐 宗密疏 · 宋 子璿記 · 清 大璸科會', date: '唐', year: 618,
    note: '圭峰宗密疏、長水子璿記、清大璸科會。△開科、分N：初二三列科；骨幹人工釘定，其餘按段序等比例。',
    nkRule: '', source: 'CBETA 金剛經疏記科會；文字取 zhu-data.js',
    generated: new Date().toISOString().slice(0, 10),
    nodes: order.map((n) => {
      const a = mk(n);
      return { id: n.id, lv: n.lv, lab: String(n.label ?? '').replace(/\.\d+$/, ''), nm: n.name, par: n.par, ch: ch.get(n.id) || [], u: a.u, off: a.off, u2: a.u, o2: a.off + 1, ln: n.known != null ? 1 : 0 };
    }),
  };
  // 區間終點：取 DFS 下一個不同位置
  for (let i = 0; i < out.nodes.length; i++) {
    const cur = out.nodes[i];
    let end = { u: SENTS[SENTS.length - 1].u, off: SENTS[SENTS.length - 1].t.length };
    for (let j = i + 1; j < out.nodes.length; j++) {
      const m = out.nodes[j];
      if (m.u > cur.u || (m.u === cur.u && m.off > cur.off)) { end = { u: m.u, off: m.off }; break; }
    }
    cur.u2 = end.u; cur.o2 = end.off;
  }
  fs.writeFileSync(path.join(ROOT, 'kepan', 'draft', 'zongmi.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log('\n寫出 kepan/draft/zongmi.json');
}
