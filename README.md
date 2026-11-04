# zhu-combined · 經注閱讀器（data-neutral）

一個**純靜態的經注對讀閱讀器**：主文一分一屏、點句看注、梵藏逐詞、別譯並置、科判層、繁簡顯示、搜尋、單本注疏閱讀模式。
**閱讀器本身不含任何經文資料**；資料由各「經群工作區」提供（目前是《金剛經合注》，見 `D:\2026\vcpp`）。

> 2026-11-04 起，本 repo 只留閱讀器（`index.html`／`app.js`／`style.css`／導覽／打包器）。
> 《金剛經合注》的資料、研究與部署搬到 [`vcpp`](https://github.com/accelon/vcpp)。

## 資料契約

閱讀器在執行時只認一個全域物件 `window.ZHU`：

```js
window.ZHU = {
  sections: [{ n, title }],                 // 分（例：昭明三十二分）
  versions: [{ id, label, trans, lang, sents: [{ t, u, s, p }] }],   // 主文與別譯
  pdf:      [{ no, secTitle, sa, tib, shi, zang, jing, note, jie, u, us }], // 梵藏逐詞
  works:    [{ id, title, author, date, year, corpus, no, vol, kind,
               text, pages, anchors: [[u, a, b, page], …] }],          // 注疏
  kepan?:   { editions: [...] }             // 可選：科判（由 build-vcpp-kepan.mjs 內嵌）
};
```

- 主文的 `versions[0]` 就是頁面主欄；`sents[].u` 是跨檔對齊的單位編號。
- 注疏以 `anchors` 掛到 `u`；閱讀器只做顯示與對齊，不認識任何一家注疏。
- 科判（`kepan/kepan-data.js`）是選用層：放在 `window.KEPAN`，由 `build-vcpp-kepan.mjs` 一起打包。

## 目錄

```text
index.html app.js style.css      閱讀器（file:// 可直接開，但需要資料）
lossless.js                      無損簡體（顯示用；build/make-lossless.mjs 從 agent-norms 產生）
tour.js tours/ src/tour/         操作導覽（self-explaining-tour）
src/kepan/kepan.js kepan.css     科判層（麵包屑、目錄、單本注疏閱讀模式）
build-vcpp.mjs                   單檔打包器（無科判）
build-vcpp-kepan.mjs             單檔打包器（含科判）
build/gunzip.js                  DecompressionStream 缺席時的純 JS 解壓
build/cdp-*.mjs                  開發驗證工具（截圖、互動、導覽回放）
```

## 開發

閱讀器需要資料才能跑。把某個經群工作區的 `zhu-data.js` 放到本目錄（或建連結），例如：

```powershell
cd D:\2026\zhu-combined
New-Item -ItemType SymbolicLink -Name zhu-data.js -Target D:\2026\vcpp\zhu-data.js
```

然後雙擊 `index.html`（`file://` 即可，不需要伺服器）。`zhu-data.js` 已列入 `.gitignore`，不會進版控。

## 打包

打包器留在本 repo，**資料從工作區讀**（`--root` 或 cwd）：

```powershell
cd D:\2026\vcpp
node ..\zhu-combined\build-vcpp.mjs                 # → vcpp-nokepan.html（無科判）
node ..\zhu-combined\build-vcpp-kepan.mjs           # → vcpp-kepan.html（含科判）
# 或直接用 vcpp 的包裝：node build.mjs
```

- 閱讀器程式（`index.html`／`app.js`／`style.css`／`lossless.js`／`tour.js`／`src/kepan/`）永遠從本目錄讀。
- 資料（`zhu-data.js`、`kepan/kepan-data.js`）從 `--root`（預設 cwd）讀。
- 每次部署都順帶產生 `vcpp.html.gz`（見 vcpp 的 `deploy.mjs`）。
- 舊的 `--limit`／`--max` 參數照舊。

## 導覽（🦮）

導覽引擎在本目錄（`src/tour/`），**劇本與成品 `tour.js` 在內容工作區**：

```powershell
cd D:\2026\vcpp
node build-tour.mjs            # tours/*.tour → tour.js（編譯器在閱讀器）
node build-tour.mjs --check    # 劇本與 tour.js 是否同步
```

- 打包器只內嵌工作區的 `tour.js`；工作區沒提供時，標題列的 🦮 會自動收起。
- 編譯器產生的 `src/tour/tour-data.ts` 是中間檔，不進版控。

## 部署

**本 repo 不部署**。部署（上傳官網孵化區 `/incubator/`）由內容工作區負責：
`D:\2026\vcpp\deploy.mjs`（`node deploy.mjs --check` → `node deploy.mjs`）。

## 科判（共用層）

科判不是金剛經專屬：介面（`src/kepan/`）留在閱讀器，資料在內容工作區。

- **資料**：工作區放 `kepan/kepan-data.js`（`window.KEPAN`，每家一套科判樹，
  節點記 `u`／`off` 起點，`workId` 指到注疏、`base` 標分章本）。
- **打包**：`node build-kepan.mjs`（＝舊名 `build-vcpp-kepan.mjs`，相容別名）。
  預設讀 `<工作區>/kepan/kepan-data.js`，可用 `--kepan <路徑>` 指定；
  沒有科判資料時會直接說「這個工作區沒有科判」，改用 `build-vcpp.mjs` 即可。
- **一般版**：`build-vcpp.mjs` 不載科判層；科判版多內嵌 `KEPAN` 與介面 CSS／JS。
- **只有科判「文字」的工作區**（例：楞嚴的六部科文）：閱讀器右欄「科判」分頁直接顯示
  全文（`ZHU.ke`），不需要科判樹；要做成麵包屑／目錄的科判版，得先把那部科文
  對到經文句（節點 `u`／`off`），不是打包能代勞的。

## 右欄分頁（依資料長出來）

`#tabs2` 不是寫死的，依 `window.ZHU` 有什麼畫什麼：

| 分頁 | 出現條件 | 資料 |
|---|---|---|
| 注疏 | `works.length` | `works[]`（anchors 對到句） |
| 科判 | `ke.length` | `ke: [{ id, title, author, text }]`，全文 pre-wrap |
| 別譯 | `versions.length > 1` 或 `english` | `versions[]`；`byJuan` 的譯本（如英譯 Luk）按卷顯示 |
| 辭典 | `glossary.entries` | `glossary` |
| 詞組 | `pdf.length` | `pdf[]` |

- 注疏的作者列**列出全部**，這一句沒有他的注文就淡掉；點淡掉的會顯示「最接近的段落」。
- 頂欄「辭」切到辭典分頁並聚焦搜尋，再按一次回上一個分頁；手機上一樣（面板全屏）。

## 辭典／速查（可選）

工作區提供 `glossary.json`（或把 `glossary` 放進 `window.ZHU`）時，頂欄會出現「辭」入口：

```json
{
  "schema": 1,
  "categories": [{ "id": "人物", "label": "人物", "count": 17 }],
  "entries": [{
    "id": "p-ananda", "term": "阿難", "aliases": ["阿難陀"], "category": "人物",
    "gloss": "佛陀堂弟…", "sa": "Ānanda", "tib": "ཀུན་དགའ་བོ", "en": "Ānanda",
    "ref": null, "count": 458, "truncated": true,
    "workHits": { "T1799": 559 },
    "occurrences": [{ "s": 8, "juan": 0, "page": "19p105c", "quote": "…" }]
  }]
}
```

- `occurrences[].s` 是主文句序（`versions[0].sents[i]`），點一筆就跳該句並閃一下；
  也可以直接給 `u`。
- `workHits` 的名稱由 `meta.workNames`（id → 顯示名）決定，沒有就顯示 id。
- 五類固定（人物／名詞／論點／呂澂批評／譯者版本），但晶片是照 `categories` 畫的，換經群可換分類。
- 沒有 `glossary` 就不顯示入口；資料欄位只增不改，未知欄位會被忽略。

## PWA（可安裝）

打包器會在同一個目錄產出：

| 檔案 | 內容 |
|---|---|
| `<名稱>.webmanifest` | `name`、`start_url`、`display: fullscreen`、192／512 圖示（讀 `assets/icon-*.png`，來源是 adb-converter 的 appicon） |
| `sw.js` | 離線快取（network-first，離線回快取） |
| `icon-192.png`／`icon-512.png` | 由 `build/pwa.mjs` 從 `assets/` 複製 |

- 打包時用 `--start <部署後的檔名>` 指定 `start_url`（例：`--start vcpp.html`，因為 deploy 會把 `vcpp-kepan.html` 改名）。
- 開啟時（`https` 或 localhost）會問「要安裝到桌面嗎」：Chrome／Edge 用 `beforeinstallprompt`，iOS 顯示「分享 → 加入主畫面」的說明；按「稍後」記在 `localStorage` 七天。
- 已安裝（`display-mode: fullscreen/standalone`）就全屏開；**只有全屏時**右上角才出現 ✕，一般分頁不顯示。
- `file://` 直接開不會註冊 service worker（正常，瀏覽器限制）。
- 部署時 `<名稱>.webmanifest`、`sw.js`、`icon-192.png`、`icon-512.png` 要一起上傳到同一目錄（vcpp 的 `deploy.mjs` 已加）。

## 應用清單（apps.json）

閱讀器不綁定任何一部經。每個數據工作區在 `apps.json` 登記一列：

```json
{ "id": "xinjing", "name": "心經注釋", "workspace": "D:\\2026\\xinjing", "build": "build.mjs", "outputs": ["xinjing.html"] }
```

```powershell
node build-all.mjs            # 只打包 default（目前是心經）
node build-all.mjs --app vcpp # 只打包金剛經
node build-all.mjs --all      # 更新所有應用
node build-all.mjs --list     # 看清單
```

## 啟動畫面與圖示

- 單檔開啟時先顯示「載入數據中」遮罩，邊解壓邊更新進度（base64 → 解壓 → 啟動）。
  解壓用 `TransformStream` 數 bytes，約每 100ms 更新；gzip 尾端的 ISIZE 當分母。
  舊瀏覽器（沒有 `DecompressionStream`）走純 JS 解壓，顯示不確定動畫。
- 想慢慢看遮罩：`?slowboot=2000`（毫秒，測試用）。
- 網頁圖示（favicon）內嵌在 `index.html`（data URI），來源是
  `D:\2026\adb-converter\www\img\appicon.png`，縮成 64×64。

## 設計取捨：一次載完，不走 lazy

**決定（2026-11-04，作者指示）**：單檔開啟時把整份資料解完再進畫面；之後所有操作都在
`window.ZHU` 上同步做，不按需抓資料。

- 做法：`zhu-b64` 內嵌 → 分塊解 base64 → 解壓 → `JSON.parse` → `__startApp()`。
  外殼（標題列、分頁）先畫，中間用一張「載入數據中」進度卡擋著，解完才收。
- 理由：
  1. 讀者一開始多等幾秒，換來之後**每一次點句、換分、注疏、辭典、跳轉都是閃現**（資料已在記憶體）。
  2. 程式不必到處 `await`：沒有「資料還沒到」的狀態要處理，渲染路徑單純、出錯面小。
- 代價：啟動時間 ≈ 資料解壓時間（金剛經約 2–3 秒、楞嚴約 4–6 秒，視裝置而定）。
- 什麼情況該改回來：資料量再大一個量級（例如十幾 MB）、或要放手機 3G 首開，
  才考慮「外殼＋`fetch('*.data.gz')` 背景載入」或「注疏按需載入」。那時要重寫渲染路徑的等待邏輯。

## 版控與分支

- `main`：穩定版（給當時的《金剛經合注》用）。
- `dev`：閱讀器與內容剝離（2026-11-04 起）；之後閱讀器的新功能都在這條線上。

## 授權

見 `LICENSE`。


## 科判：邏輯在閱讀器、內容在各工作區

**所有科判邏輯**（麵包屑、目錄浮層、經文 `kb-mark` 變色、版本切換、打包）都在本區：`src/kepan/kepan.js`、`kepan.css`、`build-vcpp-kepan.mjs`；
**科判內容**由各經注群工作區管理，只提供 `kepan/kepan-data.js`（`window.KEPAN`）。

合成資料（把 `kepan/*.json` 併成 `kepan-data.js`）：

```text
node D:\2026\zhu-combined\build\kepan\build.mjs --root D:\2026\vcpp
```

- `build/kepan/lib.mjs`：正規化、8 字窗單調對齊等共用工具
- `KEPAN.md`：科判介面與資料格式（2026-11-05 自 vcpp 移回）
