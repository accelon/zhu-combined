import fs from 'node:fs';

const raw = fs.readFileSync('build/_xy/KR6c0075.txt', 'utf8');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) {
  blocks.push(m[1] != null ? { t: 'shu', v: m[1].replace(/\s+/g, '') } : { t: 'jing', v: m[2].replace(/\s+/g, '') });
}
let i = 0;
blocks.forEach((b, k) => {
  if (b.t !== 'shu') return;
  i++;
  console.log(`[${i}] (${b.v.length}) …${b.v.slice(-70)}`);
});
