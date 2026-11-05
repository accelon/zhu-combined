// 科文 lexer：把一段科文切成 token
//
// 例：「二、序宗旨二：初、序讚經旨，二、述造疏意。」
//   → decl{label 2, name 序宗旨, n 2}, item{1 序讚經旨}, item{2 述造疏意}
//
// 難點：科名本身可能帶數字（「廣釋第十八住」），所以「尾巴那個字是子節數」要判斷，
// 這裡用「前一個字不是第」當條件（第十八住 ≠ 第十八 + 住）。
export const NUM = '初一二三四五六七八九十';
export const NUMS = { 初: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
/** 序號：初→1、一→1、十→10、十一→11、二十→20、二十三→23 */
export const toN = (s) => {
  if (!s) return 0;
  if (s.length === 1) return NUMS[s] || 0;
  const i = s.indexOf('十');
  if (i < 0) return 0;
  const hi = i === 0 ? 1 : (NUMS[s[i - 1]] || 0);
  const lo = i === s.length - 1 ? 0 : (NUMS[s[i + 1]] || 0);
  return hi * 10 + lo;
};

const RULES = [
  ['declFen', '^([^，。：；、【]{1,16}?)分([' + NUM + ']+)[：:]'],
  ['declCount', '^([' + NUM + ']{1,2})、([^，。：；【]{1,20}?)(?<!第)([' + NUM + ']{1,3})[：:]'],
  ['enterCount', '^([' + NUM + ']{1,2})、([^，。：；【]{1,20}?)(?<!第)([' + NUM + ']{1,3})[。.]'],
  ['item', '^([' + NUM + ']{1,2})、([^，。：；【]{1,20})[，,、]'],
  ['enterLeaf', '^([' + NUM + ']{1,2})、([^，。：；【]{1,20})[。.]'],
  ['countOnly', '^([' + NUM + ']{1,3})[。.]'],
  ['declBare', '^([' + NUM + ']{1,3})([^，。：；、【]{1,20}?)(?<!第)([' + NUM + ']{1,3})[。.]'],
  ['itemBare', '^([' + NUM + ']{1,3})([^，。：；、【]{1,20})[，,]'],
  ['enterBare', '^([' + NUM + ']{1,2})([^，。：；、【]{1,20})[。.]'],
];
const R = RULES.map(([k, re]) => [k, new RegExp(re)]);

export function lex(kp) {
  const toks = [];
  let s = kp;
  let guard = 0;
  while (s && guard++ < 900) {
    let hit = null;
    for (const [k, re] of R) {
      const m = re.exec(s);
      if (m) { hit = [k, m]; break; }
    }
    if (!hit) break;
    const [k, m] = hit;
    if (k === 'declFen') toks.push({ k: 'decl', name: m[1].trim(), n: toN(m[2]) });
    else if (k === 'countOnly') toks.push({ k: 'count', n: toN(m[1]) });
    else if (k === 'declBare') toks.push({ k: 'decl', label: toN(m[1]), name: m[2].trim(), n: toN(m[3]) });
    else if (k === 'itemBare') toks.push({ k: 'item', label: toN(m[1]), name: m[2].trim() });
    else if (k === 'declCount') toks.push({ k: 'decl', label: toN(m[1]), name: m[2].trim(), n: toN(m[3]) });
    else if (k === 'enterCount') toks.push({ k: 'enter', label: toN(m[1]), name: m[2].trim(), n: toN(m[3]) });
    else if (k === 'item') toks.push({ k: 'item', label: toN(m[1]), name: m[2].trim() });
    else if (k === 'enterLeaf') toks.push({ k: 'enter', label: toN(m[1]), name: m[2].trim(), n: 0 });
    else toks.push({ k: 'enter', label: toN(m[1]), name: m[2].trim(), n: 0 });
    s = s.slice(m[0].length);
  }
  toks.tail = s;   // 切完科文剩下的那截＝夾在葉科後面的經文
  return toks;
}
