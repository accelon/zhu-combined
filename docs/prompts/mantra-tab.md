# 任務：在 zhu-combined 閱讀器加「咒語」分頁

> 給 `D:\2026\zhu-combined` 的實作者。資料已由 `D:\2026\surangama` 產出，
> 這份是資料契約＋UI 規格；請先照契約接，遇到衝突在 `## 10` 回報，不要自行改資料欄位。

## 1. 目標

在現有右欄 `#tabs2` 增加一個 **咒語** 分頁，只在 `window.MANTRA` 存在且 `units.length > 0` 時出現。

分頁要能：

1. 長咒按 **五會** 分組閱讀；目前 **143 個 unit 全到齊**：
   - M1 11 個 `exact`（詞級）＋ 1 個 `gap`（M1.06）；
   - M2–M5 與 M1 其餘 131 個 `approx`（unit 級，中文範圍按梵詞數分配）。
2. 每個 unit 顯示三層：
   - 梵詞（Sanskrit word）
   - 漢字音譯（Chinese transliteration）
   - 中文詞義（Chinese meaning）
3. 梵漢 mapping 支援 **一對多（1:n）／多對一（n:1）／gap／approx**；不要假設 1:1。
4. 高頻詞表：`MANTRA.lexicon` 依 `freq` 排序；點詞可過濾／高亮目前會中的所有出現。
5. 與經文雙向鏈接：
   - 咒語頁的詞／unit → 跳到經文對應句，並高亮 `char` 範圍。
   - 經文句若有咒語 link → 顯示「咒」入口，跳到咒語頁對應 unit。
6. 手機可讀：表格在窄螢幕變成卡片，不要橫向硬捲。

> `approx` unit 的詞表是 **unit 級近似**：梵詞、lemma、詞義是逐詞的，但漢字音譯與 `char` 是整個 unit 的範圍，不是逐詞精確。UI 顯示 `≈ 近似` 即可；approx 已由作者接受，不要標成待辦或空白。

## 2. 先讀（不要重造輪子）

| 檔案 | 看什麼 |
|---|---|
| `README.md` | `window.ZHU` 契約、右欄分頁「依資料長出來」 |
| `KEPAN.md` | 既有「額外一層」怎麼掛進閱讀器（`window.ZHU_APP`、MutationObserver） |
| `app.js` | `buildTabs()`（約 962）、`renderBody()`（225）、`renderPhrase()`（612）、`actBarHtml()`（211）、`ZHU_APP`（1898）、`selectUnit()`（902） |
| `index.html` | `#tabs2`（約 50）、`#cards`、`#sheet` 結構 |
| `style.css` | `.tabs2`、`.ph-*`、`.pos-head`、`.ifan`、`.sheet` 的既有樣式 |

現有「詞組」分頁（`D.pdf`）只處理句內梵文逐詞；**不要改它**，也不要把它和咒語資料混在一起。
咒語是獨立資料、獨立分頁；可以重用 `.ph-*` 的視覺語言，但 class 用 `.mt-*` 避免互相污染。

## 3. 資料契約：`window.MANTRA`

> 命名：canonical 現在用 **轍號 `rut_id`**；目前資料仍叫 `track_id`（同值）。
> 新程式請讀 `rut_id || track_id`，新欄位用 `rut_id`；不要把 `track_id` 當新名字硬寫死。

資料檔：`<root>/mantra/mantra-data.js`，內容是一行 `window.MANTRA = {...};`。
範例資料在 `D:\2026\surangama\site\reader\mantra\mantra-data.js`（143 unit；M1 11 exact、131 approx、M1.06 gap）。

```js
window.MANTRA = {
  schema: 1,
  title: "楞嚴咒",
  source: "T945 般剌蜜帝本／KU-PDF 不空本",
  coverage: {
    units: 143, total: 143,
    exact_units: 11, approx_units: 131, gap_units: 1,
    assemblies: 5, total_assemblies: 5,
    note: "M1 exact 11；M1.06 gap；其餘 approx（中文範圍按梵詞數分配）"
  },

  assemblies: [
    { id: "M1", no: 1, title: "第一會", total: 39, covered: 39, word_covered: 11,
      units: ["M1.01", "..."], track_ids: ["S2587.3", "..."] },
    { id: "M2", no: 2, title: "第二會", total: 14, covered: 14, word_covered: 0, units: ["M2.01", "..."], track_ids: ["..."] },
    // M3–M5 同形（covered = total；word_covered = 0）
  ],

  units: [{
    id: "M1.01",
    assembly: "M1",
    seq: 1,
    sa: "Namaḥ sarva buddha bodhi-satve-bhyaḥ.",
    zh: "南無薩婆勃陀勃地薩跢鞞弊",
    track_ids: ["S2587.3"],
    u: [2587],                 // 舊 ZHU 句序；閱讀器 selectUnit() 用這個
    alignment: "exact",        // "exact" | "approx" | "gap"
    gap: false,                // true = T945 缺此句（例 M1.06）
    words: [{
      i: 0,
      sa: "Namaḥ",
      lemma: "nam",
      translit: "南無",        // 漢字音譯
      meaning: "歸敬",         // 中文詞義
      freq: 26,                // lemma 頻次
      relation: "1:1",         // "1:1" | "1:n" | "n:1" | "gap" | "approx"
      confidence: "A",         // A/B/C
      track_id: "S2587.3",
      u: [2587],
      char: [32, 34]           // 在舊句 text 中的字元範圍 [start,end)
    }]
  }],

  lexicon: [{
    lemma: "nam", translit: "南無", meaning: "歸敬", freq: 26, units: ["M1.01", "..."]
  }],

  links: [{
    track_id: "S2587.3", display_sid: "S3306", u: 2587,
    char: [32, 44], text: "南無薩婆勃陀勃地薩跢鞞弊"
  }]
};
```

### 3.1 欄位規則

- `units[].u` 是**舊 `ZHU.versions[BASE].sents[].u`**（0–3731），不是新 dense `S3306`。
  新號只放在 `display_sid`／`track_id`，不要拿去 `selectUnit()`。
- `char` 是舊句字串的 offset；`[start,end)`。點詞高亮用這個。
- `units[].alignment`：
  - `exact`：詞級對齊（M1 11 個）。
  - `approx`：unit 級近似；梵詞／lemma／詞義是逐詞，漢字音譯與 `char` 是 unit 範圍（M2–M5 與 M1 其餘）。
  - `gap`：T945 缺此句（M1.06）；`zh=""`、`words[].relation="gap"`。
- `relation` 只認五個值：
  - `1:1`：一梵詞對一漢詞。
  - `1:n`：一漢詞對多梵詞（例 `bodhi-satve` ↔ `勃地薩跢`）。
  - `n:1`：多漢詞對一梵詞（例 `srotāpannānāṃ` ↔ `蘇盧多＋波那喃`）。
  - `gap`：一邊缺（T945 缺 `M1.06 anāgāmināṃ`；`M1.12` 沒有缺，`umāpati`/`sahīyāya` 是 `S2587.18/.19`）。
  - `approx`：unit 級近似，不是逐詞對齊；UI 顯示 `≈`，不要當 exact。
- `translit` 是**漢字音譯**，不是 Hanyu Pinyin；若要加 pinyin，另加 `pinyin` 欄，不要改 `translit`。
- `meaning` 是中文詞義；空字串代表「無獨立詞義／待補」，UI 顯示 `—`，不要硬翻。
- `freq` 是 lemma 在 143 個梵 unit 的頻次；0 表示未統計。
- `assemblies[].covered` 是已覆蓋 unit 數；`word_covered` 是其中 `exact` 的 unit 數（M1 11，其餘 0）。

### 3.2 建置

- `build-kepan.mjs` 目前只讀 `<root>/kepan/kepan-data.js`。
  請加：若 `<root>/mantra/mantra-data.js` 存在，就一併內嵌；沒有就跳過，不要報錯。
- 保留 `window.MANTRA` 全域，不要塞進 `window.ZHU`；這樣其他經群沒有咒語資料時完全不受影響。
- 若 `MANTRA` 不存在或 `units.length===0`，`buildTabs()` 不要產生「咒語」分頁。

## 4. UI 規格

### 4.1 分頁

- `buildTabs()` 的 `defs` 加一列（放在「詞組」後）：
  ```js
  ['mantra', '咒語', !!(window.MANTRA && window.MANTRA.units && window.MANTRA.units.length)]
  ```
- `#tabs2` 的 click handler 遇到 `data-t="mantra"` 時：
  - 不要依賴 `state.u`；即使目前沒選句，也要能開咒語頁。
  - `state.tab='mantra'`、`#sheet` 移除 `closed`、`renderMantra()`。
- `renderBody()` 加 `else if (state.tab === 'mantra') renderMantra();`。

### 4.2 咒語頁版面

```text
┌ 咒語 ──────────────────────────────────────────────┐
│ 楞嚴咒   T945／不空本     [詞級 11/143 · 第一會]   │
│ [第一會 39/39] [第二會 14/14] [第三會 19/19] ...    │
├────────────────────────────────────────────────────┤
│ M1.01  第一會 · 1/39  exact          [在經文看]    │
│ Namaḥ sarva buddha bodhi-satve-bhyaḥ.              │
│ 南無薩婆勃陀勃地薩跢鞞弊                            │
│ ┌──────┬────────┬────────┬────┬──────┐             │
│ │梵詞  │漢字音譯│中文詞義│頻次│經文  │             │
│ │Namaḥ │南無    │歸敬    │ 26 │ →    │             │
│ │sarva │薩婆    │一切    │ 35 │ →    │             │
│ │bodhi │勃地薩跢│覺      │  0 │ →    │             │
│ │satve │勃地薩跢│有情    │  1 │ →    │             │
│ └──────┴────────┴────────┴────┴──────┘             │
├────────────────────────────────────────────────────┤
│ 高頻詞：sarva 35 · nam 26 · vidy 16 · ...           │
└────────────────────────────────────────────────────┘
```

- **assembly tabs**：五會全部可點（`covered=total`）；tab 上顯示 `第一會 39/39`、`第二會 14/14` 等。
  `word_covered=0` 的會仍要開，但 unit header 顯示 `≈ 近似`；不要 disable，也不要顯示空白頁。
- **unit card**：
  - header：`id`、`第一會 · seq/total`、`alignment` badge（`exact`／`≈ 近似`／`gap`）、`[在經文看]`。
  - 梵文行：`unit.sa`。
  - 漢文行：`unit.zh`；`gap` 時顯示「（T945 缺此句）」；`approx` 時在行尾加 `≈`。
  - 詞表：一列一梵詞；`1:n` 的連續列用 `rowspan` 合併「漢字音譯／中文詞義」欄，或左側加括號 `⌐`。
  - `n:1` 的列在「漢字音譯」欄顯示 `A＋B`，並在 tooltip 說明「多漢詞對一梵詞」。
  - `gap` 列：梵詞正常顯示，漢字音譯／中文詞義顯示 `—`，relation 顯示 `gap`。
  - `approx` 列：漢字音譯是 **unit 範圍**，不是逐詞；relation 顯示 `≈`，tooltip 說明「unit 級近似」。
  - 每列點擊 → `jumpToSutra(word.u[0], word.char)`；右側「→」按鈕同樣。`approx` 的 `char` 是 unit 範圍，閃整段即可。
- **高頻詞 panel**：
  - 放 `MANTRA.lexicon` 前 20 個；每個 chip 顯示 `lemma`、`translit`、`meaning`、`freq`。
  - 點 chip：在目前 assembly 的 unit/word 中高亮同 lemma；再點一次清除。
  - 若目前 assembly 沒有該 lemma，顯示「本會無」而不是跳走。
- **搜尋**：可選；一個 input 過濾 `sa`／`translit`／`meaning` 子串，留在同一個 assembly。

### 4.3 雙向鏈接

**咒語 → 經文**

```js
function jumpToSutra(u, char) {
  if (u == null) return;
  selectUnit(u, { scroll: true });
  // 新增：selectUnit 支援 opts.hl = [start,end]
  // 或 selectUnit 後呼叫 flashRange(u, char[0], char[1])
}
```

- 請在 `selectUnit(u, opts)` 加可選 `opts.hl=[start,end]`：
  - 找 `#reader .sent[data-u="u"]` 的文字節點；
  - 用 `Range` 包住 `[start,end)`，加 `<mark class="mt-hl">`；
  - 1.8 秒後移除；不要破壞 `dataset.base`（hover 還原用）。
- 若 `char` 缺失或超出長度，只選句、不閃字。

**經文 → 咒語**

- 建一個 index：`const MT_BY_U = new Map(); MANTRA.units.forEach(u => u.u.forEach(x => { if (!MT_BY_U.has(x)) MT_BY_U.set(x, []); MT_BY_U.get(x).push(u); }))`。
  **不要**用 `MANTRA.links` 建這個 index——links 有 422 條 S2587 句，全部 `u=2587`；
  用 links 建會變成一個 u 對 422 條，沒有意義。
- 注意：143 個 unit 全部在同一個舊句 `u=2587`（整段咒語是一句）；`MT_BY_U.get(2587)` 是 **143 個 unit 的陣列**，不是一個。
- 在 `actBarHtml(u)` 或 `renderReader` 的句尾加一個小按鈕（只有 `MT_BY_U.has(u)` 才出現）：
  ```html
  <button class="mt-link" data-mantra="u">咒</button>
  ```
- click → `openMantra({ u, char })`：
  - `state.tab='mantra'`、開 sheet、`renderMantra({ focusU:u, char })`；
  - 若 `char` 有給，選 `unit.char` 與 `char` 重疊的第一個 unit；沒有就選 `MT_BY_U.get(u)[0]`；
  - 自動切到該 unit 的 assembly，scroll 到 unit，閃一下 `mt-unit`。
  - 若 `u` 沒有 unit（理論上不會出現按鈕），顯示 toast「這一句尚無詞級資料」並開第一會，不要空白。

### 4.4 效能

- 143 unit／770 word。**一次只 render 一個 assembly**，不要 5 會全畫；每會 14–54 unit。
- `MANTRA.links` 422 條只作 `u → link` 查 char；`MT_BY_U` 只從 `MANTRA.units` 建（143 個 unit，全部 u=2587）。兩者不要混。
- 高頻詞 panel 只 render 前 20；不要把所有 lexicon 畫成 DOM。

### 4.5 樣式

- 新增 `src/mantra/mantra.css`（或直接放 `style.css` 的 `.mt-*` 區塊），不要覆蓋 `.ph-*`。
- 沿用既有 CSS 變數（`--fg`、`--bg`、`--line`、`--accent`）。
- 桌面上詞表四欄；`@media (max-width:720px)` 改成：
  - 每列一張卡：梵詞／漢字音譯／中文詞義上下排；
  - assembly tabs 橫向 scroll；
  - 高頻詞 panel 收成 `<details>`。

## 5. 目前資料的已知事實（不要當 bug）

- `coverage.units=143`：11 exact、131 approx、1 gap；M1 39/39（word_covered 11），M2 14/14，M3 19/19，M4 54/54，M5 17/17。
- `M1.06` 是 gap：T945 缺 `anāgāmināṃ`；`zh=""`、`words` 兩列 gap。
- `M1.12` 的 `umāpati`／`sahīyāya` 在 `S2587.18/.19`，不是 gap。
- `approx` unit 的 `zh`／`translit`／`char` 是 **unit 級近似**（按梵詞數分配），不是逐詞；unit header 顯示 `≈`。
- `translit` 有些是整段漢字（`勃地薩跢`），不是逐字；`1:n` 的兩列會共用同一 `translit`。
- `char` 是舊句 offset，不是新 `S3306` 的 offset。
- `MANTRA.links` 只有 S2587 的 422 句，全部 `u=2587`；`MT_BY_U.get(2587)` 是 143 個 unit 的陣列。

## 6. 驗收

請用 `D:\2026\surangama\site\reader\mantra\mantra-data.js` 做資料，至少測：

1. 有 `MANTRA` → `#tabs2` 出現「咒語」；沒有 → 完全不出現。
2. 點「咒語」在沒選句時也能開；五會 tab 都在：M1 39、M2 14、M3 19、M4 54、M5 17。
3. `M1.06` 顯示「T945 缺此句」，不是空白卡。
4. `M1.01` 的 `bodhi`/`satve` 兩列共用「勃地薩跢」，relation 顯示 `1:n`。
5. `M1.04` 的 `srotāpannānāṃ` 一列顯示「蘇盧多＋波那喃」，relation `n:1`。
6. 點 `M1.01` 的 `Namaḥ` → 經文跳到 `u=2587`，`[32,34)` 閃 `南無`。
7. 經文 `u=2587` 出現「咒」按鈕；點它 → 咒語頁 scroll 到 `M1.01`（若帶 char，選重疊 unit）。
8. 點高頻詞 `sarva` → 目前會中 `sarva` 列高亮；再點清除。
9. 手機 375px：詞表變卡片，不橫向溢出；assembly tabs 可滑。
10. 既有的「注疏／科判／別譯／辭典／詞組」分頁與 hover 梵文詞不受影響。
11. `M2.01` 顯示 `≈ 近似`；`translit` 是 unit 範圍，不是逐詞；不要把它標成 exact。
12. `M4.01`（54 unit 的會）能正常開，不會因 unit 多而卡住；一次只 render 當前會。

## 7. 檔案與建置

| 檔案 | 動作 |
|---|---|
| `app.js` | `buildTabs`、`renderBody`、`#tabs2` click、`actBarHtml`、`selectUnit`、`ZHU_APP` 加 `openMantra` |
| `index.html` | 不需要靜態 tab；`#tabs2` 由 JS 長 |
| `style.css` 或 `src/mantra/mantra.css` | `.mt-*` 樣式 |
| `build-kepan.mjs` | 可選內嵌 `<root>/mantra/mantra-data.js` |
| `src/mantra/mantra.js`（建議） | `renderMantra`、`openMantra`、`MT_BY_U`、`flashRange` |

- 不要把 `MANTRA` 寫進 `zhu-data.js`；保持獨立的 `window.MANTRA`。
- 不要改 `D:\2026\surangama` 的資料；有資料問題回報，不要在前端硬修。

## 8. 不要做

- 不要改「詞組」分頁的語意，也不要把咒語塞進 `D.pdf`。
- 不要把 `display_sid`（`S3306`）當 `u` 傳給 `selectUnit`。
- 不要在 `char` 缺失時硬猜 offset。
- 不要一次 render 全部 143 unit。
- 不要為咒語另寫一套 tab／panel 架構；用既有 `#tabs2`／`#cards`／`#sheet`。

## 9. 回報格式

完成後請回：

1. 改了哪些檔案、每個檔案的責任。
2. `MANTRA` 是否用 `window.MANTRA`；`build-kepan.mjs` 的內嵌方式。
3. `selectUnit` 的 `hl` 實作方式（Range／mark／還原）。
4. 驗收 1–10 的結果（PASS／FAIL＋截圖或文字）。
5. 你對資料契約的疑問；不要自行改欄位。

## 10. 開放問題（請先回覆，不要先改資料）

1. `window.MANTRA` 獨立 global 可以嗎？還是你要放進 `window.ZHU.mantra`？
2. `selectUnit(u,{hl})` 由你加，還是要我在 `ZHU_APP` 開 `flashRange`？
3. 分頁順序放「詞組」後可以嗎？
4. 你要不要 `MANTRA.lexicon` 先只給前 20，還是全量由前端 slice？
5. 咒語頁要不要保留「目前選句」的 highlight？還是完全獨立在 sheet 裡？

---

資料產生端：`D:\2026\surangama\scripts\build-mantra-tab.ts`
資料檔：`D:\2026\surangama\site\reader\mantra\mantra-data.js`




