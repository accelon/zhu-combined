// 掃注疏：哪幾家有自己的分科（科文），用什麼標記法
// 這些文本是沒有換行的長字串，科文靠行內符號：「△」開科、「初／二／三、」列科、
// 「分二／分三：」分科。這支只做統計與取樣，不解析。
//   node build/scan-kepan.mjs
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const works = D.works.filter((w) => w.text);

const cnt = (s, re) => (s.match(re) || []).length;
const rows = works.map((w) => {
  const t = w.text;
  return {
    w,
    tri: cnt(t, /△/g),                                  // 開科符號
    fen: cnt(t, /分[二三]科?[:：]|分為[二三]|開為[二三]|大科[^。]{0,4}分/g),
    chu: cnt(t, /(?:^|[。：；】])(初|二|三|四|五|六|七|八|九|十)、/g), // 「初、」「二、」列科
    shu: cnt(t, /【疏】/g),                              // 宗密疏／子璿記 的分層標記
    ji: cnt(t, /【記】/g),
    san: cnt(t, /序分|正宗分|流通分/g),
    len: t.length,
  };
});
rows.sort((a, b) => (b.tri + b.fen * 2 + b.chu) - (a.tri + a.fen * 2 + a.chu));

const name = (w) => (w.author + '《' + w.title + '》').replace(/\s+/g, ' ');
console.log('注疏裡的分科跡象（只看計數，△＝開科、初/二/三、＝列科、分二/分三＝分科）\n');
console.log('  △   分科語  列科   【疏】/【記】  三分   字數     著作');
console.log('-'.repeat(104));
for (const r of rows.slice(0, 22)) {
  console.log(
    String(r.tri).padStart(4) + String(r.fen).padStart(8) + String(r.chu).padStart(7) +
    (r.shu || r.ji ? String(r.shu + '/' + r.ji).padStart(12) : ' '.repeat(12)) +
    String(r.san).padStart(6) + String(r.len).padStart(9) + '   ' + name(r.w).slice(0, 38)
  );
}
console.log('-'.repeat(104));

// 取樣：第一個含「分二／分三」的 △ 段
console.log('\n樣本（△ 開頭那一段的前 90 字）：');
for (const r of rows.slice(0, 6)) {
  const m = /△[^△]{0,90}/.exec(r.w.text);
  if (m) console.log('  ' + name(r.w).slice(0, 24) + '\n    ' + m[0].replace(/\s+/g, ' ') + '\n');
}
