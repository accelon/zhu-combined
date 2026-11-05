# 給 `surangama`：咒語資料對齊（閱讀器已接好，換你這邊調）

> 這裡是 `D:\2026\zhu-combined`（閱讀器）。咒語分頁已經做完並驗收通過，
> 資料契約仍是 [`mantra-tab.md`](mantra-tab.md)；下面是**實測你現在這份資料**之後，
> 需要你決定或修的地方。**不要為了讓畫面好看去改前端契約欄位**，要改先回報。

## 0. 前端現在怎麼讀你的資料（已定，不用再問）

- 檔案：`<工作區>/mantra/mantra-data.js`，內容一行 `window.MANTRA = {...};`。
- `window.MANTRA` 是獨立 global，不進 `window.ZHU`。
- `build-kepan.mjs` 會自動內嵌（`--mantra <path>` 可指定；沒有檔案就跳過、不報錯）。
- 分頁只在 `MANTRA.units.length > 0` 時出現；一次只畫一個會；`covered=0` 的會顯示「待補」且不可點。
- `relation` 只認 `1:1`／`1:n`／`n:1`／`gap`；**其他值目前當成 1:1 顯示**（不畫標記、不合併列）。
- `MT_BY_U` 只從 `MANTRA.units[].u` 建（同一個 `u` 取**第一個** unit）；`MANTRA.links` 完全沒用到。
- `char` 是「該句原字串」的 `[start,end)`；越界或缺失只選句、不閃字。
- 高頻詞取 `lexicon` 依 `freq` 前 20，但**本會有的 lemma 排前面**。

## 1. 你現在這份資料的實測（2026-11-05 抓的版本）

```text
units 143　words 770　lexicon 453　links 422
assemblies  M1 39/39　M2 14/14　M3 19/19　M4 54/54　M5 17/17
relation    1:1 28　1:n 12　n:1 6　gap 2　approx 722   ← 契約外的值
confidence  A 30　B 18　C 722
translit 空 620/770　meaning 空 456/770
freq 0       17/770
gap          M1.06（zh 也空，u 也空）
142 個 unit 的 u 都是 [2587]（M1.06 是 gap、u 空），全咒只對到經文一句
char 越界 0　沒有 u 的詞 2（都在 M1.06）
```

## 2. 要你處理的（依影響排序）

### 2.1 `u` 全是 2587 → 「經文→咒語」只能開第一個 unit（最影響體驗）

楞嚴咒在 `zhu-data.js` 裡是**一整句** `u=2587`，所以 142 個 unit 共用它（M1.06 是 gap、u 空）；
閱讀器建 `MT_BY_U` 時取第一個，結果**任何一句有咒語的經文，點「咒」都只會開 `M1.01`**。

兩條路，選一條回報：

1. **unit 級 offset**：每個 unit 多給 `char: [start,end)`（它在 `u=2587` 那句裡的範圍），
   閱讀器就能在開咒語頁時直接滾到「這一段」對應的 unit（前端我加一個 `focusChar` 分支即可）。
2. **接受現狀**：一律開第一會第一句，但請在 `coverage.note` 寫明，免得使用者以為壞了。

（如果你們之後把經文重新分句、讓每個咒句變成獨立 `u`，這題就自動消失——那更好，跟我說一聲。）

### 2.2 `relation: "approx"` 722 筆（契約外）

契約只認四個值。現在這 722 筆在畫面上**當 1:1**：不合併、不標記，跟真正 1:1 的 28 筆長得一樣。
二選一：

- 改回 `1:1`（如果你認為逐詞對得起來）；或
- **把 `approx` 寫進契約**（`docs/prompts/mantra-tab.md` §3.1 是你我共用的文件），
  我這邊再加一個「≈ 近似」標記與 tooltip，不動資料。

我傾向第二條（資料誠實），但要你點頭。

### 2.3 `translit`／`meaning` 大量是空

620/770 沒有 `translit`、456/770 沒有 `meaning`，集中在 `confidence: C` 的 approx 區塊。
UI 依契約顯示 `—`（不硬翻），所以畫面上第二～五會幾乎整片 `—`。

要確認的是：這是**待補**，還是**本來就沒有**？

- 待補 → 沒問題，等你們補。
- 本來就沒有 → 建議在 `coverage` 或 unit 上加旗標，讓 UI 可以整塊說「此會僅梵文，音譯待補」，而不是幾百個 `—`。

### 2.4 `n:1` 的「＋」

規格 §6-5 的例子是 `蘇盧多＋波那喃`，你現在的資料是連寫 `蘇盧多波那喃`（`srotāpannānāṃ`、
`sakṛdāgāmināṃ`、`devarṣiṇāṃ` 都是）。UI 照資料顯示、另加 `n:1` 標記與 tooltip。

如果希望看到「＋」，請在資料端做（例如 `translit_parts: ["蘇盧多","波那喃"]`），**不要**讓我用長度猜。

### 2.5 `freq` 的來源

`word.freq` 有 17 筆是 0，而 `lexicon.freq` 是 26、35 這種。兩邊不一致時以哪個為準？
現在 UI：詞表顯示 `word.freq`（0 → `—`），高頻詞 chip 顯示 `lexicon.freq`。
如果你們能保證 `word.freq` 等於該 lemma 的 `lexicon.freq`，我就直接用（少一個 `—`）。

### 2.6 `links` 422 條

目前**完全沒用到**。契約原本寫「858 條全咒句」，現在是 422。請說明它要解決什麼：

- 如果是「句 → 咒」的補充索引 → 我這邊 `MT_BY_U` 已經從 `units` 建了，會撞。
- 如果是要做「一句裡有多個單元」的細分 → 那正好解 2.1，但需要 `char` 或 `unit_id` 對應。

### 2.7 `track_id` 還是 `rut_id`

契約說 canonical 用轍號 `rut_id`，目前資料仍只有 `track_id`。新程式我照契約讀 `rut_id || track_id`，
所以現在能跑；但如果你們要改欄名，**先講**，我同步。

## 3. 你可以自己驗

資料放到 `<工作區>/mantra/mantra-data.js` 之後，在 `D:\2026\zhu-combined` 跑：

```powershell
# 1) 基本：分頁、五會、gap、1:n、n:1、高頻詞
node build/cdp-mantra-test.mjs "file:///<你的 index.html>"

# 2) 雙向跳轉（咒語→經文、經文→咒語）
node build/cdp-mantra-test2.mjs "file:///<你的 index.html>"

# 3) 手機 375px（詞表變卡片、不橫向溢出）
node build/cdp-mantra-test3.mjs "file:///<你的 index.html>"

# 4) 單檔內嵌
node build-kepan.mjs --root <工作區> --mantra <工作區>\mantra\mantra-data.js --out <輸出.html>
```

測試腳本會印 JSON（欄位名就是上面那些），失敗會直接看到 `null`／`0`。

## 4. 不要做

- 不要把 `MANTRA` 塞進 `zhu-data.js`；保持獨立 `window.MANTRA`。
- 不要改 `relation`／`char`／`u` 的**語意**（要加值先寫進 `mantra-tab.md`）。
- 不要為了「讓表格好看」把 `translit` 填成猜測值；`—` 比錯的字好。
- 不要一次給 143 個 unit 的 DOM 建議——前端只畫一個會，這是刻意的。
