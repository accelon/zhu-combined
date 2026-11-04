// 宗密《金剛疏記科會》科文 → 樹（第 1 步：只產樹，不接經文）
//
// 文字格式（實測）：
//   △ 一段＝「重述一個科」＋它的疏／記。段首「初、／二、／三、」是它在兄弟中的序號。
//   宣告子數：「X分三：初、A，二、B，三、C。」或「二、序宗旨二：初、A，二、B。」
//   之後各子節在自己的段裡展開（可能重述）。
//
// 還原規則：
//   1. 同一節會被重述多次 —— 用「同名＋同序號」認回（先找游標自己，再往上找）。
//   2. 新建的節掛在「最深、而且還有子節缺」的那個祖先下（不是一律掛在游標下）。
//   3. 宣告了 N 個子節時，後面 N 個 token 就是那 N 個子節的名字。
//
//   node build/kepan/zongmi.mjs            解析＋統計＋前 44 節
//   node build/kepan/zongmi.mjs --dump     另存 kepan/zongmi-tree.json
import fs from 'node:fs';
import path from 'node:path';
import { lex } from './lex.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const work = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author || ''));
if (!work) throw new Error('找不到《金剛經疏記科會》');

const segs = work.text.split('△').slice(1);
const kpOf = (seg) => {
  const i = [seg.indexOf('【疏】'), seg.indexOf('【記】')].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  return (i >= 0 ? seg.slice(0, i) : seg.slice(0, 40)).trim();
};

const root = { id: 0, name: '金剛經疏記科會', label: 0, want: 0, lv: 0, par: null, kids: [], byLabel: new Map(), root: true };
let nextId = 1;
const st = { decl: 0, enter: 0, item: 0, reuse: 0, fresh: 0, pop: 0, conflict: 0 };
let cur = root;
let lastDecl = null;   // 最近一次宣告子節的節（科文常省略上層宣告，兜底用）
const top = () => cur;

// want 是「宣告的子節數」；沒宣告（0）時視為還可以收子節（科文常省略）
function canTake(n) { return n.root || !n.want || n.kids.length < n.want; }

function newNode(parent, label, name, want) {
    const n = { id: nextId++, name, label, want: want || 0, lv: parent.lv + 1, par: parent, kids: [], byLabel: new Map(), firstSeg: segIdx };
  const clash = parent.byLabel.get(label);
  if (clash) { st.conflict++; n.label = label + 0.1 * (parent.dd = (parent.dd || 0) + 1); }
  parent.kids.push(n);
  parent.byLabel.set(n.label, n);
  all.push(n);
  st.fresh++;
  return n;
}

/** 找已存在的同一節：從游標沿父鏈往上找同名同序號（堆疊會被收合，父鏈不會） */
/** 比對用的名字正規化：科文裡 辯／辨、脩／修、徧／遍 常混用 */
const VARIANT = { '辯': '辨', '脩': '修', '徧': '遍', '揀': '簡', '已': '巳', '決': '决', '却': '卻', '炤': '照' };
function norm(name) {
  return String(name).replace(/[、·・]/g, '').replace(/[辯脩徧揀已決却炤]/g, (c) => VARIANT[c] || c);
}
function sameName(a, b) { return norm(a) === norm(b); }
function findExisting(label, name) {
  for (let p = cur; p; p = p.par) {
    const c = p.byLabel.get(label);
    if (c && sameName(c.name, name)) return c;
  }
  return null;
}
const all = [];   // 建立順序，找不到時往回找同名節
/** 全域找同名：從最新的往回找（科文是深度優先，最近出現的最可能是它） */
function findByName(name) {
  for (let i = all.length - 1; i >= 0; i--) if (sameName(all[i].name, name)) return all[i];
  return null;
}
/** 新的一節要掛在「最深、而且還有子節缺」的祖先下 */
function placeFor(label) {
  // 科文是「深度優先＋序號」：掛到「下一個兄弟剛好是它」的最近祖先，
  // 其次才是「宣告了子數、還沒填滿」的祖先，最後才是根。
  for (let p = cur; p; p = p.par) {
    if (label === p.kids.length + 1) return p;
    if (p.want && p.kids.length < p.want) return p;
    if (p.root) break;
  }
  // 次兜底：沒宣告子數、而且序號比現有子節大的，就當它的下一個子節
  for (let p = cur; p && !p.root; p = p.par) {
    if (!p.want && label > p.kids.length) return p;
  }
  // 兜底：掛到最近一次宣告子節的節（序號接得上就掛）
  if (lastDecl && lastDecl !== cur) {
    if (label === lastDecl.kids.length + 1) return lastDecl;
    if (lastDecl.want && lastDecl.kids.length < lastDecl.want) return lastDecl;
  }
  for (let p = cur; p && !p.root; p = p.par) if (p.kids.length) return p;
  // 最後兜底：全樹找「子節數剛好差這個序號」的節（列表的兄弟常被拆散在各段）
  let best = null;
  for (const n of all) {
    if (n.firstSeg > segIdx) continue;
    if (n.kids.length + 1 !== label) continue;
    if (!best || n.lv > best.lv || (n.lv === best.lv && n.firstSeg > best.firstSeg)) best = n;
  }
  if (best) return best;
  return root;
}

let segIdx = -1;
for (const seg of segs) {
  segIdx++;
  const kp = kpOf(seg);
  if (!kp) continue;
  const toks = lex(kp);
  let i = 0;
  while (i < toks.length) {
    const t = toks[i];

    // ---------- 0. 只宣告子數：「五。」 ----------
    if (t.k === 'count') {
      const node = cur;
      node.want = t.n;
      i++;
      for (let k = 1; k <= t.n && i < toks.length; k++, i++) {
        const it = toks[i];
        if (it.k !== 'item' && it.k !== 'enter' && it.k !== 'decl') break;
        const label = it.label != null ? it.label : k;
        const c = newNode(node, label, it.name, it.n);
        st.item++;
        if (it.n) c.want = it.n;
      }
      continue;
    }
    // ---------- 1. 進入一節 ----------
    if (t.k === 'decl' || t.k === 'enter') {
      let node;
      if (t.k === 'decl' && t.label == null) {
        st.decl++;
        if (root.kids.length === 0 && t.name) root.name = t.name;
        node = top();                       // 根：宣告自己的子節
      } else {
        if (t.k === 'decl') st.decl++; else st.enter++;
        node = findExisting(t.label, t.name);
        if (node) st.reuse++;
        else {
          // 父鏈上找不到 → 回頭找全樹裡最近出現的同名節（同一科被重述）
          node = findByName(t.name);
          if (node) st.reuse++;
          else {
            const parent = placeFor(t.label);
            st.pop++;
            if (process.env.DBG && !global.__dbgN) {
              const up = []; for (let q = cur; q; q = q.par) up.push((q.name || 'root').slice(0, 10) + '[' + q.kids.length + '/' + (q.want || '-') + ']');
              console.log('新節 ' + t.label + ' ' + t.name + '\n   cur 鏈：' + up.join(' < '));
              console.log('   掛到：' + (parent.name || 'root') + '［kids ' + parent.kids.length + ' / want ' + (parent.want || '-') + '］');
              global.__dbgN = 1;
            }
            node = newNode(parent, t.label, t.name, t.n);
          }
        }
      }
      if (t.n) node.want = t.n;
      if (t.k === 'decl' || t.n) lastDecl = node;
      cur = node;
      node.lastSeg = segIdx;   // 這一段最後進入的節（後面夾的經文屬於它）
      i++;

      // ---------- 2. 宣告的 N 個子節 ----------
      if (node.want > 0) {
        for (let k = 1; k <= node.want && i < toks.length; k++, i++) {
          const it = toks[i];
          if (it.k === 'decl' && it.label == null) break;          // 換到別的宣告了
          const label = it.label != null ? it.label : k;
          const c = newNode(node, label, it.name, it.n);
          st.item++;
          if (it.n) c.want = it.n;
        }
      }
      continue;
    }
    i++;
  }
}

/* 統計 */
let n = 0;
const byLv = {};
(function walk(list) {
  for (const k of list) { n++; byLv[k.lv] = (byLv[k.lv] || 0) + 1; walk(k.kids); }
})(root.kids);
const lvs = Object.keys(byLv).map(Number);
console.log('△ 段', segs.length);
console.log('token：宣告', st.decl, '｜進入', st.enter, '｜子節', st.item,
  '｜認回', st.reuse, '｜新建', st.fresh, '｜收合', st.pop, '｜序號衝突', st.conflict);
console.log('節點', n, '｜最深', Math.max(...lvs), '層｜分層', JSON.stringify(byLv));

const lines = [];
(function show(list, d) {
  for (const k of list) {
    if (lines.length < 44) lines.push('  '.repeat(d) + k.label + ' ' + k.name.slice(0, 18));
    show(k.kids, d + 1);
  }
})(root.kids, 0);
if (process.env.ROOTS) {
  console.log('\n第 1 層（根）：');
  console.log(root.kids.map((k) => k.label + ' ' + k.name).join(' ｜ '));
}
console.log('\n前 44 節：');
console.log(lines.join('\n'));

if (process.argv.includes('--dump')) {
  const out = [];
  (function flat(list, par) {
    for (const k of list) { out.push({ id: k.id, par, lv: k.lv, label: k.label, name: k.name, seg: k.firstSeg, lastSeg: k.lastSeg }); flat(k.kids, k.id); }
  })(root.kids, null);
  const f = path.join(ROOT, 'kepan', 'zongmi-tree.json');
  fs.writeFileSync(f, JSON.stringify({ work: work.id, author: work.author, title: work.title, nodes: out }, null, 1), 'utf8');
  console.log('\n寫出 ' + f + '（' + out.length + ' 節，尚未接經文）');
}
