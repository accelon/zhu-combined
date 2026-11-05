// 錨點探測 v2：單調前進 + 較長引文；看科會的疏文到底引不引經
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const t = JSON.parse(fs.readFileSync('kepan/zongmi-tree.json', 'utf8'));

const SENTS = D.versions[0].sents;
const isP = (ch) => /[「」『』，。、！？：；…—－·（）()\s〈〉《》〔〕【】]/.test(ch);
function clean(raw) {
  let out = '';
  const map = [];
  for (let i = 0; i < raw.length; i++) { if (isP(raw[i])) continue; out += raw[i]; map.push(i); }
  return { out, map };
}
let text = '';
const pos = [];
for (const s of SENTS) {
  const { out, map } = clean(s.t);
  for (let i = 0; i < out.length; i++) { text += out[i]; pos.push({ u: s.u, off: map[i] }); }
}

/** 在 [from, ∞) 找 s（已去標點）中最長的前綴，回傳 {at, len} 或 null */
function findFrom(s, from, minLen) {
  for (let len = Math.min(s.length, 40); len >= minLen; len--) {
    const at = text.indexOf(s.slice(0, len), from);
    if (at >= 0) return { at, len };
  }
  return null;
}

let cursor = 0, hit = 0, total = 0;
const lens = {};
const samples = [];
for (const n of t.nodes) {
  total++;
  const seg = segs[n.seg] || '';
  const body = seg.replace(/^[^【]*?(?=【)/, '');
  const { out } = clean(body);
  // 疏文常以「經云／經曰」起引，先試整段找最長前綴
  const got = findFrom(out, cursor, 6);
  if (got) {
    hit++;
    lens[got.len] = (lens[got.len] || 0) + 1;
    cursor = got.at;
    if (samples.length < 8 && got.len >= 10) samples.push(n.name + '  ←' + got.len + '字  u' + pos[got.at].u + '「' + text.slice(got.at, got.at + 12) + '」');
  }
}
console.log('節點 ' + total + '｜單調可錨定 ' + hit + '（' + (hit / total * 100).toFixed(1) + '%）');
console.log('匹配長度分布：' + Object.keys(lens).sort((a, b) => a - b).map((k) => k + '字×' + lens[k]).join(' '));
console.log('樣本：\n  ' + samples.join('\n  '));
