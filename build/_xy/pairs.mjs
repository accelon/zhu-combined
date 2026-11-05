import fs from 'node:fs';

const raw = fs.readFileSync('build/_xy/KR6c0075.txt', 'utf8');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) {
  blocks.push(m[1] != null ? { t: 'S', v: m[1].replace(/\s+/g, '') } : { t: 'J', v: m[2].replace(/\s+/g, '') });
}

const NUM = '一二三四五六七八九十';
const isItem = (s) => {
  if (!s || s.length > 14) return false;
  if (!(s[0] === '初' || NUM.includes(s[0]))) return false;
  const rest = s.slice(1);
  return !rest || /^[\u4e00-\u9fa5]+$/.test(rest);
};
function tailRun(sents) {
  const run = [];
  for (let i = sents.length - 1; i >= 0; i--) {
    if (isItem(sents[i])) run.unshift(sents[i]);
    else break;
  }
  return run;
}

const pairs = [];
for (let i = 0; i < blocks.length; i++) {
  if (blocks[i].t !== 'J') continue;
  let run = null, gap = 0;
  for (let k = i - 1; k >= 0 && gap < 3; k--) {
    if (blocks[k].t !== 'S') { gap++; continue; }
    const r = tailRun(blocks[k].v.split('。').map((s) => s.trim()).filter(Boolean));
    if (r.length) { run = r; break; }
    gap++;
  }
  pairs.push({ jing: blocks[i].v, run: run || [] });
}
console.log('經文 blocks', pairs.length, ' 有科文 run 的', pairs.filter((p) => p.run.length).length);
for (const p of pairs.slice(0, 30)) {
  console.log(`  ${p.run.length ? p.run.join('。') : '(無)'}  =>  「${p.jing.slice(0, 18)}…」`);
}
