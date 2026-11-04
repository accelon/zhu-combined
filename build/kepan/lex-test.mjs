// 科文 lexer 測試：把前幾段的科文切出來看對不對
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const w = D.works.find((x) => /宗密疏 宋 子璿記 清 大璸/.test(x.author || ''));
const segs = w.text.split('△').slice(1);
const NUM = '初一二三四五六七八九十';
const NUMS = { 初: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const toN = (s) => NUMS[s] || 0;

function kpOf(seg) {
  const i = [seg.indexOf('【疏】'), seg.indexOf('【記】')].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  return (i >= 0 ? seg.slice(0, i) : seg.slice(0, 40)).trim();
}

// 依序嘗試的規則（長的前面）
const RULES = [
  ['declFen', '^([^，。：；、【]{1,14}?)分([' + NUM + ']+)[：:]'],        // X分三：
  ['declColon', '^([' + NUM + ']{1,2})、([^，。：；【]{1,18}?)([' + NUM + ']+)[：:]'], // 初、A二：
  ['enterCount', '^([' + NUM + ']{1,2})、([^，。：；【]{1,18}?)([' + NUM + ']+)[。.]'], // 初、A二。
  ['item', '^([' + NUM + ']{1,2})、([^，。：；【]{1,18})[，,、]'],        // 初、A，
  ['enterLeaf', '^([' + NUM + ']{1,2})、([^，。：；【]{1,18})[。.]'],    // 初、A。
  ['enterBare', '^([' + NUM + ']{1,2})([^，。：；、【]{1,18})[。.]'],    // 初A。
];
const R = RULES.map(([k, re]) => [k, new RegExp(re)]);

function lex(kp) {
  let s = kp;
  const out = [];
  let guard = 0;
  while (s && guard++ < 500) {
    let hit = null;
    for (const [k, re] of R) {
      const m = re.exec(s);
      if (m) { hit = [k, m]; break; }
    }
    if (!hit) { out.push({ k: 'REST', text: s.slice(0, 20) }); break; }
    const [k, m] = hit;
    const consumed = m[0].length;
    if (k === 'declFen') out.push({ k: 'decl', name: m[1].trim(), n: toN(m[2]) });
    else if (k === 'declColon') out.push({ k: 'decl', label: toN(m[1]), name: m[2].trim(), n: toN(m[3]) });
    else if (k === 'enterCount') out.push({ k: 'enter', label: toN(m[1]), name: m[2].trim(), n: toN(m[3]) });
    else if (k === 'item') out.push({ k: 'item', label: toN(m[1]), name: m[2].trim() });
    else if (k === 'enterLeaf') out.push({ k: 'enter', label: toN(m[1]), name: m[2].trim(), n: 0 });
    else if (k === 'enterBare') out.push({ k: 'enter', label: toN(m[1]), name: m[2].trim(), n: 0 });
    s = s.slice(consumed);
  }
  return out;
}

for (const seg of segs.slice(0, 5)) {
  const kp = kpOf(seg);
  console.log('原文：' + kp.slice(0, 90));
  for (const t of lex(kp)) {
    console.log('   ' + t.k.padEnd(6) + (t.label != null ? '[' + t.label + '] ' : '') + (t.n ? '{' + t.n + '} ' : '') + (t.name || t.text || ''));
  }
  console.log('');
}
