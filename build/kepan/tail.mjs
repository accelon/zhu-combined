// 看某段的 lex tail 是什麼
import fs from 'node:fs';
import { lex } from './lex.mjs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
for (const idx of [438, 464, 45]) {
  const head = (segs[idx] || '').split('【疏】')[0].split('【記】')[0];
  const toks = lex(head);
  console.log('段' + idx + '  head=' + head.slice(0, 60));
  console.log('   tokens=' + toks.length + '  tail=' + JSON.stringify((toks.tail || '').slice(0, 60)));
}
