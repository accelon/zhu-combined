// 從 zhu-data.js 抽出「pdf-entries 對到 unit」的資料，給 build/conze-align.py 用。
// 用法：node build/dump-pdf-u.mjs  → build/_pdf-u.json
import fs from 'node:fs';

globalThis.window = {};
await import('../zhu-data.js');

const D = globalThis.window.ZHU;
const out = {
  pdf: D.pdf.map((e) => ({
    no: e.no,
    u: e.u,
    sa: e.sa,
    shi: e.shi,
    en: (e.words || []).map((w) => w.en || ''),
  })),
  units: D.versions[0].sents.map((s, i) => ({ u: i, sec: s.s, t: s.t })),
};
fs.writeFileSync(new URL('./_pdf-u.json', import.meta.url), JSON.stringify(out), 'utf8');
console.log('wrote build/_pdf-u.json', out.pdf.length, out.units.length);
