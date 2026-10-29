---
name: alignment-skill
description: 把一份外文譯本（如 Conze 英譯）切分，並逐句對齊到既有句庫（unit）的做法；含粗切、細分、人工校訂、驗收。
when: 要為 zhu-combined 新增一個譯本、或修現有譯本與羅什句的對齊時。
---

# 切分與對齊（alignment）

把「一份連續的譯文」變成「每個 unit 一段」的資料。本專案已經用這套流程把
Edward Conze 的英譯（梵英對照 PDF）對到 215 個羅什句，214 句有對應、6736/6736 詞不重不漏。
換一個譯本（另一種語文、另一個 PDF）時照下面的順序做即可。

## 0. 前提

- **unit**：句庫的最小單位，本專案是「羅什的一句」＝一則梵文（`pdf-entries.json` 的 `sa`）。
  所有譯本都用同一個 `u` 索引，前端才能並列。
- **共同底本**：粗切要靠「兩邊都有的東西」。這裡是梵文：Conze 的 PDF 每段英文前面
  就是那段梵文，而我們的句庫也有每句梵文。沒有共同底本時，見 §8。
- **產物**：`conze-en.json`＝`[{t, u, sec, page}]`，`t` 是連續片段（可以是半句），
  同一個 `u` 可以有多段（依序相接），全部片段接起來＝原譯文。

## 1. 取文字層

```python
from pypdf import PdfReader
pages = [f"===== PAGE {i} =====\n" + (p.extract_text() or '') for i, p in enumerate(PdfReader(src).pages, 1)]
```

保留頁碼分隔，之後每個片段才能記「原書第幾頁」。先讀前 20 行，確認：

- 是「原文段／譯文段」交替，還是左右分欄、還是逐句穿插？
- 頁眉頁腳、書名、頁碼是不是每頁都出現？
- 偈頌是不是短行（每行不滿一句）？

## 2. 切段落（block）— 最易出錯的一步

逐行分類再合併同型連行：

```python
def classify(line, prev):
    sa = len(SA_MARK.findall(line)); en = len(EN_MARK.findall(line))
    if en > sa: return 'en'
    if sa > en: return 'sa'
    return prev or 'sa'          # 平手沿用上一行，不要預設 en
```

四個坑（都真的踩過）：

1. **平手要沿用上一行**。偈頌第一行 `Taraka timiram dipo` 一個標記都沒有，
   若預設 `en`，整首偈會被併進前一段英文。
2. **不要把單字母 `a`／`an` 放進英文標記**。梵文複合詞 `va-a-samjna` 在 `\b` 邊界上
   會命中 `a`，整行被判成英文（本專案就多出一段 `va-a-samjna va babhuva.`）。
3. **一行裡可能有「前段英文尾巴＋新段梵文」**（PDF 換段時擠在同一行）：

   ```python
   m = re.match(r"^([a-z][^.]{0,40}[.!?])\s+((?:Tat|Evam|Atha|Yas|Yo|Na)\b.*)$", line)
   if m: lines[i:i+1] = [m.group(1), m.group(2)]
   ```

   注意這條規則也會切到純梵文行（`samnisannah. Atha ...`），所以只讓它切，
   切完兩邊各自分類即可，不要假設前半一定是英文。
4. **偈頌直接硬指定**。只有三首偈，用原文比對表最省事：

   ```python
   VERSE = {"Ye mam rupena ca-adraksur": "sa", "Those who by my form did see me,": "en", ...}
   ```

另外：去掉封面標題（第一個 `Om namo` 之前）與版權頁（`Aus:` 之後）；
斷行用 `-` 接回時不要加空格（`sight-` + `objects` → `sight-objects`）；
**驗證 `sa` 段數 == `en` 段數**，不等就是分類錯了。

## 3. 錨點粗切（用共同底本）

把兩邊的梵文都 fold（去變音、小寫、只留字母）成 token，用唯一 4-gram 錨點 + LIS：

```python
pos_p = {}                        # 4-gram -> [位置]，只用唯一出現的
for i in range(len(ptoks)-3): pos_p.setdefault(tuple(ptoks[i:i+4]), []).append(i)
pairs = [(i, pos_p[g][0]) for i, g in enumerate(4grams(ctoks)) if len(pos_p.get(g, [])) == 1]
chain = LIS(pairs, key=lambda p: p[1])     # 單調、保序
# 任意 conze 位置 → pdf 位置：找前一個錨點，加上位移
```

接著 `pdf entry → u`，就得到「這一段英文大致落在哪幾個 unit」。

三個坑：

- **錨點鏈會在段尾斷掉**（最後一兩句沒錨到）→ 不要相信 `(min, max)` 範圍。
- **有些 entry 的 `u = -1`**（原書缺譯）→ 該段可能整段沒有 u，要插值。
- 段落範圍會**重疊**（前一段尾巴落在下一段的第一句）→ 見 §4。

## 4. 人工校訂段落起點（關鍵）

把「範圍」改成「起點清單」：第 i 段從 `s_i` 開始，`s_i..s_{i+1}-1` 都歸它；
`s_i == s_{i+1}` 表示兩段共用一個 unit（例如兩首偈都掛在同一個羅什句）。

校對方法：印一張表，每列 = 段落序號、起點 unit、**該 unit 的漢譯前 20 字**、
**該段英文前 70 字**，一眼就能看出起點錯沒錯：

```text
34  10u  141  須菩提！於意云何？如來有肉眼不？   What do you think, Subhuti, does the fleshly eye...
```

本專案 56 段裡有 3 段起點是錯的（差 1–2 句），全部靠這張表抓出來。
**不要相信自動範圍**；寧可人工確認一輪，後面 DP 才不會整段位移。

## 5. 段內細分（單調 DP）

目標：把該段英文切成 `m` 個**連續、非空**片段（`m` = 該段 unit 數），順序不變、不重不漏。

成本設計：

| 項 | 值 | 說明 |
|---|---|---|
| 切在句末 `[.!?]` | 0 | 最自然 |
| 切在逗號 `[,;:]` | 1.0 | 次佳（Conze 常把兩句併成一句） |
| 切在其他地方 | 6.0 | 幾乎不允許 |
| 位置差 | `POS * abs(p/n - cum_k)` | `cum_k` = 前 k 個 unit 的長度占比 |
| 詞彙重疊 | `- LEX * cos(片段, unit 逐詞注英譯)` | IDF 加權的 cosine |

`POS≈2.5`、`LEX≈0.7`。片段權重 `L_k` **用梵文長度**，不要用漢譯字數：

```python
def weight(k): return unit_sa[k] if unit_sa[k] >= 20 else len(units[k]['t'])
```

因為譯者會壓縮（Conze 常常一句抵羅什三句），用漢譯長度會把後面的 unit 全部往前拉。

DP 骨架：

```python
for j in range(1, m+1):                 # 第 j 段
  for q in range(j-1, pmax):            # 上一段結束在 q
    for p in range(q+1, pmax+1):        # 這一段結束在 p
      v = dp[j-1][q] + cc[q] + POS*abs(p/n - cum[j]) - LEX*lex(q,p)
      dp[j][p] = min(dp[j][p], v)
# 回推 bk 得到 m-1 個切點
```

**教訓：位置項是「加」不是「減」。** 寫成 `- POS*abs(...)` 會讓 DP 一路切到段尾
（因為越偏越「便宜」），症狀是「第一句吃掉整段、後面每句各分到一句」。

## 6. 人工切點（收尾）

DP 一定會有幾段抓錯，用外掛檔案指定切點，不要改程式：

```json
{ "34": ["of the Tathagata exist?", "Tathagata does exist.", "heavenly eye exist,", ...] }
```

- key = 段落序號（`pairs` 索引，0 = 歸敬偈），value = **每一段結尾的幾個詞**，
  數量必須等於 `unit 數 - 1`（最後一段吃剩下的）。
- marker 用原文的詞序比對（去標點、不分大小寫），所以**要含足夠上下文**：
  `called 'seizing on a material object'.` 比 `object'.` 安全。
- 兩個常見對不上：引號種類（`'` vs `’`，fold 時都會去掉，沒差）、連字號
  （`worlds-would` 是一個 token，marker 不能寫 `would`）。
- 一行 `python build/conze-check.py` 就能檢查全部 marker 有沒有對上。

本專案只用了 10 段人工切點（7、11、12、19、22、34、36、43、52、53），其餘全自動。

## 7. 寫回資料與前端

1. `build/build-data.ts` 追加一個 version：

   ```ts
   versions.push({ id: 'CONZE', label: 'Conze', trans: '…',
     sents: ce.map(s => ({ t: s.t, u: s.u, sec: s.sec, p: `英 ${s.page}` })) });
   ```

2. `app.js` 三件小事：
   - 片段相接：漢譯用空字串、拉丁文用空格（`joinSents`）。
   - `body.v-en`：英譯模式隱藏注疏上標（數字在英文裡像註腳）、換西文襯線字。
   - 搜尋：中文只比漢字，拉丁字母只比英文（`norm()` 會把英文濾成空字串）。
3. 重建：`bun run build/build-data.ts` → `node build-vcpp.mjs`。

## 8. 沒有共同底本怎麼辦

- 只有譯文、沒有原文：改用「結構錨點」——編號（`(1)`…`(8)`）、問答標記
  （`Subhuti asked` / `The Lord said`）、數字（`1,250`、`500`、`1,000 million`）。
- 兩份漢譯互對：用現成的 8 字窗 LIS（`build-data.ts` 的 `alignUnits`），
  它已經是「字串相似度 + 單調 DP」，不需要本文件這套。
- 譯本有兩個版本（例如 Conze 1958 與 1973 修訂）：先用 §2 切段，段落多半一一對應。

## 9. 驗收清單

- [ ] `sa` 段數 == `en` 段數（§2）
- [ ] 每段起點人工確認過（§4 的表）
- [ ] 全部人工 marker 對得上（`conze-check.py`）
- [ ] **詞數守恆**：所有片段 token 總數 == 原譯文 token 總數（扣掉歸敬偈）
- [ ] 覆蓋率：幾個 unit 有對應、哪些沒有（本專案 214/215，缺的是真言）
- [ ] 抽段看：1、7、8、9、14、26、32 分（有偈頌、有五眼、有重複句式）
- [ ] 前端：桌面 + 480px 截圖；`vcpp.html` 打得開

## 10. 檔案與指令

```text
conze.pdf ──conze-extract.py──▶ conze-raw.txt ──conze-blocks.py──▶ conze-blocks.json
                                                  │
zhu-data.js ──dump-pdf-u.mjs──▶ build/_pdf-u.json ┴─conze-align.py─▶ conze-en.json
                                             conze-ranges.json ─┘   （+ _conze-review.tsv）
                                             conze-cuts.json ───┘
```

```powershell
python build/conze-extract.py conze.pdf conze-raw.txt
python build/conze-blocks.py
node   build/dump-pdf-u.mjs
python build/conze-align.py        # 會印 words x / y，兩數要相等
python build/conze-check.py        # 檢查人工切點
bun run build/build-data.ts
node build-vcpp.mjs
```

| 檔案 | 作用 |
|---|---|
| `build/conze_lib.py` | 讀 block、4-gram 錨點、段落→unit 範圍 |
| `build/conze-align.py` | 段內 DP ＋套用人工切點 ＋輸出 |
| `build/conze-ranges.json` | 段落的起點 unit（人工校訂） |
| `build/conze-cuts.json` | 段內的人工切點（人工校訂） |
| `build/_conze-review.tsv` | 逐句對照表（block／page／u／羅什／Conze） |
| `build/conze-range.py` `conze-starts.py` | 印校對表（段落範圍／起點） |

## 一句話

**粗切靠共同底本的錨點，細分靠「切點成本 + 位置 + 詞彙」的單調 DP，
錯的地方用手工清單補，最後用「詞數守恆」收尾。**
