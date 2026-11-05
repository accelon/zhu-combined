// 用幕布本的樹（187 節，已核對＝道源／新眼疏的樹）當骨架，
// 在 X487 的疏文裡「依文件序」找每個科名，取它之後的第一段「」經文當錨點。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:\\2026\\vcpp';
const code = fs.readFileSync(path.join(process.cwd(), 'lossless.js'), 'utf8');
const win = {};
new Function('window', `${code};return window.LOSSLESS;`)(win);
const canon = win.LOSSLESS.canon;

// ---- X487 ----
const raw = fs.readFileSync('build/_xy/KR6c0075.txt', 'utf8');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) {
  blocks.push(m[1] != null
    ? { t: 'S', v: m[1].replace(/\s+/g, ''), at: m.index }
    : { t: 'J', v: m[2].replace(/\s+/g, ''), at: m.index });
}

// 疏文串（只收 S），記回 block 索引
let Sr = '';
const sAt = [];
blocks.forEach((b, i) => {
  if (b.t !== 'S') return;
  sAt.push({ start: Sr.length, block: i });
  Sr += canon(b.v) + '\u0001';
});

// ---- 幕布樹 ----
const md = fs.readFileSync('D:\\2026\\zhu-combined\\mubu-kepan\\docs\\20-金刚经科判.md', 'utf8').split('\n');
const nodes = [];
for (const line of md) {
  const mm = line.match(/^( *)- (.*)$/);
  if (!mm) continue;
  const depth = mm[1].length / 2;
  let name = mm[2].replace(/\*\*/g, '').trim();
  name = name.replace(/^第[一二三四五六七八九十]+、/, '');   // 第一、总释名题
  name = name.replace(/^[甲乙丙丁戊己庚辛壬癸][一二三四五六七八九十]+、/, ''); // 甲一、序分
  name = canon(name);
  nodes.push({ depth, name, raw: mm[2].trim() });
}
console.log('mubu nodes', nodes.length);

// ---- 依序對名 ----
let cursor = 0;
let miss = 0;
for (const n of nodes) {
  let p = -1;
  if (n.name) p = Sr.indexOf(n.name, cursor);
  if (p < 0) { n.at = -1; miss++; continue; }
  n.at = p;
  cursor = p;
}
console.log('找不到', miss, '個');
const missList = nodes.filter((n) => n.at < 0).map((n) => n.raw.slice(0, 20));
console.log(missList.slice(0, 20).join(' | '));

// ---- 每個節點的下一段經文 ----
const jing = blocks.filter((b) => b.t === 'J');
let ji = 0;
for (const n of nodes) {
  if (n.at < 0) { n.q = null; continue; }
  while (ji < jing.length && jing[ji].at < 0) ji++;
  // 用 block 索引比較（at 是原字串位置，block.at 也是）
  n.q = null;
}
// 重新：把 Sr 位置換成 block 索引
const blockOf = (pos) => {
  let lo = 0, hi = sAt.length - 1, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sAt[mid].start <= pos) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return sAt[best].block;
};
const jBlocks = blocks.map((b, i) => (b.t === 'J' ? i : -1)).filter((i) => i >= 0);
let jj = 0;
for (const n of nodes) {
  if (n.at < 0) continue;
  const bi = blockOf(n.at);
  while (jj < jBlocks.length && jBlocks[jj] < bi) jj++;
  n.q = jj < jBlocks.length ? blocks[jBlocks[jj]].v.slice(0, 30) : null;
}
let noQ = nodes.filter((n) => n.at >= 0 && !n.q).length;
console.log('沒有後續經文', noQ);
for (const n of nodes.slice(0, 8)) console.log('  ', n.depth, n.raw.slice(0, 18), '=>', n.q);
