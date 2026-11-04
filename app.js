/* 經注閱讀器 · zhu-combined（file:// 可直接開；資料由經群工作區提供） */
(function () {
  'use strict';
  const D = window.ZHU;
  if (!window.ZHU) {
    // 閱讀器本身不含資料：沒有 window.ZHU 就給人話，而不是白屏
    document.body.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = 'max-width:34em;margin:12vh auto;padding:0 20px;font:15px/1.9 sans-serif;color:#4a4034';
    box.innerHTML = '<h1 style="font-size:20px;margin:0 0 10px">經注閱讀器</h1>' +
      '<p>找不到資料（<code>window.ZHU</code>）。這個頁面只是閱讀器，經文與注疏由「經群工作區」提供。</p>' +
      '<p>開發時把工作區的 <code>zhu-data.js</code> 放到本目錄（或建連結），或用打包器把資料內嵌成單檔。</p>';
    document.body.appendChild(box);
    const bootEl = document.getElementById('boot');
    if (bootEl) bootEl.remove();
    return;
  }
  const $ = (s) => document.querySelector(s);
  // 所有輸出都經過 esc：順便把顯示字轉成繁／簡（原文與索引不動）
  const simText = (s) => (state.sim && window.LOSSLESS)
    ? window.LOSSLESS.toSimplified(String(s == null ? '' : s), state.sim)
    : String(s == null ? '' : s);
  // 書名與副標由資料決定（window.ZHU.meta）；沒有就用中性預設
  function applyMeta() {
    const m = (D && D.meta) || {};
    const title = String(m.title || '').trim();
    const sub = String(m.sub || '').trim();
    if (title) {
      document.title = title;
      const h1 = document.querySelector('.brand h1');
      if (h1) h1.textContent = title;
    }
    const p = document.querySelector('.brand .sub');
    if (p) p.textContent = sub;
    const note = document.getElementById('wxNote');
    if (note) note.textContent = title || '經注';
  }

  const esc = (s) => simText(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 漢譯句子直接相接；英譯（拉丁字母）要用空格
  const joinSents = (v, parts) => parts.join(v && v.lang === 'en' ? ' ' : '');
  // 搜尋／比對用：先把繁簡收斂到同一邊（無損表），再只留漢字
  const norm = (s) => {
    let t = String(s == null ? '' : s);
    if (window.LOSSLESS) t = window.LOSSLESS.canon(t);
    return t.replace(/[^\u3400-\u9fff]/g, '');
  };
  const foldSa = (s) => String(s || '').toLowerCase().replace(/[āīūṛṝḷḹēōṃḥṅñṭḍṇśṣ]/g, (c) => ({ 'ā': 'a', 'ī': 'i', 'ū': 'u', 'ṛ': 'r', 'ṝ': 'r', 'ḷ': 'l', 'ḹ': 'l', 'ē': 'e', 'ō': 'o', 'ṃ': 'm', 'ḥ': 'h', 'ṅ': 'n', 'ñ': 'n', 'ṭ': 't', 'ḍ': 'd', 'ṇ': 'n', 'ś': 's', 'ṣ': 's' })[c]);
  // 各譯本對同一個梵文詞的固定譯語。前綴比對（fold 過的詞形）。
  // 「笈多」的譯文是逐詞直譯、詞序同梵文，所以他的用詞可以拿來校正其他譯本：
  //   āyuṣmān ＝ 奘／淨「具壽」＝ 笈多「命者」＝ 什「長老」
  //   subhūti ＝ 奘「善現」＝ 淨「妙生」＝ 笈多「善實」＝ 什「須菩提」
  //   sattva  ＝ 奘「有情」＝ 笈多／什「眾生」
  const SYN_PREFIX = [
    ['subhut', ['須菩提', '善現', '妙生', '善實']],
    ['ayusma', ['具壽', '長老', '命者', '慧命']],
    ['sattv', ['眾生', '有情']],
    ['bhagav', ['世尊', '薄伽梵']],
  ];
  const ZH_SYN = {
    hetoh: ['故', '所以者何', '所以', '何以故'],
  };

  // 舊譯（羅什等）常直接音譯，而逐詞注的 zh 是義譯（無上、正等菩提），
  // 兩邊對不上，所以補一張常見音譯表，讓「對應」與高亮也能連到音譯本。
  const ZH_TRANS = [
    [/anuttara/, ['阿耨多羅', '無上']],
    [/samyaksambodh|samyaksambuddh/, ['三藐三菩提', '三貌三菩提', '正等菩提', '正等正覺']],
    [/prajna/, ['般若']],
    [/paramita/, ['波羅蜜']],
    [/bodhisattv/, ['菩薩']],
    [/buddh/, ['佛']],
    [/nirvan/, ['涅槃']],
    [/arhant|arhat/, ['阿羅漢']],
    [/bhagavat|bhagavan/, ['世尊']],
    [/bhiksu|bhiksuni/, ['比丘']],
    [/ganga/, ['恆河']],
    [/sumeru/, ['須彌']],
    [/asamkhya/, ['阿僧祇']],
    [/nayuta/, ['那由他']],
    [/srotapanna/, ['須陀洹']],
    [/sakrdagamin/, ['斯陀含']],
    [/anagamin/, ['阿那含']],
    [/upasaka/, ['優婆塞']],
    [/upasika/, ['優婆夷']],
    [/tathagata/, ['如來']],
    [/vajra/, ['金剛']],
    [/kalpa/, ['劫']],
  ];
  function zhCands(w) {
    const out = [];
    const zh = (w.zh || '').trim();
    if (zh) {
      out.push(zh.replace(/[。；;].*$/, ''));
      for (const p of zh.split(/[、；;]/)) { const x = p.trim(); if (x) out.push(x); }
    }
    if (Array.isArray(w.parts)) { for (const p of w.parts) if (p.zh) out.push(p.zh); }
    for (const k of [foldSa(w.s), foldSa(w.l || '')]) {
      for (const x of (ZH_SYN[k] || [])) out.push(x);
      for (const [pre, list] of SYN_PREFIX) if (k.startsWith(pre)) out.push(...list);
      for (const [re, list] of ZH_TRANS) if (re.test(k)) out.push(...list);
    }
    return [...new Set(out.filter(Boolean))];
  }
  // 同一個字可能出現多次（例如「生」在「眾生」與「生實信」），
  // 取「最靠近這個梵文詞在句中位置」的那一次，而不是第一個。
  function bestOccur(hay, cand, rel) {
    let best = -1, bestD = 1e9, idx = hay.indexOf(cand), guard = 0;
    while (idx >= 0 && guard++ < 60) {
      const d = Math.abs((idx + cand.length / 2) / Math.max(1, hay.length) - rel);
      if (d < bestD) { bestD = d; best = idx; }
      idx = hay.indexOf(cand, idx + 1);
    }
    return best;
  }
  function matchZh(text, w, total) {
    const hay = foldSa(w.s) === 'hetoh' ? String(text || '').slice(0, 12) : String(text || '');
    const rel = total ? ((w.i || 1) - 0.5) / total : null;
    let best = null, bestD = 1e9;
    for (const c of zhCands(w)) {
      const at = rel == null ? hay.indexOf(c) : bestOccur(hay, c, rel);
      if (at < 0) continue;
      const d = rel == null ? 0 : Math.abs((at + c.length / 2) / Math.max(1, hay.length) - rel);
      if (d < bestD) { bestD = d; best = { c, inf: c !== (w.zh || '').trim() }; }
    }
    return best;
  }

  // 手機／平板：右欄是覆蓋式面板（不是並排欄），所以點句與看面板在同一個視口裡
  const isOverlay = () => window.matchMedia('(max-width: 1060px)').matches;
  // 主文固定羅什（BASE）；想看別的譯本一律走面板的「別譯」分頁
  const state = { u: null, sec: 1, pick: [], altPick: null, tipPin: false, tab: 'works', showNotes: true, bm: [], page: {}, sim: 0 };

  /* ---------- 索引 ---------- */
  const byUnit = new Map(); // u -> [{w, a, b, p}]
  D.works.forEach((w) => {
    w.anchors.forEach(([u, a, b, p]) => {
      if (!byUnit.has(u)) byUnit.set(u, []);
      byUnit.get(u).push({ w, a, b, p });
    });
  });
  const wordIndex = new Map();
  (D.pdf || []).forEach((e) => {
    const u = (e.us && e.us.length) ? e.us[0] : e.u;
    (e.words || []).forEach((w) => {
      for (const k of [foldSa(w.s), foldSa(w.l || '')]) {
        if (!k) continue;
        if (!wordIndex.has(k)) wordIndex.set(k, []);
        wordIndex.get(k).push({ u, no: e.no, sec: e.sec });
      }
    });
  });
  // 科判（資料裡 kind 標成科判者）不是注疏，不列入
  const visible = (x) => x.w.kind !== '科判';
  const unitCount = (u) => (byUnit.get(u) || []).filter(visible).length;

  /* ---------- 主文：固定羅什 ---------- */
  const BASE = 0;
  const activeVersion = () => D.versions[BASE];

  /* ---------- 目錄 ---------- */
  function renderSectionSelect() {
    const el = document.getElementById('sec-select');
    if (!el) return;
    if (!el.options.length) {
      el.innerHTML = D.sections.map((s) => '<option value="' + s.n + '">' + s.n + '　' + esc(s.title.replace(/分第.*$/, '')) + '</option>').join('');
    }
    el.value = String(state.sec);
  }


  /* ---------- 經文（固定羅什） ---------- */
  function renderReader() {
    const mv = activeVersion();
    const sec = state.sec;
    const meta = D.sections.find((x) => x.n === sec) || { title: '' };
    const list = mv.sents.filter((s) => s.s === sec);
    const prevS = D.sections.find((x) => x.n === sec - 1);
    const nextS = D.sections.find((x) => x.n === sec + 1);
    const short = (t) => esc(String(t || '').replace(/分第.*$/, ''));
    let html = '<div class="chapter-nav">' +
      '<button data-goto="' + (sec - 1) + '"' + (prevS ? '' : ' disabled') + '>← ' + (prevS ? short(prevS.title) : '—') + '</button>' +
      '<span class="mid">第 ' + sec + ' 分 / ' + (D.sections || []).length + '</span>' +
      '<button data-goto="' + (sec + 1) + '"' + (nextS ? '' : ' disabled') + '>' + (nextS ? short(nextS.title) : '—') + ' →</button>' +
      '</div>';
    html += '<section class="sec" id="sec' + sec + '"><h2><span class="no">' + sec + '</span>' + esc(meta.title) + '</h2>';

    let curPage = '';
    const fanShown = new Set();
    list.forEach((s) => {
      const sel = state.u === s.u;
      let pg = '';
      if (s.p && s.p !== curPage) { curPage = s.p; pg = '<span class="pg" title="大正/卍續頁碼">' + esc(s.p) + '</span>'; }
      const n = unitCount(s.u);
      html += '<span class="sent' + (sel ? ' sel' : '') + '" data-u="' + s.u + '" data-p="' + esc(s.p) + '">' + pg +
        esc(s.t.replace(/[「『]$/, '')) + (n ? '<sup class="badge" title="' + n + ' 家注疏">' + n + '</sup>' : '') + '</span>';
      // 點句：句下就地展開梵藏，再一行按鈕決定要不要開面板（手機／平板）
      if (sel && !fanShown.has(s.u)) {
        fanShown.add(s.u);
        html += inlineFanHtml(s.u) + actBarHtml(s.u);
      }
    });
    html += '</section>';
    $('#reader').innerHTML = html;
    document.querySelectorAll('.sent.sel').forEach((el) => { el.dataset.base = el.innerHTML; });
  }

  // 手機：點句只展開梵文，面板由這一排按鈕叫出（桌面上用不到，CSS 隱藏）
  function actBarHtml(u) {
    const n = unitCount(u);
    const hasSa = (D.pdf || []).some((e) => (e.us || []).includes(u));
    return '<div class="actbar" data-u="' + u + '">' +
      '<button class="act-main" data-open="works">注疏' + (n ? '<b>' + n + ' 家</b>' : '') + ' ›</button>' +
      '<button data-open="alt">別譯</button>' +
      (hasSa ? '<button data-open="phrase">詞組</button>' : '') +
      '</div>';
  }
  /* ---------- 注疏：一排作者名按鈕，點誰展開誰 ---------- */
  function cardsFor(u) {
    return (byUnit.get(u) || []).filter(visible)
      .sort((a, b) => (a.w.year || 9999) - (b.w.year || 9999) || a.w.title.localeCompare(b.w.title));
  }

  function renderBody(u) {
    if (state.tab === 'alt') renderAlt(u);
    else if (state.tab === 'ke') renderKe(u);
    else if (state.tab === 'gloss') { if (GLOSS) GLOSS.mount(document.getElementById('cards')); }
    else if (state.tab === 'phrase') renderPhrase(u);
    else renderCards(u);
    // 重繪後記下原始 HTML，hover 高亮才有東西可還原
    document.querySelectorAll('.sent.sel,.pv-t').forEach((el) => { el.dataset.base = el.innerHTML; });
  }

  // 比較：同一句最多挑 3 家，跨分期也可以
  function pickEntries(u) {
    const all = (byUnit.get(u) || []).filter(visible);
    const ok = new Set((D.works || []).filter((w) => w.kind !== '科判').map((w) => w.id));
    state.pick = state.pick.filter((id) => ok.has(id));
    return state.pick.map((id) => {
      const exact = all.find((x) => x.w.id === id);
      if (exact) return exact;
      const w = (D.works || []).find((x) => x.id === id);
      const na = w ? nearestAnchor(w, u) : null;
      return na ? { w: w, a: na[1], b: na[2], p: na[3], approx: true } : null;
    }).filter(Boolean);
  }

  // 作者名只留人名：去掉朝代 token 與「述／撰／註…」這類角色字
  const DYN = new Set(['東晉', '北魏', '元魏', '民國', '姚秦', '劉宋', '晉', '梁', '陳', '隋', '唐', '宋', '元', '明', '清']);
  const ROLE = /(並著語|著語|治定|解釋|解義|註釋|講述|講記|講|宗通|詮次|述|撰|註|注|解|頌|記|編|纂|彙|疏|譯|造|集|鈔|科會|科|會|刪|補|論|語)$/;
  function authorShort(a) {
    return String(a || '')
      .replace(/[．·、]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t && !DYN.has(t))
      .map((t) => { // 角色字可能疊兩層（例：道川頌並著語）
        let s = t;
        for (let i = 0; i < 4; i++) { const n = s.replace(ROLE, ''); if (n === s) break; s = n; }
        return s;
      })
      .filter(Boolean)
      .join('·');
  }

  // 注疏原文在分段之間常夾著分名（例：「○依法出生分第八」「分第十三」），
  // 掛在相鄰句子的頭尾看起來像內文，顯示前先切掉。
  function trimHeading(s) {
    return String(s)
      .replace(/^[\s○〇●※]*(?:[\u4e00-\u9fa5]{0,6})?分第[一二三四五六七八九十]+[\s。．]*/, '')
      .replace(/[\s○〇●※]*[\u4e00-\u9fa5]{0,10}分第[一二三四五六七八九十]+[\s。．]*$/, '')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
  }

  /** 某一家在這一往前走最近的錨（沒有正好對到這一句時用） */
  function nearestAnchor(w, u) {
    const as = (w.anchors || []);
    if (!as.length) return null;
    let best = null;
    for (const a of as) if (a[0] <= u && (!best || a[0] > best[0])) best = a;
    if (!best) best = as.reduce((m, a) => (a[0] < m[0] ? a : m), as[0]);
    return best;
  }

  function renderCards(u) {
    const list = cardsFor(u);
    const picks = pickEntries(u);
    const ids = new Set(picks.map((x) => x.w.id));
    const allWorks = (D.works || []).filter((w) => w.kind !== '科判')
      .sort((a, b) => (a.year || 9999) - (b.year || 9999) || String(a.author).localeCompare(String(b.author)));
    if (!allWorks.length) { $('#cards').innerHTML = emptyCardsHtml(u); return; }
    const exactIds = new Set(list.map((x) => x.w.id));
    const eraOf = (w) => {
      const y = w.year || 0;
      if (!y) return 'other';
      if (y < 1200) return 'song';
      if (y < 1650) return 'ming';
      if (y < 1900) return 'qing';
      return 'modern';
    };
    let html = '<div class="note-bar">' + allWorks.map((w) =>
      `<button class="notebtn era-${eraOf(w)}${ids.has(w.id) ? ' on' : ''}${exactIds.has(w.id) ? '' : ' dim'}" data-w="${esc(w.id)}" title="${esc(w.author)}《${esc(w.title)}》">${esc(authorShort(w.author))}</button>`
    ).join('') + (function () {
      // 資料可以指定某一句的「書證」外部連結（meta.links[u] = {href, text}）
      const lk = (D.meta && D.meta.links && D.meta.links[String(u)]) || null;
      return lk && lk.href ? '<a class="note-link" href="' + esc(lk.href) + '" target="_blank" rel="noopener">' +
        esc(lk.text || '延伸閱讀') + ' ↗</a>' : '';
    })() + '</div>';
    html += picks.length
      ? picks.map((x) => {
          const raw = x.w.text ? x.w.text.slice(x.a, x.b) : '';
          const body = trimHeading(raw);
          const approxNote = x.approx ? '<span class="lite">（這一句沒有這家的注文，顯示最接近的段落）</span>' : '';
          const txt = x.w.text
            ? (body ? esc(body) : '<span class="lite">（這一句沒有疏文）</span>')
            : '<span class="lite">輕量版：此書全文未收錄</span>';
          return '<div class="note-open"><div class="note-h">' +
            '<button class="bm' + (bmHas(x.w.id) ? ' on' : '') + '" data-w="' + esc(x.w.id) + '"' +
            ' aria-pressed="' + bmHas(x.w.id) + '" title="' + (bmHas(x.w.id) ? '取消書籤' : '加入書籤') + '">' +
            (bmHas(x.w.id) ? '♥' : '♡') + '</button>' +
            '<b>' + esc(x.w.author) + '</b>《' + esc(x.w.title) + '》' +
            '<span class="note-src">' + esc(x.w.corpus) + ' ' + esc(x.w.no) + ' · ' + esc(x.p) + '</span>' +
            '<button class="unpick" data-w="' + esc(x.w.id) + '" title="收起">✕</button></div>' +
            approxNote + '<p class="ex" data-w="' + esc(x.w.id) + '">' + txt + '</p></div>';
        }).join('')
      : '<p class="empty">點上面的作者名看注疏（可同時開 1–5 家）。</p>';
    $('#cards').innerHTML = html;
    applyPages();
  }

  /* ---------- 注文分頁：每頁約 180 字，盡量切在句末 ---------- */
  const NOTE_PAGE = 180;
  function splitPages(full) {
    const out = [];
    let i = 0;
    while (i < full.length) {
      let end = Math.min(full.length, i + NOTE_PAGE);
      if (end < full.length) {
        let j = end;
        while (j > i + NOTE_PAGE * 0.55 && '。！？；'.indexOf(full.charAt(j - 1)) < 0) j--;
        if (j > i + NOTE_PAGE * 0.55) end = j;
      }
      out.push(full.slice(i, end));
      i = end;
    }
    return out;
  }
  function pagerHtml(p, n) {
    return '<span class="pager">' +
      '<button type="button" class="pg" data-d="-1"' + (p > 0 ? '' : ' disabled') + '>‹ 上一頁</button>' +
      '<span class="pg-no">' + (p + 1) + ' / ' + n + '</span>' +
      '<button type="button" class="pg" data-d="1"' + (p < n - 1 ? '' : ' disabled') + '>下一頁 ›</button>' +
      '</span>';
  }
  function showPage(el, p) {
    const pages = el && el.__pages;
    if (!pages || !pages.length) return;
    p = Math.max(0, Math.min(pages.length - 1, p));
    state.page = state.page || {};
    state.page[el.dataset.w] = p;
    el.innerHTML = esc(pages[p]) + (pages.length > 1 ? pagerHtml(p, pages.length) : '');
    el.dataset.shown = String(p);
  }
  function applyPages() {
    document.querySelectorAll('#cards p.ex[data-w]').forEach((el) => {
      if (el.__pages) return;
      const full = el.textContent || '';
      if (full.length <= NOTE_PAGE) return;   // 短注不分頁
      const pages = splitPages(full);
      if (pages.length < 2) return;
      el.__full = full;
      el.__pages = pages;
      showPage(el, state.page[el.dataset.w] || 0);
    });
  }

  /* ---------- 書籤（只記注疏；存 localStorage） ---------- */
  function bmLoad() {
    try {
      const a = JSON.parse(localStorage.getItem('zhu-bm') || '[]');
      state.bm = Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
    } catch (e) { state.bm = []; }
  }
  function bmSave() {
    try { localStorage.setItem('zhu-bm', JSON.stringify(state.bm)); } catch (e) {}
  }
  function bmHas(id) { return state.bm.indexOf(id) >= 0; }
  function bmWork(id) { return (D.works || []).filter((w) => w.id === id)[0]; }
  function bmToggle(id) {
    const i = state.bm.indexOf(id);
    if (i >= 0) state.bm.splice(i, 1); else state.bm.push(id);
    bmSave();
    renderBmList();
    document.querySelectorAll('.bm[data-w="' + id.replace(/"/g, '\\"') + '"]').forEach((b) => {
      const on = bmHas(id);
      b.classList.toggle('on', on);
      b.textContent = on ? '♥' : '♡';
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? '取消書籤' : '加入書籤';
    });
    return bmHas(id);
  }
  function bmListHtml() {
    if (!state.bm.length) return '<p class="bm-empty">還沒有書籤。點注疏標題旁的 ♡ 加入。</p>';
    return state.bm.map((id) => {
      const w = bmWork(id);
      if (!w) return '';
      return '<div class="bm-row"><button type="button" class="bm-go" data-w="' + esc(id) + '" title="打開這部注疏">' +
        esc(w.author) + '《' + esc(w.title) + '》</button>' +
        '<button type="button" class="bm-del" data-w="' + esc(id) + '" title="取消書籤">✕</button></div>';
    }).join('');
  }
  function renderBmList() {
    const box = document.querySelector('#bmList .bm-body');
    if (box) box.innerHTML = bmListHtml();
  }
  function hideBmList() {
    const el = document.getElementById('bmList');
    if (el) el.hidden = true;
  }
  function positionBmList() {
    const el = document.getElementById('bmList');
    const btn = document.getElementById('bmBtn');
    if (!el || !btn) return;
    const b = btn.getBoundingClientRect();
    const w = el.offsetWidth || 320;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, b.right - w));
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(b.bottom + 6) + 'px';
    el.style.right = 'auto';
  }
  function toggleBmList() {
    const el = document.getElementById('bmList');
    if (!el) return;
    renderBmList();
    el.hidden = !el.hidden;
    if (!el.hidden) positionBmList();
  }
  function openBm(id) {
    const w = bmWork(id);
    if (!w) return;
    hideBmList();
    const here = (byUnit.get(state.u) || []).some((x) => x.w.id === id && visible(x));
    if (!here) {
      const us = (w.anchors || []).map((a) => a[0]).sort((a, b) => a - b);
      if (!us.length) return;
      let next = us.filter((u) => u >= state.u)[0];
      if (next == null) next = us[0];
      selectUnit(next);
    }
    if (state.pick.indexOf(id) < 0) state.pick.unshift(id);
    state.pick = state.pick.slice(0, 3);
    state.tab = 'works';
    renderCards(state.u);
    if (isOverlay()) openPanel('works');
  }

  function togglePick(id) {
    const i = state.pick.indexOf(id);
    if (i >= 0) { state.pick.splice(i, 1); return false; }
    if (state.pick.length >= 5) return null; // 已滿（系統規定 5 家）
    state.pick.unshift(id); // 新開的放最前面（prepend），不必往下捲
    return true;
  }

  function emptyCardsHtml(u) {
    return '<p class="empty">這一句目前沒有對應注疏。</p>';
  }

  /* ---------- 面板 ---------- */
  // 別譯：一排譯者名按鈕（inline），可同時挑 1–5 種，新挑的排最前面
  /* ---------- 科判分頁（資料可選：ZHU.ke） ---------- */
  function renderKe() {
    const cards = document.getElementById('cards');
    const ke = D.ke || [];
    if (!ke.length) { cards.innerHTML = '<p class="empty">這部經沒有科判資料。</p>'; return; }
    const ids = ke.map(function (k) { return k.id; });
    if (!state.kePick || ids.indexOf(state.kePick) < 0) state.kePick = ids[0];
    const cur = ke.filter(function (k) { return k.id === state.kePick; })[0];
    // 有層級的科判樹（分→卷→節）；沒有樹就退回平鋪分節
    let jumps = '';
    if (D.keTree && D.keTree.length) {
      jumps = '<div class="ke-tree">' + D.keTree.map(function (part, pi) {
        const leaves = (part.children || []).map(function (jn) {
          return '<details class="ke-juan"' + (pi === 0 ? ' open' : '') + '><summary>' + esc(jn.title) +
            '<span class="ke-cnt">' + (jn.children || []).length + '</span></summary>' +
            (jn.children || []).map(function (s) {
              return '<button type="button" class="ke-jump' + (s.n === state.sec ? ' on' : '') +
                '" data-sec="' + s.n + '">' + esc(s.title) + '</button>';
            }).join('') + '</details>';
        }).join('');
        return '<details class="ke-part"' + (pi === 0 ? ' open' : '') + '><summary>' + esc(part.title) + '</summary>' + leaves + '</details>';
      }).join('') + '</div>';
    } else {
      jumps = (D.sections || []).map(function (s) {
        return '<button type="button" class="ke-jump' + (s.n === state.sec ? ' on' : '') + '" data-sec="' + s.n + '">' +
          esc(s.title || ('第 ' + s.n + ' 分')) + '</button>';
      }).join('');
      if (jumps) jumps = '<div class="ke-jumps">' + jumps + '</div>';
    }
    cards.innerHTML =
      '<div class="ke-bar"><select id="keSel" aria-label="選科判">' +
      ke.map(function (k) {
        return '<option value="' + esc(k.id) + '"' + (k.id === state.kePick ? ' selected' : '') + '>' +
          esc(k.label || titleOf2(k)) + '</option>';
      }).join('') + '</select>' +
      '<span class="ke-meta">' + esc(cur.author || '') + ' · ' + cur.text.length.toLocaleString('en-US') + ' 字</span></div>' +
      jumps +
      (D.keNodes && D.keNodes.length
        ? '<details class="ke-nodes"><summary>科文節點（' + D.keNodes.length.toLocaleString('en-US') + '，可跳正文）</summary><div class="ke-node-list">' +
          D.keNodes.map(function (n, i) {
            return '<button type="button" class="ke-node" data-u="' + n.u + '" style="padding-left:' + (8 + (n.level || 0) * 12) + 'px">' +
              esc(n.text) + '</button>';
          }).join('') + '</div></details>'
        : '') +
      '<pre class="ke-body">' + esc(cur.text) + '</pre>';
    const sel = document.getElementById('keSel');
    if (sel) sel.addEventListener('change', function () { state.kePick = sel.value; renderKe(); });
    cards.querySelectorAll('.ke-node').forEach(function (b) {
      b.addEventListener('click', function () { selectUnit(+b.dataset.u); });
    });
    cards.querySelectorAll('.ke-jump').forEach(function (b) {
      b.addEventListener('click', function () { setSection(+b.dataset.sec); });
    });
  }
  function titleOf2(k) { return String(k.title || k.id).replace(/^(楞嚴經|大佛頂)/, ''); }

  function renderAlt(u) {
    const cards = document.getElementById('cards');
    const avail = D.versions.map(function (v, i) { return { v: v, i: i }; })
      .filter(function (x) { return x.v.byJuan || x.v.bySection || (x.v.sents || []).some(function (s) { return s.u === u; }); });
    const en = D.english && D.english.byJuan ? D.english : null;
    if (!avail.length) { cards.innerHTML = '<p class="empty">此句沒有其他譯本。</p>'; return; }
    const ok = new Set(avail.map(function (x) { return x.i; }));
    if (state.altPick == null) {
      // 預設：主文＋所有可用的別譯（最多 3 個），一打開就有字
      const special = avail.filter(function (x) { return x.v.byJuan || x.v.bySection; })[0];
      if (special) {
        state.altPick = [ok.has(BASE) ? BASE : avail[0].i, special.i];
      } else {
        const list = avail.slice(0, 3).map(function (x) { return x.i; });
        if (ok.has(BASE) && list.indexOf(BASE) < 0) list.unshift(BASE);
        state.altPick = list;
      }
    }
    state.altPick = state.altPick.filter(function (i) { return ok.has(i); });
    const picks = state.altPick;
    const bar = avail.map(function (x) {
      return '<button class="altbtn' + (picks.indexOf(x.i) >= 0 ? ' on' : '') + (x.i === BASE ? ' main' : '') +
        '" data-a="' + x.i + '" title="' + esc(x.v.trans) + '">' + esc(x.v.label) + '</button>';
    }).join('');
    const panes = picks.map(function (i) {
      const v = D.versions[i];
      const bySec = v.bySection ? String(v.bySection[String(state.sec || 1)] || '') : null;
      const t = bySec != null
        ? bySec
        : (v.byJuan
          ? String(v.byJuan[String(Math.max(0, (state.sec || 1) - 1))] || '')
          : joinSents(v, v.sents.filter(function (s) { return s.u === u; }).map(function (s) { return s.t; })));
      const missing = (v.byJuan || v.bySection) && !t;
      const note = v.bySection ? '本節' : '';
      return '<div class="alt-pane"><div class="alt-who">' + esc(v.label) + '　' + esc(v.trans) + (note ? '　·　' + note : '') + '</div>' +
        (t ? '<div class="alt-body' + (v.lang === 'en' ? ' en' : '') + '">' + esc(t) + '</div>'
           : '<p class="empty">' + (missing ? '這一卷沒有英譯（Luk 由卷一開始）。' : '這個譯本沒有對應這一句。') + '</p>') + '</div>';
    }).join('');
    cards.innerHTML = '<div class="alt-bar">' + bar + '</div>' +
      (panes || '<p class="empty">點上面的譯者名看譯文（可同時開 1–5 種）。</p>');
  }



  const COMMON = new Set(['ca', 'hy', 'sma', 'iti', 'eva', 'api', 'na', 'tu', 'va', 'atha', 'tatra', 'yad', 'etad', 'ayam', 'asya', 'tena', 'tasmad']);
  function occOf(w) {
    const arr = wordIndex.get(foldSa(w.s)) || [];
    const seen = new Set();
    const out = [];
    for (const o of arr) {
      if (o.u < 0 || o.u === state.u) continue;
      const key = o.u + ':' + o.no;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(o);
    }
    return out;
  }


  function renderPhrase(u) {
    const entries = (D.pdf || []).filter((e) => (e.us || []).includes(u));
    const cards = document.getElementById('cards');
    if (!entries.length) {
      cards.innerHTML = '<p class="empty">這一句沒有梵文逐詞資料。</p>';
      return;
    }
    cards.innerHTML = entries.map(function (e) {
      const ws = e.words || [];
      const rows = ws.map(function (w) {
        const occ = occOf(w);
        const common = COMMON.has(foldSa(w.s));
        const links = common ? '' : occ.slice(0, 8).map(function (o) {
          return '<a href="#" data-u="' + o.u + '" data-i="' + (w.i - 1) + '" data-no="' + esc(e.no) + '">' + o.sec + '·' + esc(o.no) + '</a>';
        }).join('、');
        return '<div class="ph-row" data-i="' + (w.i - 1) + '" data-no="' + esc(e.no) + '">' +
          '<span class="ph-n">' + w.i + '</span><span class="ph-w">' + esc(w.s) + '</span>' +
          '<span class="ph-p">' + esc(w.p) + '</span><span class="ph-zh">' + esc(w.zh) + '</span>' +
          (links ? '<div class="ph-occ">另見 ' + occ.length + ' 處：' + links + (occ.length > 8 ? ' …' : '') + '</div>' : '') +
          '</div>';
      }).join('');
      return '<div class="ph-entry"><div class="pos-head">' + esc(e.no) + ' · ' + esc(e.secTitle) + '</div>' + rows + '</div>';
    }).join('');
  }

  // 「另見」展開：只放主譯本的一句（以免太長），梵文句裡把查的那個詞塗紅
  function occDetailHtml(u, w) {
    const entries = (D.pdf || []).filter((e) => (e.us || []).includes(u));
    const key = w ? foldSa(w.s) : '';
    const lem = w ? foldSa(w.l || '') : '';
    // 梵文有 sandhi：8-1 的詞頭是 trisāhasra，句裡卻寫成 trisāhasramahāsāhasraṃ。
    // 先找完全相符的詞，找不到再退一步標出詞頭所在的片段。
    const markSa = (sa) => {
      if (!key && !lem) return esc(sa);
      return String(sa).split(/(\s+)/).map((tok) => {
        if (!tok.trim()) return esc(tok);
        const cut = tok.replace(/[|।,;:.]+$/g, '');
        const tail = tok.slice(cut.length);
        const f = foldSa(cut);
        let at = -1, len = 0;
        if (key && f === key) { at = 0; len = cut.length; }
        else if (lem && f === lem) { at = 0; len = cut.length; }
        else if (key.length >= 3 && f.indexOf(key) >= 0) { at = f.indexOf(key); len = key.length; }
        else if (lem.length >= 3 && f.indexOf(lem) >= 0) { at = f.indexOf(lem); len = lem.length; }
        if (at < 0) return esc(tok);
        return esc(cut.slice(0, at)) + '<mark class="occ-mark">' + esc(cut.slice(at, at + len)) + '</mark>' +
          esc(cut.slice(at + len)) + esc(tail);
      }).join('');
    };
    const sa = entries.length
      ? entries.map((e) => '<div class="occ-sa"><span class="occ-no">' + esc(e.no) + '</span>' + markSa(e.sa || '') + '</div>').join('')
      : '<div class="occ-sa muted">（這一句沒有梵文資料）</div>';
    const mv = activeVersion();
    const t = joinSents(mv, mv.sents.filter((s) => s.u === u).map((s) => s.t));
    const tr = t
      ? '<div class="pv"><span class="pv-l">' + esc(mv.label) + '</span><span class="pv-t">' + esc(t) + '</span></div>'
      : '';
    const base = D.versions[BASE].sents.find((s) => s.u === u);
    return '<div class="occ-open">' + sa + tr +
      '<button class="occ-go" data-u="' + u + '">前往第 ' + (base ? base.s : '?') + ' 分 →</button></div>';
  }

  function inlineFanHtml(u) {    const list = (D.pdf || []).filter((e) => (e.us || []).includes(u));
    if (!list.length) return '';
    return '<div class="ifan" data-u="' + u + '">' + list.map(function (e) {
      const ws = e.words || [];
      const sa = ws.length
        ? ws.map(function (w) {
            return '<span class="sw c-' + w.c + '" data-i="' + (w.i - 1) + '" data-no="' + esc(e.no) + '">' + esc(w.s) + '<sup class="wn">' + w.i + '</sup></span>';
          }).join(' ')
        : esc(e.sa || '');
      return '<div class="ifan-item" data-no="' + esc(e.no) + '">' +
        '<div class="ifan-head">' + esc(e.no) + '</div>' +
        '<div class="ifan-sa">' + sa + '</div>' +
        '<div class="ifan-tib">' + tibHtml(e) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

    function tibHtml(e) {
      const raw = String(e.tib || '');
      const words = e.words || [];
      if (!raw) return '';
      const cleanTib = (x) => String(x || '').replace(/[་།\s]/g, '');
      let clean = '';
      const cmap = [];
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (/[་།\s]/.test(ch)) continue;
        clean += ch;
        cmap.push(i);
      }
      const pick = (q, wi) => {
        if (!q) return null;
        let best = -1, bestDist = 1e9;
        let idx = clean.indexOf(q);
        while (idx >= 0) {
          const expect = (wi / Math.max(1, words.length)) * clean.length;
          const d = Math.abs(idx - expect);
          if (d < bestDist) { bestDist = d; best = idx; }
          idx = clean.indexOf(q, idx + 1);
        }
        return best >= 0 ? { idx: best, len: q.length } : null;
      };
      const spans = [];
      words.forEach(function (w, wi) {
        let c = cleanTib(w.tib);
        if (!c) return;
        let hit = pick(c, wi);
        if (!hit) {
          for (let L = c.length - 1; L >= 6; L--) {
            hit = pick(c.slice(0, L), wi);
            if (hit) break;
          }
        }
        if (!hit) return;
        const s = cmap[hit.idx];
        const e = cmap[hit.idx + hit.len - 1] + 1;
        spans.push({ s, e, w });
      });
      spans.sort((a, b) => a.s - b.s);
      let cur = 0;
      let out = '';
      for (const sp of spans) {
        if (sp.s < cur) continue;
        out += esc(raw.slice(cur, sp.s));
        out += '<span class="tw c-' + sp.w.c + '" data-i="' + (sp.w.i - 1) + '">' + esc(raw.slice(sp.s, sp.e)) + '</span>';
        cur = sp.e;
      }
      return out + esc(raw.slice(cur));
    }

  function showWordTip(el, w, e) {
    const tip = document.getElementById('wtip');
    if (!tip) return;
    const parts = (w.parts || []).map((x) => esc(x.s) + '（' + esc(x.zh) + '）').join(' ＋ ');
    const eq = e ? [['奘', e.zang || ''], ['淨', e.jing || ''], ['什', e.shi || '']].map((p) => {
      const m = matchZh(p[1], w, (e.words || []).length);
      return m ? p[0] + '「' + esc(m.c) + '」' + (m.inf ? '°' : '') : '';
    }).filter(Boolean).join(' · ') : '';
    tip.innerHTML = '<div><span class="wt-sa">' + esc(w.s) + '</span>' +
      (w.l ? '<span class="wt-lem">（' + esc(w.l) + '）</span>' : '') +
      '<span class="wt-pos">' + esc(w.p) + '</span></div>' +
      '<div class="wt-zh">' + esc(w.zh || '') + (w.zh0 && w.zh0 !== w.zh ? '（原：' + esc(w.zh0) + '）' : '') + '</div>' +
      (parts ? '<div class="wt-en">拆：' + parts + '</div>' : '') +
      (eq ? '<div class="wt-en">對應：' + eq + '</div>' : '') +
      (w.en ? '<div class="wt-en">' + esc(w.en) + '</div>' : '') +
      (w.tib ? '<div class="wt-tib">' + esc(w.tib) + '</div>' : '');
    tip.classList.add('on');
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8);
    let y = r.bottom + 8;
    if (y + th > window.innerHeight - 8) y = Math.max(8, r.top - th - 8);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
  }
  // 手機點一下詞就把卡片留住（pointerleave／捲動都不要關），點卡片以外才關
  function hideWordTip() {
    if (state.tipPin) return;
    const tip = document.getElementById('wtip');
    if (tip) tip.classList.remove('on');
  }
  function forceHideWordTip() {
    state.tipPin = false;
    const tip = document.getElementById('wtip');
    if (tip) tip.classList.remove('on');
  }

  function highlightZh(w, total) {
    const cands = zhCands(w);
    const els = [].slice.call(document.querySelectorAll('.sent.sel,.pv-t'));
    const base = (w.zh || '').replace(/[。、，,；;]+$/, '');
    const rel = total ? ((w.i || 1) - 0.5) / total : null;
    els.forEach(function (el) {
      if (!el.dataset.base) return;
      el.innerHTML = el.dataset.base;
      if (!cands || !cands.length) return;
      const hay = el.innerHTML;
      let best = null, bestD = 1e9;
      for (const c of cands) {
        if (!c) continue;
        const ec = esc(c);
        const at = rel == null ? hay.indexOf(ec) : bestOccur(hay, ec, rel);
        if (at < 0) continue;
        const d = rel == null ? 0 : Math.abs((at + ec.length / 2) / Math.max(1, hay.length) - rel);
        if (d < bestD) { bestD = d; best = { ec, c, at }; }
      }
      if (!best) return;
      el.innerHTML = hay.slice(0, best.at) +
        '<mark class="gl' + (best.c === base ? '' : ' inf') + '">' + best.ec + '</mark>' +
        hay.slice(best.at + best.ec.length);
    });
  }

  function renderSheet(u) {
    renderBody(u);
    addSheetNav(u);
    document.querySelectorAll('.sent.sel,.pv-t').forEach(function (el) { el.dataset.base = el.innerHTML; });
    $('#sheet').classList.remove('closed');
  }

  function addSheetNav(u) {
    const cards = document.getElementById('cards');
    if (!cards || u == null) return;
    // 換頁／換句時先清掉舊的（nav 放在 #cards 外面，重畫注文不會把它洗掉）
    const oldNav = document.querySelector('#sheet .sheet-nav');
    if (oldNav && oldNav.parentNode) oldNav.parentNode.removeChild(oldNav);
    const ver = D.versions[BASE] || {};
    const sents = ver.sents || [];
    const cur = sents.find(function (x) { return x.u === u; });
    if (!cur) return;
    const secSents = sents.filter(function (x) { return x.s === cur.s; });
    const idx = secSents.indexOf(cur);
    const prev = idx > 0 ? secSents[idx - 1] : null;
    const next = idx >= 0 && idx < secSents.length - 1 ? secSents[idx + 1] : null;
    const nav = document.createElement('div');
    nav.className = 'sheet-nav';
    nav.innerHTML =
      '<button type="button" class="sn-btn sn-prev"' + (prev ? '' : ' disabled') + ' title="上一句">‹</button>' +
      '<div class="sn-text">' + esc(cur.t || '') + '</div>' +
      '<button type="button" class="sn-btn sn-next"' + (next ? '' : ' disabled') + ' title="下一句">›</button>';
    const panel = document.querySelector('#sheet .panel');
    if (panel) panel.insertBefore(nav, cards);
    else cards.insertBefore(nav, cards.firstChild);
    // 換句後把面板拉回可視範圍（手機上 selectUnit 會把頁面捲到經文，面板就被推到上面）
    function keepSheetVisible() {
      setTimeout(function () {
        const sheet = document.getElementById('sheet');
        if (!sheet || state.u == null) return;
        // 手機：selectUnit 會把面板收起來，這裡再打開（否則上下句一按面板就不見）
        if (isOverlay()) {
          renderSheet(state.u);
          sheet.classList.remove('closed');
        }
        const r = sheet.getBoundingClientRect();
        if (r.bottom < 80 || r.top > window.innerHeight - 80) sheet.scrollIntoView({ block: 'nearest' });
      }, 60);
    }
    const p = nav.querySelector('.sn-prev');
    const n = nav.querySelector('.sn-next');
    if (p && prev) p.addEventListener('click', function () { selectUnit(prev.u); keepSheetVisible(); });
    if (n && next) n.addEventListener('click', function () { selectUnit(next.u); keepSheetVisible(); });

  }

  function renderEmpty() {
    document.getElementById('cards').innerHTML = '<p class="empty">中欄點一句經文。</p>';
  }

  function applyView() {
    document.body.classList.toggle('notes-off', !state.showNotes);
    try { localStorage.setItem('zhu-notes', state.showNotes ? '1' : '0'); } catch (e) {}
  }
  function toggleNotes() {
    state.showNotes = !state.showNotes;
    if (state.showNotes && state.u == null) { document.getElementById('sheet').classList.remove('closed'); renderEmpty(); }
    applyView();
  }

  function setSection(n) {
    if (!(n >= 1 && n <= (D.sections || []).length)) return;
    const hadSel = state.u != null; // 換章前有選句 → 桌面自動選新章第一句，右欄才不會空掉
    state.sec = n;
    state.u = null;
    renderSectionSelect();
    renderReader();
    document.getElementById('sheet').classList.add('closed');
    renderEmpty();
    window.scrollTo({ top: 0, behavior: 'auto' });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (hadSel && !isOverlay()) {
      const first = D.versions[BASE].sents.find((s) => s.s === n);
      if (first) selectUnit(first.u, { noHash: true });
    }
  }

  // 點句：桌面上右欄一直開著；手機／平板上只把梵藏展開在句下，
  // 面板改由句下那一排按鈕（注疏／別譯／詞組）叫出，不會再蓋掉梵文。
  function selectUnit(u, opts) {
    if (u == null || u < 0) return;
    const hit = D.versions[BASE].sents.find((x) => x.u === u);
    if (hit && hit.s !== state.sec) { state.sec = hit.s; renderSectionSelect(); }
    state.u = u;
    if (!state.showNotes) { state.showNotes = true; applyView(); }
    const overlay = isOverlay();
    if (overlay) $('#sheet').classList.add('closed');
    const sy = window.scrollY;
    renderReader();
    if (overlay) {
      // 手機：梵文展開後若超出畫面，才補最小的捲動量把句子＋梵文＋按鈕整段帶進來
      const el = document.querySelector('.sent[data-u="' + u + '"]');
      const bar = document.querySelector('.actbar[data-u="' + u + '"]');
      if (el) {
        const top = el.getBoundingClientRect().top;
        const bottom = (bar || el).getBoundingClientRect().bottom;
        const room = window.innerHeight - 16;
        // 標題列是 sticky，句子至少要留在它下緣
        const head = document.getElementById('top').getBoundingClientRect().height + 8;
        let d = bottom > room ? bottom - room : 0;
        if (top - d < head) d = Math.max(0, top - head);
        if (d > 0) window.scrollTo({ top: Math.max(0, window.scrollY + d), behavior: 'auto' });
      }
    } else {
      window.scrollTo(0, sy);
      openPanel(state.tab);
      const panel = document.querySelector('#sheet .panel');
      if (panel) panel.scrollTop = 0;
    }
    if (!opts || !opts.noHash) { try { history.replaceState(null, '', '#u=' + u); } catch (e) {} }
    if (!overlay && (!opts || opts.scroll)) {
      const el = document.querySelector('.sent[data-u="' + u + '"]');
      if (el) { const r = el.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, window.scrollY + r.top - window.innerHeight / 2), behavior: 'auto' }); }
    }
  }

  // 再點同一句：收起梵文、清掉面板
  function deselectUnit() {
    state.u = null;
    hideWordTip();
    const sy = window.scrollY;
    renderReader();
    window.scrollTo(0, sy);
    document.getElementById('sheet').classList.add('closed');
    renderEmpty();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  // 手機：只收面板，句下的梵藏留著（再點同一句才收）
  function closeSheet() {
    hideWordTip();
    $('#sheet').classList.add('closed');
    if (isOverlay()) return;
    state.u = null;
    renderReader();
    renderEmpty();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  /** 分頁照資料長出來：注疏／科判／別譯／辭典／詞組（沒資料就不出現） */
  function buildTabs() {
    const box = document.getElementById('tabs2');
    if (!box) return;
    const defs = [
      ['works', '注疏', (D.works || []).length > 0],
      ['ke', '科判', !!(D.ke && D.ke.length)],
      ['alt', '別譯', (D.versions || []).length > 1 || !!D.english],
      ['gloss', '辭典', !!(D.glossary && D.glossary.entries && D.glossary.entries.length)],
      ['phrase', '詞組', (D.pdf || []).length > 0],
    ].filter(function (x) { return x[2]; });
    const cur = state.tab || 'works';
    box.innerHTML = defs.map(function (x) {
      return '<button data-t="' + x[0] + '"' + (x[0] === cur ? ' class="on"' : '') + '>' + x[1] + '</button>';
    }).join('');
    if (!defs.some(function (x) { return x[0] === cur; })) state.tab = defs.length ? defs[0][0] : 'works';
  }

  /** 頂欄「辭」：切到辭典分頁並聚焦搜尋；再按一次回上一個分頁 */
  function openGloss() {
    if (!GLOSS) return;
    const sheet = document.getElementById('sheet');
    if (state.tab === 'gloss' && state.u != null) {
      setTab(state.prevTab || 'works');
      if (state.u != null) renderSheet(state.u);
      return;
    }
    state.prevTab = state.tab;
    if (state.u == null) {
      const sec = state.sec || 1;
      const first = (D.versions[BASE].sents.find(function (x) { return x.s === sec; }) || {}).u;
      if (first != null) state.u = first;
    }
    state.tab = 'gloss';
    if (sheet) sheet.classList.remove('closed');
    setTab('gloss');
    if (state.u != null) renderSheet(state.u);
    else { buildTabs(); GLOSS.mount(document.getElementById('cards')); }
    setTimeout(function () { GLOSS.focus(); }, 120);
  }

  function setTab(t) {
    state.tab = t;
    document.querySelectorAll('#tabs2 button').forEach((x) => x.classList.toggle('on', x.dataset.t === t));
  }
  function openPanel(tab) {
    if (state.u == null) return;
    setTab(tab || state.tab);
    renderSheet(state.u);
    const panel = document.querySelector('#sheet .panel');
    if (panel) panel.scrollTop = 0;
  }
  /* ---------- 上下一句 ---------- */
  function unitSeq() {
    const seen = [];
    D.versions[BASE].sents.forEach((s) => { if (seen[seen.length - 1] !== s.u) seen.push(s.u); });
    return seen;
  }
  function move(dir) {
    if (state.u == null) return;
    const seq = unitSeq();
    const i = seq.indexOf(state.u);
    const j = i + dir;
    if (j >= 0 && j < seq.length) selectUnit(seq[j], { scroll: true });
  }

  /* ---------- 搜尋（放大鏡面板） ---------- */
  const SEARCH = { scope: 'sutra', q: '', page: 0, results: [], cache: {}, timer: null };
  const SP_PER = 10;
  const canon = (s) => (window.LOSSLESS ? window.LOSSLESS.canon(String(s == null ? '' : s)) : String(s == null ? '' : s));

  function searchIndexFor(scope) {
    if (SEARCH.cache[scope]) return SEARCH.cache[scope];
    const list = [];
    if (scope === 'kepan') {
      const K = window.KEPAN;
      (K && K.editions ? K.editions : []).forEach((ed) => {
        if (ed.id === 'zhaoming') return;   // 昭明就是經文本身，已在「經文」範圍
        (ed.nodes || []).forEach((n) => {
          const label = [n.lab, n.nm].filter(Boolean).join(' ').trim();
          if (!label) return;
          list.push({ text: canon(label), raw: label, u: n.u, ed: ed.short });
        });
      });
    } else if (scope === 'notes') {
      for (const w of D.works) {
        if (!w.text) continue;
        const anchors = (w.anchors || []).slice().sort((a, b) => a[1] - b[1]);
        list.push({ text: canon(w.text), raw: w.text, w: w, anchors: anchors });
      }
    } else {
      for (const se of D.versions[BASE].sents) list.push({ text: canon(se.t), raw: se.t, u: se.u, sec: se.s });
    }
    SEARCH.cache[scope] = list;
    return list;
  }

  function anchorU(anchors, at) {
    if (!anchors || !anchors.length) return null;
    for (const a of anchors) if (at >= a[1] && at < a[2]) return a[0];
    let best = null;
    for (const a of anchors) { if (a[1] <= at) best = a; else break; }
    return best ? best[0] : anchors[0][0];
  }

  function secOf(u) {
    const se = D.versions[BASE].sents.find((x) => x.u === u);
    return se ? se.s : '';
  }

  function excerptHtml(raw, at, len) {
    const PAD = 34;
    const from = Math.max(0, at - PAD);
    const to = Math.min(raw.length, at + len + PAD);
    return (from > 0 ? '…' : '') + esc(raw.slice(from, at)) + '<mark>' + esc(raw.slice(at, at + len)) + '</mark>' +
      esc(raw.slice(at + len, to)) + (to < raw.length ? '…' : '');
  }

  function runSearch(q) {
    SEARCH.q = String(q == null ? '' : q);
    SEARCH.page = 0;
    const nq = canon(SEARCH.q.trim()).replace(/\s+/g, '');
    if (!nq) { SEARCH.results = []; renderSearch(); return; }
    const idx = searchIndexFor(SEARCH.scope);
    const out = [];
    const MAX = 300;
    for (const it of idx) {
      if (SEARCH.scope === 'notes') {
        let from = 0;
        for (;;) {
          const at = it.text.indexOf(nq, from);
          if (at < 0) break;
          out.push({ kind: 'notes', w: it.w, anchors: it.anchors, at: at, len: nq.length, raw: it.raw });
          from = at + nq.length;
          if (out.length >= MAX) break;
        }
      } else {
        const at = it.text.indexOf(nq);
        if (at >= 0) out.push(Object.assign({ kind: SEARCH.scope, at: at, len: nq.length }, it));
      }
      if (out.length >= MAX) break;
    }
    SEARCH.results = out;
    renderSearch();
  }

  function renderSearch() {
    const list = document.getElementById('spList');
    const pager = document.getElementById('spPager');
    const count = document.getElementById('spCount');
    if (!list) return;
    const total = SEARCH.results.length;
    if (count) count.textContent = total ? total + ' 筆' : '';
    if (!total) {
      list.innerHTML = '<p class="sp-empty">' +
        (SEARCH.q.trim() ? '找不到「' + esc(SEARCH.q) + '」' : '輸入關鍵字：預設搜經文，也可切到科文、注文。') + '</p>';
      if (pager) pager.hidden = true;
      return;
    }
    const pages = Math.max(1, Math.ceil(total / SP_PER));
    if (SEARCH.page > pages - 1) SEARCH.page = pages - 1;
    if (SEARCH.page < 0) SEARCH.page = 0;
    const rows = SEARCH.results.slice(SEARCH.page * SP_PER, SEARCH.page * SP_PER + SP_PER);
    list.innerHTML = rows.map((r, i) => {
      const ix = SEARCH.page * SP_PER + i;
      let meta = '';
      if (r.kind === 'notes') {
        const u = anchorU(r.anchors, r.at);
        const sec = u == null ? '' : secOf(u);
        meta = esc(r.w.author) + '《' + esc(r.w.title) + '》' + (sec ? ' · 第 ' + sec + ' 分' : '');
      } else if (r.kind === 'kepan') {
        meta = esc(r.ed) + ' 科文' + (r.u >= 0 ? ' · 第 ' + secOf(r.u) + ' 分' : '');
      } else {
        meta = '第 ' + esc(r.sec) + ' 分';
      }
      return '<div class="sp-row"><button type="button" class="sp-go" data-i="' + ix + '">' +
        '<span class="sp-meta">' + meta + '</span>' +
        '<span class="sp-text">' + excerptHtml(r.raw, r.at, r.len) + '</span></button></div>';
    }).join('');
    if (pager) {
      pager.hidden = pages <= 1;
      pager.innerHTML = '<button type="button" data-pg="-1"' + (SEARCH.page <= 0 ? ' disabled' : '') + '>‹ 上一頁</button>' +
        '<span>' + (SEARCH.page + 1) + ' / ' + pages + '</span>' +
        '<button type="button" data-pg="1"' + (SEARCH.page >= pages - 1 ? ' disabled' : '') + '>下一頁 ›</button>';
    }
  }

  function setScope(scope) {
    SEARCH.scope = scope;
    document.querySelectorAll('#searchPanel .sp-scopes button').forEach((b) => {
      const on = b.dataset.scope === scope;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    runSearch(document.getElementById('spInput') ? document.getElementById('spInput').value : SEARCH.q);
  }

  function openSearch(q) {
    const panel = document.getElementById('searchPanel');
    if (!panel) return;
    panel.hidden = false;
    document.body.classList.add('searching');
    hideBmList();
    const inp = document.getElementById('spInput');
    if (inp) {
      if (q != null) inp.value = q;
      inp.focus();
      try { inp.select(); } catch (e) {}
    }
    runSearch(inp ? inp.value : '');
  }

  function closeSearch() {
    const panel = document.getElementById('searchPanel');
    if (panel) panel.hidden = true;
    document.body.classList.remove('searching');
  }

  function spGo(ix) {
    const r = SEARCH.results[ix];
    if (!r) return;
    if (r.kind === 'notes') {
      const u = anchorU(r.anchors, r.at);
      closeSearch();
      if (u == null) return;
      state.pick = [r.w.id];
      state.tab = 'works';
      selectUnit(u, { scroll: true });
      openPanel('works');
      return;
    }
    closeSearch();
    if (r.u != null && r.u >= 0) selectUnit(r.u, { scroll: true });
  }

  // 舊介面（?q= 與導覽）留一個入口
  function search(q) { openSearch(q); }

  /* ---------- 事件 ---------- */
  function bind() {
    $('#reader').addEventListener('click', (e) => {
      // 句下那排按鈕：才開面板
      const ab = e.target.closest('.actbar button');
      if (ab) { e.preventDefault(); openPanel(ab.dataset.open); return; }
      const s = e.target.closest('.sent');
      if (!s) return;
      const u = +s.dataset.u;
      if (state.u === u) { deselectUnit(); return; } // 再點同一句＝收起梵文
      selectUnit(u);
    });
    let lastHover = null;
    const activateWord = (el, pointerType) => {
      const item = el.closest('.ifan-item');
      if (!item) return;
      const box = el.closest('.ifan') || item;
      const i = el.dataset.i;
      // 只在同一則梵文（同一個 .ifan-item）裡標同一個詞，別連動到別的句子
      item.querySelectorAll('.sw,.tw').forEach((x) => x.classList.toggle('on', x.dataset.i === i));
      if (box !== item) box.querySelectorAll('.ifan-item').forEach((it) => { if (it !== item) it.querySelectorAll('.sw.on,.tw.on').forEach((x) => x.classList.remove('on')); });
      const e = (D.pdf || []).find((p) => p.no === item.dataset.no);
      const w = e && e.words && e.words[+i];
      if (!w) return;
      highlightZh(w, (e.words || []).length);
      state.tipPin = pointerType === 'touch'; // 手指點的才留住（滑鼠 hover 照舊）
      showWordTip(el, w, e);
    };
    document.getElementById('reader').addEventListener('pointerover', (ev) => {
      const el = ev.target.closest('.sw,.tw');
      if (!el || el === lastHover) return;
      lastHover = el;
      activateWord(el, ev.pointerType);
    });
    document.getElementById('reader').addEventListener('pointerleave', () => { lastHover = null; hideWordTip(); });
    window.addEventListener('scroll', () => { if (!state.tipPin) hideWordTip(); }, { passive: true });
    // 觸控時點卡片以外的地方才收起來
    document.addEventListener('pointerdown', (ev) => {
      if (!state.tipPin) return;
      if (ev.target.closest('#wtip,.sw,.tw')) return;
      forceHideWordTip();
    }, true);

    $('#reader').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-goto]');
      if (b) setSection(+b.dataset.goto);
    });
    $('#close').addEventListener('click', closeSheet);
    $('#sheet').addEventListener('click', (e) => { if (e.target.matches('[data-close]')) closeSheet(); });
    $('#tabs2').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-t]');
      if (!b) return;
      setTab(b.dataset.t);
      const oldNav = document.querySelector('#sheet .sheet-nav');
      if (oldNav && oldNav.parentNode) oldNav.parentNode.removeChild(oldNav);
      if (state.u != null) {
        renderBody(state.u);
        if (b.dataset.t === 'works') addSheetNav(state.u);
        document.querySelectorAll('.sent.sel,.pv-t').forEach(function (el) { el.dataset.base = el.innerHTML; });
      }
    });
    $('#cards').addEventListener('click', (e) => {
      // 別譯：點譯者名切換要看的譯本
      const ab = e.target.closest('.altbtn');
      if (ab) {
        const i = +ab.dataset.a;
        if (state.altPick == null) state.altPick = [BASE];
        const k = state.altPick.indexOf(i);
        if (k >= 0) state.altPick.splice(k, 1);
        else { if (state.altPick.length >= 5) return; state.altPick.unshift(i); }
        renderAlt(state.u);
        return;
      }
      // 詞組頁「另見」：展開那一句的梵文＋各譯本（不跳走）
      const go = e.target.closest('button.occ-go');
      if (go) {
        e.preventDefault();
        selectUnit(+go.dataset.u, { scroll: true });
        return;
      }
      const link = e.target.closest('a[data-u]');
      if (link) {
        e.preventDefault();
        const u = +link.dataset.u;
        const key = [link.dataset.no, link.dataset.i, u].join(':');
        const host = link.closest('.ph-row') || link.parentElement;
        const open = host.querySelector('.occ-open');
        // 點的是已經展開的那一筆 → 收起；點別的 → 直接換成那一筆
        if (open && open.dataset.key === key) { open.remove(); return; }
        document.querySelectorAll('.occ-open').forEach((x) => x.remove());
        const se = (D.pdf || []).find((p) => p.no === link.dataset.no);
        const sw = se && se.words && se.words[+link.dataset.i];
        host.insertAdjacentHTML('beforeend', occDetailHtml(u, sw));
        const el = host.lastElementChild;
        if (el && el.classList.contains('occ-open')) el.dataset.key = key;
        return;
      }
      const row = e.target.closest('.ph-row');
      if (row) {
        const pe = (D.pdf || []).find((p) => p.no === row.dataset.no);
        const pw = pe && pe.words && pe.words[+row.dataset.i];
        if (pw) {
          highlightZh(pw, (pe.words || []).length);
          showWordTip(row, pw, pe);
        }
        return;
      }
      // 注疏：愛心（書籤）、翻頁
      const bm = e.target.closest('.bm');
      if (bm) { e.preventDefault(); e.stopPropagation(); bmToggle(bm.dataset.w); return; }
      const pg = e.target.closest('button.pg');
      if (pg) {
        e.preventDefault(); e.stopPropagation();
        const pe = pg.closest('p.ex');
        if (pe) showPage(pe, (state.page[pe.dataset.w] || 0) + (+pg.dataset.d));
        return;
      }
      // 注疏：點作者名開／關
      const nb = e.target.closest('.notebtn');
      if (nb) {
        if (togglePick(nb.dataset.w) === null) return; // 已滿 3 家
        renderCards(state.u);
        return;
      }
      const up = e.target.closest('.unpick');
      if (up) { togglePick(up.dataset.w); renderCards(state.u); return; }
    });
    const fsBtn = document.getElementById('fsBtn');
    if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
    const simBtn = document.getElementById('simBtn');
    if (simBtn) simBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSim(); });
    const bmBtn = document.getElementById('bmBtn');
    if (bmBtn) bmBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleBmList(); });
    const bmList = document.getElementById('bmList');
    if (bmList) {
      bmList.addEventListener('click', (e) => {
        const go = e.target.closest('.bm-go');
        if (go) { openBm(go.dataset.w); return; }
        const del = e.target.closest('.bm-del');
        if (del) { bmToggle(del.dataset.w); return; }
        if (e.target.closest('.bm-x')) hideBmList();
      });
    }
    document.addEventListener('click', (e) => {
      const l = document.getElementById('bmList');
      if (l && !l.hidden && !e.target.closest('#bmList') && !e.target.closest('#bmBtn')) l.hidden = true;
    });
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.addEventListener('click', (e) => { e.stopPropagation(); openSearch(''); });
    const spPanel = document.getElementById('searchPanel');
    if (spPanel) {
      const inp = document.getElementById('spInput');
      if (inp) {
        inp.addEventListener('input', () => {
          clearTimeout(SEARCH.timer);
          SEARCH.timer = setTimeout(() => runSearch(inp.value), 120);
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); clearTimeout(SEARCH.timer); runSearch(inp.value); }
        });
      }
      spPanel.addEventListener('click', (e) => {
        if (e.target.closest('[data-sp-close]') || e.target.closest('#spClose')) { closeSearch(); return; }
        const sc = e.target.closest('.sp-scopes button');
        if (sc) { setScope(sc.dataset.scope); return; }
        const go = e.target.closest('.sp-go');
        if (go) { spGo(+go.dataset.i); return; }
        const pg = e.target.closest('#spPager button');
        if (pg) {
          SEARCH.page += (+pg.dataset.pg);
          renderSearch();
        }
      });
    }
    const secSel = document.getElementById('sec-select');
    if (secSel) secSel.addEventListener('change', (e) => setSection(+e.target.value));
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); toggleNotes(); return; }
      if (e.key === 'Escape') {
        const sp = document.getElementById('searchPanel');
        if (sp && !sp.hidden) { closeSearch(); return; }
        closeSheet();
      }
      if (e.target.matches('input,textarea')) return;
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
    });
  }

  /* ---------- 主題 ---------- */
  function syncTheme() {
    const dark = document.body.classList.contains('dark');
    const b = document.getElementById('theme');
    if (b) b.textContent = dark ? '☀' : '☾';
  }
  /* ---------- 微信號：手機點一下複製（桌面純文字，不放 weixin:// 連結） ---------- */
  function wxToast(msg) {
    let el = document.getElementById('wxToast');
    if (!el) { el = document.createElement('div'); el.id = 'wxToast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(wxToast._t);
    wxToast._t = setTimeout(function () { el.style.opacity = '0'; }, 2200);
  }
  function wxCopy(text) {
    const fallback = function () {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) { return false; }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }
  /** 頁尾：每個數據工作區有自己的發起人／聯絡方式（meta.foot），沒有就不顯示 */
  function renderFoot() {
    const foot = document.getElementById('foot');
    const box = document.getElementById('footFree');
    if (!foot || !box) return;
    const f = (D.meta && D.meta.foot) || null;
    if (!f) { foot.hidden = true; box.innerHTML = ''; return; }
    const parts = [];
    if (f.initiator) parts.push('<span class="foot-initiator">' + esc(f.initiator) + '</span>');
    if (f.free) parts.push('<b>' + esc(f.free) + '</b>');
    if (f.sponsor && f.sponsor.text) {
      const t = esc(f.sponsor.text);
      parts.push(f.sponsor.url
        ? '<a href="' + esc(f.sponsor.url) + '" target="_blank" rel="noopener">' + t + '</a>' + esc(f.sponsor.after || '')
        : t + esc(f.sponsor.after || ''));
    }
    if (f.contact) parts.push(esc(f.contact));
    if (f.wechat && f.wechat.id) {
      parts.push('微信：<span class="wx-id" id="wxId" data-wx="' + esc(f.wechat.id) + '" title="' +
        esc(f.wechat.id) + '">' + esc(f.wechat.id) + '</span>' +
        (f.wechat.note ? '，' + esc(f.wechat.notePrefix || '加微注明「') + esc(f.wechat.note) + esc(f.wechat.noteSuffix || '」') : ''));
    }
    if (f.extra) parts.push(esc(f.extra));
    box.innerHTML = parts.join('　');
    foot.hidden = false;
  }

  function initWx() {
    const el = document.getElementById('wxId');
    if (!el) return;
    const touch = window.matchMedia('(hover: none), (max-width: 760px)').matches;
    document.body.classList.toggle('wx-tap', touch);
    if (!touch || el.dataset.wxBound) return;
    el.dataset.wxBound = '1';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var id = el.dataset.wx || el.textContent.trim();
      var done = false;
      var say = function (ok) {
        done = true;
        wxToast(ok ? '微信號已複製，打開微信搜尋它' : '請長按複製：' + id);
      };
      try {
        wxCopy(id).then(say, function () { say(false); });
      } catch (err) { say(false); }
      // 剪貼簿若被瀏覽器擋住（沒有使用者手勢／權限），至少給一個提示
      setTimeout(function () { if (!done) wxToast('微信號：' + id + '（打開微信搜尋）'); }, 700);
    });
  }

  /* ---------- 辭典（資料可選：ZHU.glossary；右欄分頁） ---------- */
  const GLOSS = (function () {
    const G = D.glossary;
    if (!G || !Array.isArray(G.entries) || !G.entries.length) return null;
    const KEY = 'zhu.glossary.v1';
    const CAT_ALL = '全部';
    const HUE = { 人物: 12, 名詞: 200, 論點: 280, 呂澂批評: 0, 譯者版本: 120 };
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
    const state2 = { cat: saved.cat || CAT_ALL, q: saved.q || '', idx: 0, rows: [], cur: null, root: null };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ cat: state2.cat, q: state2.q })); } catch (e) {} };

    function hit(s, needle) {
      if (!needle) return esc(s);
      const i = s.toLowerCase().indexOf(needle);
      if (i < 0) return esc(s);
      return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + needle.length)) + '</mark>' + esc(s.slice(i + needle.length));
    }
    function hayStrict(e) {
      return [e.term, (e.aliases || []).join(' '), e.sa, e.tib, e.en, e.ref, e.category]
        .filter(Boolean).join(' ').toLowerCase();
    }
    function hayAll(e) { return hayStrict(e) + ' ' + String(e.gloss || '').toLowerCase(); }
    function workName(id) {
      const m = (D.meta && D.meta.workNames) || {};
      return m[id] || id;
    }
    function q(sel) { return state2.root ? state2.root.querySelector(sel) : null; }

    function apply() {
      const n = state2.q.trim().toLowerCase();
      const pool = (G.entries || []).filter((e) => state2.cat === CAT_ALL || e.category === state2.cat);
      // 詞條／別名／梵藏英／條號／分類／簡釋都比（規格要求 gloss 也算）
      let rows = pool.filter((e) => !n || hayAll(e).includes(n));
      if (n) {
        const rank = (e) => (String(e.term || '').toLowerCase() === n ? 0 :
          (e.aliases || []).some((a) => String(a).toLowerCase() === n) ? 1 :
          String(e.term || '').toLowerCase().startsWith(n) ? 2 : 3);
        rows = rows.slice().sort((a, b) => rank(a) - rank(b));
      }
      state2.rows = rows;
      state2.idx = Math.min(state2.idx, Math.max(0, rows.length - 1));
      renderList();
      if (rows[state2.idx]) show(rows[state2.idx]); else showEmpty();
    }
    function renderChips() {
      const box = q('.gp-chips');
      if (!box) return;
      const cats = (G.categories || []).slice();
      box.innerHTML = cats.map((c) =>
        '<button type="button" class="gp-chip' + (c.id === state2.cat ? ' on' : '') + '" data-cat="' + esc(c.id) + '">' +
        esc(c.label) + '<span class="n">' + (c.count != null ? c.count : '') + '</span></button>').join('');
    }
    function renderList() {
      const ul = q('.gp-list'), empty = q('.gp-empty');
      if (!ul) return;
      const n = state2.q.trim().toLowerCase();
      ul.innerHTML = state2.rows.map((e, i) =>
        '<li class="gp-item' + (i === state2.idx ? ' on' : '') + '" data-i="' + i + '">' +
        '<div class="gp-term"><span class="gp-dot" style="background:hsl(' + (HUE[e.category] || 20) + ' 62% 45%)"></span>' +
        hit(String(e.term || ''), n) + '</div>' +
        '<div class="gp-sub">' + esc(e.category || '') + (e.count != null ? ' · ' + e.count + ' 次' : '') +
        ((e.aliases || []).length ? ' · ' + esc(e.aliases.join('、')) : '') + '</div></li>').join('');
      if (empty) empty.hidden = state2.rows.length > 0;
    }
    function showEmpty() {
      const d = q('.gp-detail');
      if (d) d.innerHTML = '<p class="gp-hint">沒有符合的詞條。</p>';
    }
    function show(e) {
      state2.cur = e;
      const box = q('.gp-detail');
      if (!box) return;
      const n = state2.q.trim().toLowerCase();
      const alias = (e.aliases || []).length ? '<p class="gp-alias">別名：' + esc(e.aliases.join('、')) + '</p>' : '';
      const rowsHtml = [['梵', e.sa], ['藏', e.tib], ['英', e.en]]
        .map(([k, v]) => '<dt>' + k + '</dt><dd>' + (v ? hit(String(v), n) : '<span class="gp-note">—</span>') + '</dd>').join('');
      const hits = e.workHits ? Object.keys(e.workHits).map((k) =>
        '<span>' + esc(workName(k)) + ' ' + e.workHits[k] + '</span>').join('') : '';
      const occ = (e.occurrences || []).slice(0, 5);
      const occTotal = e.count != null ? e.count : (e.occurrences || []).length;
      const list = occ.map((o, i) => {
        const juan = o.juan === 0 ? '卷首' : '卷' + o.juan;
        return '<li data-occ="' + i + '"><span class="meta">' + esc(juan) + ' · ' + esc(o.page || '') + '</span>' +
          hit(String(o.quote || '').slice(0, 90), n) + '</li>';
      }).join('');
      box.innerHTML =
        '<button type="button" class="gp-back" data-gp-back>‹ 回清單</button>' +
        '<h3>' + hit(String(e.term || ''), n) + '</h3>' + alias +
        '<p><span class="gp-cat">' + esc(e.category || '') + '</span>' +
        (e.ref ? ' <span class="gp-cat">呂澂 ' + esc(e.ref) + '</span>' : '') + '</p>' +
        '<p class="gp-gloss">' + (e.gloss ? hit(String(e.gloss), n) : '<span class="gp-note">（無簡釋）</span>') + '</p>' +
        '<dl class="gp-rows">' + rowsHtml + '</dl>' +
        (hits ? '<div class="gp-hits">' + hits + '</div>' : '') +
        (occ.length
          ? '<div class="gp-occ"><h4>書證（共 ' + occTotal + ' 次' +
            (occTotal > occ.length ? '，列前 ' + occ.length + ' 筆' : '') + '）</h4><ol>' + list + '</ol></div>'
          : '<p class="gp-note">研究條目，無主文出處。</p>');
    }
    function jump(occ) {
      if (!occ) return;
      let u = null;
      if (typeof occ.u === 'number') u = occ.u;
      else if (typeof occ.s === 'number' && D.versions[BASE]) {
        const se = D.versions[BASE].sents[occ.s];
        if (se) u = se.u;
      }
      if (u == null) return;
      const sec = (D.versions[BASE].sents.find((x) => x.u === u) || {}).s;
      if (sec != null && state.sec !== sec && ZHU_APP.setSection) ZHU_APP.setSection(sec);
      setTimeout(function () {
        selectUnit(u);
        // 手機：跳完把面板收起，直接看到經文；桌面：切到注疏頁
        try {
          if (isOverlay()) document.getElementById('sheet').classList.add('closed');
          else { setTab('works'); if (state.u != null) renderSheet(state.u); }
        } catch (e) {}
        const el = document.querySelector('#reader .sent[data-u="' + u + '"]');
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1400); }
      }, 60);
    }
    function mount(root) {
      if (!root) return;
      state2.root = root;
      const inline = root.id === 'cards';
      root.innerHTML =
        '<div class="gp-chips"></div>' +
        '<div class="gp-search"><input class="gp-in" type="search" placeholder="搜尋詞條、別名、梵藏英…" autocomplete="off" spellcheck="false" aria-label="搜尋詞條"></div>' +
        '<div class="gp-body">' +
        '<div class="gp-left"><ul class="gp-list"></ul><p class="gp-empty" hidden>沒有符合的詞條。</p></div>' +
        '<div class="gp-right"><div class="gp-detail"><p class="gp-hint">輸入關鍵字開始查；選一條看解釋與出處。</p></div></div></div>';
      const inp = root.querySelector('.gp-in');
      if (inp) inp.value = state2.q;
      renderChips();
      apply();
      if (inp) {
        let t = 0;
        inp.addEventListener('focus', function () { root.classList.add('gp-list-open'); });
        inp.addEventListener('input', function () {
          clearTimeout(t);
          root.classList.add('gp-list-open');
          t = setTimeout(function () { state2.q = inp.value; state2.idx = 0; save(); apply(); }, 120);
        });
        inp.addEventListener('keydown', function (ev) {
          if (ev.key === 'Escape') { inp.blur(); }
          if (ev.key === 'Enter' && state2.rows[state2.idx]) show(state2.rows[state2.idx]);
        });
      }
      root.addEventListener('click', function (ev) {
        const t = ev.target;
        if (!t.closest) return;
        const chip = t.closest('.gp-chip');
        if (chip) { state2.cat = chip.dataset.cat; state2.idx = 0; save(); renderChips(); apply(); root.classList.add('gp-list-open'); return; }
        const it = t.closest('.gp-item');
        if (it) {
          state2.idx = +it.dataset.i;
          renderList();
          if (state2.rows[state2.idx]) show(state2.rows[state2.idx]);
          root.classList.add('gp-detail-open');
          root.classList.remove('gp-list-open');
          return;
        }
        const back = t.closest('[data-gp-back]');
        if (back) { root.classList.remove('gp-detail-open'); root.classList.add('gp-list-open'); return; }
        const oc = t.closest('.gp-occ li[data-occ]');
        if (oc && state2.cur) { jump((state2.cur.occurrences || [])[+oc.dataset.occ]); return; }
      });
    }
    function focusSearch() {
      const inp = q('.gp-in');
      if (inp) { inp.focus(); inp.select && inp.select(); }
    }
    return { mount: mount, focus: focusSearch, has: true };
  })();

  /* ---------- PWA：安裝提示、service worker、全屏關閉鈕 ---------- */
  const PWA = (function () {
    const KEY = 'zhu.pwa.dismissed';
    let deferred = null;
    let bar = null;

    function installed() {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        navigator.standalone === true;
    }
    function isIOS() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    function dismissedRecently() {
      try {
        const t = +localStorage.getItem(KEY) || 0;
        return t && Date.now() - t < 7 * 24 * 3600 * 1000;
      } catch (e) { return false; }
    }
    function dismiss() {
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
      hide();
    }
    function hide() { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); bar = null; }
    function say(html, buttons) {
      hide();
      bar = document.createElement('div');
      bar.id = 'pwaBar';
      bar.setAttribute('role', 'dialog');
      bar.innerHTML = html + '<div class="pwa-b">' +
        buttons.map(function (b, i) { return '<button class="pwa-btn' + (i === 0 ? ' main' : '') + '" data-pwa="' + b.id + '">' + b.text + '</button>'; }).join('') +
        '</div>';
      document.body.appendChild(bar);
      bar.addEventListener('click', function (ev) {
        const b = ev.target.closest('button[data-pwa]');
        if (!b) return;
        if (b.dataset.pwa === 'install') {
          if (deferred) {
            deferred.prompt();
            deferred.userChoice && deferred.userChoice.then(function (c) {
              if (c && c.outcome === 'accepted') hide();
              else dismiss();
            });
            deferred = null;
          } else dismiss();
        } else dismiss();
      });
    }
    function ask() {
      if (installed() || dismissedRecently()) return;
      const title = esc((D.meta && D.meta.title) || document.title || '這個站');
      if (deferred) {
        say('<div class="pwa-t">把「' + title + '」裝到桌面？</div>' +
            '<div class="pwa-s">裝好後可全屏閱讀，離線也打得開。</div>',
            [{ id: 'install', text: '安裝' }, { id: 'later', text: '稍後' }]);
      } else if (isIOS()) {
        say('<div class="pwa-t">加到主畫面</div>' +
            '<div class="pwa-s">Safari：點下方的「分享」→「加入主畫面」，就會像 App 一樣全屏開啟。</div>',
            [{ id: 'later', text: '知道了' }]);
      }
    }
    /** 全屏（已安裝）時在右上角放一顆關閉鈕；瀏覽器分頁裡不放 */
    function closeButton() {
      const on = installed();
      const old = document.getElementById('appClose');
      if (!on) { if (old) old.remove(); return; }
      if (old) return;
      const b = document.createElement('button');
      b.id = 'appClose';
      b.type = 'button';
      b.title = '關閉';
      b.setAttribute('aria-label', '關閉');
      b.textContent = '✕';
      b.addEventListener('click', function () {
        try { window.close(); } catch (e) {}
        setTimeout(function () {
          if (!document.hidden) {
            // 有些環境不允許關，退回上一頁／首頁
            try { history.length > 1 ? history.back() : (location.href = 'about:blank'); } catch (e) {}
          }
        }, 250);
      });
      document.body.appendChild(b);
    }
    function registerSW() {
      if (!('serviceWorker' in navigator)) return;
      if (!/^https?:$/.test(location.protocol)) return; // file:// 不註冊
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function (e) {
        console.warn('service worker 沒註冊成功：' + e.message);
      });
    }
    function init() {
      registerSW();
      closeButton();
      window.matchMedia('(display-mode: fullscreen)').addEventListener &&
        window.matchMedia('(display-mode: fullscreen)').addEventListener('change', closeButton);
      window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferred = e;
        ask();
      });
      window.addEventListener('appinstalled', function () { hide(); });
      setTimeout(ask, 1200);
    }
    return { init: init, installed: installed };
  })();

  /* ---------- 全屏 ---------- */
  function syncFs() {
    const b = document.getElementById('fsBtn');
    if (!b) return;
    const on = !!document.fullscreenElement;
    b.textContent = on ? '⤢' : '⛶';
    b.title = on ? '退出全屏' : '全屏';
    b.setAttribute('aria-pressed', String(on));
  }
  function toggleFs() {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    } catch (e) {}
  }
  document.addEventListener('fullscreenchange', syncFs);

  /* ---------- 繁簡（無損簡體） ---------- */
  function syncSim() {
    const b = document.getElementById('simBtn');
    if (!b) return;
    const on = !!state.sim;
    b.textContent = on ? '繁' : '简';
    b.title = on ? '顯示：無損簡體（點一下回原文）' : '顯示：原文（點一下轉無損簡體）';
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('on', on);
  }
  function rerenderAll() {
    try { renderReader(); } catch (e) {}
    try { if (state.u != null) renderBody(state.u); } catch (e) {}
    try { renderSectionSelect(); } catch (e) {}
    try { if (window.KEPAN && window.KEPAN.rerender) window.KEPAN.rerender(); } catch (e) {}
  }
  function toggleSim() {
    state.sim = state.sim ? 0 : 1;
    try { localStorage.setItem('zhu-sim', state.sim ? '1' : '0'); } catch (e) {}
    syncSim();
    rerenderAll();
  }

  window.__ZHU_SIM = function () { return state.sim; };

  function initTheme() {
    let saved = null;
    const tq = new URLSearchParams(location.search).get('theme');
    if (tq) saved = tq;
    if (!saved) { try { saved = localStorage.getItem('zhu-theme'); } catch (e) {} }
    if (saved === 'dark' || (!saved && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)) document.body.classList.add('dark');
    document.getElementById('theme').addEventListener('click', () => {
      document.body.classList.toggle('dark');
      try { localStorage.setItem('zhu-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); } catch (e) {}
      syncTheme();
    });
    syncTheme();
  }

  function initSplitters() {
    const layout = document.getElementById('layout');
    const el = document.getElementById('split-notes');
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      if (getComputedStyle(el).display === 'none') return; // 覆蓋式面板（<=1060px）沒有分隔線可拖
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add('on');
      document.body.classList.add('dragging');
      const startX = e.clientX;
      const startW = document.getElementById('sheet').getBoundingClientRect().width;
      let lastW = startW;
      const move = (ev) => {
        const d = ev.clientX - startX;
        const w = Math.max(320, Math.min(startW - d, Math.min(880, window.innerWidth - 12 - 360)));
        lastW = w;
        layout.style.setProperty('--notesw', Math.round(w) + 'px');
      };
      const up = () => {
        el.classList.remove('on');
        document.body.classList.remove('dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        try { localStorage.setItem('zhu-notesw', String(Math.round(lastW))); } catch (err) {}
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    el.addEventListener('dblclick', () => {
      layout.style.removeProperty('--notesw');
      try { localStorage.removeItem('zhu-notesw'); } catch (err) {}
    });
  }

  /* ---------- 操作導覽（self-explaining tour）用的最小介面 ---------- */
  // 導覽只透過這幾個動作碰 UI；其餘（選擇器、文案）都在 tours/*.tour 裡
  function tourPickSentence() {
    if (state.u != null && document.querySelector('.ifan')) return; // 已經展開
    const hasSa = new Set();
    (D.pdf || []).forEach((e) => (e.us || []).forEach((x) => hasSa.add(x)));
    const cands = [].slice.call(document.querySelectorAll('#reader .sent[data-u]'))
      .filter((el) => hasSa.has(+el.dataset.u));
    const pick = cands.find((el) => el.querySelector('sup.badge')) || cands[0];
    if (pick) { selectUnit(+pick.dataset.u, { scroll: true }); return; }
    // 這一分沒有梵文：換到第一個有梵文的分
    const first = D.versions[BASE].sents.find((s) => hasSa.has(s.u));
    if (!first) return;
    setSection(first.s);
    selectUnit(first.u, { scroll: true });
  }
  function tourOpenPanel(tab) {
    if (state.u == null) tourPickSentence();
    if (state.u != null) openPanel(tab || 'works');
  }
  function tourReset() {
    document.getElementById('sheet').classList.add('closed');
    hideWordTip();
    if (state.u != null) { state.u = null; renderReader(); renderEmpty(); }
    const q = document.getElementById('q');
    if (q) q.value = '';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  function tourSetTheme(v) {
    const dark = /^(dark|1|on|true)$/i.test(String(v || ''));
    document.body.classList.toggle('dark', dark);
    try { localStorage.setItem('zhu-theme', dark ? 'dark' : 'light'); } catch (e) {}
    syncTheme();
    return true;
  }
  function exposeTourApi() {
    window.ZHU_APP = {
      state: function () {
        return {
          ready: !!(window.ZHU && document.querySelectorAll('#reader .sent').length),
          section: state.sec,
          selected: state.u,
          panel: !document.getElementById('sheet').classList.contains('closed'),
          tab: state.tab,
          overlay: isOverlay(),
        };
      },
      setSection: setSection,
      pickSentence: tourPickSentence,
      openPanel: tourOpenPanel,
      closePanel: closeSheet,
      reset: tourReset,
      setTheme: tourSetTheme,
      openSearch: openSearch,
      closeSearch: closeSearch,
    };
  }

  /* ---------- 啟動 ---------- */
  function boot() {
    const qs = new URLSearchParams(location.search);
    applyMeta();
    initTheme();
    try { if (localStorage.getItem('zhu-sim') === '1') state.sim = 1; } catch (e) {}
    syncSim();
    syncFs();
    renderFoot();
    initWx();
    PWA.init();
    buildTabs();
    if (D.ke && D.ke.length) {
      const kb = document.getElementById('keBtn');
      if (kb) {
        kb.hidden = false;
        kb.addEventListener('click', function (e) {
          e.stopPropagation();
          if (state.u == null) {
            const first = (D.versions[BASE].sents.find(function (x) { return x.s === state.sec; }) || {}).u;
            if (first != null) state.u = first;
          }
          state.tab = 'ke';
          setTab('ke');
          const sh = document.getElementById('sheet');
          if (sh) sh.classList.remove('closed');
          if (state.u != null) renderSheet(state.u); else renderKe();
        });
      }
    }
    if (GLOSS) {
      const gb = document.getElementById('glossBtn');
      if (gb) { gb.hidden = false; gb.addEventListener('click', function (e) { e.stopPropagation(); openGloss(); }); }
    }
    bmLoad();
    // 開發版（資料用 script 直接載入）沒有解壓流程，啟動後收掉遮罩
    const bootEl = document.getElementById('boot');
    if (bootEl) { const bar = document.getElementById('bootBar'); if (bar) bar.style.width = '100%'; setTimeout(function () { bootEl.remove(); }, 60); }
    renderBmList();
    try {
      if (localStorage.getItem('zhu-notes') === '0') state.showNotes = false;
    } catch (e) {}
    if (qs.get('notes') === 'off') state.showNotes = false;
    try {
      const nw = localStorage.getItem('zhu-notesw');
      if (nw) document.getElementById('layout').style.setProperty('--notesw', nw + 'px');
    } catch (e) {}
    const m = /#u=(\d+)/.exec(location.hash);
    if (m) { const hit = D.versions[BASE].sents.find((x) => x.u === +m[1]); if (hit) state.sec = hit.s; }
    renderSectionSelect(); renderReader(); bind();
    initSplitters();
    renderEmpty(); applyView();
    if (m) selectUnit(+m[1], { noHash: true });
    const q = qs.get('q');
    if (q) search(q);
    const wq = qs.get('word');
    const twq = qs.get('tword');
    if (twq) setTimeout(function () { const el = document.querySelector('.ifan-item .tw[data-i="' + twq + '"]'); if (el) el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); }, 200);
    const he = qs.get('he');
    if (wq) setTimeout(function () { const sel = he ? '.ifan-item[data-no="' + he + '"] .sw[data-i="' + wq + '"]' : '.ifan-item .sw[data-i="' + wq + '"]'; const el = document.querySelector(sel); if (el) el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); }, 200);
    const tb = qs.get('tab');
    if (tb === 'alt' || tb === 'phrase' || tb === 'works') { setTab(tb); if (state.u != null) openPanel(tb); }
    exposeTourApi();
    // 這一區沒有導覽劇本（工作區沒提供 tour.js）就把入口收起來
    if (!window.tourState) {
      const t = document.getElementById('tourEntry');
      if (t) t.style.display = 'none';
    }
  }
  boot();
})();

