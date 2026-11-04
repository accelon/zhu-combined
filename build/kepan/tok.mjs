// 看某一段切出來的 token
import fs from 'node:fs';
import { lex } from './lex.mjs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const idx = +(process.argv[2] || 45);
const kp = (segs[idx] || '').split('【疏】')[0].split('【記】')[0];
console.log('段' + idx + '：' + kp.slice(0, 120));
for (const t of lex(kp)) {
  console.log('  ' + t.k.padEnd(6) + (t.label != null ? '[' + t.label + '] ' : '') + (t.n ? '{' + t.n + '} ' : '') + t.name);
}
