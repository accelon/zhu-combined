// 宗密科會：接經文錨點（第 2 步）→ kepan/zongmi.json
//
// 科名本身不是經文，錨點只能靠「那一段文字裡引到的經句」：
//   1. 每段（科文＋疏＋記）整段掃，找與羅什本最長的共同片段（≥12 字）
//   2. 找不到的節，繼承「前一個有錨點的節」的位置（科幾乎都是接續的）
//   3. 父節的位置取「自己與所有子孫」的最小值，保證樹是單調的
//   4. 轉成 (u, off)，區間終點取「下一個節的起點」
//
//   node build/kepan/zongmi-anchor.mjs          統計
//   node build/kepan/zongmi-anchor.mjs --dump   寫 kepan/zongmi.json
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const work = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = work.text.split('△').slice(1);
const tree = JSON.parse(fs.readFileSync(path.join(ROOT, 'kepan', 'zongmi-tree.json'), 'utf8')).nodes;

/* ---- 經文（去標點）＋位置表 ---- */
const SENTS = D.versions[0].sents;
const isP = (ch) => /[「」『』，。、！？：；…—－·（）()\s〈〉《》〔〕【】]/.test(ch);
function clean(raw) { let out = ''; const map = []; for (let i = 0; i < raw.length; i++) { if (isP(raw[i])) continue; out += raw[i]; map.push(i); } return { out, map }; }
let text = '';
const pos = [];
for (const s of SENTS) {
  const { out, map } = clean(s.t);
  for (let i = 0; i < out.length; i++) { text += out[i]; pos.push({ u: s.u, off: map[i] }); }
}
const K = 6;
const gram = new Map();
for (let i = 0; i + K <= text.length; i++) {
  const g = text.slice(i, i + K);
  if (!gram.has(g)) gram.set(g, []);
  if (gram.get(g).length < 40) gram.get(g).push(i);
}
const MIN_LEN = 12;
/** 收集這一段所有 ≥MIN_LEN 的候選（去重、記錄長度） */
function candidates(body) {
  const seen = new Map();
  for (let i = 0; i + K <= body.length; i++) {
    const cands = gram.get(body.slice(i, i + K));
    if (!cands) continue;
    for (const at of cands) {
      let len = K;
      while (i + len < body.length && at + len < text.length && body[i + len] === text[at + len]) len++;
      if (len < MIN_LEN) continue;
      const key = at + ':' + len;
      if (!seen.has(key)) seen.set(key, { at, len });
    }
  }
  return [...seen.values()].sort((a, b) => a.at - b.at);
}
/** 選錨點：優先「在上一個錨點之後、最早出現」的候選（科文是順著經文走的） */
function pickMatch(body, prev) {
  const cs = candidates(body);
  if (!cs.length) return null;
  const after = cs.filter((c) => c.at >= prev);
  if (after.length) {
    // 同一個 at 取最長；取最早的 at
    const at0 = after[0].at;
    const same = after.filter((c) => c.at === at0).sort((a, b) => b.len - a.len);
    return same[0];
  }
  // 全都在前面：挑最長的那個（可能是重述前文）
  return cs.slice().sort((a, b) => b.len - a.len)[0];
}

/* ---- 每節找錨點 ---- */
const byId = new Map(tree.map((n) => [n.id, n]));
const kids = new Map();
for (const n of tree) if (n.par != null) { if (!kids.has(n.par)) kids.set(n.par, []); kids.get(n.par).push(n.id); }
const precisePlaceholder = 0;

/* ---- DFS 巡訪：沒錨點的繼承前一個；父節取子孫最小 ---- */
const order = [];
(function dfs(id) {
  const n = byId.get(id);
  order.push(n);
  for (const k of (kids.get(id) || [])) dfs(k);
})(null) // root ids:
;
// 真正的根
const roots = tree.filter((n) => n.par == null);
order.length = 0;
for (const r of roots) (function walk(id) { const n = byId.get(id); order.push(n); for (const k of (kids.get(id) || [])) walk(k); })(r.id);

// 逐節按 DFS 順序找錨點：只接受「在上一個錨點之後」的候選，找不到就繼承
let prev = 0;
for (const n of order) {
  const m = pickMatch(clean(segs[n.seg] || '').out, prev);
  if (m) { n.anchor = m.at; n.aln = m.len; prev = m.at; }
  else { n.anchor = prev; n.aln = 0; }
}
const precise = order.filter((n) => n.aln >= 12).length;
// 父節取子孫最小值（由深往淺）
for (let i = order.length - 1; i >= 0; i--) {
  const n = order[i];
  for (const k of (kids.get(n.id) || [])) {
    const c = byId.get(k);
    if (c.anchor < n.anchor) n.anchor = c.anchor;
  }
}

/* ---- 轉成 (u, off) 與區間 ---- */
const toUS = (ci) => pos[Math.max(0, Math.min(ci, pos.length - 1))];
for (const n of order) { const p = toUS(n.anchor); n.u = p.u; n.off = p.off; }
// 區間終點＝DFS 下一個節的起點（同一位置就會是空的，交給 build 處理）
const NEXT = order.slice(1);
for (let i = 0; i < order.length; i++) {
  const n = order[i];
  let end = { u: SENTS[SENTS.length - 1].u, off: SENTS[SENTS.length - 1].t.length };
  for (let j = i + 1; j < order.length; j++) {
    const m = order[j];
    if (m.u > n.u || (m.u === n.u && m.off > n.off)) { end = { u: m.u, off: m.off }; break; }
  }
  n.u2 = end.u; n.o2 = end.off;
}

/* ---- 統計 ---- */
const mono = order.filter((n, i) => i === 0 || n.u > order[i - 1].u || (n.u === order[i - 1].u && n.off >= order[i - 1].off)).length;
const spans = new Set(order.map((n) => n.u + ':' + n.off)).size;
console.log('節點 ' + order.length + '｜精確錨點 ' + precise + '（' + (precise / order.length * 100).toFixed(1) + '%）｜繼承 ' + (order.length - precise));
console.log('單調遞增 ' + mono + ' / ' + order.length + '（' + (mono / order.length * 100).toFixed(1) + '%）');
console.log('不同起點 ' + spans + ' 個｜最深 ' + Math.max(...tree.map((n) => n.lv)) + ' 層');
console.log('u 範圍 ' + Math.min(...order.map((n) => n.u)) + '–' + Math.max(...order.map((n) => n.u)) + '（經文共 ' + SENTS.length + ' 句）');

for (const k of ['標題目', '序宗旨', '解本文', '序分', '正宗分', '流通分', '證信序', '發起序']) {
  const n = tree.find((x) => x.name === k);
  if (n) console.log('  ' + k.padEnd(5) + ' u' + n.u + ' off' + n.off + (n.aln ? '（引 ' + n.aln + ' 字）' : '（繼承）'));
}

if (process.argv.includes('--dump')) {
  const ch = new Map();
  for (const n of tree) if (n.par != null) { if (!ch.has(n.par)) ch.set(n.par, []); ch.get(n.par).push(n.id); }
  const out = {
    id: 'zongmi',
    title: '金剛經疏記科會',
    short: '宗密科會',
    author: '唐 宗密疏 · 宋 子璿記 · 清 大璸科會',
    date: '唐', year: 618,
    note: '圭峰宗密疏、長水子璿記、清大璸科會。科文以「△」開科、「分N：初、二、三」列科。',
    nkRule: '',
    source: 'CBETA 金剛經疏記科會（T?／X?）；文字取 zhu-data.js works',
    generated: new Date().toISOString().slice(0, 10),
    nodes: order.map((n) => ({
      id: n.id, lv: n.lv, lab: String(n.label ?? '').replace(/\.\d+$/, ''), nm: n.name,
      par: n.par, ch: ch.get(n.id) || [],
      u: n.u, off: n.off, u2: n.u2, o2: n.o2, ln: n.aln || 0,
    })),
  };
  const f = path.join(ROOT, 'kepan', 'zongmi.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 1), 'utf8');
  console.log('\n寫出 ' + f);
}
