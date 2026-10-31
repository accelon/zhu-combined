/**
 * Dependency-free checks for the tour format/compiler.
 *
 *   bun run test.ts
 *
 * The player is DOM-heavy; exercise it in a real browser with `example/` once
 * the shell is pasted into an app. This file covers the data layer.
 */
import { resolve } from 'node:path';
import {
  TOUR_FMT, TOUR_MAGIC, LEGACY_MAGICS, OP, OP_NAME, crc32,
  decodeTour, encodeTour, fromBase64, toBase64, type Tour,
} from './format';
import { compileTours, parseTour } from './compiler';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name + (detail ? '  ' + detail : '')); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
};

const sample: Tour = {
  id: 'unit', title: '單元測試', intro: '說明', require: 'ready',
  scenes: [
    { title: '一', body: '第一段\n\n第二段（**粗**、`碼`）', steps: [
      { op: OP.point, args: ['#query'] },
      { op: OP.type, args: ['#query', '般若'] },
      { op: OP.wait, args: ['120'] },
    ] },
    { title: '二', body: '', steps: [{ op: OP.unpoint, args: [] }] },
  ],
};

// ---------------------------------------------------------------- format
{
  const bytes = encodeTour(sample);
  const back = decodeTour(bytes);
  ok('round-trip', JSON.stringify(back) === JSON.stringify(sample), `${bytes.length} bytes`);
  ok('Chinese + emoji survive', back.scenes[0].body.includes('粗') && back.intro === '說明');
  ok('deterministic encoding', toBase64(encodeTour(sample)) === toBase64(encodeTour(sample)));
  ok('base64 round-trip', toBase64(fromBase64(toBase64(bytes))) === toBase64(bytes));
  ok('magic at offset 0', String.fromCharCode(...bytes.subarray(0, 5)) === TOUR_MAGIC);
  const want = (bytes[7] | (bytes[8] << 8) | (bytes[9] << 16) | (bytes[10] << 24)) >>> 0;
  ok('CRC32 in header', want === crc32(bytes.subarray(11)), `${want.toString(16)}`);

  const legacy = encodeTour(sample, LEGACY_MAGICS[0]);
  ok('legacy magic decodes', decodeTour(legacy).id === 'unit');
  ok('custom magic round-trip', decodeTour(encodeTour(sample, 'MYAPP'), 'MYAPP').id === 'unit');
  ok('format version byte', legacy[5] === TOUR_FMT);

  const bad = bytes.slice();
  bad[bad.length - 3] ^= 0x40;
  let msg = '';
  try { decodeTour(bad); } catch (e) { msg = (e as Error).message; }
  ok('corrupt payload → error', /corrupt|CRC/.test(msg), msg);

  const wrongMagic = bytes.slice();
  wrongMagic[0] = 0x58;
  msg = '';
  try { decodeTour(wrongMagic); } catch (e) { msg = (e as Error).message; }
  ok('unknown magic → error', /not a tour macro/.test(msg), msg);

  const wrongFmt = bytes.slice();
  wrongFmt[5] = TOUR_FMT + 7;
  msg = '';
  try { decodeTour(wrongFmt); } catch (e) { msg = (e as Error).message; }
  ok('version mismatch → error', /format/.test(msg) && /update/.test(msg), msg);
  ok('every opcode has a name', Object.values(OP).every((op) => !!OP_NAME[op]));
}

// --------------------------------------------------------------- parser
{
  const src = [
    '@id  demo',
    '@title 示範',
    '# 註解',
    '',
    '### 第一個場景',
    '說明第一行',
    '說明第二行',
    '',
    '> 指向 #query',
    '> 輸入 #query => 般 若',
    '> 等頁面 count:#searchList .snippet >= 2',
    '> 你來 按一下 📁 => api:db',
  ].join('\n');
  const { tour, errors } = parseTour(src, 'demo.tour');
  ok('parse: scene count', tour.scenes.length === 1);
  ok('parse: body keeps line breaks', tour.scenes[0].body === '說明第一行\n說明第二行');
  ok('parse: alias → opcode', tour.scenes[0].steps[0].op === OP.point);
  ok('parse: => splits once', tour.scenes[0].steps[1].args[1] === '般 若');
  ok('parse: comparison number is not a timeout',
    tour.scenes[0].steps[2].args.join('|') === 'count:#searchList .snippet >= 2',
    JSON.stringify(tour.scenes[0].steps[2].args));
  ok('parse: user condition', tour.scenes[0].steps[3].args.join('|') === '按一下 📁|api:db');
  ok('parse: no errors', errors.length === 0, errors.join(' | '));

  const bad = parseTour('### s\n> 飛 #query\n', 'x.tour');
  ok('parse: unknown command has line number', bad.errors.some((m) => /:2/.test(m) && /飛/.test(m)));
  ok('parse: prose outside a scene is an error',
    parseTour('這行沒有去處\n### s\n> 等 100\n', 'x.tour').errors.some((m) => /場景之外/.test(m)));
  ok('parse: @id must match filename',
    parseTour('@id other\n### s\n> 等 100\n', 'x.tour').errors.some((m) => /檔名/.test(m)));

  const badApi = parseTour('### s\n> 需要 api:nope\n', 'x.tour', { apiKeys: ['ready'] });
  ok('parse: unknown api key is rejected', badApi.errors.some((m) => /api:.*nope/.test(m)));
  const badTab = parseTour('### s\n> 分頁 左 nope\n', 'x.tour', { tabNames: ['main'] });
  ok('parse: unknown tab is rejected', badTab.errors.some((m) => /分頁.*nope/.test(m)));
  const badSet = parseTour('### s\n> 設定 nope 1\n', 'x.tour', { setKeys: ['theme'] });
  ok('parse: unknown setting is rejected', badSet.errors.some((m) => /設定.*nope/.test(m)));
  const badCall = parseTour('### s\n> 呼叫 nope\n', 'x.tour', { callNames: ['openSettings'] });
  ok('parse: unknown call is rejected', badCall.errors.some((m) => /函式.*nope/.test(m)));
}

// -------------------------------------------------------------- compiler
{
  const result = compileTours({
    tourDir: resolve(import.meta.dir, 'example/tours'),
    outFile: resolve(import.meta.dir, 'example/tour-data.ts'),
    templateFile: resolve(import.meta.dir, 'example/template.html'),
    formatImport: '../format',
    tabNames: ['main', 'help'],
    apiKeys: ['ready', 'tab'],
    dynamicIds: ['toast'],
    appName: 'Demo',
  });
  ok('compile: no errors', result.errors.length === 0, result.errors.join(' | '));
  ok('compile: one tour', result.tours.length === 1 && result.index[0]?.id === 'welcome');
  ok('compile: generated imports format', result.text.includes("from '../format'"));
  ok('compile: generated has index/blobs',
    result.text.includes('TOUR_INDEX') && result.text.includes('TOUR_BLOBS'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
