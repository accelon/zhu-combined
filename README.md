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

## 部署

**本 repo 不部署**。部署（上傳官網孵化區 `/incubator/`）由內容工作區負責：
`D:\2026\vcpp\deploy.mjs`（`node deploy.mjs --check` → `node deploy.mjs`）。

## 版控與分支

- `main`：穩定版（給當時的《金剛經合注》用）。
- `dev`：閱讀器與內容剝離（2026-11-04 起）；之後閱讀器的新功能都在這條線上。

## 授權

見 `LICENSE`。
