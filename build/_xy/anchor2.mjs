// 定點法：把 X487 疏文切成句子，用「句首＝序號＋科名」的規則，
// 依幕布樹的順序逐個找科名的宣告位置，再取它之後第一段能在經文裡對上的「」引文當錨點。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:\\2026\\vcpp';
const code = fs.readFileSync(path.join(process.cwd(), 'lossless.js'), 'utf8');
const win = {};
new Function('window', `${code};return window.LOSSLESS;`)(win);
const canon = win.LOSSLESS.canon;
// Unihan 變體表沒收這幾個（讚→赞），補上；只用在「科名比對」
const EXTRA = [[/讚/g, '赞'], [/讃/g, '赞'], [/歎/g, '叹'], [/祇/g, '祗']];
const norm2 = (s) => { let t = canon(s); for (const [re, to] of EXTRA) t = t.replace(re, to); return t; };

// ---------- X487 ----------
const raw = fs.readFileSync('build/_xy/KR6c0075.txt', 'utf8');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) {
  blocks.push(m[1] != null
    ? { t: 'S', v: m[1].replace(/\s+/g, '') }
    : { t: 'J', v: m[2].replace(/\s+/g, '') });
}

// 句子（只取疏文），帶 block 序號
const sents = [];
blocks.forEach((b, bi) => {
  if (b.t !== 'S') return;
  for (const s of b.v.split('。').map((x) => x.trim()).filter(Boolean)) {
    sents.push({ s: norm2(s), bi });
  }
});
console.log('sentences', sents.length);

// ---------- 幕布樹 ----------
const md = fs.readFileSync('D:\\2026\\zhu-combined\\mubu-kepan\\docs\\20-金刚经科判.md', 'utf8').split('\n');
const tree = [];
for (const line of md) {
  const mm = line.match(/^( *)- (.*)$/);
  if (!mm) continue;
  let name = mm[2].replace(/\*\*/g, '').trim();
  name = name.replace(/^第[一二三四五六七八九十]+、/, '').replace(/^[甲乙丙丁戊己庚辛壬癸][一二三四五六七八九十]+、/, '');
  if (/——/.test(name)) name = name.split('——')[0];
  tree.push({ depth: mm[1].length / 2, raw: mm[2].trim(), name: norm2(name) });
}
console.log('tree nodes', tree.length);

// ---------- 逐節點找宣告句 ----------
const ORD = /^[初一二三四五六七八九十]{1,2}/;
let cur = 0;
let hit = 0;
for (const n of tree) {
  let found = -1;
  for (let i = cur; i < sents.length; i++) {
    const s = sents[i].s.replace(ORD, '');
    if (s.startsWith(n.name) && n.name.length >= 2) { found = i; break; }
  }
  n.si = found;
  if (found >= 0) { hit++; cur = found; }
}
console.log('宣告句命中', hit, '/', tree.length);
for (const n of tree.slice(0, 18)) {
  console.log(String(n.si).padStart(4), n.raw.slice(0, 16), '|', n.si >= 0 ? sents[n.si].s.slice(0, 34) : '');
}
const miss = tree.filter((n) => n.si < 0);
console.log('未中：', miss.map((n) => n.raw.slice(0, 14)).join(' | ').slice(0, 400));


