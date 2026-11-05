// 觀察 X487（Kanripo 版）的科文格式：把 【】 區塊的尾段（科文）與其後的 「」 經文配對印出來。
import fs from 'node:fs';

const raw = fs.readFileSync('build/_xy/KR6c0075.txt', 'utf8');
// 去掉標頭與分頁標記
const body = raw
  .replace(/^#.*$/gm, '')
  .replace(/<pb:[^>]+>¶/g, '')
  .replace(/¶/g, '\n');

// 依 【】「」 切塊
const re = /【([\s\S]*?)】|「([\s\S]*?)」/g;
const blocks = [];
let m;
while ((m = re.exec(body))) {
  blocks.push(m[1] != null ? { t: 'shu', v: m[1].replace(/\s+/g, '') } : { t: 'jing', v: m[2].replace(/\s+/g, '') });
}
console.log('blocks', blocks.length, 'shu', blocks.filter((b) => b.t === 'shu').length, 'jing', blocks.filter((b) => b.t === 'jing').length);

// 科文段：以 。 結尾、含「一二三四…」序號的短句
const KEPAN = /^([\u4e00-\u9fa5\d]{0,8}?)([一二三四五六七八九十]+|初)$/;
let shown = 0;
for (let i = 0; i < blocks.length && shown < 25; i++) {
  const b = blocks[i];
  if (b.t !== 'shu') continue;
  const tail = b.v.split('。').filter(Boolean).slice(-6);
  const jing = blocks[i + 1] && blocks[i + 1].t === 'jing' ? blocks[i + 1].v.slice(0, 24) : '(無)';
  console.log(`\n--- shu#${i} tail: ${tail.join('。')}`);
  console.log(`    next jing: ${jing}`);
  shown++;
}
