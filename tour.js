(() => {
  // src/tour/format.ts
  var TOUR_MAGIC = "TOUR1";
  var LEGACY_MAGICS = ["AC26T"];
  var TOUR_FMT = 1;
  var OP = {
    text: 1,
    point: 2,
    unpoint: 3,
    click: 4,
    type: 5,
    key: 6,
    wait: 7,
    waitFor: 8,
    tab: 9,
    side: 10,
    set: 11,
    call: 12,
    user: 13,
    require: 14,
    skipIf: 15,
    tap: 16
  };
  var OP_NAME = Object.fromEntries(Object.entries(OP).map(([k, v]) => [v, k]));
  var enc = new TextEncoder;
  var dec = new TextDecoder("utf-8");
  class Reader {
    d;
    i = 0;
    constructor(d) {
      this.d = d;
    }
    u8() {
      return this.d[this.i++] ?? 0;
    }
    u16() {
      const v = (this.d[this.i] ?? 0) | (this.d[this.i + 1] ?? 0) << 8;
      this.i += 2;
      return v;
    }
    u32() {
      const v = ((this.d[this.i] ?? 0) | (this.d[this.i + 1] ?? 0) << 8 | (this.d[this.i + 2] ?? 0) << 16 | (this.d[this.i + 3] ?? 0) << 24) >>> 0;
      this.i += 4;
      return v;
    }
    raw(n) {
      const r = this.d.subarray(this.i, this.i + n);
      this.i += n;
      return r;
    }
    str() {
      return dec.decode(this.raw(this.u16()));
    }
    ascii(n) {
      return String.fromCharCode(...this.raw(n));
    }
    get eof() {
      return this.i >= this.d.length;
    }
  }
  var CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0;n < 256; n++) {
      let c = n;
      for (let k = 0;k < 8; k++)
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 4294967295;
    for (let i = 0;i < bytes.length; i++)
      c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ c >>> 8;
    return (c ^ 4294967295) >>> 0;
  }
  function decodeTour(bytes, magic = TOUR_MAGIC) {
    const r = new Reader(bytes);
    const gotMagic = r.ascii(5);
    const accepted = new Set([magic, TOUR_MAGIC, ...LEGACY_MAGICS]);
    if (!accepted.has(gotMagic))
      throw new Error(`not a tour macro (magic=${JSON.stringify(gotMagic)})`);
    const fmt = r.u8();
    if (fmt !== TOUR_FMT)
      throw new Error(`tour macro format ${fmt}; this player understands ${TOUR_FMT} (update the player)`);
    r.u8();
    const want = r.u32();
    const got = crc32(bytes.subarray(r.i));
    if (want !== got)
      throw new Error(`tour macro is corrupt (CRC ${got.toString(16)} ≠ ${want.toString(16)})`);
    const tour = {
      id: r.str(),
      title: r.str(),
      intro: r.str(),
      require: r.str(),
      scenes: []
    };
    const n = r.u16();
    for (let i = 0;i < n; i++) {
      const sc = { title: r.str(), body: r.str(), steps: [] };
      const m = r.u16();
      for (let j = 0;j < m; j++) {
        const op = r.u8();
        const argc = r.u8();
        const args = [];
        for (let k = 0;k < argc; k++)
          args.push(r.str());
        if (!OP_NAME[op])
          throw new Error(`scene ${i + 1} step ${j + 1}: unknown opcode ${op}`);
        sc.steps.push({ op, args });
      }
      tour.scenes.push(sc);
    }
    if (!r.eof)
      throw new Error(`tour macro has ${bytes.length - r.i} trailing bytes`);
    return tour;
  }
  function fromBase64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0;i < bin.length; i++)
      out[i] = bin.charCodeAt(i);
    return out;
  }

  // src/tour/player.ts
  var data = { index: [], blobs: {} };
  var prefix = "tour";
  var appName = "this app";
  var modalIds = [];
  var finishHtml = "";
  var magic = TOUR_MAGIC;
  var PKEY = (id) => `${prefix}.${id}`;
  var app = null;
  var cur = null;
  var seq = 0;
  var phase = "idle";
  var waitKind = "none";
  var note = "";
  var pointSel = null;
  var failed = [];
  var pending = null;
  var userDone = false;
  var skipReq = false;
  var tapped = false;
  var raf = 0;
  var cache = new Map;
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  var el = (id) => document.getElementById(id);
  function q(sel) {
    try {
      return document.querySelector(sel);
    } catch {
      return null;
    }
  }
  function visible(e) {
    if (!e)
      return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
  }
  function evalCond(cond) {
    let c = cond.trim();
    let neg = false;
    if (c.startsWith("!")) {
      neg = true;
      c = c.slice(1).trim();
    }
    let yes = false;
    try {
      yes = atom(c);
    } catch {
      yes = false;
    }
    return neg ? !yes : yes;
  }
  function atom(c) {
    if (c.startsWith("api:")) {
      const body = c.slice(4);
      const eq = body.indexOf("=");
      const path = (eq < 0 ? body : body.slice(0, eq)).trim();
      const want = eq < 0 ? null : body.slice(eq + 1).trim();
      let v;
      try {
        v = path.split(".").reduce((o, k) => o == null ? undefined : o[k], app?.state?.() ?? {});
      } catch {
        v = undefined;
      }
      return want === null ? !!v : String(v) === want;
    }
    if (c.startsWith("count:")) {
      const m = /^(.*?)\s*(>=|<=|==|!=|>|<)\s*(\d+)$/.exec(c.slice(6).trim());
      if (m) {
        const n = document.querySelectorAll(m[1]).length;
        const k = Number(m[3]);
        switch (m[2]) {
          case ">=":
            return n >= k;
          case "<=":
            return n <= k;
          case "==":
            return n === k;
          case "!=":
            return n !== k;
          case ">":
            return n > k;
          default:
            return n < k;
        }
      }
      try {
        return document.querySelectorAll(c.slice(6).trim()).length > 0;
      } catch {
        return false;
      }
    }
    if (c.startsWith("text:")) {
      const body = c.slice(5);
      const eq = body.indexOf("=");
      if (eq < 0)
        return false;
      const e = q(body.slice(0, eq).trim());
      return !!e && (e.textContent ?? "").includes(body.slice(eq + 1).trim());
    }
    return visible(q(c));
  }
  function load(id) {
    let t = cache.get(id);
    if (t)
      return t;
    const b64 = data.blobs[id];
    if (!b64)
      return null;
    try {
      t = decodeTour(fromBase64(b64), magic);
      cache.set(id, t);
      return t;
    } catch (e) {
      console.error("[tour] 宏解不開", e);
      return null;
    }
  }
  function tourProgress(id) {
    try {
      return Math.max(0, Number(localStorage.getItem(PKEY(id)) ?? "0") || 0);
    } catch {
      return 0;
    }
  }
  function saveProgress(scene) {
    if (!cur)
      return;
    try {
      localStorage.setItem(PKEY(cur.id), String(scene));
    } catch {}
  }
  var mdLite = (src) => src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").split(/\n{2,}/).map((p) => "<p>" + p.replace(/\n/g, "<br>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>") + "</p>").join("");
  function setText(md) {
    const e = el("tourText");
    if (e)
      e.innerHTML = mdLite(md);
  }
  function setNote(msg) {
    note = msg;
    const e = el("tourNote");
    if (e) {
      e.textContent = msg;
      e.hidden = !msg;
    }
  }
  function pointAt(sel) {
    pointSel = sel;
    layout();
  }
  function layout() {
    const spot = el("tourSpot");
    const bubble = el("tourBubble");
    if (!spot || !bubble || bubble.hidden)
      return;
    const target = pointSel ? q(pointSel) : null;
    const r = target ? target.getBoundingClientRect() : null;
    const has = !!r && r.width > 0 && r.height > 0;
    spot.hidden = !has;
    if (has && r) {
      const pad = 4;
      spot.style.left = Math.round(r.left - pad) + "px";
      spot.style.top = Math.round(r.top - pad) + "px";
      spot.style.width = Math.round(r.width + pad * 2) + "px";
      spot.style.height = Math.round(r.height + pad * 2) + "px";
      const lower = r.top + r.height / 2 > window.innerHeight / 2;
      bubble.style.top = lower ? "18px" : "";
      bubble.style.bottom = lower ? "" : "18px";
    } else {
      bubble.style.top = "";
      bubble.style.bottom = "18px";
      if (pointSel) {
        if (!note.startsWith("⚠ 找不到"))
          setNote(`⚠ 找不到「${pointSel}」，或它目前看不到`);
      }
    }
    if (has && note.startsWith("⚠ 找不到"))
      setNote("");
  }
  function startRaf() {
    if (raf)
      return;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      layout();
    };
    raf = requestAnimationFrame(tick);
  }
  function stopRaf() {
    if (raf)
      cancelAnimationFrame(raf);
    raf = 0;
  }
  function showBubble(on) {
    const b = el("tourBubble");
    if (b)
      b.hidden = !on;
    if (!on) {
      const s = el("tourSpot");
      if (s)
        s.hidden = true;
      stopRaf();
      return;
    }
    startRaf();
  }
  function show(id, on, label) {
    const b = el(id);
    if (!b)
      return;
    b.hidden = !on;
    if (on && label)
      b.textContent = label;
  }
  function updateUi() {
    if (!cur)
      return;
    const sc = cur.tour.scenes[cur.scene];
    const where = el("tourWhere");
    if (where)
      where.textContent = `場景 ${cur.scene + 1} / ${cur.tour.scenes.length}`;
    const title = el("tourTitle");
    if (title)
      title.textContent = sc.title;
    const prog = el("tourProg");
    if (prog)
      prog.textContent = `${Math.min(cur.step, sc.steps.length)} / ${sc.steps.length}`;
    const last = cur.scene >= cur.tour.scenes.length - 1;
    show("tourNext", waitKind === "next", last ? "完成 ✓" : "下一個場景 →");
    show("tourDone", waitKind === "user");
    show("tourSkip", waitKind === "user" || waitKind === "cond" || waitKind === "pause", waitKind === "pause" ? "略過這步" : waitKind === "cond" ? "略過等待" : "略過這步");
    show("tourReplay", waitKind !== "none");
    const prev = el("tourPrev");
    if (prev) {
      prev.hidden = false;
      prev.disabled = cur.scene === 0;
    }
    const bubble = el("tourBubble");
    if (bubble)
      bubble.classList.toggle("paused", waitKind === "pause");
  }
  function beginScene(sc) {
    setText(sc.body);
    const title = el("tourTitle");
    if (title)
      title.textContent = sc.title;
    setNote("");
    pointSel = null;
    waitKind = "none";
    phase = "running";
    updateUi();
    layout();
  }
  function interrupt() {
    const p = pending;
    pending = null;
    if (p)
      p("stop");
    userDone = false;
    skipReq = false;
  }
  function ask(kind) {
    waitKind = kind;
    phase = kind === "next" ? "waiting" : "running";
    updateUi();
    return new Promise((res) => {
      pending = (v) => {
        pending = null;
        res(v);
      };
    });
  }
  function fail(msg) {
    note = msg;
    if (cur)
      failed.push({ scene: cur.scene, step: cur.step, msg });
    setNote(msg);
    return "pause";
  }
  async function exec(st, my) {
    const a = st.args;
    switch (st.op) {
      case OP.text:
        setText(a[0]);
        return "ok";
      case OP.point:
        pointAt(a[0]);
        return "ok";
      case OP.unpoint:
        pointAt(null);
        return "ok";
      case OP.click: {
        const e = q(a[0]);
        if (!visible(e))
          return fail(`找不到「${a[0]}」（或它目前看不到）`);
        e.click();
        await sleep(60);
        return "ok";
      }
      case OP.type: {
        const e = q(a[0]);
        if (!e)
          return fail(`找不到輸入框「${a[0]}」`);
        e.focus();
        e.value = a[1] ?? "";
        e.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(60);
        return "ok";
      }
      case OP.key: {
        const target = a[1] ? q(a[1]) : document.activeElement;
        if (!target)
          return fail(`找不到「${a[1] ?? "目前焦點"}」`);
        target.dispatchEvent(new KeyboardEvent("keydown", { key: a[0], bubbles: true, cancelable: true }));
        await sleep(60);
        return "ok";
      }
      case OP.wait:
        await sleep(Number(a[0]) || 0);
        return "ok";
      case OP.waitFor:
        return waitCond(a[0], Number(a[1]) || 5000, my);
      case OP.tab:
        app?.tab?.(a[0], a[1]);
        await sleep(120);
        return "ok";
      case OP.side:
        app?.side?.(a[0], a[1] === "on");
        await sleep(120);
        return "ok";
      case OP.set:
        if (!app?.set?.(a[0], a[1] ?? ""))
          return fail(`不認得的設定「${a[0]}」`);
        await sleep(120);
        return "ok";
      case OP.call:
        try {
          await app?.call?.(a[0], a[1] ?? "");
        } catch (e) {
          return fail(`${a[0]} 失敗：${e?.message ?? e}`);
        }
        return "ok";
      case OP.user:
        return waitUser(a[0], a[1] ?? "", my);
      case OP.tap:
        return waitTap(a[0] ?? "", my);
      case OP.require:
        return waitCond(a[0], 120000, my, `需要：${a[0]}`);
      case OP.skipIf:
        if (evalCond(a[0])) {
          note = `（本場景不適用：${a[0]}）`;
          return "skip";
        }
        return "ok";
      default:
        return fail(`未知指令 ${st.op}`);
    }
  }
  async function waitCond(cond, timeout, my, hint = "") {
    if (evalCond(cond))
      return "ok";
    waitKind = "cond";
    updateUi();
    const t0 = performance.now();
    while (my === seq) {
      if (skipReq) {
        skipReq = false;
        setNote(`（跳過等待：${cond}）`);
        return "ok";
      }
      if (evalCond(cond)) {
        setNote("");
        return "ok";
      }
      const waited = performance.now() - t0;
      if (waited > timeout)
        return fail(`等不到「${cond}」（${Math.round(timeout)} ms）`);
      setNote(`${hint || "等"}：${cond}…`);
      await sleep(100);
    }
    return "ok";
  }
  async function waitUser(text, cond, my) {
    setText(text);
    if (cond && evalCond(cond)) {
      setText(text);
      return "ok";
    }
    waitKind = "user";
    updateUi();
    while (my === seq) {
      if (userDone) {
        userDone = false;
        return "ok";
      }
      if (skipReq) {
        skipReq = false;
        return "ok";
      }
      if (cond && evalCond(cond))
        return "ok";
      await sleep(120);
    }
    return "ok";
  }
  async function waitTap(hint, my) {
    tapped = false;
    waitKind = "tap";
    setNote(hint || "（點畫面任何地方，或按空白鍵，繼續）");
    updateUi();
    while (my === seq) {
      if (tapped) {
        tapped = false;
        setNote("");
        return "ok";
      }
      await sleep(80);
    }
    return "ok";
  }
  async function play(id, from) {
    if (!app)
      return;
    const tour = load(id);
    if (!tour) {
      openTourMenu();
      return;
    }
    interrupt();
    seq++;
    const my = seq;
    const start = Math.max(0, Math.min(from ?? tourProgress(id), tour.scenes.length - 1));
    cur = { id, tour, scene: start, step: 0 };
    failed = [];
    note = "";
    closeTourMenu();
    showBubble(true);
    loop(my).catch((e) => {
      if (my !== seq)
        return;
      fail(`導覽中斷：${e?.message ?? e}`);
      phase = "paused";
      waitKind = "pause";
      updateUi();
    });
  }
  async function loop(my) {
    outer:
      while (my === seq && cur) {
        const sc = cur.tour.scenes[cur.scene];
        if (!sc) {
          finish();
          return;
        }
        beginScene(sc);
        while (cur.step < sc.steps.length) {
          const r = await exec(sc.steps[cur.step], my);
          if (my !== seq)
            return;
          if (r === "skip") {
            cur.scene++;
            cur.step = 0;
            continue outer;
          }
          if (r === "pause") {
            const act2 = await ask("pause");
            if (my !== seq)
              return;
            if (act2 === "stop")
              return stopTour();
            if (act2 === "replay") {
              cur.step = 0;
              beginScene(sc);
              updateUi();
              continue;
            }
          }
          cur.step++;
          updateUi();
        }
        phase = "waiting";
        waitKind = "next";
        setText(sc.body);
        setNote("");
        saveProgress(cur.scene);
        updateUi();
        const act = await ask("next");
        if (my !== seq)
          return;
        if (act === "stop")
          return stopTour();
        if (act === "replay") {
          play(cur.id, cur.scene);
          return;
        }
        if (act === "prev") {
          play(cur.id, Math.max(0, cur.scene - 1));
          return;
        }
        cur.scene++;
        cur.step = 0;
      }
    if (cur)
      cur.scene = cur.tour.scenes.length;
  }
  function finish() {
    phase = "done";
    waitKind = "next";
    pointSel = null;
    layout();
    const title = el("tourTitle");
    if (title)
      title.textContent = "導覽結束";
    setText(finishHtml || `這些都可以在 ${appName} 的設置裡隨時改回來。想再看一次：從「操作導覽」再開一次。`);
    setNote("");
    if (cur)
      saveProgress(cur.tour.scenes.length - 1);
    const next = el("tourNext");
    if (next) {
      next.hidden = false;
      next.textContent = "再看一次";
    }
    show("tourDone", false);
    show("tourSkip", false);
    show("tourReplay", false);
    const prev = el("tourPrev");
    if (prev)
      prev.hidden = true;
    pending = null;
  }
  function stopTour() {
    interrupt();
    seq++;
    cur = null;
    phase = "idle";
    waitKind = "none";
    note = "";
    pointSel = null;
    showBubble(false);
  }
  var escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  function renderMenu() {
    const list = el("tourList");
    if (!list)
      return;
    list.innerHTML = data.index.map((t) => {
      const done = tourProgress(t.id);
      const label = done > 0 && done < t.scenes ? `繼續（${done + 1} / ${t.scenes}）` : "開始";
      return `<div class="tourRow" data-id="${escapeHtml(t.id)}">` + `<div class="tourName">${escapeHtml(t.title)}</div>` + `<div class="tourIntro">${escapeHtml(t.intro)}</div>` + `<div class="tourMeta">${t.scenes} 個場景 · ${t.steps} 步${t.require ? " · 需要 " + escapeHtml(t.require) : ""}</div>` + `<div class="tourActs"><button type="button" class="primary" data-play="1">${label}</button>` + (done > 0 ? '<button type="button" data-restart="1">從頭</button>' : "") + "</div></div>";
    }).join("");
    list.querySelectorAll(".tourRow").forEach((row) => {
      const id = row.dataset.id ?? "";
      row.querySelector("[data-play]")?.addEventListener("click", () => {
        play(id);
      });
      row.querySelector("[data-restart]")?.addEventListener("click", () => {
        play(id, 0);
      });
    });
  }
  function openTourMenu() {
    if (cur)
      stopTour();
    const box = el("tourBox");
    const back = el("tourBackdrop");
    if (box)
      box.hidden = false;
    if (back)
      back.hidden = false;
    renderMenu();
  }
  function closeTourMenu() {
    const box = el("tourBox");
    const back = el("tourBackdrop");
    if (box)
      box.hidden = true;
    if (back)
      back.hidden = true;
  }
  function tourMenuOpen() {
    return el("tourBox")?.hidden === false;
  }
  var modalOpen = () => modalIds.some((id) => el(id)?.hidden === false);
  function onKey(ev) {
    if (ev.key === "Escape") {
      if (modalOpen())
        return;
      if (tourMenuOpen()) {
        ev.preventDefault();
        ev.stopPropagation();
        closeTourMenu();
        return;
      }
      if (cur) {
        ev.preventDefault();
        ev.stopPropagation();
        stopTour();
      }
      return;
    }
    if (!cur)
      return;
    if (ev.key === "ArrowRight" || ev.key === " " || ev.key === "Enter") {
      if (waitKind === "tap") {
        ev.preventDefault();
        ev.stopPropagation();
        tapped = true;
        return;
      }
      if (waitKind !== "next")
        return;
      ev.preventDefault();
      ev.stopPropagation();
      if (phase === "done")
        play(cur.id, 0);
      else
        pending?.("next");
      return;
    }
    if (ev.key === "ArrowLeft" && cur.scene > 0) {
      ev.preventDefault();
      ev.stopPropagation();
      play(cur.id, Math.max(0, cur.scene - 1));
    }
  }
  function initTour(a, d, options = {}) {
    app = a;
    data = d;
    prefix = options.storagePrefix ?? "tour";
    appName = options.appName ?? "this app";
    modalIds = options.modalIds ?? [];
    finishHtml = options.finishHtml ?? "";
    magic = options.magic ?? TOUR_MAGIC;
    el("tourClose")?.addEventListener("click", () => closeTourMenu());
    el("tourBackdrop")?.addEventListener("click", () => closeTourMenu());
    el("tourX")?.addEventListener("click", () => stopTour());
    el("tourNext")?.addEventListener("click", () => {
      if (phase === "done" && cur) {
        play(cur.id, 0);
        return;
      }
      pending?.("next");
    });
    el("tourPrev")?.addEventListener("click", () => {
      if (cur)
        play(cur.id, Math.max(0, cur.scene - 1));
    });
    el("tourReplay")?.addEventListener("click", () => {
      if (cur)
        play(cur.id, cur.scene);
    });
    el("tourDone")?.addEventListener("click", () => {
      userDone = true;
    });
    el("tourSkip")?.addEventListener("click", () => {
      if (waitKind === "pause") {
        pending?.("next");
        return;
      }
      skipReq = true;
    });
    document.addEventListener("click", (ev) => {
      if (waitKind !== "tap")
        return;
      const t = ev.target;
      if (t?.closest?.("#tourBubble, #tourBox, #tourBackdrop"))
        return;
      tapped = true;
    }, true);
    window.addEventListener("keydown", onKey, true);
    renderMenu();
  }
  function tourState() {
    const bubble = el("tourBubble");
    const spot = el("tourSpot");
    const target = pointSel ? q(pointSel) : null;
    const br = bubble ? bubble.getBoundingClientRect() : null;
    const sr = spot && !spot.hidden ? spot.getBoundingClientRect() : null;
    const tr = target ? target.getBoundingClientRect() : null;
    return {
      id: cur?.id ?? null,
      scene: cur?.scene ?? -1,
      scenes: cur?.tour.scenes.length ?? 0,
      step: cur?.step ?? -1,
      steps: cur ? cur.tour.scenes[cur.scene]?.steps.length ?? 0 : 0,
      phase,
      waitKind,
      note,
      point: pointSel,
      failed: failed.slice(),
      progress: cur ? tourProgress(cur.id) : 0,
      bubble: {
        visible: !!bubble && !bubble.hidden,
        rect: br && br.width ? { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) } : null,
        text: el("tourText")?.textContent?.slice(0, 120) ?? "",
        where: el("tourWhere")?.textContent ?? "",
        buttons: ["tourNext", "tourPrev", "tourReplay", "tourDone", "tourSkip"].filter((id) => el(id)?.hidden === false)
      },
      spot: {
        visible: !!sr,
        rect: sr ? { x: Math.round(sr.x), y: Math.round(sr.y), w: Math.round(sr.width), h: Math.round(sr.height) } : null,
        target: tr ? { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width), h: Math.round(tr.height) } : null,
        overlapTarget: !!sr && !!tr && !(sr.right < tr.left || sr.left > tr.right || sr.bottom < tr.top || sr.top > tr.bottom)
      },
      tours: data.index.map((t) => ({ id: t.id, title: t.title, scenes: t.scenes, steps: t.steps }))
    };
  }

  // src/tour/tour-data.ts
  var TOUR_INDEX = [
    {
      id: "welcome",
      title: "第一次使用",
      intro: "一分鐘走一遍：讀一分、看科判、點一句看梵藏注疏、三個分頁、搜尋。",
      scenes: 11,
      steps: 45,
      require: "",
      bytes: 3269
    }
  ];
  var TOUR_BLOBS = {
    welcome: "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"
  };

  // src/tour/app.ts
  var api = () => window.ZHU_APP;
  var savedSection = null;
  var app2 = {
    call(name) {
      const a = api();
      if (!a)
        throw new Error("資料還沒載入");
      switch (name) {
        case "pickSentence":
          a.pickSentence();
          return;
        case "openNotes":
          a.openPanel("works");
          return;
        case "openAlt":
          a.openPanel("alt");
          return;
        case "openPhrase":
          a.openPanel("phrase");
          return;
        case "closePanel":
          a.closePanel();
          return;
        case "openSearch":
          a.openSearch?.();
          return;
        case "closeSearch":
          a.closeSearch?.();
          return;
        case "reset":
          a.reset();
          if (savedSection != null)
            a.setSection(savedSection);
          return;
        default:
          throw new Error(`不認得的動作：${name}`);
      }
    },
    set(key, value) {
      if (key === "theme")
        return !!api()?.setTheme(value);
      return false;
    },
    state() {
      const s = api()?.state() ?? { ready: false };
      return { ...s };
    }
  };
  var SEEN = "zhu.tour.seen";
  var HINT = "zhu.tour.hint";
  var readFlag = (k) => {
    try {
      return !!localStorage.getItem(k);
    } catch {
      return false;
    }
  };
  var writeFlag = (k) => {
    try {
      localStorage.setItem(k, "1");
    } catch {}
  };
  var wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function whenReady(timeout = 20000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (api()?.state().ready)
        return true;
      await wait(200);
    }
    return false;
  }
  async function start() {
    const id = TOUR_INDEX[0]?.id;
    if (!id)
      return;
    const a = api();
    savedSection = a ? a.state().section : null;
    writeFlag(SEEN);
    hideHint();
    await whenReady();
    const last = (TOUR_INDEX[0]?.scenes ?? 1) - 1;
    const done = tourProgress(id);
    if (done > 0 && done < last)
      await play(id);
    else
      await play(id, 0);
  }
  var hintTimer = 0;
  function hideHint() {
    window.clearTimeout(hintTimer);
    document.getElementById("tourHint")?.remove();
  }
  function placeHint() {
    const box = document.getElementById("tourHint");
    if (!box)
      return;
    const head = document.getElementById("top")?.getBoundingClientRect().height ?? 0;
    box.style.top = Math.round(head + 8) + "px";
  }
  function maybeHint() {
    if (readFlag(HINT) || readFlag(SEEN))
      return;
    if (document.getElementById("tourHint"))
      return;
    const box = document.createElement("div");
    box.id = "tourHint";
    box.setAttribute("role", "note");
    box.innerHTML = '<span class="th-text">第一次用？按標題列的 <b>\uD83E\uDDAE</b> 一分鐘走一遍</span>' + '<button type="button" class="th-x" id="tourHintX" aria-label="關閉提示" title="關閉提示">✕</button>';
    document.body.appendChild(box);
    placeHint();
    window.addEventListener("resize", placeHint);
    box.addEventListener("click", (ev) => {
      if (ev.target.closest("#tourHintX"))
        return;
      start();
    });
    box.querySelector("#tourHintX")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      hideHint();
      writeFlag(HINT);
    });
    window.setTimeout(hideHint, 20000);
    window.addEventListener("scroll", () => {
      if (document.getElementById("tourHint"))
        hideHint();
    }, { passive: true, once: true });
  }
  initTour(app2, { index: TOUR_INDEX, blobs: TOUR_BLOBS }, {
    appName: "金剛經合注",
    storagePrefix: "zhu.tour",
    finishHtml: "導覽結束。想再看一次：按標題列的 \uD83E\uDDAE。<br>畫面已還原到你原來讀的地方。"
  });
  document.getElementById("tourEntry")?.addEventListener("click", () => {
    start();
  });
  window.tourState = tourState;
  document.getElementById("tourX")?.addEventListener("click", () => {
    api()?.closePanel();
    const q2 = document.getElementById("q");
    if (q2)
      q2.value = "";
  });
  whenReady().then((ok) => {
    if (!ok)
      return;
    hintTimer = window.setTimeout(maybeHint, 1200);
  });
})();
