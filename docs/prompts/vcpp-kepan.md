# 給 `vcpp`：把新眼疏科判收尾（一校草稿 → 可用）

> 閱讀器這邊（`D:\2026\zhu-combined`）已經把《金剛新眼疏》科判做成資料並入庫：
> `vcpp\kepan\xinyan.json`（187 節、4 根、連經文 184、`nk` 3）。
> 現在要你在 **vcpp 工作區**把它收尾。先讀 `vcpp\AGENTS.md`，再讀這份。

## 0. 這套科判的來歷（不要重新找資料）

- 科文出處：清·通理《金剛新眼疏經偈合釋》（CBETA X487）。原文的科文夾在疏文裡
  （「二正宗分四。一…初二。…初。」），**Kanripo KR6c0075 卷一＋卷二**把它排成獨立段落：
  `zhu-combined\build\_xy\KR6c0075_001.txt`、`_002.txt`。
- 骨架：幕布〈金剛經科判〉187 節（`zhu-combined\mubu-kepan\docs\20-金刚经科判.md`），已與道源法師
  《金剛經講記》的 188 個標題核對過。
- 產生器：`zhu-combined\build\kepan\xinyan3.mjs`（可重跑，別手改 JSON）：

  ```powershell
  cd D:\2026\zhu-combined
  node build\kepan\xinyan3.mjs --root D:\2026\vcpp    # 會覆寫 vcpp\kepan\xinyan.json
  $env:DBG=1; node build\kepan\xinyan3.mjs --root D:\2026\vcpp   # 額外印 MISS／NOSI
  node build\kepan\build.mjs --root D:\2026\vcpp      # → vcpp\kepan\kepan-data.js
  ```

## 1. 現況（實測）

```text
科名宣告句  182/187
葉科錨點    110/114（其中 3 個是 nk 的釋題節，不算）
空範圍      0
分覆蓋      32/32
```

**已入庫**：`kepan/xinyan.json`，`kepan-data.js` 已含六家（昭明／新眼疏／江味農／印順／宗密／十八住），
`vcpp.html` 也重建過，科判下拉選得到「新眼疏」。

## 2. 要你修的（只有兩件，第三件可選）

### 2.1 尾段四節錯位（必修）

`zhu-data.js` 最後幾句是：

```text
209 須菩提！若有人以滿無量阿僧祇世界七寶…為人演說，
210 云何為人演說？
211 不取於相，如如不動。
212 何以故？「一切有為法，如夢、幻、泡、影…」
213 佛說是經已，長老須菩提及諸比丘…
214 真言那謨婆伽跋帝…（卷末真言，不是經文）
```

現在 `xinyan.json` 的尾段是：

```text
戊二示說結問   212:0   ← 應是 210（云何為人演說）
  己一示說不取 212:0   ← 應是 210
  己二不取之故 213:0   ← 應是 212（何以故？一切有為法…）
甲三流通分     213:0   ← 正確
```

也就是整段往前錯了一位（210、211 這兩句沒被用上）。請在 `xinyan3.mjs` 的錨點階段修正，
不要手改 JSON。線索：`己二不取之故` 的科文在 X487 卷二尾（`KR6c0075_002.txt` 的 `三流通分` 之前），
它對到的「」引文是「何以故。一切有為法。如夢幻泡影…」。

### 2.2 `空生問得` 沒錨到（必修）

`DBG=1` 會印：

```text
NOSI 空生問得     ← 在 X487 疏文裡找不到這個科名的宣告句
```

X487 的寫法可能多了字（例：「空生問得為無」）或換了詞。用下面這支探針找：

```powershell
node build\kepan\xinyan3.mjs --root D:\2026\vcpp   # 先看它落在哪個父節點底下
# 在 Kanripo 文字裡找：
Select-String -Path build\_xy\KR6c0075_002.txt -Pattern "空生問得|問得" | Select-Object -First 5
```

找到後把 `xinyan3.mjs` 的 `stripOrd`／`ed<=1` 容錯放寬到涵蓋那個寫法（不要硬塞 u）。

### 2.3 （可選）補一套「銷釋金剛經科儀會要註解」

我掃過 adb：`D:\accelon3\accelon3_fg\wxzj.adb` 裡有一批金剛經科文書
（見 `D:\2026\adb-converter\build\kepan-shortlist.tsv`）：

| 書 | 備註 |
|---|---|
| 銷釋金剛經科儀會要註解 | 「科判以成篇章，故立科儀以為題名」——科儀體，含科判 |
| 金剛經采微科 | vcpp 已有 X464《金剛經采微》正文 |
| 金剛經疏記科會 | vcpp 已有 X491，且已做成 `kepan/zongmi.json` |
| 金剛疏科釋 | vcpp 已有 X466 |

要做就照 `build\kepan\zongmi.mjs` 的模式：從 wxzj 抽科文 → 對到 `u/off` → 出 `kepan/<id>.json`。
**先確認它真的有可用的科判樹**，沒有就記在 `docs/kepan-inbox.md` 不要硬做。

## 3. 驗收

```powershell
cd D:\2026\vcpp
node build.mjs                                   # → vcpp.html（3.1 MB 上下）
node D:\2026\zhu-combined\build\kepan\audit.mjs --root D:\2026\vcpp   # 若該支支援 --root；否則看 build 的輸出
```

- `node build\kepan\build.mjs --root D:\2026\vcpp` 要印出 `xinyan: 187 節 · 連經文 ≥184 · 根 4`
- 開 `vcpp.html`，科判下拉切「新眼疏」：
  - 麵包屑最底一節要能落在「云何為人演說」「何以故？一切有為法…」「佛說是經已」三句上
  - 目錄裡點任一節會跳到對應經文；點小三角只展開／收合，**不會關掉目錄**
- 隨手抽 5 節（例如 甲一序分、丙二如來許說、己三勸如教住、乙四決定降住成證分、甲三流通分）對照經文。

## 4. 不要做

- 不要手改 `kepan/xinyan.json` 或 `kepan/kepan-data.js`——改 `xinyan3.mjs` 再重跑。
- 不要改 `zhu-data.js` 的分句（改了全庫錨點都要重對）。
- 不要把「一校草稿」的字樣拿掉，除非上面兩件都修完、抽樣看過。
- 不要在這區改閱讀器（`app.js`／`kepan.js`）；那是 `zhu-combined` 的事，回那邊改。

## 5. 做完請回報

1. 改了 `xinyan3.mjs` 哪幾段、尾段四節的新 `u/off`。
2. `空生問得` 在 X487 的實際寫法。
3. 重跑後的 `節數／連經文／根` 與 `31/32 分覆蓋`。
4. `vcpp.html` 的大小；`docs/build-log.md` 加一列。
