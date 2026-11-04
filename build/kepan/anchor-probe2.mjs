// 錨點可行性：用 8-gram 在整段（科文之後的疏＋記）裡找經文引句
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const t = JSON.parse(fs.readFileSync('kepan/zongmi-tree.json', 'utf8'));

const SENTS = D.versions[0].sents;
const isPunct = (ch) => /[「」『』，。、！？：；…—－·（）()\s〈〉《》〔〕【】]/.test(ch);
const cleanKeepMap = (raw) => {
  let out = '';
  const map = [];
  for (let i = 0; i < raw.length; i++) {
    if (isPunct(raw[i])) continue;
    map.push(i);
    out += raw[i];
  }
  return { out, map };
};

// 全部經文（去標點）＋位置表
let text = '';
const pos = [];                       // pos[charIdx] = {u, off}
for (const s of SENTS) {
  const { out, map } = cleanKeepMap(s.t);
  for (let i = 0; i < out.length; i++) { text += out[i]; pos.push({ u: s.u, off: map[i] }); }
}
const N = 8;
const grams = new Map();              // 8-gram → 起始 charIdx
for (let i = 0; i + N <= text.length; i++) {
  const g = text.slice(i, i + N);
  if (!grams.has(g)) grams.set(g, i);
}

let hit = 0, total = 0;
const samples = [];
for (const n of t.nodes) {
  total++;
  const seg = segs[n.seg] || '';
  const body = seg.replace(/^[^【]*?(?=【)/, '');          // 去掉段首科文
  const { out } = cleanKeepMap(body);
  let at = -1;
  for (let i = 0; i + N <= out.length; i++) {
    const g = out.slice(i, i + N);
    if (grams.has(g)) { at = grams.get(g); break; }
  }
  if (at >= 0) {
    hit++;
    if (samples.length < 6) samples.push(n.name + ' → u' + pos[at].u + '（' + text.slice(at, at + 10) + '）');
  }
}
console.log('節點 ' + total + '｜可錨定 ' + hit + '（' + (hit / total * 100).toFixed(1) + '%）');
console.log('樣本：\n  ' + samples.join('\n  '));
