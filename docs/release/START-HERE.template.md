# START HERE：zhu-combined 閱讀器（{{VERSION}}）

> 發行日 **{{DATE}}**　·　閱讀器 commit `{{COMMIT}}`　·　{{FILES}} 個檔案
> 這一包是**閱讀器本體**，不含任何經文資料。你的工作區提供資料，閱讀器只負責畫。
> 先讀 `zhu-combined-skill.md`（方法論與華嚴的具體建議），再讀 `README.md`（資料契約）。

---

## 硬規則：**資料＋閱讀器打包後，上限 5 MiB**（口語的 5 MB；程式比的是 5,242,880 bytes）

這是本專案的上限（打包器預設 8 MiB，是給別的專案用的）。**每一條打包指令都要帶 `--max 5`**，
超過就直接 `exit 1`，不會悄悄產出一個 9 MB 的檔。

```bash
node build-kepan.mjs --max 5 --root D:/2026/你的工作區 --out out/huayan.html \
  --title "華嚴經集註" --sub "…" --start huayan.html
```

真的超過 5 MiB，照順序做：

1. **`--limit 40000`**：把超長注疏（演義鈔 1.15 MB、探玄記 627 KB）切成節錄，
   UI 會標「節錄」；主文與其餘注疏不受影響。
2. **分卷／分會出兩檔**：例如 卷一–四十、四十一–八十，`apps.json` 各登記一列。

> 實測參考：楞嚴選注 5.02 MiB（略超）、圓覺 4.62 MiB、金剛經 3.11 MiB。
> 華嚴主文本身就不小，**先把主文＋一家注疏打通、量一次大小，再決定要不要收第二家**。

---

## 一分鐘跑起來

```bash
# 1) 解壓到你的工作區旁邊
# 2) 做一份資料：<你的工作區>/zhu-data.js（內容 window.ZHU = {...}; 契約見 README.md）
#    最小可用：
#    window.ZHU = { sections:[{n:0,title:'卷一'}], versions:[{id:'main',label:'唐譯',sents:[{t:'如是我聞…',u:0,s:0,p:''}]}], works:[] };

# 3) 開發版：把資料複製到這個資料夾，直接開 index.html（file:// 可開）
node -e "require('fs').copyFileSync('D:/2026/你的工作區/zhu-data.js','zhu-data.js')"

# 4) 單檔打包（含科判，5 MiB 上限）
node build-kepan.mjs --max 5 --root D:/2026/你的工作區 --out out/huayan.html \
  --title "華嚴經集註" --sub "…" --start huayan.html

# 沒有科判的版本
node build-vcpp.mjs --max 5 --root D:/2026/你的工作區 --out out/huayan.html --title "華嚴經集註"
```

需要 Node 18+；有 `bun` 很好，但閱讀器本身不用它（`bun` 留給你的語料腳本）。

## 檔案在哪

| 路徑 | 是什麼 |
|---|---|
| `index.html`／`app.js`／`style.css`／`lossless.js` | 閱讀器本體（`file://` 可開） |
| `src/kepan/` | 科判層（麵包屑、目錄、載入偵測） |
| `src/mantra/` | 咒語分頁（可選層） |
| `src/tour/` | 操作導覽引擎 |
| `build-vcpp.mjs` | 打包器（無科判） |
| `build-kepan.mjs` | 打包器（含科判；預設讀 `<root>/kepan/kepan-data.js`） |
| `build-all.mjs`／`apps.json` | 多工作區一起打包的登記表 |
| `build/kepan/` | 科判產生器**範例**（金剛經、楞嚴）；照抄結構，不要照抄資料 |
| `build/cdp-*.mjs` | 驗收腳本（截圖、點擊、科判目錄／辭典／咒語） |
| `docs/prompts/` | 給各工作區的提示詞（含 `brotli-release.md`） |
| `docs/kepan-adb-scan/` | 掃 taisho／wxzj／Library 的科判書單 |

## 另外兩個限制

1. **一次載完**是刻意設計：啟動 2–6 秒，之後每個操作都是閃現。不要改成 lazy。
2. **資料不放這包**：`zhu-data.js`、`kepan/kepan-data.js`、`mantra/` 都由你的工作區產生。

## 驗收（每次改資料都跑）

```bash
node build/cdp-smoke.mjs "file:///.../out/huayan.html"      # 載入、分頁、例外
node build/cdp-kb-warn.mjs "file:///.../out/huayan.html"    # 科判每家有沒有 ⚠
node build/cdp-kb-panel.mjs "file:///.../out/huayan.html"   # 目錄小三角不會關面板
```

## 有問題回哪裡

閱讀器本體維護在 `D:\2026\zhu-combined`（作者）。**不要在你那邊改 `app.js`／`src/kepan/`**，
要改回報；資料問題（對位、科判層級）在你那邊解決。

## 版本

這一包是哪一天的閱讀器，看 `VERSION.txt`；更新閱讀器或規則時會重新出一包，
資料夾與檔名都帶日期（例：`zhu-combined-reader-{{DATE}}/`）。舊包可以留著對照。
