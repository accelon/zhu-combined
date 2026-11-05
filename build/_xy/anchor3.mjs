// 以幕布樹為骨架、X487 為權威：
//   1. 依幕布樹的文件序，在 X487 疏文的句首找對應的科名（允許 1 字異文，如 誡/誠）
//   2. 科名以 X487 的寫法為準（幕布本是轉抄，有錯字）
//   3. 錨點＝該宣告句之後第一段能在羅什經文裡對上的「」引文
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:\\2026\\vcpp';
const code = fs.readFileSync(path.join(process.cwd(), 'lossless.js'), 'utf8');
const win = {};
new Function('window', `${code};return window.LOSSLESS;`)(win);
const canon = win.LOSSLESS.canon;
const EXTRA = [[/讚/g, '赞'], [/讃/g, '赞'], [/歎/g, '叹'], [/祇/g, '祗']];
const norm2 = (s) => { let t = canon(s); for (const [re, to] of EXTRA) t = t.replace(re, to); return t; };

// ---------- X487 ----------
const raw = ['001','002'].map((v) => fs.readFileSync('build/_xy/KR6c0075_' + v + '.txt', 'utf8')).join('\n');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) {
  blocks.push(m[1] != null ? { t: 'S', v: m[1].replace(/\s+/g, '') } : { t: 'J', v: m[2].replace(/\s+/g, '') });
}
const sents = [];
blocks.forEach((b, bi) => {
  if (b.t !== 'S') return;
  for (const s of b.v.split('。').map((x) => x.trim()).filter(Boolean)) sents.push({ s, n: norm2(s), bi });
});

// ---------- 幕布樹 ----------
const md = fs.readFileSync('D:\\2026\\zhu-combined\\mubu-kepan\\docs\\20-金刚经科判.md', 'utf8').split('\n');
const tree = [];
for (const line of md) {
  const mm = line.match(/^( *)- (.*)$/);
  if (!mm) continue;
  let name = mm[2].replace(/\*\*/g, '').trim()
    .replace(/^第[一二三四五六七八九十]+、/, '')
    .replace(/^[甲乙丙丁戊己庚辛壬癸][一二三四五六七八九十]+、/, '')
    .replace(/（[^）]*）\s*$/, '');
  if (/——/.test(name)) name = name.split('——')[0];
  tree.push({ depth: mm[1].length / 2, raw: mm[2].trim(), name: norm2(name) });
}

// ---------- 編輯距離 ----------
function ed(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}
const ORD = /^[初一二三四五六七八九十]{1,2}/;

// ---------- 逐節點找宣告句 ----------
let cur = 0;
let hit = 0, fuzzy = 0;
for (const n of tree) {
  let best = -1, bestD = 99;
  for (const W of [120, 400, 900]) {
    const window = Math.min(sents.length, cur + W);
    best = -1; bestD = 99;
    for (let i = cur; i < window; i++) {
      const s = sents[i].n.replace(ORD, '');
      if (s.length > n.name.length + 3) continue;
      const d = ed(n.name, s);
      if (d <= 1) { best = i; bestD = d; break; }   // 最近的一個先贏
    }
    if (best >= 0) break;
  }
  if (bestD <= 1) {
    n.si = best;
    n.xname = sents[best].s.replace(ORD, '').slice(0, n.name.length + (bestD ? 1 : 0));
    cur = best;
    hit++;
    if (bestD) fuzzy++;
  } else n.si = -1;
}
console.log('命中', hit, '/', tree.length, '（其中異文', fuzzy, '）');
console.log('未中：', tree.filter((n) => n.si < 0).map((n) => n.raw.slice(0, 12)).join(' | ').slice(0, 300));
console.log('\n前 20：');
for (const n of tree.slice(0, 20)) console.log(String(n.si).padStart(4), n.raw.slice(0, 14).padEnd(16), '→', n.xname || '');

console.log('--- 15..45 ---');
console.log("--- nodes 120..187 ---");
for (const n of tree.slice(120)) console.log(String(n.si).padStart(4), n.raw.slice(0,16).padEnd(18), "|", n.xname||"", "|", n.si>=0?sents[n.si].s.slice(0,30):"");
