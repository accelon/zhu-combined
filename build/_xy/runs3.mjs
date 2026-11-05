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
  if (!rest) return true;
  return /^[\u4e00-\u9fa5]+$/.test(rest);
};

// 逐句掃（只掃疏文），收集連續的 item run
const runs = [];
let cur = null;
for (const b of blocks) {
  if (b.t !== 'S') continue;
  const sents = b.v.split('。').map((s) => s.trim()).filter(Boolean);
  for (const s of sents) {
    if (isItem(s)) {
      if (!cur) { cur = []; runs.push(cur); }
      cur.push(s);
    } else {
      cur = null;
    }
  }
  cur = null; // 跨 block 不連
}
console.log('runs', runs.length, ' total items', runs.reduce((a, r) => a + r.length, 0));
const multi = runs.filter((r) => r.length > 1);
console.log('runs>1:', multi.length, ' items in them:', multi.reduce((a, r) => a + r.length, 0));
multi.slice(0, 15).forEach((r, i) => console.log(`[${i}] ${r.join('。')}`));
console.log('\n--- 單句 run 前 30 ---');
runs.filter((r) => r.length === 1).slice(0, 30).forEach((r) => console.log('  ', r[0]));
