/* 金剛經合注 · zhu-combined（file:// 可直接開） */
(function () {
  'use strict';
  const D = window.ZHU;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 漢譯句子直接相接；英譯（拉丁字母）要用空格
  const joinSents = (v, parts) => parts.join(v && v.lang === 'en' ? ' ' : '');
  const norm = (s) => s.replace(/[^\u3400-\u9fff]/g, '');
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
  const state = { u: null, sec: 1, pick: [], altPick: null, tipPin: false, tab: 'works', showNotes: true };

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
  // 科判（X466、X491）不是注疏，不列入
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
      '<span class="mid">第 ' + sec + ' 分 / 32</span>' +
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
    else if (state.tab === 'phrase') renderPhrase(u);
    else renderCards(u);
    // 重繪後記下原始 HTML，hover 高亮才有東西可還原
    document.querySelectorAll('.sent.sel,.pv-t').forEach((el) => { el.dataset.base = el.innerHTML; });
  }

  // 比較：同一句最多挑 3 家，跨分期也可以
  function pickEntries(u) {
    const all = (byUnit.get(u) || []).filter(visible);
    const ok = new Set(all.map((x) => x.w.id));
    state.pick = state.pick.filter((id) => ok.has(id));
    return state.pick.map((id) => all.find((x) => x.w.id === id)).filter(Boolean);
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

  function renderCards(u) {
    const list = cardsFor(u);
    const picks = pickEntries(u);
    const ids = new Set(picks.map((x) => x.w.id));
    if (!list.length) { $('#cards').innerHTML = emptyCardsHtml(u); return; }
    let html = '<div class="note-bar">' + list.map((x) =>
      `<button class="notebtn${ids.has(x.w.id) ? ' on' : ''}" data-w="${esc(x.w.id)}" title="${esc(x.w.author)}《${esc(x.w.title)}》">${esc(authorShort(x.w.author))}</button>`
    ).join('') + (u === 38 ? '<a class="note-link" href="shuzheng-u38.md" target="_blank">書證 ↗</a>' : '') + '</div>';
    html += picks.length
      ? picks.map((x) => {
          const raw = x.w.text ? x.w.text.slice(x.a, x.b) : '';
          const body = trimHeading(raw);
          const txt = x.w.text
            ? (body ? esc(body) : '<span class="lite">（這一句沒有疏文）</span>')
            : '<span class="lite">輕量版：此書全文未收錄</span>';
          return '<div class="note-open"><div class="note-h"><b>' + esc(x.w.author) + '</b>《' + esc(x.w.title) + '》' +
            '<span class="note-src">' + esc(x.w.corpus) + ' ' + esc(x.w.no) + ' · ' + esc(x.p) + '</span>' +
            '<button class="unpick" data-w="' + esc(x.w.id) + '" title="收起">✕</button></div>' +
            '<p class="ex">' + txt + '</p></div>';
        }).join('')
      : '<p class="empty">點上面的作者名看注疏（可同時開 1–3 家）。</p>';
    $('#cards').innerHTML = html;
  }

  function togglePick(id) {
    const i = state.pick.indexOf(id);
    if (i >= 0) { state.pick.splice(i, 1); return false; }
    if (state.pick.length >= 3) return null; // 已滿
    state.pick.unshift(id); // 新開的放最前面（prepend），不必往下捲
    return true;
  }

  function emptyCardsHtml(u) {
    return '<p class="empty">這一句目前沒有對應注疏。</p>';
  }

  /* ---------- 面板 ---------- */
  // 別譯：一排譯者名按鈕（inline），可同時挑 1–3 種，新挑的排最前面
  function renderAlt(u) {
    const cards = document.getElementById('cards');
    const avail = D.versions.map(function (v, i) { return { v: v, i: i }; })
      .filter(function (x) { return x.v.sents.some(function (s) { return s.u === u; }); });
    if (!avail.length) { cards.innerHTML = '<p class="empty">此句沒有其他譯本。</p>'; return; }
    const ok = new Set(avail.map(function (x) { return x.i; }));
    if (state.altPick == null) state.altPick = [ok.has(BASE) ? BASE : avail[0].i];
    state.altPick = state.altPick.filter(function (i) { return ok.has(i); });
    const picks = state.altPick;
    const bar = avail.map(function (x) {
      return '<button class="altbtn' + (picks.indexOf(x.i) >= 0 ? ' on' : '') + (x.i === BASE ? ' main' : '') +
        '" data-a="' + x.i + '" title="' + esc(x.v.trans) + '">' + esc(x.v.label) + '</button>';
    }).join('');
    const panes = picks.map(function (i) {
      const v = D.versions[i];
      const t = joinSents(v, v.sents.filter(function (s) { return s.u === u; }).map(function (s) { return s.t; }));
      return '<div class="alt-pane"><div class="alt-who">' + esc(v.label) + '　' + esc(v.trans) + '</div>' +
        (t ? '<div class="alt-body' + (v.lang === 'en' ? ' en' : '') + '">' + esc(t) + '</div>'
           : '<p class="empty">這個譯本沒有對應這一句。</p>') + '</div>';
    }).join('');
    cards.innerHTML = '<div class="alt-bar">' + bar + '</div>' +
      (panes || '<p class="empty">點上面的譯者名看譯文（可同時開 1–3 種）。</p>');
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
    document.querySelectorAll('.sent.sel,.pv-t').forEach(function (el) { el.dataset.base = el.innerHTML; });
    $('#sheet').classList.remove('closed');
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
    if (!(n >= 1 && n <= 32)) return;
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

  /* ---------- 搜尋 ---------- */
  function search(q) {
    const nq = norm(q);
    const latin = /[A-Za-z]/.test(q) && !/[\u3400-\u9fff]/.test(q);
    if (!nq && !latin) return;
    const lq = q.trim().toLowerCase();
    for (let vi = 0; vi < D.versions.length; vi++) {
      const v = D.versions[vi];
      const hit = latin
        ? v.sents.find((s) => s.t.toLowerCase().includes(lq))
        : v.sents.find((s) => norm(s.t).includes(nq));
      if (hit) {
        if (hit.s !== state.sec) { state.sec = hit.s; renderSectionSelect(); }
        // 命中羅什以外（英譯、古譯…）：跳同一句，並把「別譯」分頁開到那一家
        if (vi !== BASE) { state.altPick = [vi]; state.tab = 'alt'; }
        selectUnit(hit.u, { scroll: true });
        if (vi !== BASE) openPanel('alt');
        return;
      }
    }
    alert('找不到：' + q);
  }

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
      if (state.u != null) { renderBody(state.u); document.querySelectorAll('.sent.sel,.pv-t').forEach(function (el) { el.dataset.base = el.innerHTML; }); }
    });
    $('#cards').addEventListener('click', (e) => {
      // 別譯：點譯者名切換要看的譯本
      const ab = e.target.closest('.altbtn');
      if (ab) {
        const i = +ab.dataset.a;
        if (state.altPick == null) state.altPick = [BASE];
        const k = state.altPick.indexOf(i);
        if (k >= 0) state.altPick.splice(k, 1);
        else { if (state.altPick.length >= 3) return; state.altPick.unshift(i); }
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
    $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') search(e.target.value); });
    const secSel = document.getElementById('sec-select');
    if (secSel) secSel.addEventListener('change', (e) => setSection(+e.target.value));
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); toggleNotes(); return; }
      if (e.key === 'Escape') closeSheet();
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
    };
  }

  /* ---------- 啟動 ---------- */
  function boot() {
    const qs = new URLSearchParams(location.search);
    initTheme();
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
  }
  boot();
})();

