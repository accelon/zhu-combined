#!/usr/bin/env bun
/**
 * 針對「一切賢聖皆以無為法而有差別」產生書證彙編（Markdown）。
 * 讀 zhu-combined/zhu-data.js、pdf-entries.json、docx-text.txt。
 *
 * 用法（在 D:\2026\zhu-combined 執行）：bun run build/research.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'D:\\2026\\zhu-combined';
const dataJs = readFileSync(`${DIR}\\zhu-data.js`, 'utf8');
const D = JSON.parse(dataJs.replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const U = 38;

const docx = readFileSync(`${DIR}\\docx-text.txt`, 'utf8');
const pdfEntry = (D.pdf || []).find((e: any) => e.no === '7-5');

const cards: any[] = [];
for (const w of D.works) {
  const a = w.anchors.find((x: any) => x[0] === U);
  if (a && w.kind !== '科判') cards.push({ w, a });
}
cards.sort((x, y) => (x.w.year || 9999) - (y.w.year || 9999) || x.w.title.localeCompare(y.w.title));

const DOCX_IDS = new Set(['X454', 'X504', 'T1700', 'T1701', 'X459']);
const DOCX_NAMES = ['吉藏', '澄觀', '王日休', '顏丙', '李文會', '江味農', '慧能', '六祖', '僧肇', '窺基', '宗密'];
const isDocx = (w: any) => DOCX_IDS.has(w.id) || DOCX_NAMES.some((n) => (w.author + w.title).includes(n));

const startOf = (w: any, a: number) => {
  const t = w.text;
  const m = Math.max(t.lastIndexOf('。', a), t.lastIndexOf('！', a), t.lastIndexOf('？', a));
  return m >= a - 160 ? m + 1 : a;
};
const excerpt = (t: string, n: number) => {
  const s = t.replace(/\s+/g, '').replace(/^[，。、；：！？」』）】]+/, '');
  return s.length > n ? s.slice(0, n) + '…' : s;
};

// 書證線索
const PEOPLE = ['無著', '天親', '世親', '真諦', '窺基', '宗密', '子璿', '智旭', '德清', '僧肇', '慧能', '六祖', '王日休', '顏丙', '李文會', '江味農', '澄觀', '吉藏', '道川', '傅大士', '彌勒', '功德施', '天台', '智者', '圭峰', '長水'];
const STOP_T = new Set(['金剛經', '金剛般若波羅蜜經', '金剛般若經', '金剛般若波羅蜜多經', '能斷金剛般若波羅蜜多經']);
const cite = new Map<string, { n: number; works: Set<string> }>();
for (const { w, a } of cards) {
  const t = w.text.slice(a[1], a[2]);
  for (const m of t.matchAll(/《([^》]{2,24})》/g)) {
    const term = m[1];
    if (STOP_T.has(term)) continue;
    if (!cite.has(term)) cite.set(term, { n: 0, works: new Set() });
    const x = cite.get(term)!; x.n++; x.works.add(w.title);
  }
  for (const m of t.matchAll(/([\u4e00-\u9fa5]{2,4})(?:云|曰)/g)) {
    if (!PEOPLE.includes(m[1])) continue;
    if (!cite.has(m[1])) cite.set(m[1], { n: 0, works: new Set() });
    const x = cite.get(m[1])!; x.n++; x.works.add(w.title);
  }
}
const cites = [...cite.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 30);

// 古註段（docx）
const gz = docx.indexOf('古註：');
const gzEnd = docx.indexOf('【江味農');
const docxGz = gz >= 0 ? docx.slice(gz + 3, gzEnd > gz ? gzEnd : docx.length).trim() : '';

const lines: string[] = [];
lines.push('# 「一切賢聖皆以無為法而有差別」書證彙編');
lines.push('');
lines.push('> 由 zhu-combined MVP 自動整理（昭明三十二分，第 7 分「無得無說」）。');
lines.push('> 梵文注解取自《金剛經梵文注解》（2013，中國人民大學國際佛學研究中心·瀋陽北塔翻譯組）；');
lines.push('> 注疏取自大正藏、卍續藏、印順《般若經講記》。');
lines.push('');
lines.push('## 一、六譯');
lines.push('');
lines.push('| 譯者 | 譯文 |');
lines.push('|---|---|');
lines.push(`| 鳩摩羅什 | ${pdfEntry.shi} |`);
lines.push(`| 菩提流支 | 何以故？一切聖人，皆以無為法得名。 |`);
lines.push(`| 真諦 | 何以故？一切聖人，皆以無為真如所顯現故。 |`);
lines.push(`| 笈多 | 彼何因？無為法顯明聖人。 |`);
lines.push(`| 玄奘 | ${pdfEntry.zang} |`);
lines.push(`| 義淨 | ${pdfEntry.jing} |`);
lines.push('');
lines.push('## 二、梵文與藏譯');
lines.push('');
lines.push('```text');
lines.push(pdfEntry.sa);
lines.push(pdfEntry.tib);
lines.push('```');
lines.push('');
lines.push('**逐詞注**（節錄）');
lines.push('');
lines.push('```text');
lines.push(pdfEntry.note);
lines.push('```');
lines.push('');
lines.push('**解**');
lines.push('');
lines.push('```text');
lines.push(pdfEntry.jie);
lines.push('```');
lines.push('');
lines.push('## 三、原筆記已收的古註');
lines.push('');
lines.push(docxGz);
lines.push('');
lines.push('## 四、MVP 檢出的全部注疏（依年代）');
lines.push('');
lines.push(`共 ${cards.length} 家。標 ★ 者為原筆記未收。`);
lines.push('');
lines.push('| | 朝代 | 書名 | 作者 | 出處 | 摘錄 |');
lines.push('|---|---|---|---|---|---|');
for (const { w, a } of cards) {
  const star = isDocx(w) ? '' : '★';
  const author = w.author.replace(/^(東晉|北魏|元魏|民國|梁|陳|隋|唐|宋|元|明|清)\s*/, '');
  lines.push(`| ${star} | ${w.date || ''} | ${w.title} | ${author} | ${w.corpus} ${w.no}·${a[3]} | ${excerpt(w.text.slice(startOf(w, a[1]), a[2]), 90).replace(/\|/g, '｜')} |`);
}
lines.push('');
lines.push('## 五、新增書證（原筆記未收）');
lines.push('');
const fresh = cards.filter((x) => !isDocx(x.w));
lines.push(`共 ${fresh.length} 家：${fresh.map((x) => x.w.title).join('、')}。`);
lines.push('');
for (const { w, a } of fresh.slice(0, 40)) {
  lines.push(`### ${w.title}（${w.date || '—'} ${w.author}，${w.corpus} ${w.no} ${a[3]}）`);
  lines.push('');
  lines.push(excerpt(w.text.slice(startOf(w, a[1]), a[2]), 260));
  lines.push('');
}
lines.push('## 六、書證線索（這一句的注疏提到的書名與人物）');
lines.push('');
for (const [t, x] of cites) {
  lines.push(`- **${t}**（${x.n}）— ${[...x.works].join('、')}`);
}
lines.push('');
lines.push('## 七、參考講座（原筆記連結）');
lines.push('');
try {
  const talks = readFileSync(`${DIR}\\一切賢聖皆以無為法而有差別.txt`, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const t of talks) lines.push('- ' + t);
} catch (e) {}
lines.push('');
lines.push('## 八、初步觀察');
lines.push('');
lines.push('1. 梵文 `āryapudgalāḥ` 是「聖補特伽羅／聖者」，什譯作「賢聖」，奘譯作「諸賢聖補特伽羅」，淨譯作「諸聖者」。什譯的「賢聖」是漢語化的雙音節，不是梵文有「賢、聖」二類。');
lines.push('2. 核心動詞 `prabhāvitā`（√bhū 致使式）是「所顯、所顯現、所成立」。奘、淨譯「所顯（現）」，笈多譯「顯明」，藏譯「所差別」；什譯「而有差別」是義譯，把「由無為法而安立」轉成「差別」。');
lines.push('3. 因此這一句的爭點不在「有為／無為」的定義，而在：無為法是一，為何有聖者階位差別？注疏大致分三系：');
lines.push('   - **同悟而淺深不同**：僧肇「無為雖一，解有明昧」、彙纂「皆得人法兩空…但三乘差別」、石注「性本無為，悟有淺深」。');
lines.push('   - **依論釋**：宗密引無著「有學得名／無學得名」、天親，說三乘賢聖皆修證無為，故通說差別。');
lines.push('   - **位次配屬**：王日休以淺者為賢、深者為聖；顏丙「法本無為，悟有淺深」；李文會「根有利鈍，學有淺深」；江味農「半滿」。');
lines.push('4. 原筆記已引吉藏《金剛般若疏》、澄觀《演義鈔》，二者不在 40 家消文之列（吉藏疏對經文覆蓋僅 19%，澄觀是《華嚴》疏鈔旁證）。若要擴充「不限消文」的書證層，應另建一個 citation corpus，把 T1699、T1736 這類旁證納入。');
lines.push('5. MVP 新增的 30 家（★）多為明清註疏，其中 X497《石注》、X506《俞樾注》、X510《謝承謨易解》、Y01 印順《講記》對「淺深／位次」的說法最清楚，可補原筆記之未備。');
lines.push('');

const out = `${DIR}\\一切賢聖皆以無為法而有差別-書證.md`;
writeFileSync(out, lines.join('\n'));
console.log('wrote', out, 'cards', cards.length, 'fresh', fresh.length, 'cites', cites.length);
