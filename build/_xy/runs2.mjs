import fs from 'node:fs';

const raw = fs.readFileSync('build/_xy/KR6c0075.txt', 'utf8');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) {
  blocks.push(m[1] != null ? { t: 'shu', v: m[1].replace(/\s+/g, '') } : { t: 'jing', v: m[2].replace(/\s+/g, '') });
}

const NUM = '一二三四五六七八九十';
const isBare = (s) => s === '初' || /^[{NUM}]{1,2}$/.test(s) || NUM.includes(s) && s.length <= 2;
const isBareOrd = (s) => s === '初' || (s.length <= 2 && [...s].every((c) => NUM.includes(c)));
const isItem = (s) => {
  if (!s || s.length > 14) return false;
  const first = s[0];
  if (!(first === '初' || NUM.includes(first))) return false;
  const rest = s.slice(1);
  if (!rest) return true;                    // 裸序號
  if (!/^[\u4e00-\u9fa5．·]+$/.test(rest)) return false;
  return true;
};

let groups = 0;
const out = [];
for (const b of blocks) {
  if (b.t !== 'shu') continue;
  const sents = b.v.split('。').map((s) => s.trim()).filter(Boolean);
  let i = sents.length - 1;
  if (i < 0 || !isBareOrd(sents[i])) continue;   // 必須以裸序號收尾
  const run = [];
  while (i >= 0 && isItem(sents[i])) { run.unshift(sents[i]); i--; }
  groups++;
  out.push(run.join('。'));
}
console.log('groups', groups);
out.slice(0, 12).forEach((g, i) => console.log(`\n[${i}] ${g}`));
