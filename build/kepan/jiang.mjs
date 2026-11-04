#!/usr/bin/env node
// 抽江味農《金剛般若波羅蜜經講義》的科判 → kepan/jiang.json
//
// 來源：D:\2026\wisdomlight\sources\jiang-weinong-jingang-jiangyi.md
//   （DILA 江味農居士著作全集數位典藏，底本 CBETA 大藏經補編 No. 23；見該目錄 README）
//   標記約定：`> ` 是《金剛經》經文；`（甲）…（亥）` 是科判；`###` 以下是科判目錄。
//
// 做法：
//   1. 掃每一條以「（層級字）」開頭的科判行，拆成「本節」＋「宣告後續 N 個子節」；
//      子節的標題常在下一條科判行裡，所以用「已宣告、還沒定位」的清單把節點留著，
//      等它自己那一行出現再補上位置。
//   2. 經文引文（`> `）依序接到羅什本上（8 字窗單調對齊），得到每個節點在
//      經文裡的 (u, off)，即字元級起點。
//   3. 驗證：節點數／名稱要與 markdown 的 `#####` 標題一一對上。
//
// 用法：node build/kepan/jiang.mjs [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import { LEVEL_CHARS, levelOf, norm, normMap, buildChain, cnToInt } from './lib.mjs';

const ROOT = 'D:\\2026\\zhu-combined';
const SRC = 'D:\\2026\\wisdomlight\\sources\\jiang-weinong-jingang-jiangyi.md';
const OUT = path.join(ROOT, 'kepan', 'jiang.json');
const VERBOSE = process.argv.includes('--verbose');

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const BODY0 = lines.findIndex((l) => /^## 金剛般若波羅蜜經講義卷一/.test(l));
const AT_START = new RegExp('^（[' + LEVEL_CHARS + ']）');
const AT_START_OK = new RegExp(
  '^（[' + LEVEL_CHARS + ']）(?:(?:[初次]|[一二三四五六七八九十]+)[，,]|[初次][^\s，。；：]|(?:此科)?(?:又|分)[一二三四五六七八九十]+：)');
const MARKER = new RegExp('（([' + LEVEL_CHARS + '])）', 'g');
const PENDING_ANY = /(?:又|分)[一二三四五六七八九十]+：/;

/**
 * 科判行判定。
 * 絕大多數科判行以「（甲）」開頭，格式是「（甲）初，科名」或「（辛）此科分二：」。
 * 只有一處（卷一開頭「欲說此經，先當科判。大科分二。（甲）初，總釋名題。…」）
 * 把大科宣告寫在行首，那一行也要收。
 * 反之，講義正文會用「（甲）（乙）」當列點（例：卷四「此中又當開兩義說之。（甲）因上句…」），
 * 那種行後面沒有「初，」也沒有「分N：」，一律排除（否則會多出幾十個假節點）。
 */
const isKepanLine = (l) => {
  if (AT_START_OK.test(l)) return true;
  if (AT_START.test(l)) return false;
  MARKER.lastIndex = 0;
  if (!MARKER.test(l)) return false;
  return PENDING_ANY.test(l) && /（[^）]{0,12}）[初次][，,]/.test(l);
};

/* ---------------------------------------------------------------- 科判行解析 */

const PENDING_RE = /(?:(?:此科)?(?:又|分)([一二三四五六七八九十]+)：)\s*$/;
// 序號後面的逗號有時省略（例：「（寅）次約熏習結成。」）
const LABEL_RE = /^([初次]|[一二三四五六七八九十]+)[，,]?\s*/;

const labelKey = (lab) => (lab === '初' ? 1 : lab === '次' ? 2 : cnToInt(lab));

function cleanName(s) {
  return String(s || '')
    .replace(/^[，,。；：\s]+/, '')
    .replace(/[，,。；：\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBody(body) {
  let head = body;
  let tail = '';
  const cut = /[；。]/.exec(body);
  if (cut) { head = body.slice(0, cut.index); tail = body.slice(cut.index + 1); }

  let pending = 0;
  let label = '';
  const lm = LABEL_RE.exec(head);
  if (lm) { label = lm[1]; head = head.slice(lm[0].length); }
  const pm = PENDING_RE.exec(head);
  if (pm) { pending = cnToInt(pm[1]); head = head.slice(0, pm.index); }
  const name = cleanName(head);

  const sibs = [];
  const pushSib = (t) => {
    let s = t.trim();
    if (!s) return;
    let lb = '';
    const m2 = LABEL_RE.exec(s);
    if (m2) { lb = m2[1]; s = s.slice(m2[0].length); }
    let pn = 0;
    const p2 = PENDING_RE.exec(s);
    if (p2) { pn = cnToInt(p2[1]); s = s.slice(0, p2.index); }
    const nm = cleanName(s);
    if (!nm && !pn) return;
    sibs.push({ label: lb, name: nm, pending: pn });
  };
  if (tail) {
    const lead = /^\s*((?:此科)?(?:又|分)([一二三四五六七八九十]+)：)\s*/.exec(tail);
    if (lead) { pending = cnToInt(lead[2]); tail = tail.slice(lead[0].length); }
    for (const part of tail.split(/[；。]/)) pushSib(part);
  }
  return { label, name, pending, sibs };
}

/* ---------------------------------------------------------------- 建樹 */

const nodes = [];
let vol = 0;
const stack = [];
const lastByLevelLabel = new Map();
const unpositioned = [];
const lastAtLevel = [];
let pending = null;

function newNode({ lv, label, name, line }) {
  const n = { id: nodes.length, lv, lab: label, nm: name, par: null, ch: [], ln: line, vol, pos: null, own: false };
  nodes.push(n);
  return n;
}

// 根：全書只有一大科（「大科分二。（甲）初，總釋名題。次，別解文義。」）
const root = newNode({ lv: 0, label: '', name: '', line: BODY0 });
root.root = true;
root.pos = BODY0;
root.own = true;
stack.push(root);
function attach(n, parent) {
  n.par = parent ? parent.id : null;
  if (parent) parent.ch.push(n.id);
  return n;
}
function nearestParent(lv) {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].lv < lv) return stack[i];
  return null;
}
function place(n, line) {
  while (stack.length && stack[stack.length - 1].lv >= n.lv) stack.pop();
  stack.push(n);
  if (n.pos == null) n.pos = line;
  lastAtLevel[n.lv] = n;
  const ui = unpositioned.indexOf(n);
  if (ui >= 0) unpositioned.splice(ui, 1);
  return n;
}

/** 找出「已經宣告、還沒定位」的那一節（避免同一節被建兩次） */
function existingUnpositioned(lv, label, name, parentId) {
  for (const un of unpositioned) {
    if (un.lv !== lv) continue;
    if ((un.par ?? null) !== parentId) continue;
    if (name && un.nm && un.nm !== name) continue;
    if (label && un.lab && labelKey(un.lab) !== labelKey(label)) continue;
    if (!label && !name) return un;
    if (label && un.lab && labelKey(un.lab) === labelKey(label)) return un;
    if (!label && name && un.nm === name) return un;
  }
  return null;
}

for (let i = BODY0 >= 0 ? BODY0 : 0; i < lines.length; i++) {
  const line = lines[i];
  const vm = /^## 金剛般若波羅蜜經講義卷([一二三四五])/.exec(line);
  if (vm) { vol = cnToInt(vm[1]); continue; }
  if (!isKepanLine(line)) continue;

  const marks = [];
  MARKER.lastIndex = 0;
  let m;
  while ((m = MARKER.exec(line))) marks.push({ ch: m[1], at: m.index, end: m.index + m[0].length });
  if (!marks.length) continue;

  // 行首若不是「（甲）」，前面那段可能正是大科宣告（「大科分二。」）
  if (!AT_START.test(line)) {
    const prefix = line.slice(0, marks[0].at);
    const pm0 = /(?:又|分)([一二三四五六七八九十]+)。?\s*$/.exec(prefix);
    if (pm0) pending = { parent: root, level: 1, need: cnToInt(pm0[1]), got: 0 };
  }

  for (let k = 0; k < marks.length; k++) {
    const lv = levelOf(marks[k].ch);
    const body = line.slice(marks[k].end, k + 1 < marks.length ? marks[k + 1].at : line.length);
    const { label, name, pending: pendN, sibs } = parseBody(body);

    const near = nearestParent(lv);
    const nearId = near ? near.id : null;

    // 決定節點身分
    //  1) 已宣告、還沒定位的那一節（父節點相同）
    //  2) 同一節被重述：「（乙）初，序分。」先在大科那行出現，下一行又「（乙）初，序分，分二：…」
    //     —— 同名、同層、同父、而且還沒有子節，就接回來
    //  3) 「（辛）此科分二：」這種省略名字的續行
    let n = existingUnpositioned(lv, label, name, nearId);
    let parent = n ? (n.par != null ? nodes[n.par] : null) : null;
    if (!n && label) {
      const cand = lastByLevelLabel.get(lv + '|' + labelKey(label));
      // 「改名」只在兩種情況接回同一個節點：
      //   * 那節還沒定位（名字只是宣告行寫的）——例：宣告「四，論用」，自己那行寫「四，辨用」
      //   * 名字一樣（同一節被重述）
      // 若那節已經有自己的標題、名字又不同，就是另一節（例：（癸）次，陳讚慶 →（癸）二，勸信解）。
      const sameName = !name || !cand || !cand.nm || cand.nm === name;
      if (cand && (cand.par ?? null) === nearId && cand.ch.length === 0
          && (!cand.own || sameName)) {
        n = cand; parent = near;
      }
    }
    if (!n && !label && !name) {
      const cand = lastAtLevel[lv];
      if (cand && cand.ch.length === 0) { n = cand; parent = cand.par != null ? nodes[cand.par] : null; }
    }
    if (!n) {
      n = newNode({ lv, label, name, line: i });
      parent = pending && pending.level === lv && pending.need > pending.got ? pending.parent : near;
      attach(n, parent);
      if (pending && pending.parent === parent && pending.level === lv && pending.need > pending.got) pending.got++;
    }
    n.own = true;
    if (name && n.nm !== name) n.nm = name;
    if (!n.lab && label) n.lab = label;
    place(n, i);
    lastByLevelLabel.set(lv + '|' + labelKey(label), n);

    if (pendN) pending = { parent: n, level: lv + 1, need: pendN, got: 0 };

    // 同一行後面跟著的兄弟節
    for (const s of sibs) {
      let sn = existingUnpositioned(lv, s.label, s.name, parent ? parent.id : null);
      if (!sn) {
        sn = newNode({ lv, label: s.label, name: s.name, line: i });
        attach(sn, parent);
        unpositioned.push(sn);
      }
      if (!sn.lab && s.label) sn.lab = s.label;
      if (!sn.nm && s.name) sn.nm = s.name;
      lastByLevelLabel.set(lv + '|' + labelKey(s.label), sn);
      if (pending && pending.parent === parent && pending.level === lv && pending.need > pending.got) pending.got++;
      if (s.pending) pending = { parent: sn, level: lv + 1, need: s.pending, got: 0 };
    }
  }
}

// 沒等到自己那一行的節點：位置取文件序中下一個有位置的節點
for (let i = nodes.length - 1; i >= 0; i--) {
  const n = nodes[i];
  if (n.pos == null) {
    let nx = null;
    for (let j = i + 1; j < nodes.length; j++) if (nodes[j].pos != null) { nx = nodes[j]; break; }
    n.pos = nx ? nx.pos : lines.length;
  }
}

/* ---------------------------------------------------------------- 對到經文 */
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8')
  .replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const base = D.versions[0];
const S = base.sents.map((s) => s.t).join('');
const SN = norm(S);
const unitStarts = [];
{
  let acc = 0;
  for (const s of base.sents) { unitStarts.push(acc); acc += norm(s.t).length; }
}
const unitRaw = base.sents.map((s) => normMap(s.t).map);
function toUnit(pos) {
  let lo = 0, hi = unitStarts.length - 1, best = 0;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (unitStarts[mid] <= pos) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  return best;
}

// 經文引文（行首 `> `）：跳過卷首的前置說明，連續的 > 行接成一段。
// 卷首還有「> 金剛般若波羅蜜經」「> 姚秦三藏法師鳩摩羅什譯」這種引文，不是經文，
// 用 8 字窗命中率過濾掉（<50% 視為非經文）。
const snGrams = new Set();
for (let i = 0; i + 8 <= SN.length; i++) snGrams.add(SN.slice(i, i + 8));
const quotes = [];
{
  let cur = null;
  for (let i = BODY0; i < lines.length; i++) {
    const l = lines[i];
    if (/^>\s?/.test(l)) {
      const t = l.replace(/^>\s?/, '');
      if (cur && cur.end === i - 1) { cur.text += t; cur.end = i; }
      else { cur = { start: i, end: i, text: t, norm: '' }; quotes.push(cur); }
    }
  }
  for (const q of quotes) q.norm = norm(q.text);
  const dropped = [];
  for (const q of quotes) {
    let hit = 0, tot = 0;
    for (let i = 0; i + 8 <= q.norm.length; i++) { tot++; if (snGrams.has(q.norm.slice(i, i + 8))) hit++; }
    // 只要有 8 字窗命中就當成經文引文（卷首的經題／譯者那種一個都沒有）
    q.keep = tot === 0 ? SN.includes(q.norm) : hit > 0;
    if (!q.keep) dropped.push(q.text.slice(0, 20));
  }
  if (dropped.length) console.log('略過非經文引文', dropped.length, JSON.stringify(dropped.slice(0, 4)));
}
const kq = quotes.filter((q) => q.keep);
const qAll = kq.map((q) => q.norm).join('');
const { chain } = buildChain(qAll, SN);
console.log(`引文 ${kq.length} 段（${qAll.length} 字），錨點 ${chain.length}，經文 ${SN.length} 字`);

/**
 * 把每段引文直接定位到經文上。
 * 引文的順序就是經文的順序，所以由前到後單調掃；8 字窗對齊在「同一段被引用兩次」
 * 或「異體字改字」時會飄掉，直接 indexOf 反而穩。找不到完整 16 字就退到 12/10/8/6 字，
 * 並允許跳過開頭 1–6 字（引文常從句中起）。
 */
{
  let cursor = 0;
  let bad = 0;
  for (const q of kq) {
    let pos = -1;
    for (let skip = 0; skip <= 6 && pos < 0; skip++) {
      const s = q.norm.slice(skip);
      for (const len of [16, 12, 10, 8, 6]) {
        if (s.length < len) continue;
        const at = SN.indexOf(s.slice(0, len), Math.max(0, cursor - 40));
        if (at < 0) continue;
        let p = at, k = skip;
        while (k > 0 && p > 0 && SN[p - 1] === q.norm[k - 1]) { p--; k--; }
        pos = p;
        break;
      }
    }
    if (pos < 0) { q.sn = -1; bad++; }
    else { q.sn = pos; cursor = Math.max(cursor, pos + Math.max(4, q.norm.length - 2)); }
  }
  if (bad) console.log('⚠ 對不上的引文', bad, '段');
}

function anchorOfLine(line) {
  const q = kq.find((x) => x.start >= line && x.sn >= 0) || null;
  if (!q) {
    const last = base.sents[base.sents.length - 1];
    return { u: base.sents.length - 1, off: last.t.length, q: null };
  }
  const u = toUnit(q.sn);
  const offN = Math.max(0, q.sn - unitStarts[u]);
  const map = unitRaw[u];
  const off = offN >= map.length ? base.sents[u].t.length : map[offN];
  return { u, off, q };
}

let miss = 0;
for (const n of nodes) {
  const a = anchorOfLine(n.pos);
  n.u = a.u; n.off = a.off;
  if (!a.q) miss++;
  n.q = a.q ? a.q.text.slice(0, 18) : '';
}

// 範圍：前序中的下一個節點
const order = [];
(function dfs(list) {
  for (const id of list) { const n = nodes[id]; order.push(id); if (n.ch.length) dfs(n.ch); }
})(nodes.filter((n) => n.par == null).map((n) => n.id));
const lastU = base.sents.length - 1;
for (let k = 0; k < order.length; k++) {
  const n = nodes[order[k]];
  let endU = lastU, endOff = base.sents[lastU].t.length;
  for (let j = k + 1; j < order.length; j++) {
    const m2 = nodes[order[j]];
    if (m2.u > n.u || (m2.u === n.u && m2.off > n.off)) { endU = m2.u; endOff = m2.off; break; }
  }
  n.u2 = endU; n.u2off = endOff;
}

/* ---------------------------------------------------------------- 驗證 */
// 用 markdown 的 `#####` 目錄標題當「標準答案」：每一節應該恰好對上一個標題。
const heads = lines.map((l, i) => [i, l]).filter(([i, l]) => /^#{3,6} /.test(l) && i >= BODY0);
const normName = (s) => String(s || '').replace(/[^\u3400-\u9fff]/g, '');
const tail = (s, n) => (s.length <= n ? s : s.slice(-n));
let matched = 0;
const problems = [];
let hi = 0;
for (const id of order) {
  const n = nodes[id];
  const nm = normName(n.nm);
  let found = -1;
  for (let k = hi; k < Math.min(hi + 40, heads.length); k++) {
    const h = normName(heads[k][1].replace(/^#+ /, ''));
    if (!h) continue;
    if (!nm) { found = k; break; }                       // 無名節點（「此科」）先佔一個標題
    if (h === nm || h.endsWith(nm) || nm.endsWith(h) || tail(h, 4) === tail(nm, 4)) { found = k; break; }
  }
  if (found >= 0) { matched++; hi = found + 1; }
  else problems.push({ id: n.id, lv: n.lv, lab: n.lab, nm: n.nm, ln: n.ln });
}
console.log(`對上 ${matched} / ${order.length}；標題共 ${heads.length}；對不上 ${problems.length}`);
console.log(`節點 ${nodes.length}；與標題對上 ${matched}；對不上 ${problems.length}；無引文可錨 ${miss}`);
if (VERBOSE) {
  console.log('前 12 個節點：');
  for (const n of nodes.slice(0, 12)) console.log(' ' + '  '.repeat(Math.max(0, n.lv - 1)) + n.lab + n.nm, `[u${n.u}.${n.off}→u${n.u2}.${n.u2off}]`, 'ln', n.ln, 'q', n.q);
  console.log('對不上的前 12：', problems.slice(0, 12));
  const depths = {};
  for (const n of nodes) depths[n.lv] = (depths[n.lv] || 0) + 1;
  console.log('層級分佈', JSON.stringify(depths));
  const noName = nodes.filter((n) => !n.nm);
  console.log('無名節點', noName.length, noName.slice(0, 8).map((n) => `${n.id} lv${n.lv} ${n.lab} ln${n.ln}`));
}

/* ---------------------------------------------------------------- 輸出 */
const out = {
  id: 'jiang',
  title: '江味農《金剛般若波羅蜜經講義》科判',
  short: '江味農',
  author: '江味農（1872–1938）',
  date: '民國',
  year: 1938,
  note: '科判層級用天干（甲乙…癸）＋地支（子丑…亥），最多 22 層。',
  nkRule: 'preface',   // 根與「初總釋名題」整棵子樹＝懸論，不對應經文
  source: {
    text: '江味農《金剛般若波羅蜜經講義》',
    base: '大藏經補編 No. 23（CBETA）',
    via: '法鼓文理學院 DILA「江味農居士著作全集數位典藏」JWN-B-B0023',
    file: 'wisdomlight/sources/jiang-weinong-jingang-jiangyi.md',
    license: 'CC BY-NC-SA 4.0（DILA）；底本限非商業使用',
  },
  generated: new Date().toISOString(),
  nodes: nodes.map((n) => ({
    id: n.id, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch,
    u: n.u, off: n.off, u2: n.u2, o2: n.u2off, ln: n.ln,
  })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('寫出', OUT, (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB');
