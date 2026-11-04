/* 科文（科判）介面
 * ---------------------------------------------------------------------------
 * 三件事：
 *   1. 科文條：一條 accelon26 樣式的麵包屑（路徑＋同層兄弟），點哪一節就跳到那一節。
 *   2. 科文目錄：浮層列出整棵科判樹，可展開／收合、可搜尋位置。
 *   3. 經文上的科文：在目前這一分裡，把科文標題插在它起點那個「字」前面
 *      （字元級），並把目前這一節涵蓋的經文淡淡地襯底。
 *
 * 資料在 kepan/kepan-data.js（window.KEPAN），節點只記 (u, off) 起點與樹狀關係；
 * 經文與注疏仍在 zhu-data.js／app.js，這一支只加「層」，不改舊程式。
 *
 * 與 App 的往來只透過 window.ZHU_APP（app.js 本來就為操作導覽開的介面）與 DOM 事件。
 */
(function () {
  'use strict';

  var K = window.KEPAN;
  var Z = window.ZHU;
  var APP = window.ZHU_APP;
  if (!K || !Z) return;

  var QS = new URLSearchParams(location.search);
  if (QS.get('kepan') === 'off') return;

  // 這一層有載入才把「分」下拉與經文那條 chapter-nav 收起來（kepan=off 時兩者照舊）
  document.body.classList.add('kb-layer');

  function kbError(msg) {
    if (document.getElementById('kbErr')) return;
    var d = document.createElement('div');
    d.id = 'kbErr';
    d.textContent = '科判層錯誤：' + msg;
    d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;max-width:70vw;padding:6px 10px;' +
      'border-radius:6px;background:#7a1f1f;color:#fff;font:12px/1.5 sans-serif;white-space:pre-wrap';
    document.body.appendChild(d);
  }
  window.addEventListener('error', function (e) { if (e && e.message) kbError(e.message); });

  var esc = function (s) {
    var t = String(s == null ? '' : s);
    var m = window.__ZHU_SIM ? window.__ZHU_SIM() : 0;
    if (window.LOSSLESS && m) t = window.LOSSLESS.toSimplified(t, m);
    return t.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var SENTS = Z.versions[0].sents;
  var N = SENTS.length;
  var SEC_OF = [];
  SENTS.forEach(function (s) { SEC_OF[s.u] = s.s; });
  var SEC_FIRST = [];
  SENTS.forEach(function (s) { if (SEC_FIRST[s.s] == null) SEC_FIRST[s.s] = s.u; });

  /* ------------------------------------------------------------ 資料準備 */
  var BASE = 100000;
  var eds = K.editions.map(function (e) {
    var byId = new Map();
    var roots = e.roots.slice();
    e.nodes.forEach(function (n) {
      var o = {
        id: n.id, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch,
        u: n.u, off: n.off, u2: n.u2, o2: n.o2, nk: n.nk,
        s: n.nk ? -1 : n.u * BASE + n.off,
        e: n.nk ? -1 : n.u2 * BASE + n.o2,
      };
      byId.set(o.id, o);
    });
    // 子節點依起點排序（各家 JSON 本來就是文件序，這裡只是保險）
    byId.forEach(function (o) {
      if (o.ch && o.ch.length > 1) {
        o.ch.sort(function (a, b) { return byId.get(a).s - byId.get(b).s; });
      }
    });
    return {
      id: e.id, short: e.short, title: e.title, author: e.author, date: e.date,
      note: e.note, source: e.source, workId: e.workId || '', roots: roots, byId: byId,
      linked: e.linked, nodes: e.nodes,
      ordStyle: e.ordStyle || '', flat: !!e.flat, noMarks: !!e.noMarks,
    };
  });
  if (!eds.length) return;
  var edIx = 0;   // build.mjs 已依 order 排好，第一個就是預設（昭明）
  for (var i = 0; i < eds.length; i++) if (QS.get('kepan') === eds[i].id) edIx = i;
  var ed = eds[edIx];

  var state = { u: null, open: false, on: true };
  var bypass = false;   // 這次點擊要放行給 App（切換科文開關時收掉選句用）

  /* ------------------------------------------------------------ 小工具 */
  function posOf(u, off) { return u * BASE + off; }

  /** 這個位置落在哪一條路徑（回傳由外到內的節點陣列） */
  function pathAt(p) {
    var path = [], list = ed.roots;
    for (;;) {
      var pick = null, thru = null;
      for (var i = 0; i < list.length; i++) {
        var n = ed.byId.get(list[i]);
        if (!n) continue;
        if (n.s > p) break;
        if (!n.nk) pick = n;      // 最後一個起點 <= p 的已連經文節點
        thru = n;                 // 範圍內最後一個節點（可能是「不連經文」的總論）
      }
      if (pick) {
        path.push(pick);
        list = pick.ch || [];
      } else if (thru) {
        list = thru.ch || [];     // 路過總論節點，繼續往裡找
      } else break;
      if (!list.length) break;
    }
    return path;
  }

  function siblingsOf(n) {
    var list = n.par == null ? ed.roots : (ed.byId.get(n.par) || { ch: [] }).ch;
    return list.map(function (id) { return ed.byId.get(id); })
      .filter(function (x) { return x && !x.nk; });
  }

  function titleOf(n) {
    return (n.lab || '') + (n.nm || '');
  }

  /* 深度 → 色相：仿 offtext 的巢式文字（每深一層 HSV 色相 +30°，20° 暖色起點）。
     手機上的麵包屑只留「干支序號」，所以另外要一個 ordOf()。 */
  var GAN = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
  function hueOf(lv) { return (20 + Math.max(0, lv - 1) * 30) % 360; }
  function ordOf(n) {
    var lab = n.lab || '';
    if (!lab) return '';                                   // 章／節 沒有序號
    if (ed && ed.ordStyle === 'plain') return lab;         // 昭明：一、二…三十二
    if (GAN.indexOf(lab[0]) >= 0) return lab;              // 印順：甲一
    return (GAN[n.lv - 1] || '') + lab;                    // 江味農：lv3 + 初 → 丙初
  }

  /** 科名短標籤（干支序號另外顯示，這裡只放名字）：不超過 7 字就全顯示，
      否則取分隔符前那段再加省略號 */
  function shortOf(n) {
    var full = (n.nm || '').replace(/\s+/g, ' ').trim() || '（無名）';
    if (full.length <= 7) return full;
    var head = full.split(/[\s、，。：；·｜|／/\-—–_~]+/).filter(Boolean)[0] || full;
    return head.length <= 7 ? head : head.slice(0, 6) + '…';
  }

  function sectionNow() {
    var a = APP && APP.state ? APP.state() : null;
    return a ? a.section : 1;
  }
  function selectedNow() {
    var a = APP && APP.state ? APP.state() : null;
    return a ? a.selected : null;
  }

  var lastTrailHtml = '';

  /* ------------------------------------------------------------ 條（breadcrumb） */
  var top = document.getElementById('top');
  var bar = document.createElement('nav');
  bar.id = 'kepanBar';
  bar.setAttribute('aria-label', '科判路徑');
  bar.innerHTML =
    '<div class="kb-left"><button type="button" class="kb-tag" id="kbToggle" aria-pressed="true"' +
    ' title="科文：開（經文上顯示科文標記；點一下收起，只讀經文，梵文詞可以點）">科文</button>' +
    '<select id="kbEd" title="換一家的科判"></select>' +
    '<button type="button" class="kb-btn" id="kbTree" title="科判目錄（整棵樹）" aria-expanded="false">科判</button>' +
    '</div>' +
    '<div class="kb-trail" id="kbTrail"></div>';
  if (top) top.appendChild(bar);

  // 導覽（🦮）與明暗（☾）搬到標題列最左上角，跟搜尋分開
  (function () {
    if (!top) return;
    var box = top.querySelector('.kb-utils');
    var had = !!box;
    if (!box) { box = document.createElement('div'); box.className = 'kb-utils'; }
    ['fsBtn', 'bmBtn', 'theme', 'simBtn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode !== box) box.appendChild(el);
    });
    if (!had && box.childNodes.length) top.insertBefore(box, top.firstChild);
  })();

  var edSel = document.getElementById('kbEd');
  eds.forEach(function (e, i) {
    var o = document.createElement('option');
    o.value = String(i);
    o.textContent = e.short;
    edSel.appendChild(o);
  });
  edSel.value = String(edIx);
  edSel.title = '換一家的科判';
  edSel.onchange = function () {
    edIx = +edSel.value;
    ed = eds[edIx];
    try { localStorage.setItem('zhu.kb.ed', ed.id); } catch (e) {}
    render();
    decorateAll(true);
  };

  /* ------------------------------------------------------------ 點擊委派（一處就好） */
  // 綁在 document 的捕獲階段：麵包屑晶片、下拉項目、目錄列都在這裡處理。
  // 這樣不管是哪一次重畫、element 被換掉幾次，點擊都不會失效。
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;

    var chip = t.closest('#kepanBar .kb-chip, #kbRead .kb-chip');
    // 保險：若按下的那顆晶片剛好被重畫換掉，改用座標找（click 的 target 會退到共同祖先）
    if (!chip && typeof ev.clientX === 'number' && ev.clientX >= 0) {
      var at = document.elementFromPoint(ev.clientX, ev.clientY);
      if (at && at.closest) chip = at.closest('#kepanBar .kb-chip, #kbRead .kb-chip');
    }
    if (chip) {
      ev.preventDefault();
      ev.stopPropagation();
      onTrailClick(chip);
      return;
    }
    var item = t.closest('#kepanMenu .kb-item[data-k]');
    if (item) {
      ev.preventDefault();
      ev.stopPropagation();
      closeMenu();
      var n = ed.byId.get(+item.dataset.k);
      if (n) jumpTo(n);
      return;
    }
    var row = t.closest('#kepanPanel .kb-node[data-k]');
    if (row) {
      ev.preventDefault();
      ev.stopPropagation();
      onTreeClick(row);
    }
  }, true);

  /* ------------------------------------------------------------ 分導覽（與「分」下拉整合） */
  // 分章不再用下拉：標題列上是「‹ 21 非說所說 ›」，每章正文末尾也放一份。
  // 箭頭換分；中間那格點一下＝開科判目錄（昭明就是三十二分，等於跳分）。
  function onNavKey(ev) {
    var t = ev.target;
    if (!t || !t.closest || !t.closest('[data-cur]')) return;
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
      ev.preventDefault();
      if (state.open) closeTree(); else openTree();
    }
  }
  function onNavClick(ev) {
    var t = ev.target;
    if (t && t.closest && t.closest('[data-cur]')) {
      ev.preventDefault(); ev.stopPropagation();
      if (state.open) closeTree(); else openTree();
      return;
    }
    var b = t && t.closest ? t.closest('[data-step]') : null;
    if (!b || b.disabled) return;
    ev.preventDefault(); ev.stopPropagation();
    var sec = sectionNow() + (+b.dataset.step);
    if (APP && APP.setSection) APP.setSection(sec);
  }
  function makeNav(id) {
    var w = document.createElement('span');
    w.className = 'kb-nav';
    if (id) w.id = id;
    // 兩顆箭頭放在分名前面（上下兩份都一樣）：前後相鄰，連按不會落空
    w.innerHTML = '<button type="button" class="kb-step" data-step="-1" title="上一分">‹</button>' +
      '<button type="button" class="kb-step" data-step="1" title="下一分">›</button>' +
      '<span class="kb-cur" data-cur="1" role="button" tabindex="0" title="點一下開科判目錄"></span>';
    w.addEventListener('click', onNavClick);
    w.addEventListener('keydown', onNavKey);
    return w;
  }
  var kbNav = makeNav('kbNav');
  (function () {
    var sel0 = document.getElementById('sec-select');
    if (sel0 && sel0.parentNode) sel0.parentNode.insertBefore(kbNav, sel0);
    else if (top) top.appendChild(kbNav);

    placeMobileControls();
  })();

  /** 更新畫面上所有分導覽（標題列那一份＋每章末尾那一份）
   *  這裡一定要「沒變就不寫」：章末那份掛在 #reader 裡，寫 innerHTML 會觸發
   *  MutationObserver → schedule() → renderNav()，一秒可以跑幾十輪，
   *  DevTools 就看到 .kb-cur 一直被更新（而且按鈕會被換掉，點擊容易丟）。 */
  function renderNav() {
    var sec = sectionNow();
    var total = (Z.sections || []).length;
    var meta = (Z.sections || []).filter(function (x) { return x.n === sec; })[0] || {};
    var nm = String(meta.title || '').replace(/分第[一二三四五六七八九十]+$/, '') || ('第 ' + sec + ' 分');
    var shortId = String(meta.title || '').split(/[　 ]/)[0] || ('第 ' + sec + ' 分');
    var html = '<b>' + esc(shortId) + '</b>';
    var tip = '第 ' + sec + ' 分／' + total + '：' + (meta.title || '') + '（點一下開科判目錄）';
    var key = sec + '|' + total;
    var nodes = document.querySelectorAll('.kb-nav');
    for (var i = 0; i < nodes.length; i++) {
      var w = nodes[i];
      var cur = w.querySelector('[data-cur]');
      if (cur && (w.dataset.kbNav !== key || cur.innerHTML !== html)) {
        cur.innerHTML = html;
        w.dataset.kbNav = key;
        if (cur.title !== tip) cur.title = tip;
      }
      var p = w.querySelector('[data-step="-1"]'), n = w.querySelector('[data-step="1"]');
      if (p && p.disabled !== (sec <= 1)) p.disabled = sec <= 1;
      if (n && n.disabled !== (sec >= total)) n.disabled = sec >= total;
    }
  }
  /** 每章正文末尾那一份（#reader 會被 App 重畫，所以每次重畫後重新掛上去） */
  function placeBottomNav() {
    var secEl = document.querySelector('#reader .sec');
    if (!secEl || !secEl.parentNode) return;
    var b = document.getElementById('kbNavBottom');
    if (!b) { b = makeNav('kbNavBottom'); b.classList.add('kb-nav-bottom'); }
    if (secEl.nextSibling !== b) secEl.parentNode.insertBefore(b, secEl.nextSibling);
  }

  /* ------------------------------------------------------------ 手機：分導覽進科文條，🦮 與放大鏡留在標題列最右 */
  var mHome = null;
  function placeMobileControls() {
    var barEl = document.getElementById('kepanBar');
    var nav = document.getElementById('kbNav');
    var tour = document.getElementById('tourEntry');
    var search = document.querySelector('.search');
    if (!barEl || !nav) return;
    if (!mHome) mHome = { nav: { p: nav.parentNode, n: nav.nextSibling } };
    var mobile = window.matchMedia('(max-width: 760px)').matches;
    if (mobile) {
      if (nav.parentNode !== barEl) barEl.appendChild(nav);
      if (search) search.classList.add('kb-head-right');
      if (tour && search && tour.parentNode !== search) search.appendChild(tour);
      barEl.classList.add('kb-mobile');
    } else {
      if (mHome.nav.p && nav.parentNode !== mHome.nav.p) mHome.nav.p.insertBefore(nav, mHome.nav.n);
      if (search) search.classList.remove('kb-head-right');
      if (tour) {
        var prev = nav.querySelector('.kb-step[data-step="-1"]');
        if (prev && tour.parentNode !== nav) nav.insertBefore(tour, prev);
      }
      barEl.classList.remove('kb-mobile');
    }
  }
  window.addEventListener('resize', placeMobileControls);

  var trail = document.getElementById('kbTrail');
  var menu = document.createElement('div');
  menu.id = 'kepanMenu';
  menu.hidden = true;
  document.body.appendChild(menu);

  function closeMenu() { menu.hidden = true; }
  document.addEventListener('click', function (ev) {
    if (menu.hidden) return;
    if (menu.contains(ev.target)) return;
    // 點麵包屑上的晶片：交給晶片自己開新的下拉，不要在這裡先收掉
    // 「目錄」按鈕不含在 #kepanBar 裡（它搬到分導覽左邊），要一併排除，
    // 否則點它會先被這裡關掉、再被按鈕自己打開，看起來像沒反應。
    if (ev.target && ev.target.closest && ev.target.closest('#kepanBar, #kbTree, #kbRead, #kepanMenu')) return;
    closeMenu();
  }, true);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', function () { if (!menu.hidden) closeMenu(); }, { passive: true });

  function openMenu(anchor, list, curId) {
    menu.innerHTML = list.map(function (n) {
      return '<button type="button" class="kb-item' + (n.id === curId ? ' cur' : '') + '" data-k="' + n.id + '">' +
        '<span class="kb-n">' + esc(n.lab || '') + '</span>' + esc(n.nm || '（無名）') + '</button>';
    }).join('');
    menu.hidden = false;
    var r = anchor.getBoundingClientRect();
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var topY = r.bottom + 6;
    if (topY + h > window.innerHeight - 8) topY = Math.max(8, r.top - h - 6);
    menu.style.left = left + 'px';
    menu.style.top = topY + 'px';

  }

  function onTrailClick(b) {
    if (!b) return;
    if (b.dataset.mid) {
      var p = pathAt(posOf(state.u || 0, 0));
      openMenu(b, p.slice(2, p.length - 2), p[p.length - 1] && p[p.length - 1].id);
      return;
    }
    var n = ed.byId.get(+b.dataset.k);
    if (!n) return;
    var list = siblingsOf(n);
    var cur = pathAt(posOf(state.u || 0, 0));
    var curId = cur.length ? cur[cur.length - 1].id : null;
    if (list.length > 1) openMenu(b, list, curId);
    else jumpTo(n);
  }

  function chipHtml(n, cur) {
    return '<button type="button" class="kb-chip' + (cur ? ' cur' : '') + '" data-k="' + n.id + '"' +
      ' style="--kuhue:' + hueOf(n.lv) + '"' +
      ' title="' + esc(titleOf(n) || '（無名）') + '：點一下換同一層的其他節">' +
      '<span class="kb-id">' + esc(ordOf(n)) + '</span>' +
      '<span class="kb-nm">' + esc(shortOf(n)) + '</span>' +
      '<span class="kb-caret">▾</span></button>';
  }

  /** 路徑晶片：太長就折成「前 2 ＋ … ＋ 後 2」，中間那段放在 … 的下拉裡 */
  function trailHtml(path) {
    // 麵包屑是讀者定位的主要依據：整條路徑全部列出（可以換行），不折疊成「…」。
    return path.map(function (n, i) { return chipHtml(n, i === path.length - 1); })
      .join('<span class="kb-sep">›</span>');
  }

  function render() {
    var u = state.u == null ? (SEC_FIRST[sectionNow()] == null ? 0 : SEC_FIRST[sectionNow()]) : state.u;
    state.u = u;
    var path = pathAt(posOf(u, 0));
    var last = path.length ? path[path.length - 1] : null;
    var html = '';
    if (!last) {
      html = '<span class="kb-hint">這一段沒有科文。</span>';
    } else {
      // 同層兄弟不再排成晶片（toolbar 要短）；要換同層，點祖先那一格下拉即可。
      html = trailHtml(path);
    }
    // 只有內容真的變了才動 DOM。之前每次 schedule() 都重畫，使用者按下的那一顆
    // 會在 mousedown 與 mouseup 之間被換掉，click 就永遠不會發生（看起來「點不動」）。
    if (html !== lastTrailHtml) {
      lastTrailHtml = html;
      trail.innerHTML = html;
      var curChip = trail.querySelector('.kb-chip.cur');
      if (curChip && curChip.scrollIntoView) {
        try { curChip.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
      }
    }
  }

  /* ------------------------------------------------------------ 跳轉 */
  function jumpTo(n) {
    if (!n) return;
    if (n.nk) { openTree(n.id); return; }
    var u = n.u;
    if (u < 0 || u >= N) return;
    var sec = SEC_OF[u];
    var app = APP && APP.state ? APP.state() : null;
    if (state.on) {
      // 科判模式跳節：先收掉既有選句，否則 App 換分時會自動選新分第一句（面板就對不上）
      var had = document.querySelector('#reader .sent.sel');
      if (had) { bypass = true; try { had.click(); } catch (e) {} bypass = false; }
      app = APP && APP.state ? APP.state() : null;
    }
    if (!app || app.section !== sec) {
      if (APP && APP.setSection) APP.setSection(sec);
    }
    var el = document.querySelector('#reader .sent[data-u="' + u + '"]');
    state.u = u;
    render();
    decorateAll(true);
    if (!el) return;
    if (state.on) {
      // 科文開：只把這一句帶到眼前，不選句（免得長出梵文、開注疏）
      centerOn(el);
      flash(el);
    } else if (el.classList.contains('sel')) {
      flash(el);
    } else {
      el.click();               // 走 App 原本的選句：開注疏、捲到句中
      state.u = u;
      render();
      decorateAll(true);
    }
  }

  /** 把某一句捲到標題列下方一點的位置（不選句時用） */
  function centerOn(el) {
    var head = top ? top.getBoundingClientRect().height : 0;
    var r = el.getBoundingClientRect();
    var y = window.scrollY + r.top - head - Math.max(14, window.innerHeight * 0.16);
    window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
  }

  function flash(el) {
    el.classList.remove('kb-flash');
    void el.offsetWidth;
    el.classList.add('kb-flash');
    setTimeout(function () { el.classList.remove('kb-flash'); }, 1000);
  }

  /* ------------------------------------------------------------ 目錄浮層 */
  var panel = document.createElement('div');
  panel.id = 'kepanPanel';
  panel.hidden = true;
  panel.innerHTML = '<div class="kb-ph"><b>科判目錄</b><span class="kb-src" id="kbSrc"></span>' +
    '<button type="button" class="kb-btn" id="kbPanelX" title="關閉">✕</button></div>' +
    '<div class="kb-pb" id="kbPanelBody"></div>' +
    '<div class="kb-pf" id="kbPanelFoot"></div>';
  document.body.appendChild(panel);
  panelBody = document.getElementById('kbPanelBody');

  var panelBody = null;
  function onTreeClick(b) {
    if (!b) return;
    var n = ed.byId.get(+b.dataset.k);
    if (!n) return;
    if (n.nk) { flashRow(b); return; }
    jumpTo(n);
    buildTree();
    var cur2 = document.querySelector('#kepanPanel .kb-node.cur');
    if (cur2) cur2.scrollIntoView({ block: 'center' });
  }
  function buildTree() {
    var cur = state.u == null ? (SEC_FIRST[sectionNow()] || 0) : state.u;
    var path = pathAt(posOf(cur, 0));
    var onPath = new Set(path.map(function (n) { return n.id; }));
    var body = document.getElementById('kbPanelBody');
    var rows = [];
    function walk(ids, depth) {
      for (var i = 0; i < ids.length; i++) {
        var n = ed.byId.get(ids[i]);
        if (!n) continue;
        if (!n.nm && !n.lab) { if (n.ch && n.ch.length) walk(n.ch, depth + 1); continue; }
        // 彩點不內縮（仿 accelon26 的目錄樹）：深度用色點表示，列高固定、不隨層級縮排
        var cls = 'kb-node' + (n.nk ? ' nk' : '') + (onPath.has(n.id) ? ' cur' : '');
        var title = titleOf(n) || '（無名）';
        if (n.nk) title += '（總論，不對應經文）';
        // 與科文分頁共用同一個彩點列（app.js 的 window.ZHU_ZROW）
        if (window.ZHU_ZROW) {
          rows.push(window.ZHU_ZROW({
            hue: hueOf(n.lv), label: ordOf(n), name: n.nm || '（無名）',
            cls: cls, attrs: ' data-k="' + n.id + '"', title: title,
          }));
        } else {
          rows.push('<button type="button" class="zrow ' + cls + '" data-k="' + n.id +
            '" style="--zhue:' + hueOf(n.lv) + '"><span class="zdot"></span>' +
            '<span class="zlabel">' + esc(ordOf(n)) + '</span>' +
            '<span class="zname">' + esc(n.nm || '（無名）') + '</span></button>');
        }
        if (n.ch && n.ch.length) walk(n.ch, depth + 1);
      }
    }
    walk(ed.roots, 0);
    body.innerHTML = rows.join('');
    // 點擊交給 panelBody 上的委派（見 init），重畫 innerHTML 也不會掉
    var src = document.getElementById('kbSrc');
    if (src) {
      var bits = [ed.author, ed.title, ed.source && ed.source.base].filter(function (x) { return x && x !== 'undefined'; });
      src.textContent = bits.join(' · ');
    }
    var foot = document.getElementById('kbPanelFoot');
    if (foot) {
      var bt = K.build ? new Date(K.build) : null;
      var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
      var stamp = bt ? (pad2(bt.getMonth() + 1) + '-' + pad2(bt.getDate()) + ' ' + pad2(bt.getHours()) + ':' + pad2(bt.getMinutes())) : '';
      foot.textContent = (ed.note || '') + '　共 ' + ed.nodes.length + ' 節，' + ed.linked + ' 節連到經文。' +
        (stamp ? '　建置 ' + stamp : '');
    }
  }

  function flashRow(b) {
    b.classList.remove('kb-flash');
    void b.offsetWidth;
    b.classList.add('kb-flash');
    setTimeout(function () { b.classList.remove('kb-flash'); }, 1000);
  }

  function openTree(k) {
    panel.hidden = false;
    state.open = true;
    document.getElementById('kbTree').setAttribute('aria-expanded', 'true');
    buildTree();
    var body = document.getElementById('kbPanelBody');
    var cur = k != null ? body.querySelector('.kb-node[data-k="' + k + '"]') : body.querySelector('.kb-node.cur');
    if (cur) cur.scrollIntoView({ block: 'center' });
    closeMenu();
  }
  function closeTree() {
    panel.hidden = true;
    state.open = false;
    var b = document.getElementById('kbTree');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  document.getElementById('kbTree').onclick = function (ev) {
    ev.stopPropagation();
    if (state.open) closeTree(); else openTree();
  };
  document.getElementById('kbPanelX').onclick = function (ev) { ev.stopPropagation(); closeTree(); };
  document.addEventListener('click', function (ev) {
    if (panel.hidden) return;
    if (panel.contains(ev.target)) return;
    // 「目錄」按鈕不在 #kepanBar 裡（它搬到分導覽左邊），要一併排除，
    // 否則點它會先被這裡關掉、再被按鈕自己打開，看起來像關不起來。
    // .kb-node 是目錄裡的一列：點下去會重畫目錄，舊的節點已經脫離 DOM，
    // panel.contains() 就認不出來，會被誤判成「點到外面」而把面板關掉。
    if (ev.target && ev.target.closest && ev.target.closest('#kepanBar, #kbTree, .kb-node')) return;
    closeTree();
  }, true);

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { closeTree(); closeMenu(); }
    // Ctrl+Alt+K：開關科文條
    if (ev.altKey && (ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
      ev.preventDefault();
      bar.classList.toggle('kb-off');
    }
  });

  /* ------------------------------------------------------------ 科文開關（kb-tag） */
  var ON_KEY = 'zhu.kb.on';
  try {
    var ov = localStorage.getItem(ON_KEY);
    if (ov === '0' || ov === '1') state.on = ov === '1';
  } catch (e) {}
  function applyOn() {
    document.body.classList.toggle('kb-on', state.on);
    document.body.classList.toggle('kb-plain', !state.on);
    var t = document.getElementById('kbToggle');
    if (t) {
      t.setAttribute('aria-pressed', state.on ? 'true' : 'false');
      t.title = state.on ? '科文：開（點一下收起，只讀經文，梵文詞可以點）' : '科文：關（點一下在經文上顯示科文，梵文詞暫停）';
    }
    bar.classList.toggle('kb-off-mode', !state.on);
  }
  document.getElementById('kbToggle').onclick = function (ev) {
    ev.stopPropagation();
    state.on = !state.on;
    if (state.on) {
      var sel = document.querySelector('#reader .sent.sel');
      if (sel) { bypass = true; try { sel.click(); } catch (e) {} bypass = false; }
    }
    try { localStorage.setItem(ON_KEY, state.on ? '1' : '0'); } catch (e) {}
    applyOn();
    decorateAll(true);
  };

  /* 科判一開就顯示全部層級的科文，不再分「同層／全部」。 */

  /* ------------------------------------------------------------ 經文裝飾（字元級） */
  var reader = document.getElementById('reader');
  var lastHtml = new WeakMap();
  var scheduled = false;

  /** 算出這一節在這一句裡的 [起, 迄)（回傳 null 表示不相交） */
  function clip(n, u, len) {
    var a = -1, b = -1;
    if (u < n.u || u > n.u2) return null;
    if (u === n.u) a = n.off; else a = 0;
    if (u === n.u2) b = n.o2; else b = len;
    if (a < 0) a = 0;
    if (b > len) b = len;
    if (b <= a) return null;
    return [a, b];
  }

  function decorateEl(el) {
    var u = +el.dataset.u;
    var sent = SENTS[u];
    if (!sent) return;
    var t = sent.t.replace(/[「『]$/, '');
    var path = state.on ? pathAt(posOf(u, 0)) : [];
    var marks = [];
    var ranges = [];

    if (path.length) {
      var last = path[path.length - 1];
      var r = clip(last, u, t.length);
      if (r) ranges.push({ s: r[0], e: r[1], cur: true, hue: hueOf(last.lv) });
    }

    if (state.on && path.length && !ed.flat && !ed.noMarks) {
      var last2 = path[path.length - 1];
      // 科判一開就把整棵樹的科文都標出來（不再分同層／全部）
      var list = [];
      (function walk(ids) {
        ids.forEach(function (id) {
          var n = ed.byId.get(id);
          if (!n) return;
          if (!n.nk) list.push(n);          // nk＝不連經文，自己不標，但子節要往下走
          if (n.ch && n.ch.length) walk(n.ch);
        });
      })(ed.roots);
      for (var i = 0; i < list.length; i++) {
        var n = list[i];
        if (n.nk || n.u !== u) continue;
        if (n.off < 0 || n.off > t.length) continue;
        marks.push({
          pos: n.off, id: n.id, lv: n.lv, cur: n.id === (last2 && last2.id), hue: hueOf(n.lv),
          ord: ordOf(n), name: shortOf(n), full: titleOf(n),
        });
      }
    }

    // 同一位置會有好幾層（甲次→乙初→丙初 都從同一個字開始）：**全部留著**，
    // 由淺到深排，顏色照麵包屑的層深色走——讀者一眼看到這一句是「在這條路徑的哪裡」。
    marks = marks.sort(function (a, b) {
      return (a.pos - b.pos) || (a.lv - b.lv);
    });

    var cuts = { 0: 1 };
    cuts[t.length] = 1;
    marks.forEach(function (m) { cuts[m.pos] = 1; });
    ranges.forEach(function (r) { cuts[r.s] = 1; cuts[r.e] = 1; });
    var pos = Object.keys(cuts).map(Number).filter(function (p) { return p >= 0 && p <= t.length; })
      .sort(function (a, b) { return a - b; });

    var html = '';
    for (var k = 0; k < pos.length; k++) {
      var a = pos[k], b = k + 1 < pos.length ? pos[k + 1] : t.length;
      marks.filter(function (m) { return m.pos === a; }).forEach(function (m) {
        html += '<span class="kb-mark' + (m.cur ? ' cur' : '') + '" data-k="' + m.id + '"' +
          ' style="--kuhue:' + m.hue + '"' +
          ' title="科文：' + esc(m.full || m.name) + '（點一下跳到這一節）">' +
          '<span class="kb-mi">' + esc(m.ord) + '</span></span>';
      });
      if (b > a) {
        var seg = esc(t.slice(a, b));
        if (!state.on) { html += seg; continue; }
        // 經文不再按層深上色（用處不大，ancestor 科文已經夠）：只有「目前這一節」
        // 那一小段墊一層很淡的底，其餘一律是原文純文字——順便少掉大量 <span>，
        // 老手機的 DOM 小很多。
        var cur = false;
        for (var q = 0; q < ranges.length; q++) {
          if (ranges[q].cur && a >= ranges[q].s && a < ranges[q].e) { cur = true; break; }
        }
        html += cur ? '<span class="kb-t cur">' + seg + '</span>' : seg;
      }
    }

    var pg = el.querySelector('.pg');
    var badge = el.querySelector('sup.badge');
    var full = (pg ? pg.outerHTML : '') + html + (badge ? badge.outerHTML : '');
    // App 的梵文詞 hover 會在句裡塞 <mark class="gl">：那時不要蓋掉它
    if (el.querySelector('mark.gl')) return;
    var sig = edIx + '|' + (state.on ? 1 : 0) + '|' + u + '|' + (state.u || 0) + '|' + marks.length + '|' + ranges.length + '|' + (state.u === u ? 1 : 0);
    var want = (marks.length || ranges.length) ? 1 : 0;
    var have = el.querySelector('.kb-t,.kb-mark') ? 1 : 0;
    if (el.dataset.kbsig === sig && want === have) return;
    el.dataset.kbsig = sig;
    el.innerHTML = full;
    Array.prototype.forEach.call(el.querySelectorAll('.kb-mark'), function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        var n = ed.byId.get(+b.dataset.k);
        if (n) jumpTo(n);          // 點科文標記＝聯動 breadcrumb（跳到那一節）
      };
    });
  }

  var selfMutAt = 0;
  function decorateAll(force) {
    if (!reader) return;
    var els = reader.querySelectorAll('.sent[data-u]');
    if (!els.length) return;
    selfMutAt = Date.now();
    for (var i = 0; i < els.length; i++) decorateEl(els[i]);
    void force;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      var sel = selectedNow();
      var sec = sectionNow();
      // 科文開時點經文不會選句，位置記在 state.u；不要被「本分第一句」蓋掉
      var keep = state.u != null && SEC_OF[state.u] === sec ? state.u : null;
      var u = sel != null ? sel : (keep != null ? keep : (SEC_FIRST[sec] == null ? null : SEC_FIRST[sec]));
      if (u !== state.u) { state.u = u; }
      placeBottomNav();
      renderNav();
      render();
      decorateAll();
    });
  }

  if (reader && window.MutationObserver) {
    // 不在這裡判斷「是不是自己改的」：App 也可能在同一個批次裡重畫（換分、選句），
    // 跳過就會漏掉 renderNav／placeBottomNav。schedule 本身已經很便宜（沒變就不動 DOM）。
    new MutationObserver(function () { schedule(); })
      .observe(reader, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------------ 單本注疏閱讀模式
     科文開、且不是昭明時，點一句＝進這一家的閱讀模式：
     麵包屑（這一科的層級）＋所注經文＋他的注文（可翻頁），不跳 #sheet。 */
  var READ = { open: false, u: null, page: 0 };
  // 這一家的注文是哪一部 work：由資料（kepan/<家>.json 的 workId）指定，閱讀器不認識任何一家
  var ED_WORK = {};

  function zWork(id) {
    if (!id) return null;
    var ws = Z.works || [];
    for (var i = 0; i < ws.length; i++) if (ws[i].id === id) return ws[i];
    return null;
  }
  function zSent(u) {
    var ss = Z.versions[0].sents;
    for (var i = 0; i < ss.length; i++) if (ss[i].u === u) return ss[i];
    return null;
  }
  function zNote(w, u) {
    if (!w || !w.text) return '';
    var out = [];
    (w.anchors || []).forEach(function (a) { if (a[0] === u) out.push(w.text.slice(a[1], a[2])); });
    return out.join('\n').replace(/[ \t]*\n[ \t]*/g, '\n').trim();
  }
  function readPath(u) { return pathAt(posOf(u, 0)) || []; }
  function readPages(text) {
    var N = 260, out = [];
    for (var i = 0; i < text.length;) {
      var end = Math.min(text.length, i + N);
      if (end < text.length) {
        var j = end;
        while (j > i + N * 0.6 && '。！？；'.indexOf(text.charAt(j - 1)) < 0) j--;
        if (j > i + N * 0.6) end = j;
      }
      out.push(text.slice(i, end));
      i = end;
    }
    return out.length ? out : [''];
  }
  function readWorkOf() { return zWork(ed.workId || ED_WORK[ed.id] || ''); }
  function readContent(u) {
    var w = readWorkOf();
    if (w) {
      var note = zNote(w, u);
      return { who: w.author + '《' + w.title + '》', text: note || '（這一句，這一家沒有逐句注文）', work: w };
    }
    var path = readPath(u);
    var node = path.length ? path[path.length - 1] : null;
    var kids = node ? (node.ch || []).map(function (id) { return ed.byId.get(id); }).filter(Boolean) : [];
    var body;
    if (kids.length) {
      body = kids.map(function (k) { return '・' + titleOf(k); }).join('\n');
    } else if (node) {
      // 走到葉節點：列出同科的其他子目，讓讀者知道這一句在整科裡的位置
      var sibs = (node.par == null ? ed.roots : ((ed.byId.get(node.par) || {}).ch || []))
        .map(function (id) { return ed.byId.get(id); }).filter(Boolean);
      body = '本句屬「' + titleOf(node) + '」\n' +
        (sibs.length ? '\n同科：\n' + sibs.map(function (k) {
          return (k.id === node.id ? '▶ ' : '　 ') + titleOf(k);
        }).join('\n') : '（這一科沒有其他子目）');
    } else {
      body = '（這一句不在他的科文裡）';
    }
    return { who: (ed.author || ed.title || ed.short) + ' 科文', text: body, work: null };
  }
  function ensureRead() {
    var el = document.getElementById('kbRead');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'kbRead';
    el.hidden = true;
    el.innerHTML =
      '<div class="kr-bar"><div class="kr-crumbs" id="krCrumbs"></div>' +
      '<button type="button" class="kr-btn kr-full" title="全屏">⛶</button>' +
      '<button type="button" class="kr-btn kr-x" title="關閉（Esc）">✕</button></div>' +
      '<div class="kr-body" id="krBody"></div>' +
      '<div class="kr-foot"><button type="button" class="kr-btn kr-prev">‹ 上一句</button>' +
      '<span class="kr-who" id="krWho"></span>' +
      '<button type="button" class="kr-btn kr-next">下一句 ›</button></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('.kr-x')) { closeRead(); return; }
      if (ev.target.closest('.kr-full')) { toggleReadFull(el); return; }
      if (ev.target.closest('.kr-prev')) { stepRead(-1); return; }
      if (ev.target.closest('.kr-next')) { stepRead(1); return; }
      var pg = ev.target.closest('.kr-pg');
      if (pg) { READ.page += (+pg.getAttribute('data-d')); renderRead(); }
    });
    return el;
  }
  function toggleReadFull(el) {
    try {
      if (!document.fullscreenElement) el.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) {}
  }
  function openRead(u) {
    READ.open = true; READ.u = u; READ.page = 0;
    var sheet = document.getElementById('sheet');
    if (sheet) sheet.classList.add('closed');
    renderRead();
  }
  function closeRead() {
    READ.open = false;
    var el = document.getElementById('kbRead');
    if (el) el.hidden = true;
    document.body.classList.remove('kb-reading');
  }
  function stepRead(d) {
    var ss = Z.versions[0].sents, ix = -1;
    for (var i = 0; i < ss.length; i++) if (ss[i].u === READ.u) { ix = i; break; }
    if (ix < 0) return;
    var nx = Math.max(0, Math.min(ss.length - 1, ix + d));
    if (nx === ix) return;
    READ.u = ss[nx].u; READ.page = 0;
    state.u = READ.u;
    renderRead();
  }
  function renderRead() {
    var el = ensureRead();
    var u = READ.u;
    var path = readPath(u);
    document.getElementById('krCrumbs').innerHTML =
      '<span class="kr-ed">' + esc(ed.short) + '</span>' +
      (path.length ? ' <span class="kr-sep">›</span> ' + trailHtml(path) : '');
    var se = zSent(u);
    var content = readContent(u);
    var pages = readPages(content.text || '');
    if (READ.page > pages.length - 1) READ.page = pages.length - 1;
    if (READ.page < 0) READ.page = 0;
    var body = '<div class="kr-sutra"><span class="kr-tag">所注經文</span>' +
      (se ? esc(se.t) : '（找不到這一句）') + '</div>' +
      (content.work ? '' : '<p class="kr-tip">這一家只收科判，沒有逐句注文；下面是這一科的子目。</p>') +
      '<div class="kr-text">' + esc(pages[READ.page]) + '</div>';
    if (pages.length > 1) {
      body += '<div class="kr-pager"><button type="button" class="kr-btn kr-pg" data-d="-1"' +
        (READ.page <= 0 ? ' disabled' : '') + '>‹ 上一頁</button><span>' + (READ.page + 1) + ' / ' + pages.length +
        '</span><button type="button" class="kr-btn kr-pg" data-d="1"' + (READ.page >= pages.length - 1 ? ' disabled' : '') +
        '>下一頁 ›</button></div>';
    }
    document.getElementById('krBody').innerHTML = body;
    document.getElementById('krWho').textContent = content.who || '';
    el.hidden = false;
    document.body.classList.add('kb-reading');
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && READ.open) { closeRead(); }
  });

  // 點經文（捕獲階段攔下來）：
  //   科文開 → 只把條移到這一句所屬的科文，不選句（不長出梵文、不開注疏）
  //   科文關 → 照 App 原本：選句、開注疏、梵文可點
  if (reader) {
    reader.addEventListener('click', function (ev) {
      var t = ev.target;
      // 科文標記自己處理（它的 onclick 會 stopPropagation），這裡不要搶
      if (t && t.closest && t.closest('.kb-mark')) return;
      var el = t && t.closest ? t.closest('.sent[data-u]') : null;
      if (!el) return;
      var viaBadge = !!(t.closest && t.closest('sup.badge'));
      // 科文開、且不是昭明：點一句＝進這一家的閱讀模式（不跳 #sheet）
      if (state.on && !bypass && ed.id !== 'zhaoming' && !viaBadge) {
        ev.preventDefault();
        ev.stopPropagation();
        state.u = +el.dataset.u;
        openRead(state.u);
        render();
        decorateAll();
        return;
      }
      // 科判模式：點已經選著的那一句＝維持（不要交給 App 的「再點一次收起」），
      // 面板要用 ✕ 關。否則讀到一半點到同一句，注疏就突然不見。
      if (state.on && !bypass && el.classList.contains('sel')) {
        ev.preventDefault();
        ev.stopPropagation();
        state.u = +el.dataset.u;
        render();
        var a0 = APP && APP.state ? APP.state() : null;
        if (a0 && a0.overlay && APP.openPanel) { try { APP.openPanel('works'); } catch (e) {} }
        return;
      }
      state.u = +el.dataset.u;
      render();                     // 只動標題列，不動 #reader
      // 要點：不能在這裡就 decorateAll()。裝飾會把 .sent 的內容換掉，被點到的那個節點
      // 就從 DOM 上摘下來，App 的 click 委派（e.target.closest('.sent')）便找不到它，
      // 於是有時選得到句、有時選不到（點到字就失敗、點到字與字之間就成功）。
      // 所以等 App 處理完這一次點擊，再裝飾、再補開面板。
      setTimeout(function () {
        var a = APP && APP.state ? APP.state() : null;
        if (state.on && a && a.selected != null && (viaBadge || a.overlay)) {
          if (APP.openPanel) { try { APP.openPanel('works'); } catch (e) {} }
        }
        decorateAll();
      }, 0);
    }, true);
  }

  // 標題列高度 → 浮層位置
  function syncTopH() {
    if (!top) return;
    document.documentElement.style.setProperty('--top-h', Math.round(top.getBoundingClientRect().height) + 'px');
  }
  syncTopH();
  window.addEventListener('resize', syncTopH);
  if (window.ResizeObserver && top) new ResizeObserver(syncTopH).observe(top);

  /* ------------------------------------------------------------ 深連結／啟動 */
  (function boot() {
    try {
      var saved = localStorage.getItem('zhu.kb.ed');
      if (saved != null && !QS.get('kepan')) {
        var ix = -1;
        for (var k = 0; k < eds.length; k++) if (eds[k].id === saved) ix = k;
        if (ix < 0 && /^\d+$/.test(saved) && eds[+saved]) ix = +saved;   // 舊版存的是索引
        if (ix >= 0) { edIx = ix; ed = eds[edIx]; edSel.value = String(edIx); }
      }
    } catch (e) {}
    var k = QS.get('k');
    var hashK = /(?:^|[#&])k=(\d+)/.exec(location.hash || '');
    if (!k && hashK) k = hashK[1];
    if (k != null) {
      var n = ed.byId.get(+k);
      if (n && !n.nk) { setTimeout(function () { jumpTo(n); }, 60); return; }
    }
    var m = /#u=(\d+)/.exec(location.hash || '');
    if (m) state.u = +m[1];
    placeBottomNav();
    renderNav();
    applyOn();
    render();
    setTimeout(function () { syncTopH(); decorateAll(); }, 80);
  })();

  // 給 console／導覽用
  window.ZHU_KEPAN = {
    editions: eds,
    get edition() { return ed; },
    get node() { var p = pathAt(posOf(state.u || 0, 0)); return p.length ? p[p.length - 1] : null; },
    path: function () { return pathAt(posOf(state.u || 0, 0)); },
    go: function (id) { jumpTo(ed.byId.get(+id)); },
    tree: function () { openTree(); },
  };
})();
