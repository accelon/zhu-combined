// 上限量測：有多少段的「夾經文尾巴」真的含經文（≥4 字共同片段）
import fs from 'node:fs';
import { lex } from './lex.mjs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const SENTS = D.versions[0].sents;
const isP = (ch) => /[「」『』，。、！？：；…—－·（）()\s〈〉《》〔〕【】]/.test(ch);
const clean = (s) => { let o = ''; for (const c of s) if (!isP(c)) o += c; return o; };
const sutra = clean(SENTS.map((s) => s.t).join(''));
const K = 4;
const grams = new Set();
for (let i = 0; i + K <= sutra.length; i++) grams.add(sutra.slice(i, i + K));

let withTail = 0, withSutra = 0;
for (let i = 0; i < segs.length; i++) {
  const head = (segs[i] || '').split('【疏】')[0].split('【記】')[0];
  const tail = clean(lex(head).tail || '');
  if (tail.length < 4) continue;
  withTail++;
  let hit = false;
  for (let j = 0; j + K <= tail.length && !hit; j++) if (grams.has(tail.slice(j, j + K))) hit = true;
  if (hit) withSutra++;
}
console.log('△ 段 ' + segs.length + '｜尾巴 ≥4 字 ' + withTail + '｜其中含經文 ' + withSutra);
console.log('→ 夾經文法最多能錨定約 ' + withSutra + ' 段（' + (withSutra / segs.length * 100).toFixed(1) + '% 的段）');
