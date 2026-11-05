import fs from 'node:fs';
const t = fs.readFileSync('build/_xy/KR6c0075_002.txt', 'utf8');
for (const k of ['推廣降住', '初果離相', '開解分', '流通分']) {
  const idx = [];
  let i = -1;
  while ((i = t.indexOf(k, i + 1)) >= 0) idx.push(i);
  console.log(k, idx.length, idx.slice(0, 6).join(','));
}
const i = t.indexOf('推廣降住');
console.log('--- context ---');
console.log(t.slice(Math.max(0, i - 500), i + 400));
