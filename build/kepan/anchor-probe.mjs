// 可行性探測：科會每一科後面的【疏】引文，能不能對到經文
// （科名不是經文，錨點要靠疏文裡引的經句）
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const t = JSON.parse(fs.readFileSync('kepan/zongmi-tree.json', 'utf8'));

// 經文（羅什本）：把所有句串成大字串，記每個字屬於哪一句
const sents = D.versions[0].sents;
const clean = (s) => s.replace(/[「」『』，。、！？：；…—－·「」（）()\s]/g, '');
let text = '';
const map = [];                 // map[i] = {u, off}
for (const s of sents) {
  const raw = s.t;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (/[「」『』，。、！？：；…—－·（）()\s]/.test(ch)) continue;
    text += ch;
    map.push({ u: s.u, off: i });
  }
}

const kpOf = (seg) => {
  const i = [seg.indexOf('【疏】'), seg.indexOf('【記】')].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  return { kp: (i >= 0 ? seg.slice(0, i) : '').trim(), rest: i >= 0 ? seg.slice(i) : seg };
};

let ok = 0, total = 0, noShu = 0;
const samples = [];
for (const n of t.nodes) {
  total++;
  const seg = segs[n.seg] || '';
  const { rest } = kpOf(seg);
  const shu = /【疏】([\s\S]*?)(【記】|△|$)/.exec(rest);
  if (!shu) { noShu++; continue; }
  const q = clean(shu[1]).slice(0, 14);          // 疏文開頭 14 字（常直接引經）
  if (q.length < 5) { noShu++; continue; }
  const at = text.indexOf(q);
  if (at >= 0) {
    ok++;
    if (samples.length < 5) samples.push(n.name + ' → u' + map[at].u + ' off' + map[at].off + '（' + q.slice(0, 10) + '…）');
  }
}
console.log('節點 ' + total + '｜疏文有引到經句 ' + ok + '（' + (ok / total * 100).toFixed(1) + '%）｜無疏 ' + noShu);
console.log('樣本：\n  ' + samples.join('\n  '));
