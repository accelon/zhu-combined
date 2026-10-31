# zhu-combined · 金剛經合注

一個純靜態的《金剛經》對讀站：**羅什主文**（昭明三十二分）＋ **41 家注疏** ＋ **梵藏逐詞** ＋ **11 種別譯**。
直接開 `index.html` 就能用（不需要伺服器）。

- 線上：<https://shutonggui.cn/huixintang/>（鏡像 <https://nissaya.cn/huixintang/>）
- 原始碼：<https://github.com/accelon/zhu-combined>

## 功能

- **十一譯對讀**：主文固定羅什（T235）；其他譯本——留支（T236a）、真諦（T237）、笈多（T238）、玄奘（T220(9)）、義淨（T239）、Conze 英譯（1958）、中台、成觀、Muller、今譯——都在面板「別譯」分頁對讀，逐句以 `u` 對齊昭明太子三十二分。
- **一次一分**：中欄只顯示目前這一分（昭明 32 分）；搜尋框旁有下拉可直選 32 分，上方也有「上一分／下一分」。
- **點句看注**：點任一經句，桌面上右欄立刻回到頂端，列出該句注疏（依年代排序）；**再點同一句就收起**（梵文對照收起來、右欄復原）。卡片有書名、作者、年代、出處與頁碼，預設收成一列。
- **梵藏對照**：每句若有《金剛經梵文注解》（2013，人民大學國際佛學研究中心·瀋陽北塔翻譯組）的對應條目，只顯示梵文與藏譯（漢譯見「其他譯本」）。一條梵文若跨兩句，只掛在重疊最多的那一句，不會兩邊重複出現。梵文以「分詞」呈現（依逐詞注的詞形），下方附一行連聲原文；梵、藏詞都可滑過（或點）：藏文以「་／།」斷詞，容忍拼寫差異（如 ཕྱི་བ／ཕྱེ་བ，取最長可匹配前綴）；滑過藏文也會反亮梵文與漢譯。名詞／代詞、形容詞、動詞／分詞、其他各有顏色；滑過即時標出藏文對應詞與漢譯中的對應字，並顯示詞原形（括號）、詞性、漢譯、英譯。梵文詞有編號，另附「逐詞編號」清單（詞形、原形、詞性、詞典義、各譯對應）；推測的漢譯對應用 ° 標記，例如 hetoḥ → 奘／淨「故」、什「所以者何」。各譯本對同一個詞的固定譯語會一併比對（笈多逐詞直譯，正好拿來校正：命者＝具壽、善實＝須菩提、眾生＝有情），同一字出現多次時取最靠近該詞位置的那一次（例如「生實信」的「生」不會誤連「眾生」）。滑過時另有一個跟著詞跑的小卡，梵文在畫面下方也看得到。
- **右欄三分頁**：面板沒有標題列，最上面就是 `注疏｜別譯｜詞組`（sticky）。`注疏`＝一排作者名按鈕（inline，只有人名，依年代排），點誰就展開誰的全文（可同時開 1–3 家；展開後才顯示完整注疏名與出處）。`別譯`＝一排譯者名按鈕（11 種），新挑的排最前面、可同時看 1–3 種；羅什標「主」。`詞組`＝當前句子逐詞列出，並標出該詞在別處的出現位置；點「另見」就地展開那一句（點同一筆收起、點另一筆直接換過去）的梵文（查的詞標紅；連寫的 sandhi 詞如 trisāhasramahāsāhasraṃ 也會標出 trisāhasra 那一段）與羅什譯文。
- **手機／平板（≤1060px）：先梵文，再面板**：點一句只把梵藏展開在句下（會補最小的捲動量把它們帶進畫面），句下多一排 `注疏 N 家 ›｜別譯｜詞組`；按了才開覆蓋式面板，所以梵文不會再被面板蓋掉。面板的 ✕ 或背景只收面板，句下梵文留著；再點同一句才整個收起。梵文詞可用手指點出詞性小卡（`?word=` 深連結在手機上也有效）。標題列在手機上也 sticky（`overflow-x: clip` 而非 `hidden`，否則 sticky 會失效），「分」下拉與搜尋滑到哪都在。
- **操作導覽 🦮**：標題列最右邊（☾ 旁邊）的狗就是導覽入口，9 個場景一分鐘走完：讀一分、點一句看梵藏、面板三分頁、搜尋。每個場景做完會**停住**等你看，可「上一場景／重播」；進度記在 `localStorage`，再按 🦮 會從上次停的地方續走。第一次進入時標題列下方會有一行提示（按 ✕ 或開始導覽後不再出現；20 秒或一捲動就自己收起）。劇本在 `tours/*.tour`，改完跑 `bun run build-tour.mjs`。
- **兩欄**：中經文｜右注疏（≥1060px 為並排兩欄，右欄預設 440px、可拖寬）。右欄常駐，點句即更新。右欄不自己捲（三個分頁都一樣），整頁只有一條捲軸；分頁列 sticky 在標題列下。≤1060px 時右欄改成覆蓋式面板（寬 `min(560px, 92%)`，手機全寬），由句下那排按鈕叫出。
- **欄寬可拖**：兩條分隔線可左右拖曳，雙擊還原；寬度記在 localStorage。
- **快速開關**：`Ctrl+Alt+B` 開關注疏欄（Mac 用 ⌘，原本標題列的 ☷ 按鈕已移除）。
- **明暗切換**：右上角 ☾／☀；跟隨系統 `prefers-color-scheme`，選擇存在 localStorage。也可用 `?theme=dark`／`?theme=light`。
- **科判不收**：科判（X466、X491）不是注疏，不列入面板；江味農分科亦不採用。

## 直接連結

```text
index.html?theme=dark          # 暗底
index.html?notes=off           # 收起注疏
index.html#u=38                # 第 38 句
index.html?word=3#u=38         # 第 38 句並點第 4 個梵文詞
index.html?tab=alt#u=38       # 別譯頁（11 種譯本，羅什標「主」）
index.html?tab=phrase#u=38    # 詞組頁；點「另見 →」就地展開該句梵文＋羅什
index.html?q=Heap%20of%20merit # 搜尋（命中英譯／別譯時，面板直接開在「別譯」那一譯）
index.html?q=一切賢聖皆以無為法  # 搜尋
```

搜尋英文（如 `?q=Heap of merit`）會自動在英譯裡找；中文只比對漢字，英文只比對拉丁字母。

## 研究：一切賢聖皆以無為法而有差別

第 7 分第 5 句（`#u=38`）的面板有「書證彙編」連結，連到
第 7 分第 5 句（`#u=38`）的面板有「書證彙編」連結，連到 [`shuzheng-u38.md`](shuzheng-u38.md)：

- 六譯對照、梵文／藏譯、逐詞注與解
- 原筆記已收的古註
- MVP 檢出的 35 家注疏（★ 標原筆記未收的 30 家）
- 這一句的書證線索（書名／人物）
- 初步觀察（`prabhāvitā` 的譯法、賢聖／聖者、三系解釋）

## Conze 英譯

來源：[Edward Conze, *The Diamond Sutra in Sanskrit and English*]
(https://www.buddhistische-gesellschaft-berlin.de/downloads/diamantsutraconze.pdf)
（Buddhist Wisdom Books, London 1958；本檔 21 頁，梵英對照）。

這個 PDF 本身是「一段梵文、一段英文」交替排的，所以對齊分兩步：

1. **粗切（依梵語）**：把 56 個梵文段落用 4-gram 錨點＋LIS 對到
   `pdf-entries.json` 的梵文句子（每條就是一個 unit），得到每段的 unit 範圍；
   `build/conze-ranges.json` 是人工校訂過的段落起點。
2. **細分（對齊我們的句子）**：段內把英文切成連續片段——切點優先落在句末，
   其次子句逗號，用「翻譯長度比例（以梵文長度為權重）＋逐詞注英譯的詞彙重疊」
   做單調 DP，保證全文不重不漏；`build/conze-cuts.json` 收了幾處人工指定的切點。

完整做法（含坑與參數）另寫成 [`alignment-skill.md`](alignment-skill.md)，
換一個譯本時照著做即可。

結果：215 個 unit 有 214 個拿到英文（`u=214` 的真言羅什本無，Conze 也沒有）。
片段可能從句子中間開始（例如 u2 只拿到 "When he had eaten and returned from his round,"），
因為羅什與 Conze 的分句本來就不同；把一分的片段接起來就是 Conze 的完整譯文。
PDF 裡的 `[...]` 是 Conze 標記的後人增補，原樣保留。

檔案：

| 檔案 | 用途 |
|---|---|
| `vendor/pdf/conze.pdf` / `conze-raw.txt` | 原始 PDF（不進版控）與文字層 |
| `conze-blocks.json` | 切好的梵／英段落（各 57 段） |
| `conze-en.json` | 對到 unit 的英文片段（build-data.ts 讀這個） |
| `build/conze-extract.py` `conze-blocks.py` `conze-align.py` | 上面三步的腳本 |
| `build/conze_lib.py` | 錨點與段落→unit 範圍的共用邏輯 |
| `build/_conze-review.tsv` | 逐句對照表（`conze-align.py` 重跑時產生，不進版控），校對用 |

## 資料來源

| 類別 | 來源 |
|---|---|
| 六譯經文 | 大正藏 T235、T236a、T237、T238、T220(9)、T239 |
| 今譯 | 顯密文庫「金剛般若波羅蜜經·現代文」（只取【譯語】，【注釋】不採） |
| 英譯 | Edward Conze, *Buddhist Wisdom Books*（1958）；中台山英譯（Chung Tai Translation Committee, 2009）；成觀法師英譯（The Diamond Sutra, 修訂第三版 2010）；A. Charles Muller 英譯（2013, acmuller.net） |
| 注疏 41 家 | 大正藏 7 家、卍續藏 32 家、印順《般若經講記》、慈舟《中道了義疏》（顯密文庫） |
| 梵藏注解 | 《金剛經梵文注解》PDF（255 頁，237 條） |
| 分句 | `ylz-prjn.offtext/vcpp_*.off` 只提供句界；文本與頁碼用 taisho／wxzj／yinshun |

今譯與 Muller 都是按昭明三十二分排列，所以直接以「分」為錨：一分之內的句子，
依句末／逗號切點與句長比例單調分配到該分的 unit（`build/align-sections.py`）。

## 逐詞義校訂

`gloss-overrides.tsv`（surface／zh／note，Tab 分隔）可覆寫個別梵文詞的漢譯；重建後生效，原詞義會以「原：…」保留在逐詞編號裡。目前收了 `Jetavane → 勝林（中．依格）`、`ārāme → 園`、`'nāthapiṇḍadasya → 給孤獨；無親摶施與`、`asaṃskṛta → 無為法`、`prabhāvitā → 所顯`、`asaṃskṛta-prabhāvitā → 無為法所顯`。含連字號的複合詞會自動拆成部件（如 asaṃskṛta ＋ prabhāvitā），在逐詞清單與滑過資訊中顯示「拆：…」。

## 手機版面

- 寬度 ≤1060px 時右欄改成覆蓋式面板；點一句只在句下展開梵藏（桌面上右欄照舊常駐）。
- 句下那排 `注疏 N 家 ›｜別譯｜詞組` 才開面板；✕ 或點背景只收面板，句下梵文留著，再點同一句才全收。
- 標題列 sticky；梵文／藏文詞用 **tap** 代替 hover → 就地跳出詞性小卡。
- 一次只顯示一分；分下拉在搜尋框旁。

## 重建

```powershell
# 全部在 D:\2026\zhu-combined 執行
# 1. PDF 文字層 → pdf-entries.json（已附，可重跑）
python parse_pdf.py

# 2. 六譯＋注疏＋梵藏 → zhu-data.js
#    語料預設讀 D:\2026\adb-converter\build（只讀）；可用 $env:ZHU_CORPUS 改
bun run build/build-data.ts

# 2b.（可選）重跑 Conze 英譯對齊 → conze-en.json
python build/conze-extract.py vendor/pdf/conze.pdf conze-raw.txt
python build/conze-blocks.py            # → conze-blocks.json
node build/dump-pdf-u.mjs               # → build/_pdf-u.json（給下一步讀）
python build/conze-align.py             # → conze-en.json、build/_conze-review.tsv
#   要改段落起點：build/conze-ranges.json；要改段內切點：build/conze-cuts.json
#   檢查切點：python build/conze-check.py

# 2c. 今譯（顯密文庫）／中台、成觀、Muller 英譯 → jinyi.json、ctzen.json、chengguan.json、muller.json
python build/fetch_jinyi.py             # → src/jinyi-raw.json（33 頁 markdown）
python build/extract_english.py         # → src/muller.txt、src/chengguan-raw.txt
python build/parse_chengguan.py         # 成觀 PDF 依左／右半頁重排 → src/chengguan-cols.json
python build/align-sections.py          # 按「分」對到 unit → jinyi.json、muller.json、ctzen.json、chengguan.json

# 2d. 慈舟《中道了義疏》→ src/cizhou-body.txt（build-data 當一部注疏讀）
python build/make_cizhou.py

# 3. 產生書證彙編 → shuzheng-u38.md
bun run build/research.ts

# 3b. 操作導覽（改了 tours/*.tour 才需要；單檔會內嵌 tour.js）
bun run build-tour.mjs

# 4. 單檔（全部全文；上限 8MB，可 --max 放寬）→ vcpp.html
node build-vcpp.mjs            # 約 2.7MB，收全部全文
node build-vcpp.mjs --limit 40000   # 輕量版，約 1.6MB
```

## 操作導覽（🦮）

標題列最右邊的 **🦮**（`#tourEntry`，`aria-label="操作導覽"`，跟 ☾ 同尺寸）就是入口。
第一次進入時標題列下方會有一行提示，按 ✕ 或開始導覽後不再出現（也記在 `zhu.tour.hint`）。

- **劇本**：`tours/welcome.tour` — 9 個場景，每個場景一個觀念，用 `停` 等你看完；
  資料用 `等頁面` 等，不用固定秒數。桌面上「面板從這裡打開」那一幕用 `若非 !api:overlay` 跳過。
- **引擎**：`self-explaining-tour`（vendored 在 `src/tour/`，來源見 `src/tour/VENDOR.md`）；
  `src/tour/app.ts` 是轉接層，只透過 `window.ZHU_APP` 操作 App（`pickSentence`／`openPanel`／`state`…）。
- **手機優先**：氣泡貼邊、按鈕 40px 高；指向元件都選在覆蓋式面板裡也看得到的（`#tabs2`、`.note-bar`、`.actbar`…）。
- **狀態**：進度 `zhu.tour.welcome`（續走用）、已看過 `zhu.tour.seen`、提示已關 `zhu.tour.hint`。

改劇本後（兩步，缺一步就是「改了沒反應」）：

```powershell
bun run build-tour.mjs            # tours/*.tour → src/tour/tour-data.ts，再打包 → tour.js
bun run build-tour.mjs --check    # 發版前：tour-data 與 tour.js 是否都是最新的

# 自動走完整場（手機視窗），印出每一幕的 spotlight 與 failed
node build/cdp-tour.mjs "file:///D:/2026/zhu-combined/index.html" 390 844 out-tour
```

劇本要用的新動作，要同時加在 `src/tour/app.ts` 的 `call()` 與 `tour.config.ts` 的 `callNames`／`apiKeys`，
否則編譯器會擋下來（這正是它存在的理由）。
## 專案結構

```text
index.html app.js style.css     前端（純靜態，file:// 可直接開，不需要伺服器）
zhu-data.js                     經文＋注疏資料（約 6.8MB，build/build-data.ts 生成）
pdf-entries.json                梵藏逐詞條目（parse_pdf.py 從 PDF 抽出）
conze-en.json conze-blocks.json  Conze 英譯對齊結果
muller.json ctzen.json chengguan.json jinyi.json   各別譯本抽出的資料
gloss-overrides.tsv             逐詞漢譯校訂（手工）
tours/*.tour                    操作導覽的劇本（DSL，改這個）
src/tour/                       操作導覽模組（vendored self-explaining-tour）＋ app.ts 轉接層
build-tour.mjs                  編譯劇本 → src/tour/tour-data.ts，再打包 → tour.js
tour.js                         導覽執行檔（打包產物，commit 進版控；單檔版會內嵌）
build/                          資料管線（Python／TypeScript／MJS）與開發工具
build-vcpp.mjs deploy.mjs       單檔建置、部署
alignment-skill.md              把新譯本對到句庫的做法
shuzheng-u38.md                 第 7 分第 5 句書證彙編（網站「書證 ↗」連到這份）
書證-影片來源.txt                 該句相關的影片來源
vendor/                         原始 PDF／docx（不進版控，見 vendor/README.md）
.local/                         部署憑證（不進版控）
```

## 版控

<https://github.com/accelon/zhu-combined>（授權見 `LICENSE`）

- **進版控**：前端程式、`build/` 的資料管線、抽出的資料（`*.json`、`gloss-overrides.tsv`）、文件。
- **不進版控**：`vendor/`（原始 PDF／docx）、`.local/`（部署憑證）、`vcpp.html`（建置產物）、
  `build/_pdf-u.json`、`build/_conze-review.tsv`（中間檔）、`screenshots/`、`__pycache__/`、`*.log`。
- 換機器：把 `vendor/pdf/`、`vendor/docx/` 的檔案補回去（來源見「資料來源」），資料檔已在版控內，
  通常不必重跑管線；要重跑就照下面「重建」。

## 部署

```powershell
node deploy.mjs --check   # 檢查兩站
node deploy.mjs            # 上傳＋驗證
```

單檔 `vcpp.html` 由 `node build-vcpp.mjs` 產生（預設收全部全文，約 2.7MB；
大小上限 8MB，用 `--max` 放寬、`--limit 40000` 回到輕量版）；
主站與鏡像、回滾、憑證位置見 [`deploy.md`](deploy.md)。`https://nissaya.cn` 頻寬約 100 KB/s，2.9MB 的 `vcpp.html` 首次載入約 30 秒（檔案本身與主站 byte-identical）。

## 資料格式

```text
window.ZHU = {
  sections: [{n, title}],
  versions: [{id, label, trans, sents: [{t, u, s, p}]}],
  pdf:      [{no, secTitle, sa, tib, shi, zang, jing, note, jie, u, us}],
  works:    [{id, title, author, date, year, corpus, no, vol, kind,
              text, pages, anchors: [[u, a, b, page], …]}]
}
```

## 已知限制

- 句下注用 8 字窗 LIS 對齊；「先引一大段、再整段註解」的作品，同段注文會掛給段內每一句。
- 梵文 PDF 的悉曇／天城體字型有亂碼，資料只用其拉丁轉寫（IAST）。
- 年代取朝代，未逐年考訂（作者按鈕依 `works[].year` 排序）。
- Conze 英譯是按比例切給羅什句的，不是逐句重譯的對齊：有幾處片段會從句子中間開始，
  少數句子（如「五眼」一段 Conze 把四問併成一句）只能按詞序分給相鄰幾句。
  逐句對照可看 `build/_conze-review.tsv`（`python build/conze-align.py` 重跑時產生）。
- 尚未接 CBETA 原文連結；頁碼已保留，可回查。


















- **進版控**：前端程式、`build/` 的資料管線、抽出的資料（`*.json`、`gloss-overrides.tsv`）、操作導覽（`tours/`、`src/tour/`、`tour.js`、`tour.config.ts`）、文件。
