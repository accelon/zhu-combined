#!/usr/bin/env node
// 把 kepan/*.json 合成單一資料檔 kepan/kepan-data.js（前端用）。
//
// 這裡只做「合併＋補欄位＋驗證」，不改各家的節點內容；各家科文各自留在
// kepan/<id>.json（離文標註：經文在 zhu-data.js，科文只記 (u, off) 起點）。
//
// 節點欄位：
//   id   這一家的節點序號（文件序）
//   lv   層級（1 起算；不同家用的層級字不同）
//   lab  序號標籤（初／次／三…；甲一／乙一…）
//   nm   科名
//   par  父節點 id（根為 null）
//   ch   子節點 id[]
//   u/off      起點：第 u 句的第 off 個字元（off 是「原字串」位移，可直接切 DOM）
//   u2/o2      迄點（不含）
//   nk   1 = 不連經文（總論、懸論之類）
//
// 用法：node build/kepan/build.mjs
import fs from 'node:fs';
import path from 'node:path';

// 資料工作區（含 zhu-data.js 與 kepan/）由 --root 或 VCPP_ROOT 指定；不預設成閱讀器目錄
const ROOT = (() => {
  const i = process.argv.indexOf('--root');
  const fromArg = i >= 0 ? process.argv[i + 1] : null;
  const root = fromArg || process.env.VCPP_ROOT || process.env.KEPAN_ROOT;
  if (!root) {
    console.error('用法：node build/kepan/build.mjs --root <資料工作區>（需有 zhu-data.js 與 kepan/）');
    process.exit(1);
  }
  return path.resolve(root);
})();
const DIR = path.join(ROOT, 'kepan');
const OUT = path.join(DIR, 'kepan-data.js');

const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8')
  .replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const base = D.versions[0];
const UNIT_TEXT = base.sents.map((s) => s.t);

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
const editions = [];

// 「未來會有其他家的科文」：把新的 kepan/<家>.json 放進來就會自動收錄，
// 只要它有 { id, title, nodes:[{id,lv,nm,par,ch,u,off,u2,o2}] }。
for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (!raw || !raw.id || !Array.isArray(raw.nodes) || !raw.nodes.length || typeof raw.nodes[0].u !== 'number') {
    console.log(`略過 ${f}（不是科文資料檔）`);
    continue;
  }
  const nodes = raw.nodes.map((n) => ({ ...n }));
  // 各家 JSON 可以用 nk 或 nolink 表示「不連經文」，這裡統一成 nk
  for (const n of nodes) if ('nolink' in n) n.nk = n.nolink ? 1 : 0;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 江味農的懸論（總釋名題→釋經題／釋人題）不是對某段經文分科：整棵子樹都不連經文。
  // 判準：在「序分」那一節（lv 2 的乙初）之前建立的節點。
  if (!nodes.some((n) => 'nk' in n)) {
    if (raw.nkRule === 'preface') {
      // 江味農：根與「初總釋名題」整棵子樹（釋經題、釋人題＝懸論）都不對應經文；
      // 「次別解文義」則涵蓋全經，要留著。其他家不套這條規則。
      const mark = new Set(nodes.filter((n) => n.par == null).map((n) => n.id));
      const first = nodes.find((n) => n.lv === 1);
      if (first) (function walk(id) {
        mark.add(id);
        (byId.get(id).ch || []).forEach(walk);
      })(first.id);
      for (const n of nodes) n.nk = mark.has(n.id) ? 1 : 0;
    } else {
      for (const n of nodes) n.nk = 0;
    }
  }

  // 檢查：父節點存在、層級比父深、起點不倒退（文件序）
  let err = 0;
  for (const n of nodes) {
    if (n.par != null) {
      const p = byId.get(n.par);
      if (!p) { console.error(`${raw.id}#${n.id} 父節點 ${n.par} 不存在`); err++; continue; }
      if (p.lv >= n.lv) { console.error(`${raw.id}#${n.id} 層級 ${n.lv} 不深於父 ${p.lv}`); err++; }
      if (!p.ch.includes(n.id)) p.ch.push(n.id);
    }
    if (!n.nk && (n.u < 0 || n.u >= UNIT_TEXT.length)) { console.error(`${raw.id}#${n.id} u 超出範圍 ${n.u}`); err++; continue; }
    if (!n.nk && (n.off < 0 || n.off > UNIT_TEXT[n.u].length)) { console.error(`${raw.id}#${n.id} off 超出句長 ${n.off}`); err++; }
  }
  for (const n of nodes) for (const c of n.ch) if (!byId.has(c)) { console.error(`${raw.id}#${n.id} 子節點 ${c} 不存在`); err++; }
  if (err) throw new Error(`${raw.id} 有 ${err} 個問題`);

  const roots = nodes.filter((n) => n.par == null).map((n) => n.id);
  const linked = nodes.filter((n) => !n.nk).length;
  editions.push({
    id: raw.id,
    order: typeof raw.order === 'number' ? raw.order : 99,
    ordStyle: raw.ordStyle || '',
    workId: raw.workId || '',
    base: !!raw.base,
    flat: raw.flat ? 1 : 0,
    short: raw.short,
    title: raw.title,
    author: raw.author,
    date: raw.date,
    year: raw.year,
    note: raw.note,
    source: raw.source,
    noMarks: raw.noMarks ? 1 : 0,
    roots,
    linked,
    nodes: nodes.map((n) => ({
      id: n.id, lv: n.lv, lab: n.lab || '', nm: n.nm || '', par: n.par,
      ch: n.ch, u: n.nk ? -1 : n.u, off: n.nk ? 0 : n.off,
      u2: n.nk ? -1 : n.u2, o2: n.nk ? 0 : n.o2, nk: n.nk ? 1 : 0,
    })),
  });
  console.log(`${raw.id}: ${nodes.length} 節 · 連經文 ${linked} · 根 ${roots.length}`);
}

editions.sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));

const data = {
  v: 1,
  generated: new Date().toISOString(),
  note: '科判資料（昭明三十二分、江味農、印順、宗密、十八住處）。節點只記 (u, off) 起點與樹狀關係，經文在 zhu-data.js，互不摻雜。',
  editions,
};
const js = 'window.KEPAN=' + JSON.stringify(data) + ';\n';
fs.writeFileSync(OUT, js);
console.log('寫出', OUT, (js.length / 1024).toFixed(1) + ' KB');
