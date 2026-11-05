# mubu-kepan — 幕布科判抓取

把 <https://mubu.com/explore/1eys4Vhta6b>（〈佛經科判資源列表〉，作者 **败空破有**）能抓的科判抓下來。

## 結論先講

| | 數量 | 說明 |
|---|---|---|
| 清單列出的科判 | 64 條 | mubu 分享連結（`mubu.com/doc/…`） |
| 其中**還活著**的 | **0 條** | 全部已刪除 |
| 從 explore／社群另外抓到的 | **28 份**（15,481 節點） | 見 [`index.md`](index.md) |
| 兩份「目錄」文件 | 276 + 264 節點 | 見 `catalogs/` |

清單裡那 64 條，逐一呼叫 `POST /v3/api/document/view/get` 全部回 `code 16`（文件不存在）；換 `share.mubu.com` 網址、去掉結尾的 `r`、用真實瀏覽器開 `/doc/` 頁面，結果都一樣（瀏覽器顯示「此文檔鏈接已失效」）。舊網域 `www.mubucm.com` 現在根本打不開。所以**清單本身抓得到，清單指向的科判抓不到**——原檔確定已被作者刪除或關閉分享。

能抓的是**公開在幕布「精選」與「社群」的文件**：這些匿名可讀，API 直接回傳整棵大綱（`definition` JSON），不必登入、不必開瀏覽器。

## 檔案

```text
mubu-kepan/
  crawl.mjs            抓取器（唯一的手寫檔；其餘都可重跑產生）
  README.md            本檔
  index.md             成果索引：28 份科判一覽 + 64 條失效連結逐條對照
  data.json            精簡 metadata（標題／作者／節點數／原連結／鏡像）
  kepan-trees.json     28 份科判的純結構樹 {t, h?, note?, k?}（給下游程式用）
  docs/NN-標題.md       每份科判的縮排大綱（Markdown）
  catalogs/            兩份目錄文件的 Markdown 全文
  raw/                 每份文件的原始 mubu definition JSON（含節點 id、顏色、筆記）
```

`docs/` 的 Markdown 保留幕布原本的層級：縮排 = 子節點，`**粗體**`、`<u>底線</u>`、`[連結]()` 都照原樣轉；`## ` 是幕布的「標題」節點，`- [ ]` 是勾選項，`>` 是節點備註。

## 抓到的 28 份（依節點數）

多為藏傳五大論的科判（《入行論》《中論》《俱舍論》《現觀》《親友書》…），另有金剛經三家、解深密經、四分律、妙法蓮華經玄贊等。全部清單見 [`index.md`](index.md)。

值得注意的是：

- **金剛經科判**（187 節）與**金剛經講義科判**（348 節，帶天干甲乙丙層級）——正好是 `zhu-combined` 現有經群缺的層。
- **解深密經四品科判**（趙國森，274 節）。
- **四分律科判**（165 節）。
- **大圓滿前行**兩家（子茗 264 節、圆本 246 節），各是一套。

## 重跑

```powershell
node mubu-kepan/crawl.mjs
```

會重抓目錄、重查 64 條失效連結、重跑 explore 搜尋與作者反查，覆寫 `docs/`、`raw/`、`catalogs/`、`index.md`、`data.json`、`kepan-trees.json`。約 2 分鐘（每次請求間隔 200–250ms，避免被擋）。

## API 備忘（匿名可讀的部分）

```text
POST https://api2.mubu.com/v3/api/explore/get                  {"exploreDocId":"…"}   → 精選文件（含 definition）
POST https://api2.mubu.com/v3/api/document/view/get            {"docId":"…"}          → 文件本體（含 definition）
POST https://api2.mubu.com/v3/api/explore/search               {"keyword":"科判","start":0,"count":20}
POST https://api2.mubu.com/v3/api/community/get_user_community_document {"userId":…,"start":0,"count":200}
```

- 一定要帶這幾顆 header，缺了會回 `{"code":17,"msg":"illegal request"}`：
  `Jwt-Token`（匿名給空字串）、`data-unique-id`、`x-request-id`、`x-reg-entrance`、`x-session-id`（都給 UUID 即可）、`Origin: https://mubu.com`、`Referer`。
- `code 16` = 文件不存在／已刪；`code 5201` = 不是精選文件；`code 2` = 需要登入（`document/get`、`explore/get_explore_by_doc_id` 這類）。
- 匿名拿不到 `/doc/` 的私有分享、也拿不到 `share/get`（永遠回空物件 `{}`）。

## 限制

1. **只有大綱，沒有經文對位。** 幕布節點是「科判文字」，沒有「這句科文從經文第幾個字開始」的資訊。要接進 `zhu-combined` 的科判層（`window.KEPAN` 的 `nodes[].u / off`），得先有對應的經文資料，再跑 `build/kepan/lib.mjs` 的字窗對齊——那是另一件事，這批檔案只提供素材。
2. **沒有層級標號的統一（甲乙丙 vs 一、二、三）。** 各家科判的標號寫在文字裡，格式不一，直接照抄。
3. **`catalogs/` 的連結九成也是死的**（那是 2020 年的目錄），但**標題本身有用**：181 個 mubu 連結、67 處提到「科判」，可當成「還有哪些經論該去找科判」的清單。

## 相關

- [`../kepan-refs`](../kepan-refs) — 從 Dynalist 抓回來的〈科判研究〉：科判的定義、術語、編號體系、科·文對照形式、錄入流程，以及一份「去哪裡找科判文本」的資源清單（上海佛學書局《佛經科判選編》19 種、CBETA 科判、kepan.org 等）。
