// 科文管線的共用工具：漢字正規化、8 字窗單調對齊、層級字。
//
// 「科文」＝各家對《金剛經》的科判（分科標題樹）。本目錄的管線把每一家的科文
// 抽成獨立的資料檔（kepan/*.json），只記「節點樹＋它在經文中的起點」，
// 經文本身不動（離文標註）。節點起點用 (u, off) 表示：
//   u   = 羅什本的句序（zhu-data.js versions[0].sents[i].u）
//   off = 該句內的字元位移（0 起算，以 sentence.t 為準）
// 這樣科文可以指到「字元級」的位置，不受分句方式影響。

// 江味農科判用的層級字：天干（10）＋地支（12），最多 22 層。
export const LEVEL_CHARS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
export const levelOf = (ch) => LEVEL_CHARS.indexOf(ch) + 1;
export const levelChar = (n) => LEVEL_CHARS[n - 1] || '?';

// 異體字折疊（與 build/build-data.ts 一致，這樣對齊才對得上）
const VAR = [
  [/[説説]/g, '說'], [/[卽即]/g, '即'], [/[著着]/g, '著'], [/[鉢缽]/g, '鉢'],
  [/[湼涅]/g, '涅'], [/[衞衛]/g, '衛'], [/[衆眾]/g, '眾'], [/[祗祇]/g, '祇'],
  [/[敎教]/g, '教'], [/[縁緣]/g, '緣'], [/[經経]/g, '經'], [/[徳德]/g, '德'],
  [/[虗虛]/g, '虛'], [/[麁麤]/g, '麤'], [/[穉稚]/g, '稚'], [/[牀床]/g, '床'],
  [/[婬淫]/g, '淫'], [/[瞖翳]/g, '翳'], [/[珂呵]/g, '訶'], [/[却卻]/g, '卻'],
  [/[况況]/g, '況'], [/[覩睹]/g, '睹'], [/[煖暖]/g, '暖'], [/[疎疏]/g, '疏'],
];

const HAN = /[\u3400-\u9fff]/;
const isHan = (ch) => HAN.test(ch);

/** 只留漢字，並記下每個字在原字串中的位置 */
export function normMap(raw) {
  let out = '';
  const map = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (!isHan(ch)) continue;
    out += ch;
    map.push(i);
  }
  let folded = '';
  for (const ch of out) {
    let c = ch;
    for (const [re, to] of VAR) { re.lastIndex = 0; if (re.test(c)) { c = to; break; } }
    folded += c;
  }
  return { text: folded, map };
}
export const norm = (s) => normMap(s).text;

const N = 8;
const BASE = 131;
const POW = (() => { let p = 1; for (let i = 0; i < N; i++) p = Math.imul(p, BASE); return p | 0; })();

/**
 * 把查詢字串 Q 單調地對到目標字串 T（兩邊都先用 norm 過）。
 * 回傳 chain（Q/T 上的 8 字窗錨點，已用 LIS 選出一條遞增鏈）、
 * mapPos（Q 的位置 → T 的位置；落在註釋段落時取最近的錨點外推，誤差 >200 字就回 -1）、
 * mapNext（Q 的位置 → **下一個**錨點在 T 的位置；科文標題落在註釋裡時用它最準）。
 */
export function buildChain(Q, T) {
  const posMap = new Map();
  let h = 0;
  for (let i = 0; i < T.length; i++) {
    h = (Math.imul(h, BASE) + T.charCodeAt(i)) | 0;
    if (i >= N) h = (h - Math.imul(T.charCodeAt(i - N), POW)) | 0;
    if (i < N - 1) continue;
    const a = posMap.get(h);
    if (a) a.push(i - N + 1); else posMap.set(h, [i - N + 1]);
  }
  const qCount = new Map();
  for (let j = 0; j + N <= Q.length; j++) {
    const g = Q.slice(j, j + N);
    qCount.set(g, (qCount.get(g) || 0) + 1);
  }
  const pairs = [];
  h = 0;
  for (let i = 0; i < Q.length; i++) {
    h = (Math.imul(h, BASE) + Q.charCodeAt(i)) | 0;
    if (i >= N) h = (h - Math.imul(Q.charCodeAt(i - N), POW)) | 0;
    if (i < N - 1) continue;
    const j = i - N + 1;
    const arr = posMap.get(h);
    if (!arr) continue;
    const g = Q.slice(j, j + N);
    if ((qCount.get(g) || 0) > 1) continue;
    for (let k = arr.length - 1; k >= 0; k--) {
      const p = arr[k];
      if (T.startsWith(g, p)) pairs.push([j, p]);
    }
  }
  if (!pairs.length) return { chain: [], mapPos: () => -1, mapNext: () => -1 };
  const tailPos = [], tailPair = [];
  const parent = new Int32Array(pairs.length).fill(-1);
  for (let k = 0; k < pairs.length; k++) {
    const pos = pairs[k][1];
    let lo = 0, hi = tailPos.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tailPos[mid] < pos) lo = mid + 1; else hi = mid; }
    if (lo > 0) parent[k] = tailPair[lo - 1];
    tailPos[lo] = pos; tailPair[lo] = k;
  }
  const chain = [];
  let k = tailPair[tailPair.length - 1];
  while (k >= 0) { chain.push({ j: pairs[k][0], p: pairs[k][1] }); k = parent[k]; }
  chain.reverse();
  const chainJ = chain.map((c) => c.j);
  const chainP = chain.map((c) => c.p);
  const mapPos = (qi) => {
    let lo = 0, hi = chainJ.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (chainJ[mid] <= qi) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best < 0) best = 0;
    const c = chain[best];
    if (!c || Math.abs(c.j - qi) > 200) return -1;
    return c.p + (qi - c.j);
  };
  // qi 是「目標字串 T」上的位置：找第一個錨點 p >= qi，回傳它在 Q（查詢）上的位置。
  const mapNext = (qi) => {
    let lo = 0, hi = chainP.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (chainP[mid] >= qi) { best = mid; hi = mid - 1; } else lo = mid + 1;
    }
    if (best < 0) return -1;
    return chain[best].j;
  };
  return { chain, mapPos, mapNext };
}

/** 中文數字（標籤用）：初、次、三…十、十一… */
const NUM = '〇一二三四五六七八九十';
export function labelAt(i, labels) {
  if (labels && labels[i]) return labels[i];
  return i === 0 ? '初' : i === 1 ? '次' : cnNum(i + 1);
}
export function cnNum(n) {
  if (n <= 10) return n === 10 ? '十' : NUM[n];
  if (n < 20) return '十' + NUM[n - 10];
  if (n < 100) return NUM[Math.floor(n / 10)] + '十' + (n % 10 ? NUM[n % 10] : '');
  return String(n);
}
export { NUM };

/** 中文數字 → 整數（用於「分三」「又二」這種） */
export function cnToInt(s) {
  if (!s) return 0;
  if (/^\d+$/.test(s)) return +s;
  let n = 0, cur = 0;
  for (const ch of s) {
    const v = NUM.indexOf(ch);
    if (v < 0) continue;
    if (ch === '十') { cur = (cur || 1) * 10; n += cur; cur = 0; }
    else cur = v;
  }
  return n + cur;
}

/**
 * 錨點微調：Q[q] 對應 T[t]，但是 8 字窗錨點通常落在引文的第 2–6 個字。
 * 往前逐字比對，對得上就一起退，把起點還原到引文真正的第一個字。
 */
export function extendBack(Q, q, T, t) {
  while (q > 0 && t > 0 && Q[q - 1] === T[t - 1]) { q--; t--; }
  return t;
}
