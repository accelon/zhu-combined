/* 咒語分頁（資料：window.MANTRA）
 *
 * 資料契約見 docs/prompts/mantra-tab.md。這一支只管「畫」與「跳」：
 *   - 一次只畫一個會（assembly），不把 143 個 unit 全 render
 *   - 詞表支援 1:1／1:n／n:1／gap 四種對應
 *   - 與經文雙向：這裡跳 selectUnit；經文那邊由 app.js 的 actBarHtml 掛「咒」
 *
 * 對外介面：window.MANTRA_UI = { has, render, open, byU, jumpTo }
 */
(function () {
  'use strict';

  var M = window.MANTRA;
  var has = !!(M && M.units && M.units.length);
  var UI = { has: has, render: function () {}, open: function () {}, byU: new Map(), jumpTo: function () {} };
  window.MANTRA_UI = UI;
  if (!has) return;

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var fmt = function (n) { return n == null || n === 0 ? '—' : String(n); };

  /* ---------- 索引：只從 units 建（不要用 links，links 有 858 句） ---------- */
  var byU = new Map();
  M.units.forEach(function (un) { (un.u || []).forEach(function (x) { if (!byU.has(x)) byU.set(x, un); }); });
  UI.byU = byU;

  var asms = (M.assemblies || []).slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
  var firstAsm = asms.filter(function (a) { return a.covered > 0; })[0] || asms[0] || null;
  var st = { asm: firstAsm ? firstAsm.id : null, hi: '', focus: null, q: '' };

  function unitsOf(asmId) {
    return M.units.filter(function (u) { return u.assembly === asmId; })
      .sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
  }
  function asmOf(id) { return asms.filter(function (a) { return a.id === id; })[0] || null; }

  // 每個會有哪些 lemma（給「本會無」判斷與高頻詞排序用）
  var lemmaCache = new Map();
  function lemmaSet(asmId) {
    if (!asmId) return new Set();
    if (lemmaCache.has(asmId)) return lemmaCache.get(asmId);
    var s = new Set();
    unitsOf(asmId).forEach(function (u) { (u.words || []).forEach(function (w) { if (w.lemma) s.add(w.lemma); }); });
    lemmaCache.set(asmId, s);
    return s;
  }

  /* ---------- 詞表：把連續的 1:n 合成一組（共用同一漢字音譯） ---------- */
  function wordRows(unit) {
    var rows = [];
    (unit.words || []).forEach(function (w) {
      var rel = w.relation || '1:1';
      var prev = rows[rows.length - 1];
      // 1:n：同一組連續梵詞共用同一個漢字音譯 → 併成一列，漢字欄 rowspan
      if (rel === '1:n' && prev && prev.rel === '1:n' && prev.translit === (w.translit || '')) {
        prev.words.push(w);
        return;
      }
      rows.push({ rel: rel, translit: w.translit || '', meaning: w.meaning || '', words: [w] });
    });
    return rows;
  }

  /* ---------- 主畫面 ---------- */
  function render(opts) {
    opts = opts || {};
    var cards = document.getElementById('cards');
    if (!cards) return;
    if (opts.asm) st.asm = opts.asm;
    if (opts.focusU != null) {
      var hit = byU.get(opts.focusU);
      if (hit) { st.asm = hit.assembly; st.focus = hit.id; }
      else st.focus = null;
    } else if (!opts.keepFocus) st.focus = null;

    var asm = asmOf(st.asm) || firstAsm;
    var units = asm ? unitsOf(asm.id) : [];
    var cov = M.coverage || {};
    var inAsm = lemmaSet(asm ? asm.id : null);
    // 高頻詞前 20：先放「本會有的」，再用全咒最高頻補滿
    var byFreq = (M.lexicon || []).slice().sort(function (a, b) { return (b.freq || 0) - (a.freq || 0); });
    var lex = byFreq.filter(function (l) { return inAsm.has(l.lemma); })
      .concat(byFreq.filter(function (l) { return !inAsm.has(l.lemma); }))
      .slice(0, 20);

    var html = '';
    html += '<div class="mt-head">' +
      '<div class="mt-title">' + esc(M.title || '咒語') + '</div>' +
      (M.source ? '<div class="mt-src">' + esc(M.source) + '</div>' : '') +
      '<div class="mt-cov">' + (cov.units || M.units.length) + '/' + (cov.total || '?') + ' unit' +
      (asm ? ' · ' + esc(asm.title || asm.id) : '') + '</div>' +
      '</div>';

    // 五會
    html += '<div class="mt-asms">';
    asms.forEach(function (a) {
      var dis = !(a.covered > 0);
      html += '<button type="button" class="mt-asm' + (a.id === (asm && asm.id) ? ' on' : '') + '"' +
        ' data-mt-asm="' + esc(a.id) + '"' + (dis ? ' disabled' : '') +
        ' title="' + esc((a.title || a.id) + '：' + a.covered + '/' + a.total + ' unit') + '">' +
        esc(a.title || a.id) +
        '<i>' + (dis ? '待補' : a.covered + '/' + a.total) + '</i>' +
        '</button>';
    });
    html += '</div>';

    // 高頻詞
    if (lex.length) {
      html += '<details class="mt-lex"' + (window.matchMedia('(min-width:721px)').matches ? ' open' : '') + '>' +
        '<summary>高頻詞</summary><div class="mt-chips">';
      lex.forEach(function (l) {
        var ext = !inAsm.has(l.lemma);
        html += '<button type="button" class="mt-chip' + (st.hi === l.lemma ? ' on' : '') + (ext ? ' ext' : '') + '" data-mt-lex="' + esc(l.lemma) + '"' +
          ' title="' + esc((l.translit || '') + ' ' + (l.meaning || '') + ' · ' + l.freq + ' 次' + (ext ? '（本會無）' : '')) + '">' +
          '<b>' + esc(l.lemma) + '</b>' +
          '<span>' + esc(l.translit || '') + '</span>' +
          '<em>' + esc(l.meaning || '—') + '</em>' +
          '<i>' + (l.freq || 0) + '</i>' +
          '</button>';
      });
      html += '</div>' +
        (st.note ? '<div class="mt-note">' + esc(st.note) + '</div>' : '') +
        '</details>';
    }

    // unit 卡
    if (!units.length) {
      html += '<p class="empty">' + esc(asm ? (asm.title || asm.id) + '還沒有詞級資料。' : '沒有咒語資料。') + '</p>';
    } else {
      units.forEach(function (un) {
        html += unitHtml(un);
      });
    }

    cards.innerHTML = html;
    document.querySelectorAll('.sent.sel,.pv-t').forEach(function (el) { el.dataset.base = el.innerHTML; });

    if (st.focus) {
      var el = cards.querySelector('.mt-unit[data-mt-unit="' + st.focus + '"]');
      if (el) {
        setTimeout(function () {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.classList.add('flash');
          setTimeout(function () { el.classList.remove('flash'); }, 1200);
        }, 30);
      }
      st.focus = null;
    }
  }

  function unitHtml(un) {
    var asm = asmOf(un.assembly) || {};
    var hi = st.hi;
    var out = '<div class="mt-unit' + (un.gap ? ' gap' : '') + '" data-mt-unit="' + esc(un.id) + '">';
    out += '<div class="mt-uh">' +
      '<span class="mt-id">' + esc(un.id) + '</span>' +
      '<span class="mt-pos">' + esc(asm.title || '') + ' · ' + (un.seq || '?') + '/' + (asm.total || '?') + '</span>' +
      '<button type="button" class="mt-go" data-mt-u="' + esc((un.u || [])[0] || '') + '" title="在經文看這一句">在經文看 ›</button>' +
      '</div>';
    out += '<div class="mt-sa">' + esc(un.sa || '') + '</div>';
    out += '<div class="mt-zh">' + (un.zh ? esc(un.zh) : '<span class="mt-gapn">（T945 缺此句）</span>') + '</div>';

    if ((un.words || []).length) {
      out += '<table class="mt-tab"><thead><tr>' +
        '<th>梵詞</th><th>漢字音譯</th><th>中文詞義</th><th>頻次</th><th>經文</th>' +
        '</tr></thead><tbody>';
      wordRows(un).forEach(function (r) {
        var first = r.words[0];
        var span = r.words.length;
        var u0 = (first.u || [])[0];
        var ch = first.char || null;
        var lit = r.rel === 'n:1'
          ? '<span title="多漢詞對一梵詞">' + esc(r.translit) + '</span>'
          : esc(r.translit || '—');
        var relTag = r.rel === 'gap' ? '<i class="mt-rel">gap</i>'
          : (r.rel === '1:n' || r.rel === 'n:1') ? '<i class="mt-rel">' + r.rel + '</i>' : '';
        r.words.forEach(function (w, k) {
          var on = hi && w.lemma === hi ? ' hit' : '';
          out += '<tr class="mt-row' + on + '"' + (u0 != null ? ' data-mt-jump="' + esc(u0) + '"' + (ch ? ' data-mt-char="' + ch[0] + ',' + ch[1] + '"' : '') : '') + '>';
          out += '<td data-l="梵詞" class="mt-c-sa">' + esc(w.sa || '') +
            (w.confidence && w.confidence !== 'A' ? '<i class="mt-conf" title="對應信心">' + esc(w.confidence) + '</i>' : '') + '</td>';
          if (k === 0) {
            out += '<td data-l="漢字音譯" class="mt-c-lit"' + (span > 1 ? ' rowspan="' + span + '"' : '') + '>' + lit + '</td>';
            out += '<td data-l="中文詞義" class="mt-c-mn"' + (span > 1 ? ' rowspan="' + span + '"' : '') + '>' +
              (r.meaning ? esc(r.meaning) : '—') + relTag + '</td>';
          }
          out += '<td data-l="頻次" class="mt-c-fq">' + fmt(w.freq) + '</td>';
          out += '<td class="mt-c-go">' + (u0 != null ? '<button type="button" class="mt-arrow" data-mt-jump="' + esc(u0) + '"' + (ch ? ' data-mt-char="' + ch[0] + ',' + ch[1] + '"' : '') + ' title="跳到經文">→</button>' : '') + '</td>';
          out += '</tr>';
        });
      });
      out += '</tbody></table>';
    }
    out += '</div>';
    return out;
  }

  /* ---------- 與經文互跳 ---------- */
  function jumpTo(u, ch) {
    if (u == null || u === '') return;
    var un = +u;
    if (window.ZHU_APP && window.ZHU_APP.selectUnit) window.ZHU_APP.selectUnit(un, { scroll: true, hl: ch || null });
  }

  function flashRange(u, a, b) {
    var el = document.querySelector('#reader .sent[data-u="' + u + '"]');
    if (!el) return;
    var text = el.textContent || '';
    if (!(a >= 0 && b > a && b <= text.length)) return;
    // 只走「正文」文字節點：跳過頁碼與注疏數的 sup
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (p && p.classList && (p.classList.contains('pg') || p.classList.contains('badge'))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var pos = 0, startNode = null, startOff = 0, endNode = null, endOff = 0, n;
    while ((n = walker.nextNode())) {
      var len = n.nodeValue.length;
      if (!startNode && a >= pos && a <= pos + len) { startNode = n; startOff = a - pos; }
      if (!endNode && b >= pos && b <= pos + len) { endNode = n; endOff = b - pos; }
      pos += len;
    }
    if (!startNode || !endNode) return;
    var base = el.dataset.base;
    try {
      var range = document.createRange();
      range.setStart(startNode, startOff);
      range.setEnd(endNode, endOff);
      var mark = document.createElement('mark');
      mark.className = 'mt-hl';
      range.surroundContents(mark);
    } catch (e) { return; }
    setTimeout(function () {
      if (base != null) el.innerHTML = base;
      else if (mark.parentNode) mark.replaceWith(document.createTextNode(mark.textContent));
    }, 1800);
  }

  /* ---------- 事件（一次綁在 document，跟 app.js 的 #cards 監聽不衝突） ---------- */
  document.addEventListener('click', function (e) {
    var asmBtn = e.target.closest('.mt-asm');
    if (asmBtn && !asmBtn.disabled) { st.asm = asmBtn.dataset.mtAsm; st.hi = ''; render(); return; }
    var chip = e.target.closest('.mt-chip');
    if (chip) {
      var l = chip.dataset.mtLex;
      if (st.hi === l) { st.hi = ''; st.note = ''; render({ keepFocus: true }); return; }
      var has = lemmaSet(st.asm).has(l);
      st.hi = has ? l : '';
      st.note = has ? '' : '「' + l + '」本會無';
      render({ keepFocus: true });
      if (!has) setTimeout(function () { if (st.note) { st.note = ''; render({ keepFocus: true }); } }, 1800);
      return;
    }
    var go = e.target.closest('[data-mt-jump]');
    if (go) {
      var ch = go.dataset.mtChar ? go.dataset.mtChar.split(',').map(Number) : null;
      jumpTo(go.dataset.mtJump, ch);
      return;
    }
    var gu = e.target.closest('[data-mt-u]');
    if (gu && gu.dataset.mtU !== '') { jumpTo(gu.dataset.mtU, null); return; }
  });

  /* ---------- app.js 呼叫的入口 ---------- */
  UI.render = render;
  UI.open = function (opts) { render(opts); };
  UI.jumpTo = jumpTo;
  UI.flashRange = flashRange;
})();


