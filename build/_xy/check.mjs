import fs from 'node:fs';
const K = JSON.parse(fs.readFileSync('D:/2026/vcpp/kepan/kepan-data.js', 'utf8').replace(/^window\.KEPAN=/, '').replace(/;\s*$/, ''));
const x = K.editions.find((e) => e.id === 'xinyan');
console.log('editions:', K.editions.map((e) => `${e.id}(${e.nodes.length})`).join(' '));
console.log('xinyan: nodes', x.nodes.length, 'roots', x.roots.length, 'linked', x.linked, 'nk', x.nodes.filter((n) => n.nk).length);
console.log('first 4:', x.nodes.slice(0, 4).map((n) => `${n.nm}@${n.u}${n.nk ? '(nk)' : ''}`).join('  '));
console.log('last 2:', x.nodes.slice(-2).map((n) => `${n.nm}@${n.u}:${n.off}-${n.u2}:${n.o2}`).join('  '));
const bad = x.nodes.filter((n) => !n.nk && (n.u < 0 || n.u >= 215));
console.log('out-of-range:', bad.length);
