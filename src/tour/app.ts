/**
 * 操作導覽的轉接層：把 self-explaining-tour 的播放器接到金剛經合注。
 *
 * 播放器本身不認得這個 App；它只透過下面幾個動作操作 UI，
 * 其餘（指向哪個元素、說什麼話）都在 `tours/*.tour` 裡。
 * 這支檔案會被 `bun build` 打包成 `tour.js`，所以要避開執行期相依。
 */
import { initTour, play, tourProgress, tourState } from './player';
import { TOUR_BLOBS, TOUR_INDEX } from './tour-data';

type Snapshot = {
  ready: boolean;
  section: number;
  selected: number | null;
  panel: boolean;
  tab: string;
  overlay: boolean;
};

type Api = {
  state(): Snapshot;
  setSection(n: number): void;
  pickSentence(): void;
  openPanel(tab: string): void;
  closePanel(): void;
  reset(): void;
  setTheme(v: string): boolean;
};

const api = (): Api | undefined => (window as unknown as { ZHU_APP?: Api }).ZHU_APP;

/** 導覽開始時的「分」，結束時還原 */
let savedSection: number | null = null;

const app = {
  call(name: string): void | Promise<void> {
    const a = api();
    if (!a) throw new Error('資料還沒載入');
    switch (name) {
      case 'pickSentence': a.pickSentence(); return;
      case 'openNotes': a.openPanel('works'); return;
      case 'openAlt': a.openPanel('alt'); return;
      case 'openPhrase': a.openPanel('phrase'); return;
      case 'closePanel': a.closePanel(); return;
      case 'reset':
        a.reset();
        if (savedSection != null) a.setSection(savedSection);
        return;
      default:
        throw new Error(`不認得的動作：${name}`);
    }
  },
  set(key: string, value: string): boolean {
    if (key === 'theme') return !!api()?.setTheme(value);
    return false;
  },
  state(): Record<string, unknown> {
    const s = api()?.state() ?? { ready: false };
    return { ...s };
  },
};

const SEEN = 'zhu.tour.seen';
const HINT = 'zhu.tour.hint';
const readFlag = (k: string): boolean => { try { return !!localStorage.getItem(k); } catch { return false; } };
const writeFlag = (k: string): void => { try { localStorage.setItem(k, '1'); } catch { /* 無痕模式 */ } };

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function whenReady(timeout = 20000): Promise<boolean> {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (api()?.state().ready) return true;
    await wait(200);
  }
  return false;
}

async function start(): Promise<void> {
  const id = TOUR_INDEX[0]?.id;
  if (!id) return;
  const a = api();
  savedSection = a ? a.state().section : null;
  writeFlag(SEEN);
  hideHint();
  await whenReady();
  const last = (TOUR_INDEX[0]?.scenes ?? 1) - 1;
  const done = tourProgress(id); // 0 = 沒開始過
  if (done > 0 && done < last) await play(id); // 上次沒走完 → 接著走
  else await play(id, 0);
}

// ------------------------------------------------------------------ 第一次的提示
let hintTimer = 0;

function hideHint(): void {
  window.clearTimeout(hintTimer);
  document.getElementById('tourHint')?.remove();
}

function placeHint(): void {
  const box = document.getElementById('tourHint');
  if (!box) return;
  const head = document.getElementById('top')?.getBoundingClientRect().height ?? 0;
  box.style.top = Math.round(head + 8) + 'px';
}

function maybeHint(): void {
  if (readFlag(HINT) || readFlag(SEEN)) return;
  if (document.getElementById('tourHint')) return;
  const box = document.createElement('div');
  box.id = 'tourHint';
  box.setAttribute('role', 'note');
  box.innerHTML =
    '<span class="th-text">第一次用？按右上角的 <b>🦮</b> 一分鐘走一遍</span>' +
    '<button type="button" class="th-x" id="tourHintX" aria-label="關閉提示" title="關閉提示">✕</button>';
  document.body.appendChild(box);
  placeHint();
  window.addEventListener('resize', placeHint);
  box.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('#tourHintX')) return;
    void start();
  });
  box.querySelector('#tourHintX')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideHint();
    writeFlag(HINT);
  });
  // 一直黏在標題列下面會擋住經文：20 秒或一開始捲動就收起來（不記「已看過」，下次還會提示）
  window.setTimeout(hideHint, 20000);
  window.addEventListener('scroll', () => { if (document.getElementById('tourHint')) hideHint(); }, { passive: true, once: true });
}

// ------------------------------------------------------------------ 接線
initTour(app, { index: TOUR_INDEX, blobs: TOUR_BLOBS }, {
  appName: '金剛經合注',
  storagePrefix: 'zhu.tour',
  finishHtml: '導覽結束。想再看一次：按右上角的 🦮。<br>畫面已還原到你原來讀的地方。',
});

document.getElementById('tourEntry')?.addEventListener('click', () => { void start(); });

// 測試用：完整走一遍時檢查 failed／spotlight（也用於 demo 腳本除錯）
(window as unknown as { tourState: typeof tourState }).tourState = tourState;

// 中途按 ✕ 結束：把面板收起來，回到經文
document.getElementById('tourX')?.addEventListener('click', () => {
  api()?.closePanel();
  const q = document.getElementById('q') as HTMLInputElement | null;
  if (q) q.value = '';
});

// 等首屏穩定再提示（單檔版要解壓資料）
void whenReady().then((ok) => {
  if (!ok) return;
  hintTimer = window.setTimeout(maybeHint, 1200);
});
