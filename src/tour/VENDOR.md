# src/tour · 操作導覽模組（vendored）

這個目錄是 [`agent-norms`](https://github.com/accelon/agent-norms) 的
`self-explaining-tour` 原樣拷貝，加上本站的轉接層。

- 來源：`D:\2026\agent-norms\self-explaining-tour`，commit `450413e`
- 拷貝的檔案：`player.ts`、`format.ts`、`compiler.ts`、`build-tours.ts`、`test.ts`、
  `shell.html`、`shell.css`、`README.md`（**不改內容**；要改請回 `agent-norms` 改，再重新拷貝）
- 本站新增：`app.ts`（轉接層 + 入口接線 + 第一次提示）、`tour-data.ts`（編譯產物，勿手改）

## 為什麼要打包

`player.ts` 是 TypeScript，本專案前端是純 JS（`file://` 直接開、單檔 `vcpp.html` 內嵌），
所以 `bun build src/tour/app.ts --outfile tour.js` 把它打包成一個 IIFE，
`index.html` 以 `<script src="tour.js">` 載入，`build-vcpp.mjs` 再把它內嵌進單檔。

```powershell
bun run build-tour.mjs            # tours/*.tour → tour-data.ts → tour.js
bun run build-tour.mjs --check    # 兩者是否都是最新的（發版前跑）
```

## 不要做的事

- 不要直接改 `player.ts`／`compiler.ts`／`format.ts`（下次同步會被蓋掉）。
- 不要在 `tour-data.ts` 手寫資料（`--check` 會失敗）。
- 新增 `呼叫` 動作時，`app.ts` 的 `call()` 與 `tour.config.ts` 的 `callNames` 要一起改。
