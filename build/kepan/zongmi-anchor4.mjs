// 宗密科會：錨點 v4 — 骨幹當硬牆，引文只能在牆與牆之間活動
//
// 上一版失敗在「全域強制單調」：一個漂掉的引文錨點把後面所有骨幹一起拖走。
// 這一版把骨幹當成牆：
//   1. 釘死的骨幹 → walls = [{index, char}]
//   2. 相鄰兩道牆之間：只接受落在 [lo, hi] 的引文候選，其餘丟掉
//   3. 牆與牆之間等比例插入
//   4. 只在「同一段牆內」做單調
//
//   node build/kepan/zongmi-anchor4.mjs          統計
//   node build/kepan/zongmi-anchor4.mjs --dump   寫 kepan/draft/zongmi.json
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
const longest = (body, lo, hi) => {
  let best = null;
  for (let i = 0; i + K <= body.length; i++) {
    const cs = gram.get(body.slice(i, i + K)); if (!cs) continue;
    for (const at of cs) {
      if (at < lo || at > hi) continue;
      let len = K;
      while (i + len < body.length && at + len < text.length && body[i + len] === text[at + len]) len++;
      if (!best || len > best.len) best = { at, len };
    }
  }
  return best;
};
const charOfU = (u, off = 0) => { for (let i = 0; i < pos.length; i++) if (pos[i].u === u && pos[i].off === off) return i; return 0; };

/* ---- 骨幹牆 ---- */
const PIN = {
  標題目: 0, 序宗旨: 0, 解本文: 0,
  序分: 0, 證信序: 0,
  發起序: SEC_FIRST[1],
  正宗分: SEC_FIRST[2],
  流通分: SEC_FIRST[32],
};
const kids = new Map();
for (const n of tree) if (n.par != null) { if (!kids.has(n.par)) kids.set(n.par, []); kids.get(n.par).push(n.id); }
const byId = new Map(tree.map((n) => [n.id, n]));
const order = [];
for (const r of tree.filter((n) => n.par == null)) (function walk(id) { const n = byId.get(id); order.push(n); for (const k of (kids.get(id) || [])) walk(k); })(r.id);

const walls = [];
order.forEach((n, i) => { if (PIN[n.name] != null) walls.push({ i, ci: charOfU(PIN[n.name]), name: n.name }); });
walls.sort((a, b) => a.i - b.i);
// 同名節只留第一個
const seen = new Set();
for (let k = walls.length - 1; k >= 0; k--) { if (seen.has(walls[k].name)) walls.splice(k, 1); else seen.add(walls[k].name); }

/* ---- 逐段（牆與牆之間）處理 ---- */
function fillRange(from, to, lo, hi) {
  const idxs = [];
  for (let i = from; i <= to; i++) idxs.push(i);
  // 候選：牆內引文
  const known = [];
  for (const i of idxs) {
    const n = order[i];
    if (n.pinned) continue;
    const head = (segs[n.seg] || '').split('【疏】')[0].split('【記】')[0];
    const tail = clean(lex(head).tail || '');
    let m = tail ? longest(tail, lo, hi) : null;
    if (!m || m.len < 6) { const b = clean(segs[n.seg] || ''); m = longest(b, lo, hi); }
    if (m && m.len >= (tail && tail.length ? 6 : 10)) known.push({ i, ci: m.at });
  }
  known.sort((a, b) => a.i - b.i);
  // 牆內單調（只丟倒退的）
  const kept = [];
  let lastCi = lo;
  for (const k of known) { if (k.ci < lastCi) continue; kept.push(k); lastCi = k.ci; }
  // 等比例填
  const pts = [{ i: from - 1, ci: lo }, ...kept, { i: to + 1, ci: hi }];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    for (let i = a.i + 1; i < b.i; i++) {
      const f = (b.i - a.i) === 0 ? 0 : (i - a.i) / (b.i - a.i);
      order[i].anchor = Math.round(a.ci + (b.ci - a.ci) * f);
    }
  }
  for (const k of kept) order[k.i].anchor = k.ci;
}

// 先把牆釘上
for (const w of walls) { order[w.i].pinned = true; order[w.i].anchor = w.ci; }
// 逐段填
let prev = { i: -1, ci: 0 };
for (const w of walls) {
  fillRange(prev.i + 1, w.i - 1, prev.ci, w.ci);
  prev = w;
}
fillRange(prev.i + 1, order.length - 1, prev.ci, pos.length - 1);
// 全域最後保險：單調（牆已經是遞增的，這裡只會微調同段內的殘留）
for (let i = 1; i < order.length; i++) if (order[i].anchor < order[i - 1].anchor) order[i].anchor = order[i - 1].anchor;

const precise = order.filter((n) => order.pinned || n.pinned).length;
const quoted = order.filter((n) => n.quoted).length;
const distinct = new Set(order.map((n) => n.anchor)).size;
const mono = order.filter((n, i) => i === 0 || n.anchor >= order[i - 1].anchor).length;
console.log('節點 ' + order.length + '｜骨幹牆 ' + walls.length + '｜位置 ' + distinct + ' 個｜單調 ' + mono + '/' + order.length);
for (const w of walls) {
  const p = pos[Math.min(order[w.i].anchor, pos.length - 1)];
  console.log('  ' + w.name.padEnd(5) + ' u' + p.u + ' off' + p.off);
}

const nameMap = new Map();
for (const n of tree) if (!nameMap.has(n.name)) nameMap.set(n.name, n);
if (process.argv.includes('--dump')) {
  // 標題目、序宗旨 兩棵子樹標 nk（總論，不對應經文）
  const nkSet = new Set();
  (function mark(id) { const n = byId.get(id); if (!n) return; nkSet.add(id); for (const k of (kids.get(id) || [])) mark(k); })(nameMap.get('標題目').id);
  (function mark(id) { const n = byId.get(id); if (!n) return; nkSet.add(id); for (const k of (kids.get(id) || [])) mark(k); })(nameMap.get('序宗旨').id);
  const ch = new Map();
  for (const n of tree) if (n.par != null) { if (!ch.has(n.par)) ch.set(n.par, []); ch.get(n.par).push(n.id); }
  const out = {
    id: 'zongmi', title: '金剛經疏記科會', short: '宗密科會',
    author: '唐 宗密疏 · 宋 子璿記 · 清 大璸科會', date: '唐', year: 618,
    note: '圭峰宗密疏、長水子璿記、清大璸科會。△開科、分N：初二三列科；骨幹釘定，其餘按段序等比例。',
    nkRule: '', noMarks: 1,   // 錨點太粗：只做目錄／麵包屑，不插經文標記
    source: 'CBETA 金剛經疏記科會；文字取 zhu-data.js',
    generated: new Date().toISOString().slice(0, 10),
    nodes: order.map((n) => {
      const p = pos[Math.min(n.anchor, pos.length - 1)];
      return { id: n.id, lv: n.lv, lab: String(n.label ?? '').replace(/\.\d+$/, ''), nm: n.name, par: n.par, ch: ch.get(n.id) || [], u: p.u, off: p.off, u2: p.u, o2: p.off + 1, ln: n.pinned ? 1 : 0, nk: nkSet.has(n.id) ? 1 : 0 };
    }),
  };
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
