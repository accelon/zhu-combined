import fs from 'node:fs';

const raw = fs.readFileSync('build/_xy/KR6c0075.txt', 'utf8');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) {
  blocks.push(m[1] != null ? { t: 'shu', v: m[1].replace(/\s+/g, '') } : { t: 'jing', v: m[2].replace(/\s+/g, '') });
}

// 科文候選句：一/二/三…/初 開頭，短，沒有標點
const KEP = /^(初|[一二三四五六七八九十]{1,2})[\u4e00-\u9fa5]{1,16}$/;
// 也可能「名+數字」結尾（宣告子數）
const hasTail = (s) => /[\u4e00-\u9fa5][一二三四五六七八九十]$/.test(s);

let idx = 0;
for (const b of blocks) {
  if (b.t !== 'shu') continue;
  const sents = b.v.split('。').map((s) => s.trim()).filter(Boolean);
  const run = [];
  for (let i = sents.length - 1; i >= 0; i--) {
    if (KEP.test(sents[i])) run.unshift(sents[i]);
    else break;
  }
  if (run.length) {
    console.log(`#${idx} run(${run.length}) ${run.join('。')}`);
  }
  idx++;
}
