// 抓 道源法師《金剛經講記》全文（學佛網 0731–0770），存成純文字。
// 這份講記的科判是《金剛新眼疏》的甲一／乙一…系統（講記開頭自述「依新眼疏分科」），
// 每一科標題後面緊接的就是該科的經文，用來做錨點。
import fs from 'node:fs';

const lines = [];
let pages = 0;
for (let n = 731; n <= 775; n++) {
  const num = String(n).padStart(4, '0');
  const url = `http://www.xuefo.net/asp/putiwenhai/books/${num}.htm`;
  let t;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buf = Buffer.from(await res.arrayBuffer());
    let s = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if ((s.match(/\uFFFD/g) || []).length > 20) s = new TextDecoder('gb18030').decode(buf);
    t = s;
  } catch (e) {
    console.error(num, 'ERR', e.message);
    continue;
  }
  const title = ((t.match(/<title>([^<]*)/i) || [])[1] || '').trim();
  if (!/金刚经讲录/.test(title)) continue;
  const body = t
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  const clean = body.split('\n').map((x) => x.trim()).filter(Boolean);
  lines.push(`\n===== PAGE ${num} ${title} =====\n`);
  lines.push(clean.join('\n'));
  pages++;
  console.error(num, title);
}
fs.writeFileSync('build/_daoyuan-jingang.txt', lines.join('\n'), 'utf8');
console.log('pages', pages);
