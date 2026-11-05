import fs from 'node:fs';
const raw = ['001', '002'].map((v) => fs.readFileSync(`build/_xy/KR6c0075_${v}.txt`, 'utf8')).join('\n');
const body = raw.replace(/^#.*$/gm, '').replace(/<pb:[^>]+>¶/g, '').replace(/¶/g, '\n');
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) blocks.push(m[1] != null ? { t: 'S', v: m[1].replace(/\s+/g, '') } : { t: 'J', v: m[2].replace(/\s+/g, '') });
const sents = [];
blocks.forEach((b) => { if (b.t === 'S') for (const s of b.v.split('。').map((x) => x.trim()).filter(Boolean)) sents.push(s); });

for (const kw of process.argv.slice(2)) {
  const hits = [];
  sents.forEach((s, i) => { if (s.includes(kw)) hits.push(`${i}:${s.slice(0, 18)}`); });
  console.log(`\n== ${kw} (${hits.length})`);
  console.log(hits.slice(0, 8).join(' | '));
}
