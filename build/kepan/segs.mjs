// 印出指定段號附近的科文（看孤兒的兄弟是誰）
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author));
const segs = w.text.split('△').slice(1);
const from = +(process.argv[2] || 44), to = +(process.argv[3] || 46);
for (let i = from; i <= to && i < segs.length; i++) {
  const kp = (segs[i] || '').split('【疏】')[0].split('【記】')[0].slice(0, 110).replace(/\s+/g, ' ');
  console.log('段' + i + '：' + kp);
}
