#!/usr/bin/env bun
/**
 * zhu-combined 資料管線（v2）
 *
 * 文本以 taisho / wxzj / yinshun 為準（才有頁碼可溯源）；vcpp_*.off 只提供分句邊界。
 *   - 六個譯本：T235 羅什、T236a 留支、T237 真諦、T238 笈多、T220(9) 玄奘、T239 義淨
 *   - 注疏：大正藏 7 部、卍續藏 32 部、印順《般若經講記》金剛經部分
 *   - 昭明太子 32 分；科判另標 kind，預設不混入注疏
 *
 * 用法（在 D:\\2026\\zhu-combined 執行）：bun run build/build-data.ts
 *
 * 語料輸入（catalog.tsv／tei-all.txt／wxzj-tei-2026R2.txt／ys-text-full.txt／
 * jingang-fen.tsv）預設讀 D:\\2026\\adb-converter\\build；可用環境變數
 * ZHU_CORPUS 指向別的目錄。本專案不寫入該目錄。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const CORPUS = process.env.ZHU_CORPUS || 'D:\\2026\\adb-converter\\build';
const VCPP = 'D:\\2023\\yonglezang\\ylz-prjn.offtext\\';
const OUT_DIR = 'D:\\2026\\zhu-combined';

const TAG = /\^[a-z_]+[0-9]*(?:[#@:.\/~|-][^\s【〔「『（(《<]*)?(?:<[^>]*>)?(?:[【〔「『（(][^】〕」』）)]*[】〕」』）)])?/g;
const HEADING = /^[〔【（(]?[^\s，。！？；：、]{1,7}分第[一二三四五六七八九十]+[〕】）)]?/;

const VAR: [RegExp, string][] = [
  [/[説説]/g, '說'], [/[卽即]/g, '即'], [/[著着]/g, '著'], [/[鉢缽]/g, '鉢'],
  [/[湼涅]/g, '涅'], [/[衞衛]/g, '衛'], [/[衆眾]/g, '眾'], [/[祗祇]/g, '祇'],
  [/[敎教]/g, '教'], [/[縁緣]/g, '緣'], [/[經経]/g, '經'], [/[徳德]/g, '德'],
  [/[虗虛]/g, '虛'], [/[麁麤]/g, '麤'], [/[穉稚]/g, '稚'], [/[牀床]/g, '床'],
  [/[婬淫]/g, '淫'], [/[瞖翳]/g, '翳'], [/[珂呵]/g, '訶'], [/[却卻]/g, '卻'],
  [/[况況]/g, '況'], [/[覩睹]/g, '睹'], [/[煖暖]/g, '暖'], [/[疎疏]/g, '疏'],
];

function normMap(raw: string) {
  let out = '', map: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (!/[\u3400-\u9fff]/.test(ch)) continue;
    out += ch; map.push(i);
  }
  let folded = '';
  for (const ch of out) {
    let c = ch;
    for (const [re, to] of VAR) { re.lastIndex = 0; if (re.test(c)) { c = to; break; } }
    folded += c;
  }
  return { text: folded, map };
}
const norm = (s: string) => normMap(s).text;

// ---------- vcpp 分句參考 ----------
interface SRef { t: string; sec: number; }
function parseVcpp(file: string): SRef[] {
  const raw = readFileSync(VCPP + file, 'utf8');
  const secs: string[][] = [];
  let cur = -1;
  for (const line of raw.split(/\r?\n/)) {
    const ck = /\^ck(\d+)/.exec(line);
    let text = line.replace(TAG, '').trim().replace(HEADING, '').trim();
    if (ck) {
      const n = +ck[1];
      if (n === 0) { cur = -1; continue; }
      cur = n - 1;
      if (!secs[cur]) secs[cur] = [];
      if (text) secs[cur].push(text);
    } else if (cur >= 0 && text) secs[cur].push(text);
  }
  const out: SRef[] = [];
  secs.forEach((lines, i) => {
    let buf = '';
    const push = () => { if (buf.trim()) { out.push({ t: buf.trim(), sec: i + 1 }); buf = ''; } };
    for (const l of lines) {
      buf += l;
      if (/[。！？][」』”’]?$/.test(buf)) push();
    }
    push();
  });
  return out;
}

// ---------- 取權威文本（保留頁碼） ----------
interface TextWithPages { text: string; pages: { id: string; at: number }[]; }
function stripYinshunKe(chunk: string): string {
  // 印順《般若經講記》的科文是 <項|節|章 u="文">甲一 序分</...> 這類標題；
  // 全部去掉，避免科文混進講記正文。
  return chunk.replace(/<(項|節|章)[^>]*u="文"[^>]*>[\s\S]*?<\/\1>/g, '');
}

function extractText(chunk: string): TextWithPages {
  let s = chunk.replace(/<頁 id="([^"]+)"\/>/g, (_, id) => `\u0001${id}\u0002`);
  s = s.replace(/<[^>]+>/g, '').replace(/&[A-Za-z0-9#]+;/g, '').replace(/\s+/g, '');
  const pages: { id: string; at: number }[] = [];
  let out = '';
  let i = 0;
  while (i < s.length) {
    const a = s.indexOf('\u0001', i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const b = s.indexOf('\u0002', a);
    pages.push({ id: s.slice(a + 1, b), at: out.length });
    i = b + 1;
  }
  return { text: out, pages };
}
function pageAt(pages: { id: string; at: number }[], at: number): string {
  let lo = 0, hi = pages.length - 1, best = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (pages[mid].at <= at) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  return best >= 0 ? pages[best].id : (pages[0]?.id ?? '');
}

// ---------- 單調映射（8 字窗 LIS） ----------
const N = 8;
const BASE = 131;
const POW = (() => { let p = 1; for (let i = 0; i < N; i++) p = Math.imul(p, BASE); return p | 0; })();

function buildChain(Q: string, T: string) {
  const posMap = new Map<number, number[]>();
  let h = 0;
  for (let i = 0; i < T.length; i++) {
    h = (Math.imul(h, BASE) + T.charCodeAt(i)) | 0;
    if (i >= N) h = (h - Math.imul(T.charCodeAt(i - N), POW)) | 0;
    if (i < N - 1) continue;
    const a = posMap.get(h);
    if (a) a.push(i - N + 1); else posMap.set(h, [i - N + 1]);
  }
  const qCount = new Map<string, number>();
  for (let j = 0; j + N <= Q.length; j++) {
    const g = Q.slice(j, j + N);
    qCount.set(g, (qCount.get(g) ?? 0) + 1);
  }
  const pairs: [number, number][] = [];
  h = 0;
  for (let i = 0; i < Q.length; i++) {
    h = (Math.imul(h, BASE) + Q.charCodeAt(i)) | 0;
    if (i >= N) h = (h - Math.imul(Q.charCodeAt(i - N), POW)) | 0;
    if (i < N - 1) continue;
    const j = i - N + 1;
    const arr = posMap.get(h);
    if (!arr) continue;
    const g = Q.slice(j, j + N);
    if ((qCount.get(g) ?? 0) > 1) continue;
    for (let k = arr.length - 1; k >= 0; k--) {
      const p = arr[k];
      if (T.startsWith(g, p)) pairs.push([j, p]);
    }
  }
  if (!pairs.length) return { chain: [] as { j: number; p: number }[], mapPos: () => -1 };
  const tailPos: number[] = [], tailPair: number[] = [];
  const parent = new Int32Array(pairs.length).fill(-1);
  for (let k = 0; k < pairs.length; k++) {
    const pos = pairs[k][1];
    let lo = 0, hi = tailPos.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tailPos[mid] < pos) lo = mid + 1; else hi = mid; }
    if (lo > 0) parent[k] = tailPair[lo - 1];
    tailPos[lo] = pos; tailPair[lo] = k;
  }
  const chain: { j: number; p: number }[] = [];
  let k = tailPair[tailPair.length - 1];
  while (k >= 0) { chain.push({ j: pairs[k][0], p: pairs[k][1] }); k = parent[k]; }
  chain.reverse();
  const chainJ = chain.map((c) => c.j);
  const mapPos = (qi: number): number => {
    let lo = 0, hi = chainJ.length - 1, best = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (chainJ[mid] <= qi) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    if (best < 0) best = 0;
    const c = chain[best];
    if (!c || Math.abs(c.j - qi) > 200) return -1;
    return c.p + (qi - c.j);
  };
  return { chain, mapPos };
}

// ---------- 依 vcpp 邊界切權威文本 ----------
interface Sent { t: string; u: number; sec: number; p: string; }

function segment(text: string, pages: { id: string; at: number }[], refs: SRef[]): Sent[] {
  const QN = refs.map((r) => norm(r.t));
  const starts: number[] = [];
  let acc = 0;
  for (const s of QN) { starts.push(acc); acc += s.length; }
  const { mapPos } = buildChain(QN.join(''), norm(text));
  const nm = normMap(text);
  const toRaw = (q: number) => nm.map[Math.max(0, Math.min(q, nm.text.length - 1))] ?? 0;
  const cuts: number[] = [];
  for (let i = 0; i < refs.length; i++) {
    const q = mapPos(starts[i]);
    let raw = q >= 0 ? toRaw(q) : (cuts.length ? cuts[cuts.length - 1] : 0);
    if (cuts.length && raw < cuts[cuts.length - 1]) raw = cuts[cuts.length - 1];
    cuts.push(raw);
  }
  const out: Sent[] = [];
  for (let i = 0; i < refs.length; i++) {
    const a = cuts[i];
    const b = i + 1 < cuts.length ? cuts[i + 1] : text.length;
    const t = text.slice(a, b).trim();
    if (t.replace(/[^\u3400-\u9fff]/g, '').length < 2) continue;
    out.push({ t, u: -1, sec: refs[i].sec, p: pageAt(pages, a) });
  }
  // 最後一兩個字（句讀切點落在字上）補回上一句
  const lastCut = cuts[cuts.length - 1] ?? text.length;
  const rem = text.slice(lastCut).trim();
  if (rem && rem.length <= 12 && out.length) out[out.length - 1].t += rem;
  return out;
}

// ---------- 對齊其他譯本 ----------
function bigrams(s: string) { const set = new Set<string>(); for (let i = 0; i + 2 <= s.length; i++) set.add(s.slice(i, i + 2)); return set; }
function sim(a: string, b: string) {
  if (!a || !b) return 0;
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}
function alignUnits(B: Sent[], V: Sent[]): number[] {
  const b = B.map((x) => norm(x.t));
  const v = V.map((x) => norm(x.t));
  const n = b.length, m = v.length;
  const NEG = -1e9, GAP = -0.45;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) dp[i][0] = dp[i - 1][0] + GAP;
  for (let j = 1; j <= m; j++) dp[0][j] = dp[0][j - 1] + GAP;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const prior = -0.18 * Math.abs(i / n - j / m);
    const s = sim(b[i - 1], v[j - 1]) * 2 - 0.25 + prior;
    dp[i][j] = Math.max(dp[i - 1][j - 1] + s, dp[i - 1][j] + GAP, dp[i][j - 1] + GAP);
  }
  const map: number[] = new Array(m).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const prior = -0.18 * Math.abs(i / n - j / m);
    const s = sim(b[i - 1], v[j - 1]) * 2 - 0.25 + prior;
    if (Math.abs(dp[i][j] - (dp[i - 1][j - 1] + s)) < 1e-9) { map[j - 1] = i - 1; i--; j--; }
    else if (Math.abs(dp[i][j] - (dp[i - 1][j] + GAP)) < 1e-9) i--;
    else j--;
  }
  let last = 0;
  for (let k = 0; k < m; k++) { if (map[k] >= 0) last = map[k]; else map[k] = last; }
  return map;
}

// ---------- 主資料 ----------
const catalog = readFileSync(`${CORPUS}\\jingqun\\catalog.tsv`, 'utf8')
  .split(/\r?\n/).slice(1).filter(Boolean)
  .map((l) => { const p = l.split('\t'); return { idx: +p[0], vol: p[1], no: p[2], title: p[6], author: p[7] }; });

const teiAll = readFileSync(`${CORPUS}\\tei-all.txt`, 'utf8');
const xzAll = readFileSync(`${CORPUS}\\wxzj-tei-2026R2.txt`, 'utf8');
const ysAll = readFileSync(`${CORPUS}\\ys-text-full.txt`, 'utf8');

function booksOf(source: string) {
  const re = /<段\/><書 id="n(\d+)">([^<]*)<\/書>/g;
  let m: RegExpExecArray | null;
  const marks: { id: number; title: string; start: number }[] = [];
  while ((m = re.exec(source))) marks.push({ id: +m[1], title: m[2], start: m.index + m[0].length });
  return marks.map((x, k) => ({ ...x, end: k + 1 < marks.length ? marks[k + 1].start : source.length }));
}
const teiBooks = booksOf(teiAll);
const xzBooks = booksOf(xzAll);

const fen = readFileSync(`${CORPUS}\\jingqun\\jingang-fen.tsv`, 'utf8').split(/\r?\n/).filter(Boolean)
  .map((l) => { const p = l.split('\t'); return { n: +p[0], title: p[1] }; });

console.log('parse vcpp …');
type Book = { id: number; title: string; start: number; end: number };
const refFiles: [string, string, string, string, () => string][] = [
  ['vcpp.off', 'T0235', '羅什', '姚秦 鳩摩羅什譯', () => teiAll.slice(teiBooks.find((x) => x.id === 245)!.start, teiBooks.find((x) => x.id === 245)!.end)],
  ['vcpp_ruci.off', 'T0236a', '留支', '元魏 菩提留支譯', () => teiAll.slice(teiBooks.find((x) => x.id === 246)!.start, teiBooks.find((x) => x.id === 246)!.end)],
  ['vcpp_paramartha.off', 'T0237', '真諦', '陳 真諦譯', () => teiAll.slice(teiBooks.find((x) => x.id === 248)!.start, teiBooks.find((x) => x.id === 248)!.end)],
  ['vcpp_gupta.off', 'T0238', '笈多', '隋 笈多譯', () => teiAll.slice(teiBooks.find((x) => x.id === 249)!.start, teiBooks.find((x) => x.id === 249)!.end)],
  ['vcpp_xuanzang.off', 'T0220(9)', '玄奘', '唐 玄奘譯', () => {
    const b = teiBooks.find((x) => x.id === 230)!;
    const t = teiAll.slice(b.start, b.end);
    const i = t.indexOf('卷第五百七十七');
    const j = t.indexOf('卷第五百七十八', i);
    return t.slice(i, j > 0 ? j : t.length);
  }],
  ['vcpp_yijing.off', 'T0239', '義淨', '唐 義淨譯', () => teiAll.slice(teiBooks.find((x) => x.id === 250)!.start, teiBooks.find((x) => x.id === 250)!.end)],
];

const versions: any[] = [];
for (const [file, id, label, trans, getChunk] of refFiles) {
  const refs = parseVcpp(file);
  let { text, pages } = extractText(getChunk());
  // 去掉卷尾經題與後序：先看「信受奉行」後還剩多少
  const p = text.lastIndexOf('信受奉行');
  if (p > 1000) {
    const tail = text.length - (p + 4);
    if (tail > 60) text = text.slice(0, p + 4); // 後序／跋
  } else {
    const q = text.lastIndexOf('大歡喜');
    if (q > 1000) text = text.slice(0, q + 3);
  }
  text = text.replace(/(佛說能斷金剛般若波羅蜜多經|能斷金剛般若波羅蜜多經|金剛般若波羅蜜經|金剛能斷般若波羅蜜經|實相般若波羅蜜經)$/, '');
  const sents = segment(text, pages, refs);
  console.log(`${id} ${label}: refs=${refs.length} sents=${sents.length} text=${text.length}`);
  versions.push({ id, label, trans, group: id === 'T0235' ? 'base' : 'guyi', lang: 'zh', text, pages, sents });
}

const base = versions[0];
base.sents.forEach((s: Sent, i: number) => { s.u = i; });
const baseUnits = base.sents as Sent[];

for (const v of versions.slice(1)) {
  const map = alignUnits(baseUnits, v.sents);
  v.sents.forEach((s: Sent, i: number) => { s.u = map[i]; });
}

// ---------- 其他譯本（外部 JSON：conze-en.json / muller.json / jinyi.json） ----------
// 每筆 [{t,u,sec}]，u 已對到羅什句。lang: en 用空格接句子，zh 直接相接。
const EXTRA: { id: string; label: string; group: string; trans: string; file: string; lang: 'en' | 'zh' }[] = [
  { id: 'CONZE', label: 'Conze', group: 'eng', trans: 'Edward Conze 英譯（Buddhist Wisdom Books, London 1958）', file: 'conze-en.json', lang: 'en' },
  { id: 'CTZEN', label: '中台', group: 'eng', trans: '中台山英譯（Chung Tai Translation Committee, 2009）', file: 'ctzen.json', lang: 'en' },
  { id: 'CHENGGUAN', label: '成觀', group: 'eng', trans: '成觀法師英譯（The Diamond Sutra, 修訂第三版 2010）', file: 'chengguan.json', lang: 'en' },
  { id: 'MULLER', label: 'Muller', group: 'eng', trans: 'A. Charles Muller 英譯（2013）', file: 'muller.json', lang: 'en' },
  { id: 'JY', label: '今譯', group: 'jinyi', trans: '白話現代文（顯密文庫「金剛經·現代文」）', file: 'jinyi.json', lang: 'zh' },
];
for (const ex of EXTRA) {
  const p = `${OUT_DIR}\\${ex.file}`;
  if (!existsSync(p)) { console.warn(`略過 ${ex.id}：找不到 ${ex.file}`); continue; }
  const rows = JSON.parse(readFileSync(p, 'utf8')) as { t: string; u: number; sec: number; page?: number }[];
  versions.push({
    id: ex.id,
    label: ex.label,
    group: ex.group,
    lang: ex.lang,
    trans: ex.trans,
    text: rows.map((s) => s.t).join(ex.lang === 'en' ? ' ' : ''),
    pages: [],
    sents: rows.map((s) => ({
      t: s.t, u: s.u, sec: s.sec,
      p: s.page ? `英 ${s.page}` : '',
    })),
  });
  console.log(`${ex.id}: fragments=${rows.length} units=${new Set(rows.map((s) => s.u)).size}`);
}

// ---------- 注疏名單 ----------
interface WorkMeta { id: string; title: string; author: string; no: string; vol: string; corpus: string; kind: string; base: string; }
const DYNASTY: Record<string, number> = {
  '東晉': 317, '晉': 265, '梁': 502, '陳': 557, '北魏': 386, '元魏': 386,
  '隋': 581, '唐': 618, '宋': 960, '元': 1271, '明': 1368, '清': 1644, '民國': 1912,
};
function dateYear(author: string) {
  // 朝代多半在開頭，但「天親菩薩造 元魏 菩提流支譯」這類寫法在前面，
  // 所以不鎖 ^；替代順序要把「元魏」放在「元」前面。
  const m = /(東晉|北魏|元魏|民國|晉|梁|陳|隋|唐|宋|元|明|清)/.exec(author);
  if (!m) return { date: '', year: 0 };
  return { date: m[1], year: DYNASTY[m[1]] ?? 0 };
}
const worksMeta: WorkMeta[] = [
  { id: 'T1700', title: '金剛般若經贊述', author: '唐 窺基撰', no: 'T1700', vol: '33', corpus: '大正藏', kind: '注疏', base: 'T0235' },
  { id: 'T1701', title: '金剛般若經疏論纂要', author: '唐 宗密述 宋 子璿治定', no: 'T1701', vol: '33', corpus: '大正藏', kind: '注疏', base: 'T0235' },
  { id: 'T1703', title: '金剛般若波羅蜜經註解', author: '明 宗泐．如同註', no: 'T1703', vol: '33', corpus: '大正藏', kind: '注疏', base: 'T0235' },
  { id: 'T2732', title: '梁朝傅大士頌金剛經', author: '梁 傅大士頌', no: 'T2732', vol: '85', corpus: '大正藏', kind: '頌', base: 'T0235' },
  { id: 'T1511', title: '金剛般若波羅蜜經論', author: '天親菩薩造 元魏 菩提流支譯', no: 'T1511', vol: '25', corpus: '大正藏', kind: '注疏', base: 'T0236a' },
  { id: 'T1510B', title: '金剛般若波羅蜜經論', author: '無著菩薩造 隋 達磨笈多譯', no: 'T1510b', vol: '25', corpus: '大正藏', kind: '注疏', base: 'T0236a' },
  { id: 'T1704', title: '金剛般若波羅蜜經略疏', author: '唐 智儼述', no: 'T1704', vol: '33', corpus: '大正藏', kind: '注疏', base: 'T0236a' },
];

const xzMeta: [string, string, string][] = [
  ['454', '金剛經註', '東晉 僧肇注'], ['459', '金剛經解義', '唐 慧能解義'], ['461', '金剛經註', '宋 道川頌並著語'],
  ['464', '金剛經采微', '宋 曇應述'], ['466', '金剛疏科釋', '元 徐行善科'], ['468', '金剛經註解', '明 洪蓮編'],
  ['471', '金剛經宗通', '明 曾鳳儀宗通'], ['474', '金剛經決疑', '明 德清撰'], ['475', '金剛經鎞', '明 廣伸述'],
  ['478', '金剛經筆記', '明 如觀註'], ['479', '金剛經破空論', '明 智旭造論'], ['482', '金剛經略疏', '明 元賢述'],
  ['456', '金剛經註疏', '唐 慧淨註'], ['483', '金剛經音釋直解', '明 圓杲解註'], ['485', '金剛經如是解', '清 無是道人註解'], ['486', '金剛經會解了義', '清 徐昌治纂'],
  ['487', '金剛新眼疏經偈合釋', '清 通理述'], ['488', '金剛經郢說', '清 徐發詮次'], ['489', '金剛經註正訛', '清 仲之屏彙纂'],
  ['490', '金剛經淺解', '清 翁春．王錫琯解釋'], ['491', '金剛經疏記科會', '唐 宗密疏 宋 子璿記 清 大璸科會'],
  ['493', '金剛經部旨', '清 靈耀撰'], ['494', '金剛經註釋', '清 溥仁乩書 子真乩訂'], ['495', '金剛經演古', '清 寂燄述'],
  ['496', '金剛經直說', '清 迹刪鷲述'], ['497', '金剛經石注', '清 石成金撰集'], ['503', '金剛經注解', '清 孚佑帝君註解'],
  ['504', '金剛經彙纂', '清 孫念劬纂'], ['505', '金剛經心印疏', '清 溥畹述'], ['506', '金剛經注', '清 俞樾註'],
  ['509', '金剛經解義', '清 徐槐廷述'], ['510', '金剛經易解', '清 謝承謨註釋'],
];
for (const [no, title, author] of xzMeta) {
  const kind = (no === '466' || no === '491') ? '科判' : '注疏';
  worksMeta.push({ id: 'X' + no, title, author, no: 'X' + no, vol: no <= '468' ? '24' : '25', corpus: '卍續藏', kind, base: 'T0235' });
}
worksMeta.push({ id: 'Y01', title: '般若經講記', author: '釋印順講 演培記', no: 'Y01n0001', vol: 'Y01', corpus: '印順', kind: '講記', base: 'T0235' });
worksMeta.push({ id: 'CIZHOU', title: '金剛般若波羅蜜經中道了義疏', author: '民國 慈舟法師講述', no: 'XIANMI-2805', vol: '—', corpus: '顯密文庫', kind: '注疏', base: 'T0235' });

// ---------- 取作品全文 ----------
const xzByNo = new Map<string, { start: number; end: number; title: string }>();
for (const b of xzBooks) {
  const m = /No\.\s*([0-9]+[a-z]?)/.exec(xzAll.slice(b.start, Math.min(b.end, b.start + 3000)));
  if (m) xzByNo.set(m[1], b);
}
const ysStart = ysAll.indexOf('<章 t="節,項." u="文">金剛般若波羅蜜經講記</章>');
const ysEnd = ysAll.indexOf('<章 t="節,項." u="文">般若波羅蜜多心經講記</章>');
console.log('yinshun', ysStart, ysEnd);

const works: any[] = [];
for (const wm of worksMeta) {
  let text: string, pages: { id: string; at: number }[];
  if (wm.corpus === '大正藏') {
    const c = catalog.find((c) => c.no === wm.no.replace('T', '').toLowerCase())!;
    const b = teiBooks.find((x) => x.id === c.idx)!;
    ({ text, pages } = extractText(teiAll.slice(b.start, b.end)));
  } else if (wm.corpus === '卍續藏') {
    const b = xzByNo.get(wm.no.replace('X', ''))!;
    ({ text, pages } = extractText(xzAll.slice(b.start, b.end)));
  } else if (wm.corpus === '顯密文庫') {
    // 慈舟《中道了義疏》：本地純文字（src/cizhou-body.txt，由 build/make_cizhou.py 產生）
    const f = `${OUT_DIR}\\src\\cizhou-body.txt`;
    text = existsSync(f) ? readFileSync(f, 'utf8').replace(/\s+/g, '') : '';
    pages = [];
  } else {
    ({ text, pages } = extractText(stripYinshunKe(ysAll.slice(ysStart, ysEnd))));
  }
  works.push({ ...wm, text, pages, anchors: [] as any[] });
}

// ---------- 句下注錨定 ----------
function anchorWork(w: any, queryUnits: { t: string; u: number }[]) {
  const QN = queryUnits.map((q) => norm(q.t));
  const starts: number[] = [];
  let acc = 0;
  for (const s of QN) { starts.push(acc); acc += s.length; }
  const { mapPos } = buildChain(QN.join(''), norm(w.text));
  const nm = normMap(w.text);
  const qToRaw = (q: number) => nm.map[Math.max(0, Math.min(q, nm.text.length - 1))] ?? 0;
  const tmp: { u: number; qs: number; qe: number }[] = [];
  for (let i = 0; i < queryUnits.length; i++) {
    const qs = mapPos(starts[i]);
    if (qs < 0) continue;
    const qe = Math.min(nm.text.length, qs + QN[i].length);
    tmp.push({ u: queryUnits[i].u, qs, qe });
  }
  const groups: { s: number; e: number }[] = [];
  let gs = 0;
  for (let i = 0; i < tmp.length; i++) {
    const next = tmp[i + 1];
    if (!next || Math.abs(next.qs - tmp[i].qe) > 2) { groups.push({ s: gs, e: i }); gs = i + 1; }
  }
  const out: any[] = [];
  for (let g = 0; g < groups.length; g++) {
    const { s, e } = groups[g];
    const a = qToRaw(tmp[e].qe);
    const nxt = groups[g + 1];
    const b = nxt ? qToRaw(tmp[nxt.s].qs) : Math.min(w.text.length, a + 4000);
    if (b <= a + 10) continue;
    for (let k = s; k <= e; k++) {
      // 若跨度內已出現下一句經文，截在該句之前
      let bb = b;
      const nq = queryUnits.find((x) => x.u === tmp[k].u + 1);
      if (nq) {
        const pfx = norm(nq.t).slice(0, 12);
        if (pfx.length >= 8) {
          const p = nm.text.indexOf(pfx, tmp[e].qe);
          if (p >= 0) { const rb = qToRaw(p); if (rb > a && rb < bb) bb = rb; }
        }
      }
      out.push([tmp[k].u, a, bb, pageAt(w.pages, a)]);
    }
  }
  return out;
}

const t236 = versions[1];
for (const w of works) {
  const queries = w.base === 'T0236a'
    ? t236.sents.map((s: Sent) => ({ t: s.t, u: s.u }))
    : baseUnits.map((s: Sent, i: number) => ({ t: s.t, u: i }));
  const raw = anchorWork(w, queries);
  // 同一句（同一 u）合併為一個跨度
  const merged = new Map<number, [number, number, string]>();
  for (const [u, a, b, p] of raw) {
    const cur = merged.get(u);
    if (!cur) merged.set(u, [a, b, p]);
    else { cur[0] = Math.min(cur[0], a); cur[1] = Math.max(cur[1], b); }
  }
  w.anchors = [...merged.entries()].map(([u, v]) => [u, v[0], v[1], v[2]]);
  console.log(`${w.id} ${w.title}: anchors=${w.anchors.length}`);
}

// ---------- 輸出 ----------
// ---------- 梵文注解（PDF）對到句 ----------
const pdfRaw = JSON.parse(readFileSync('D:\\2026\\zhu-combined\\pdf-entries.json', 'utf8'));
const pdfQN = pdfRaw.map((e: any) => norm(e.shi || ''));
const pdfStarts: number[] = [];
let pacc = 0;
for (const x of pdfQN) { pdfStarts.push(pacc); pacc += x.length; }
const unitStarts: number[] = [];
let uacc = 0;
for (const u of baseUnits) { unitStarts.push(uacc); uacc += norm(u.t).length; }
const baseAll = baseUnits.map((u) => norm(u.t)).join('');
const { mapPos: pdfMap } = buildChain(pdfQN.join(''), baseAll);
const unitEnds = unitStarts.map((x, i) => x + norm(baseUnits[i].t).length);

// 使用者校訂的逐詞義（surface \t zh \t note）
const GLOSS_PATH = 'D:\\2026\\zhu-combined\\gloss-overrides.tsv';
const GLOSS = new Map<string, { zh: string; nt: string }>();
const glossKey = (x: string) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
if (existsSync(GLOSS_PATH)) {
  for (const line of readFileSync(GLOSS_PATH, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || /^surface\t/.test(line)) continue;
    const p = line.split('\t');
    if (p[0] && p[1] !== undefined) GLOSS.set(glossKey(p[0]), { zh: p[1], nt: p[2] || '' });
  }
}
function applyGloss(words: any[]) {
  for (const w of words) {
    const g = GLOSS.get(glossKey(w.s)) || GLOSS.get(glossKey(w.l || ''));
    if (g) {
      if (w.zh !== g.zh) { w.zh0 = w.zh; w.zh = g.zh; }
      if (g.nt) w.nt = g.nt;
    }
    const raw = String(w.s || '').includes('-') ? w.s : String(w.l || '');
    const seq = raw.split('-').filter((x: string) => x && x !== '√bhū');
    if (seq.length > 1) {
      const parts = seq.map((p: string) => ({ s: p, zh: (GLOSS.get(glossKey(p)) || { zh: '' }).zh }));
      if (parts.some((p: any) => p.zh)) w.parts = parts;
    }
  }
  return words;
}

function parseNote(note: string) {
  const words: any[] = [];
  const parts = String(note || '').split(/\n(?=\d+、)/);
  const SA = /^[A-Za-z\u00C0-\u024F\u1E00-\u1EFF'’\-]+/;
  const POS_END = /(體格|屬格|具格|為格|從格|依格|呼格|業格|因格|於格|單數|複數|雙數|陽性|中性|陰性|第一人稱|第二人稱|第三人稱|完成式|祈願|命令|現在式|未來式|過去式|被動|主動|致使|分詞|形容詞|副詞|名詞|代詞|數詞|小品詞)/g;
  for (const part of parts) {
    const m = /^(\d+)、([\s\S]*)$/.exec(part.trim());
    if (!m) continue;
    const body = m[2].trim();
    const sm = /^([A-Za-z\u00C0-\u024F\u1E00-\u1EFF'’\-]+)(?:\s*[（(]([^）)]*)[）)])?/.exec(body);
    if (!sm) continue;
    const surface = sm[1].trim();
    const lemma = sm[2] ? sm[2].trim() : '';
    let rest = body.slice(sm[0].length).replace(/^[\s：:，,。.、]+/, '');

    let pos = '', rem = '';
    const dot = rest.indexOf('。');
    if (dot >= 0) {
      pos = rest.slice(0, dot).trim();
      rem = rest.slice(dot + 1);
    } else {
      const colon = rest.search(/[：:]/);
      if (colon >= 0) {
        pos = rest.slice(0, colon).trim();
        rem = rest.slice(colon + 1);
      } else {
        // 有些行沒有「。」，POS 後面直接接詞義（例：kasya … 屬格何、什麼）
        let last: RegExpExecArray | null = null;
        let mm: RegExpExecArray | null;
        POS_END.lastIndex = 0;
        while ((mm = POS_END.exec(rest))) last = mm;
        if (last && last.index > 0) {
          pos = rest.slice(0, last.index + last[1].length).trim();
          rem = rest.slice(last.index + last[1].length).replace(/^[、，,。.\s]+/, '');
        } else {
          pos = rest.trim();
          rem = '';
        }
      }
    }

    const tm = /[\u0F00-\u0FFF][\u0F00-\u0FFF\s་།]*/.exec(rem);
    let zh = '', tib = '', en = '';
    if (tm) {
      tib = tm[0].replace(/\s+$/, '').trim();
      zh = rem.slice(0, tm.index).replace(/[，,、\s]+$/, '').trim();
      en = rem.slice(tm.index + tm[0].length).replace(/^[，,、.。\s]+/, '').trim();
    } else {
      const seg = rem.split(/[，,]/).map((x) => x.trim()).filter(Boolean);
      zh = seg.shift() || '';
      en = seg.join('，');
    }
    if (!SA.test(surface)) continue;
    let cat = 'o';
    if (/分詞|動詞|致使|√/.test(pos)) cat = 'v';
    else if (/形容詞/.test(pos)) cat = 'a';
    else if (/名詞|代詞|數詞/.test(pos)) cat = 'n';
    words.push({ i: +m[1], s: surface, l: lemma, p: pos, c: cat, zh, tib, en });
  }
  return words;
}

const pdfOut = pdfRaw.map((e: any, i: number) => {
  const pos = pdfMap(pdfStarts[i]);
  let u = -1;
  if (pos >= 0 && !/缺譯/.test(e.shi || '')) {
    let lo = 0, hi = unitStarts.length - 1, best = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (unitStarts[mid] <= pos) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    u = best;
    // 邊界句：就近找真正包含這段文字的句
    const head = norm(e.shi || '').slice(0, 10);
    if (head.length >= 6) {
      for (let d = 0; d <= 2; d++) {
        const cand = [u - d, u + d].filter((x) => x >= 0 && x < baseUnits.length);
        const hit = cand.find((x) => norm(baseUnits[x].t).includes(head));
        if (hit !== undefined) { u = hit; break; }
      }
    }
  }
  // 這筆 PDF 句只掛到「重疊最多」的那一個 unit：
  // 一條梵文若跨兩句（例如 2-3 起於「希有世尊」、大半在下一句），
  // 兩邊都顯示會重複同一段梵文，也會讓 hover 看起來在兩處連動。
  const us: number[] = [];
  if (pos >= 0) {
    const p1 = pos + Math.max(1, pdfQN[i].length);
    let bestK = -1, bestOv = 0;
    for (let k = 0; k < baseUnits.length; k++) {
      const ov = Math.min(p1, unitEnds[k]) - Math.max(pos, unitStarts[k]);
      if (ov > bestOv) { bestOv = ov; bestK = k; }
    }
    if (bestK >= 0 && bestOv >= 4) us.push(bestK);
  }
  return { ...e, u, us, words: applyGloss(parseNote(e.note)) };
});
console.log('pdf entries', pdfOut.length, 'mapped', pdfOut.filter((e) => e.u >= 0).length);

const data = {
  generated: new Date().toISOString(),
  sections: fen.map((f) => ({ n: f.n, title: f.title })),
  versions: versions.map((v) => ({
    id: v.id, label: v.label, trans: v.trans, group: v.group || 'guyi', lang: v.lang || 'zh',
    sents: v.sents.map((s: Sent) => ({ t: s.t, u: s.u, s: baseUnits[s.u]?.sec ?? s.sec, p: s.p })),
  })),
  pdf: pdfOut,
  works: works.map((w) => {
    const dy = w.id === 'Y01' ? { date: '民國31年（1942）', year: 1942 } : dateYear(w.author);
    return {
      id: w.id, title: w.title, author: w.author, date: dy.date, year: dy.year,
      corpus: w.corpus, no: w.no, vol: w.vol, kind: w.kind, base: w.base,
      text: w.text, pages: w.pages, anchors: w.anchors,
    };
  }),
};
mkdirSync(OUT_DIR, { recursive: true });
const js = 'window.ZHU=' + JSON.stringify(data) + ';\n';
writeFileSync(`${OUT_DIR}\\zhu-data.js`, js);
console.log('wrote', (js.length / 1024 / 1024).toFixed(2), 'MiB');

