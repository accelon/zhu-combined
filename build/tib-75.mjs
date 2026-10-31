// 印出 7-5 的藏文句與相關詞的藏文（給長圖引用）。
import { readFileSync } from 'node:fs';

const src = readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, '');
const D = JSON.parse(src);
const e = D.pdf.find((x) => x.no === (process.argv[2] || '7-5'));
if (!e) { console.log('no entry'); process.exit(0); }
console.log('tib:', JSON.stringify(e.tib));
for (const w of e.words || []) console.log(w.i, w.s, '|', w.tib || '', '|', w.zh);
