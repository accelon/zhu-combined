import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync('D:\\2026\\vcpp\\zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const S = D.versions[0].sents;
for (const i of [0, 1, 2, 3, 4, 70, 71, 72, 75]) console.log(i, '|', S[i].t.slice(0, 40));
console.log('total', S.length);
