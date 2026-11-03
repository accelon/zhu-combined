/* gzip 解壓（RFC 1952 + RFC 1951），給沒有 DecompressionStream 的舊 Safari／iOS 用。
   純 ES5、無外部依賴；表驅動 Huffman 解碼，6.8MB 文字在中階手機約 1–3 秒。
   由 build-vcpp.mjs 內嵌到單檔；失敗時丟 Error，由外層顯示訊息。 */
function __gunzip(src) {
  if (src[0] !== 0x1f || src[1] !== 0x8b || src[2] !== 8) throw new Error('不是 gzip 資料');

  var flg = src[3];
  var pos = 10, i, j, k, l, c;
  if (flg & 4) { pos += 2 + (src[pos] | (src[pos + 1] << 8)); }   // FEXTRA
  if (flg & 8) { while (src[pos++] !== 0) { /* FNAME */ } }
  if (flg & 16) { while (src[pos++] !== 0) { /* FCOMMENT */ } }
  if (flg & 2) { pos += 2; }                                       // FHCRC

  // --- 位元讀取 ---
  var buf = 0, cnt = 0, bpos = pos;
  function fill(n) {
    while (cnt < n && bpos < src.length) { buf |= src[bpos++] << cnt; cnt += 8; }
  }
  function bits(n) {
    fill(n);
    var v = buf & ((1 << n) - 1);
    buf >>>= n; cnt -= n;
    return v;
  }
  function alignByte() {
    var bitpos = (bpos * 8 - cnt + 7) & ~7;
    bpos = bitpos >> 3; buf = 0; cnt = 0;
  }

  // --- 輸出緩衝 ---
  var out = new Uint8Array(1 << 20), op = 0;
  function ensure(n) {
    if (op + n <= out.length) return;
    var cap = out.length;
    while (cap < op + n) cap *= 2;
    var next = new Uint8Array(cap);
    next.set(out.subarray(0, op));
    out = next;
  }

  // --- Huffman 表（15 位定長查表） ---
  var NB = 1 << 15;
  var tblA = new Int32Array(NB), tblB = new Int32Array(NB);

  function buildTable(lengths, n, tbl) {
    var counts = new Int32Array(16), offs = new Int32Array(16);
    var syms = new Int32Array(n);
    var a, b, code, rev, cc, step, lv, sym;
    for (a = 0; a < 16; a++) counts[a] = 0;
    for (a = 0; a < n; a++) counts[lengths[a]]++;
    counts[0] = 0;
    offs[0] = 0; offs[1] = 0;
    for (a = 2; a < 16; a++) offs[a] = offs[a - 1] + counts[a - 1];
    for (a = 0; a < n; a++) { b = lengths[a]; if (b) syms[offs[b]++] = a; }
    for (a = 0; a < NB; a++) tbl[a] = 0;
    code = 0; k = 0;
    for (lv = 1; lv < 16; lv++) {
      for (c = 0; c < counts[lv]; c++) {
        sym = syms[k++];
        rev = 0; cc = code;
        for (j = 0; j < lv; j++) { rev = (rev << 1) | (cc & 1); cc >>>= 1; }
        step = 1 << lv;
        for (j = rev; j < NB; j += step) tbl[j] = (lv << 16) | sym;
        code++;
      }
      code <<= 1;
    }
  }

  function decode(tbl) {
    fill(15);
    var e = tbl[buf & 32767];
    var len = e >>> 16;
    if (!len) throw new Error('解壓失敗：Huffman 碼');
    buf >>>= len; cnt -= len;
    return e & 0xffff;
  }

  // --- 常數表 ---
  var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  var fixLit = null, fixDist = null;
  function initFixed() {
    if (fixLit) return;
    var lens = new Uint8Array(288);
    for (i = 0; i < 144; i++) lens[i] = 8;
    for (; i < 256; i++) lens[i] = 9;
    for (; i < 280; i++) lens[i] = 7;
    for (; i < 288; i++) lens[i] = 8;
    fixLit = new Int32Array(NB); buildTable(lens, 288, fixLit);
    var dl = new Uint8Array(30);
    for (i = 0; i < 30; i++) dl[i] = 5;
    fixDist = new Int32Array(NB); buildTable(dl, 30, fixDist);
  }

  var last = 0, litTbl, distTbl, type, n, sym, len, dist, from, q, hl, hd, hc, clens, clTbl, lens, total, s, rep, v;

  while (!last) {
    last = bits(1);
    type = bits(2);

    if (type === 0) {                       // 未壓縮區塊
      alignByte();
      n = src[bpos] | (src[bpos + 1] << 8);
      bpos += 4;
      ensure(n);
      for (q = 0; q < n; q++) out[op++] = src[bpos++];
      continue;
    }

    if (type === 1) {                       // 固定 Huffman
      initFixed();
      litTbl = fixLit; distTbl = fixDist;
    } else if (type === 2) {                // 動態 Huffman
      hl = bits(5) + 257;
      hd = bits(5) + 1;
      hc = bits(4) + 4;
      clens = new Uint8Array(19);
      for (i = 0; i < hc; i++) clens[ORDER[i]] = bits(3);
      clTbl = new Int32Array(NB); buildTable(clens, 19, clTbl);
      total = hl + hd;
      lens = new Uint8Array(total);
      k = 0;
      while (k < total) {
        s = decode(clTbl);
        if (s < 16) { lens[k++] = s; }
        else if (s === 16) {
          if (!k) throw new Error('解壓失敗：重複碼');
          rep = 3 + bits(2); v = lens[k - 1];
          while (rep-- && k < total) lens[k++] = v;
        } else if (s === 17) {
          rep = 3 + bits(3);
          while (rep-- && k < total) lens[k++] = 0;
        } else {
          rep = 11 + bits(7);
          while (rep-- && k < total) lens[k++] = 0;
        }
      }
      litTbl = tblA; buildTable(lens.subarray(0, hl), hl, litTbl);
      distTbl = tblB; buildTable(lens.subarray(hl, total), hd, distTbl);
    } else {
      throw new Error('解壓失敗：區塊型別');
    }

    for (;;) {
      sym = decode(litTbl);
      if (sym < 256) { ensure(1); out[op++] = sym; continue; }
      if (sym === 256) break;
      sym -= 257;
      if (sym >= 29) throw new Error('解壓失敗：長度碼');
      len = LBASE[sym] + bits(LEXT[sym]);
      dist = decode(distTbl);
      if (dist >= 30) throw new Error('解壓失敗：距離碼');
      dist = DBASE[dist] + bits(DEXT[dist]);
      if (dist > op) throw new Error('解壓失敗：距離超出');
      ensure(len);
      from = op - dist;
      for (q = 0; q < len; q++) out[op++] = out[from + q];
    }
  }

  return out.subarray(0, op);
}
