import fs from 'node:fs';
const ROOT = 'D:\\2026\\vcpp';
const D = JSON.parse(fs.readFileSync(ROOT + '\\zhu-data.js', 'utf8').replace(/^window\.ZHU=/, '').replace(/;\s*$/, ''));
const S = D.versions[0].sents;
const K = JSON.parse(fs.readFileSync(ROOT + '\\kepan\\xinyan.json', 'utf8'));
const byId = new Map(K.nodes.map((n) => [n.id, n]));
const root = K.nodes.filter((n) => n.par == null).map((n) => n.id);
const out = [];
(function dfs(ids) {
  for (const id of ids) {
    const n = byId.get(id);
    const t = S[n.u].t.slice(n.off, n.off + 12);
    out.push(`${'  '.repeat(n.lv - 1)}${n.lab}${n.nm}  〔${n.u}:${n.off}〕${t}`);
    if (n.ch.length) dfs(n.ch);
  }
})(root);
fs.writeFileSync('build/_xy/xinyan-view.txt', out.join('\n'), 'utf8');
console.log(out.slice(0, 40).join('\n'));
console.log('... total', out.length);
