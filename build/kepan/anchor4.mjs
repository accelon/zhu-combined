// 錨點探測 v3：段內「任意位置」找與經文的最長共同片段，並要求 ≥ 上一個錨點（單調）
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const t = JSON.parse(fs.readFileSync('kepan/zongmi-tree.json', 'utf8'));

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
  const arr = gram.get(g);
  if (arr.length < 40) arr.push(i);
}

/** 在 body 裡找最長、且落點 ≥ from 的引文 */
function longestMatch(body, from, minLen) {
  let best = null;
  for (let i = 0; i + K <= body.length; i++) {
    const cands = gram.get(body.slice(i, i + K));
    if (!cands) continue;
    for (const at of cands) {
      if (at < from) continue;
      let len = K;
      while (i + len < body.length && at + len < text.length && body[i + len] === text[at + len]) len++;
      if (!best || len > best.len) best = { at, len, i };
      if (len > 40) break;
    }
  }
  return best && best.len >= minLen ? best : null;
}

for (const minLen of [10, 8, 6]) {
  let cursor = 0, hit = 0;
  const lens = {};
  const samples = [];
  for (const n of t.nodes) {
    const body = segs[n.seg] || '';   // 整段都掃：經文常夾在葉科的後面（「初問：須菩提！…」）
    const { out } = clean(body);
    const got = longestMatch(out, 0, minLen);   // 先不管單調，逐節各自找最佳
    if (got) {
      hit++;
      lens[got.len] = (lens[got.len] || 0) + 1;
      if (got.at > cursor) cursor = got.at;
      if (samples.length < 5 && got.len >= 12) samples.push(n.name + ' ←' + got.len + '字 u' + pos[got.at].u + '「' + text.slice(got.at, got.at + 12) + '」');
    }
  }
  console.log('minLen ' + minLen + '：各自可錨定 ' + hit + ' / ' + t.nodes.length + '（' + (hit / t.nodes.length * 100).toFixed(1) + '%）');
  console.log('   長度分布 ' + Object.keys(lens).sort((a, b) => a - b).map((k) => k + '×' + lens[k]).join(' '));
  if (samples.length) console.log('   ' + samples.join('\n   '));
}
