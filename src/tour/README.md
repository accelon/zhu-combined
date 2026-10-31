# self-explaining-tour

A tiny, dependency-free **guided tour** system for web apps and webview desktop apps.
It exists so users who do not read manuals can learn by watching, and so a feature can be demoed in under a minute.

- A tour is a `.tour` script (Markdown-ish, Chinese/English commands).
- It compiles into a compact binary + base64 blob, embedded in a single-file build.
- A player dims the page, spotlights the target, explains in a bubble, waits for real conditions (not fixed sleeps), and lets the user set the pace.
- No framework, no CDN, no runtime dependencies.

```text
tours/*.tour  →  build-tours.ts  →  tour-data.ts  →  your HTML/JS
                                  (TOUR_INDEX + TOUR_BLOBS)
```

## Why not just a help page?

- Users do not read manuals; they learn by doing.
- A tour can **show** the exact button and wait for the result.
- A tour doubles as a **demo script**: play it in a meeting or a screen recording.
- A tour that fails to find its target is a build error, not a silent bad demo.

## Files

```text
format.ts        binary macro format (CRC32, version, base64)
player.ts        spotlight + bubble + step engine
compiler.ts      .tour parser, static checks, code generation
build-tours.ts   CLI wrapper (--config, --check)
shell.html       standard DOM shell (paste once)
shell.css        standard styling (theme-variable friendly)
example/         runnable tiny example + config
test.ts          format/compiler checks
```

## Quick start

### 1. Copy the module

Copy this folder into the app, e.g. `src/tour/` (or keep it as a local package). The files are plain TypeScript; Bun/Node can import them.

### 2. Paste the shell

Put `shell.html` once before `</body>`, and load `shell.css` (or copy its rules). Keep the ids (`tourSpot`, `tourBubble`, `tourNext`, `tourBox`, …); the player looks them up by id.

If the app already has theme variables (`--panel`, `--fg`, `--accent`, …), the CSS uses them with fallbacks. Otherwise define the `--tour-*` variables or edit the fallbacks.

### 3. Implement the adapter

The player never imports app panels. Give it a `TourApp`:

> Call `initTour` **once**, after the shell is in the DOM. It binds listeners by the shell ids and renders the menu.

```ts
import { initTour, startTour } from './tour/player';
import { TOUR_BLOBS, TOUR_INDEX } from './tour-data';

initTour({
  tab(col, name) { /* switch left/right tab */ },
  side(col, on) { /* show/hide a column */ },
  set(key, value) { /* theme, advanced, ...; return false if unknown */ },
  call(name, arg) { /* openSettings, search, ... */ },
  state() { return snapshot; }, // for api: conditions
}, { index: TOUR_INDEX, blobs: TOUR_BLOBS }, {
  appName: 'MyApp',
  modalIds: ['settingsBox', 'aboutBox'],
  storagePrefix: 'myapp.tour',
});

document.querySelector('#tourEntry')?.addEventListener('click', startTour);
```

` tab`/`side`/`set`/`call`/`state` are optional; commands that need a missing method fail with a visible note.

### 4. Configure the compiler

Create `tour.config.ts`:

```ts
import { defineTourConfig } from './tour/compiler';

export default defineTourConfig({
  tourDir: './tours',
  outFile: './tour-data.ts',
  templateFile: './index.html', // optional; enables #id checks
  formatImport: './tour/format',
  appName: 'MyApp',
  setKeys: ['theme', 'advanced'],
  callNames: ['openSettings', 'search'],
  tabNames: ['main', 'help'],
  apiKeys: ['ready', 'tab', 'query'],
  dynamicIds: ['toast'],
});
```

All paths are resolved from the **current working directory**. Run the CLI from the project root (or pass a config with absolute paths).

Add scripts:

```json
{
  "scripts": {
    "tour:build": "bun run src/tour/build-tours.ts --config tour.config.ts",
    "tour:check": "bun run src/tour/build-tours.ts --config tour.config.ts --check"
  }
}
```

`--check` is the important one: it fails when a `.tour` was edited but `tour-data.ts` was not rebuilt. Put it in CI.

### 5. Write a tour

`tours/welcome.tour`:

```markdown
@id     welcome
@title  第一次使用
@intro  一分鐘走一遍：開檔、查詢、設定。

### 先看這個畫面
左邊是**目錄**，中間是**內容**，右邊是**摘要**。看完在畫面任何地方點一下。

> 指向 #leftPane
> 停
> 不指向

### 查一個詞
在搜尋框打一個詞，結果會出現在右邊。

> 指向 #query
> 輸入 #query => 般若
> 等頁面 count:#results .item >= 1 10000
> 指向 #results
> 停 看完再點一下
> 不指向
```

`@id` must equal the file name. At least one `###` scene is required.

### 6. Verify

```powershell
bun run test.ts                         # format + compiler, no browser
bun run src/tour/build-tours.ts --config tour.config.ts
bun run src/tour/build-tours.ts --config tour.config.ts --check
```

Then play it in a real browser. A full-play test is strongly recommended: click through every scene, assert `tourState().failed` is empty, and check the spotlight actually overlaps the target.

## Entry point

A tour nobody finds is not a tour. Two shapes work:

| UI | Entry |
|---|---|
| has a menu / About dialog | a labelled item: 「操作導覽」 / "Take a tour" |
| **icon-only toolbar** | **🦮 right after the primary action** (usually save) |

For the icon form:

```html
<button id="tourEntry" class="iconbtn" title="操作導覽（跟著做一次就會用）"
        aria-label="操作導覽">🦮</button>
```

* Keep `id="tourEntry"` — tests, the adapter and the first-run hint all bind to it.
* `aria-label` + `title` are both required: an emoji-only button has no text name.
* Same size/style as the neighbouring icon buttons; keep the emoji at the icon font size.
* ❌ `▶` / `🎬` / `?` — they read as "play a demo" or "help page" and get skipped.
* ❌ a text label beside it — one text link in an icon row reads as a different kind of control.
* Put it **next to the action the user already uses**, not in a settings submenu.

Why a dog: it is the one glyph that says *someone will lead you step by step* without words,
it is not already taken by "play", "help" or "settings", and it is memorable after one visit.
Like a guide dog at a crossing: it does not explain the route, it walks it with you.

**First run.** If the user has never started the tour, one line is enough
("第一次用？按右邊的 🦮 一分鐘走一遍") — a toast, an empty-state hint, or a highlight.
Do **not** auto-start the tour on load: it steals the first impression and the user cannot
read the screen underneath. Persist "seen" as soon as the tour starts, not when it finishes.

## DSL

Header: `@id`, `@title`, `@intro`, `@require`.

| Chinese | English | Example | What it does |
|---|---|---|---|
| `指向` | `point` | `指向 #search` | Spotlight the element |
| `不指向` | `unpoint` | `不指向` | Remove spotlight |
| `點` | `click` | `點 #settingsBtn` | Real DOM click |
| `輸入` | `type` | `輸入 #query => 般若` | Set value + dispatch `input` |
| `按鍵` | `key` | `按鍵 Enter #query` | Dispatch keydown |
| `等` | `wait` | `等 600` | Short pause (visual pacing only) |
| `等頁面` | `waitFor` | `等頁面 count:#results .item >= 1 10000` | Poll until condition; last number = timeout |
| `分頁` | `tab` | `分頁 左 dir` | Switch a column's tab |
| `側欄` | `side` | `側欄 右 開` | Show/hide a column |
| `設定` | `set` | `設定 simmode 1` | App setting |
| `說` | `say` | `說 這裡是摘要` | Replace bubble text mid-scene |
| `呼叫` | `call` | `呼叫 openSettings` | Allow-listed app function |
| `你來` | `user` | `你來 選一個檔 => api:file` | Wait for the user (with completion condition) |
| `停` | `tap` | `停` / `停 看完再點一下` | Wait for a click anywhere (or Space/→/Enter) |
| `需要` | `require` | `需要 api:ready` | Wait for a condition (up to 120 s) |
| `若非` | `skipIf` | `若非 !#tabHelp` | Skip the whole scene when true |

Conditions (used by `等頁面`, `你來`, `需要`, `若非`; prefix `!` negates):

| Form | Meaning |
|---|---|
| `#id` / `.class` | Element exists and is visible (has area, not `visibility:hidden`) |
| `!#panel:not([hidden])` | Not visible |
| `count:#list .item >= 1` | Count comparison (`>= <= == != > <`) |
| `api:ready` / `api:tab=main` | Read the app's `state()` snapshot |
| `text:#button=Save` | Text content contains |

## Writing rules

1. **UI-introduction scenes use `停`, not `等`.** Let the reader look; do not auto-run past an explanation.
2. **Never use `等` to wait for data.** Use `等頁面 count:…` / `api:…`. Fixed sleeps fail randomly on slow machines.
3. **Close a modal before pointing at something else.** `不指向` → `點 #close`; otherwise the spotlight points at a vanished element.
4. **File pickers and OS dialogs cannot be automated.** Use `你來` (browser security).
5. **Each scene must stand alone.** The user may replay one scene or resume mid-tour.
6. **Keep scenes short.** One idea, ~5–12 steps. A 10-minute first-run tour is too long; split it.
7. **Name the visible thing, not the implementation.** "按右上角的 🔧" beats "call openSettings()".
8. **End with agency.** Tell the user settings can be changed and the tour can be replayed.
9. **Demo mode is the same script.** A short tour is a demo; do not maintain a second script.

## Static checks

`compiler.ts` rejects:

- unknown commands;
- wrong argument counts;
- `#id` not present in the template (when `templateFile` is configured);
- unknown `data-tab`;
- unknown `設定` keys / `呼叫` functions (when allow-lists are configured);
- unknown `api:` top-level keys (when configured);
- `@id` ≠ filename, empty tours, prose outside a scene, empty scenes.

This is the main value: a tour that points at nothing fails at build time instead of silently embarrassing a demo.

## Player API

```ts
initTour(app, data, options?): void
play(id, from?): Promise<void>
startTour(): void          // one tour → play; many → menu
stopTour(): void
openTourMenu(): void
closeTourMenu(): void
tourState(): Record<string, unknown>  // diagnostics
evalCond(cond: string): boolean
```

`TourOptions`:

```ts
{
  storagePrefix?: string; // default 'tour'
  appName?: string;       // final scene text
  modalIds?: string[];    // ids that own Esc
  finishHtml?: string;    // override final scene
  magic?: string;         // must match compiler magic; default TOUR1
}
```

`tourState()` is designed for tests: `{ phase, waitKind, scene, step, failed, point, bubble, spot, tours }`.
Assert `failed.length === 0` after a full play; check `spot.overlapTarget`.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| Bubble shows `⚠ 找不到` | Selector missing/invisible, or modal closed too early | Check the element; use `等頁面`, close modals in order |
| Tour hangs on `等頁面` | Condition never true; wrong count/selector; data not loaded | Use `count:`/`api:`; add a generous timeout; inspect `tourState()` |
| Tour skipped a scene | `若非` condition true | Check the condition; it is intentionally skipped |
| `等頁面 count:#x >= 1` is misparsed | A trailing number is treated as timeout | The compiler avoids this when the previous token is a comparison operator |
| Click does nothing | Element hidden/covered; wrong element | Use the actual clickable element; check `visible()` |
| File dialog step fails | Browser blocks automation | Use `你來` |
| Tour works in Chrome, not in the app | WebView DOM differs; modal ids not in `modalIds` | Test in the real webview; add modal ids |
| `tour-data.ts` stale | Forgot to rebuild | Run `--check` in CI |

## Limits

- The player is DOM-only; no canvas/OS-level automation.
- Browser file pickers, permission prompts, and native menus cannot be driven.
- It is not a security boundary; base64 is not encryption.
- Very large tours are still inline data; keep scripts lean.
- The spotlight assumes a normal 2D page; transformed/scrolled containers need `scrollIntoView` in the app or a custom step.

## Example

```powershell
cd example
bun run ../build-tours.ts --config tour.config.ts
bun run ../build-tours.ts --config tour.config.ts --check
```

The example's `template.html` is a tiny page; `tours/welcome.tour` uses only its selectors.

## Related

- [SKILL.md](../skills/self-explaining-tour/SKILL.md) — agent workflow for adding a tour to a new app.
- [yap-software-practice.md](../yap-software-practice.md) — UI/theming defaults.
