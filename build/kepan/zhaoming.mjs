#!/usr/bin/env node
// 昭明太子三十二分，當作「一層科判」→ kepan/zhaoming.json
//
// 這不是誰的注疏科文，而是經文本身的段落：三十二分。放進同一套資料格式，
// 就可以當成最淺的一層科判（預設值），和江味農、印順的科判並列比較。
//
// 節點：每分一節，lv=1，lab=分序（一、二…三十二），nm=分名（去掉「分第…」）。
//
// 用法：node build/kepan/zhaoming.mjs
import fs from 'node:fs';
import path from 'node:path';
import { cnNum } from './lib.mjs';

const ROOT = 'D:\\2026\\zhu-combined';
const OUT = path.join(ROOT, 'kepan', 'zhaoming.json');

const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'zhu-data.js'), 'utf8')
  .replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const base = D.versions[0];
const secs = D.sections;
const N = base.sents.length;

// 每一分的第一句
const first = [];
for (const s of base.sents) if (first[s.s] == null) first[s.s] = s.u;

const shortTitle = (t) => String(t || '').replace(/分第[一二三四五六七八九十]+$/, '') || String(t);

const nodes = [];
secs.forEach((sec, i) => {
  const u = first[sec.n] == null ? 0 : first[sec.n];
  const nextU = i + 1 < secs.length && first[secs[i + 1].n] != null ? first[secs[i + 1].n] : N;
  nodes.push({
    id: i,
    lv: 1,
    lab: cnNum(sec.n),
    nm: shortTitle(sec.title),
    par: null,
    ch: [],
    u,
    off: 0,
    u2: nextU >= N ? N - 1 : nextU,
    o2: nextU >= N ? base.sents[N - 1].t.length : 0,
    ln: 0,
  });
});

const out = {
  id: 'zhaoming',
  title: '昭明太子三十二分',
  short: '昭明',
  author: '梁 昭明太子 分',
  date: '梁',
  year: 520,
  order: 0,              // 排最前面（也是預設）
  ordStyle: 'plain',     // lab 本身就是序號（一、二…），不必再加天干
  flat: 1,               // 只有一層：經文裡的科文標記省略（分名已在上方標題）
  note: '經文本身的三十二分，只有一層，沒有細科；當作最淺的一層科判。',
  source: {
    text: '《金剛般若波羅蜜經》昭明太子分',
    base: '大正藏 T235（三十二分為後人所分）',
    via: 'zhu-data.js sections',
    file: 'zhu-data.js',
  },
  generated: new Date().toISOString(),
  nodes,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`寫出 ${OUT}：${nodes.length} 分，${fs.statSync(OUT).size} bytes`);
console.log('前 3 分：', nodes.slice(0, 3).map((n) => `${n.lab} ${n.nm} u${n.u}`).join('｜'));
