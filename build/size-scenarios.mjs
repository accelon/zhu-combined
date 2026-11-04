// 「如果砍成這樣會剩多少」試算
import fs from 'node:fs';
import zlib from 'node:zlib';

const h = fs.readFileSync('vcpp-kepan.html', 'utf8');
const i = h.indexOf('id="zhu-b64"');
const s = h.indexOf('>', i) + 1;
const e = h.indexOf('</script>', s);
const obj = JSON.parse(zlib.gunzipSync(Buffer.from(h.slice(s, e), 'base64')).toString('utf8'));
const zhu = obj.zhu;
const fileSize = Buffer.byteLength(h);
const b64Of = (n) => Math.ceil(n / 3) * 4;
const gz = (v) => zlib.gzipSync(Buffer.from(JSON.stringify(v), 'utf8'), { level: 9 }).length;

const worksGz = gz(zhu.works.map((w) => w.text || ''));
const pdfGz = gz(zhu.pdf);
const base = fileSize;

const num = (n) => n.toLocaleString('en-US');
const row = (label, gzNow, note) => {
  const deltaB64 = b64Of(worksGz + pdfGz) - b64Of(gzNow * 0 + 0) // 佔位
  ;
};
// 直接算：每個情境的 works text gzip
function worksGzWith(fn) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(zhu.works.map((w, i) => fn(w.text || '', i, w))), 'utf8'), { level: 9 }).length;
}
const scenarios = [];
const add = (label, worksGzNew, pdfNew, note) => {
  // 檔案大小變化 ≈ base64(新總 gzip) 與現在差
  const nowData = worksGz + pdfGz;                  // 兩大塊合計（現在的 gzip）
  const newData = worksGzNew + pdfNew;
  const deltaFile = b64Of(newData) - b64Of(nowData); // 負數＝變小
  scenarios.push({ label, file: base + deltaFile, delta: deltaFile, note });
};

add('現況', worksGz, pdfGz, '');
for (const n of [20000, 30000, 40000, 60000]) {
  add('每家中段截短到 ' + (n / 1000) + 'k 字', worksGzWith((t) => t.slice(0, n)), pdfGz, '全文仍在資料源，只是單檔收一半');
}
add('去掉梵藏逐詞（pdf）', worksGz, 0, '失去梵文逐詞／詞組頁／梵文高亮');
const dropBig = new Set(zhu.works.filter((w) => (w.text || '').length > 80000).map((w) => w.id));
add('去掉 8 部 8 萬字以上的大部頭', worksGzWith((t, i, w) => (dropBig.has(w.id) ? '' : t)), pdfGz,
  '那幾家只留書目與錨點（點開顯示「輕量版：全文未收錄」）');
add('注疏全部只留書目與錨點', worksGzWith(() => ''), pdfGz, '只剩「有哪幾家、對到哪幾句」，沒有內文');

console.log('情境                          單檔大小      變化      說明');
console.log('-'.repeat(96));
for (const sc of scenarios) {
  console.log(
    sc.label.padEnd(28) +
    num(sc.file).padStart(12) +
    ((sc.delta >= 0 ? '+' : '') + num(sc.delta)).padStart(12) + '  ' + sc.note
  );
}
console.log('-'.repeat(96));
console.log('（還有：伺服器開 gzip，單檔 3,063,854 → 2,237,829，−27%，功能完全不變）');
