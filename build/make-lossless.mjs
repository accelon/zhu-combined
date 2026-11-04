// 從 agent-norms 的 lossless-simplified 產生本專案用的 lossless.js（純 ES5、掛在 window.LOSSLESS）。
//   node build/make-lossless.mjs
// 來源：D:\2026\agent-norms\lossless-simplified\{simplified-data.ts,lossless.ts}
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'D:\\2026\\agent-norms\\lossless-simplified';
const OUT = 'D:\\2026\\zhu-combined\\lossless.js';

const data = fs.readFileSync(path.join(SRC, 'simplified-data.ts'), 'utf8');
const pick = (name) => {
  const m = new RegExp('export const ' + name + ' = "([^"]*)";').exec(data);
  if (!m) throw new Error('抓不到 ' + name);
  return m[1];
};
const safe = pick('SAFE_PAIRS');
const force = pick('FORCE_PAIRS');

const out = `/* 無損簡體（顯示用）— 由 build/make-lossless.mjs 從 agent-norms 產生，不要手改。
 *
 * 來源：agent-norms/lossless-simplified（Unihan kSimplifiedVariant／kTraditionalVariant）
 * 規則：0 原樣、1 無損（只轉一對一；發／髮、乾／幹、臺／台 這類多對一保留原字）、2 強制。
 * 只做顯示與搜尋比對；索引、資料本身仍是原文。
 */
(function (root) {
  'use strict';
  var SAFE_PAIRS = ${JSON.stringify(safe)};
  var FORCE_PAIRS = ${JSON.stringify(force)};

  function parsePairs(s) {
    var m = {};
    for (var i = 0; i + 1 < s.length; i += 2) m[s.charAt(i)] = s.charAt(i + 1);
    return m;
  }
  var safeMap = null, forceMap = null;
  function maps() {
    if (!safeMap) { safeMap = parsePairs(SAFE_PAIRS); forceMap = parsePairs(FORCE_PAIRS); }
    return { safe: safeMap, force: forceMap };
  }
  function toSimplified(text, mode) {
    if (!mode || !text) return String(text || '');
    var m = maps(), map = mode === 1 ? m.safe : m.force;
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      out += map[ch] || ch;
    }
    return out;
  }
  root.LOSSLESS = {
    toSimplified: toSimplified,
    // 搜尋用：兩邊都強制簡體再比，繁簡查詢都通
    canon: function (s) { return toSimplified(String(s == null ? '' : s), 2); },
    stats: function () { var m = maps(); return { safe: Object.keys(m.safe).length, force: Object.keys(m.force).length }; },
  };
})(typeof window !== 'undefined' ? window : this);
`;

fs.writeFileSync(OUT, out, 'utf8');
console.log('寫出 ' + OUT + '（' + (out.length / 1024).toFixed(1) + ' KB；safe ' + (safe.length / 2) + ' 組、force ' + (force.length / 2) + ' 組）');
