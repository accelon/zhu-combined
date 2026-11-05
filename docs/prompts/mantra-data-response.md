# 回覆：mantra-data-feedback

> 2026-11-05。作者已說 **approx 可以**；以下是對 `<docs/prompts/mantra-data-feedback.md>` 的處理。

## 0. 結論

- **approx 保留**，不改成 1:1；已在契約加入 `relation: "approx"`，閱讀器顯示 `≈ 近似`，不標「待補」。
- 原型 app 已上孵化區「釋家」：<https://shutonggui.cn/incubator/surangama-mantra.html>。
- 資料版本：`build/rev/2026-11-05-t/`。

## 2.1 `u` 全是 2587

**選「接受現狀」**，不在這版做 unit 級 offset。原因：`zhu-data.js` 的咒語仍是一整句 `u=2587`，
要拆 `u` 是另一個工程；目前先讓「咒」按鈕開第一會 `M1.01`，並在 `coverage.note` 與 app 頁尾寫明：

> 經文中的楞嚴咒是整段一句，只能定位到該句；咒語頁內以 unit 閱讀。

如果之後把咒語重新分句成獨立 `u`，再回來加 `focusChar`。

## 2.2 `relation: "approx"` 722 筆

**保留 `approx`**。契約已加第五個值：

```text
"1:1" | "1:n" | "n:1" | "gap" | "approx"
```

- `approx` = unit 級近似，不是逐詞對齊。
- 閱讀器顯示 `≈` 與 tooltip，不當 1:1。
- 作者已接受，不列待辦。

## 2.3 `translit`／`meaning` 大量空

**這是 approx 的已知狀態，不是 bug。** M1 exact 的詞多半有音譯／詞義；M2–M5 的 131 個 approx
只保證梵詞、lemma、詞義（有詞典的 lemma）與 unit 中文行；逐詞音譯沒有硬填。
UI 顯示 `—` 是正確的，不要猜。

## 2.4 `n:1` 的「＋」

**這版不拆 `translit_parts`。** UI 用 `relation=n:1` 的標記與 tooltip 即可；
資料端不再用長度猜。若之後要「蘇盧多＋波那喃」的視覺，再加 `translit_parts`。

## 2.5 `freq`

**已修**：`word.freq` 現在等於該 lemma 的 `lexicon.freq`（例 `nam` 26、`sarva` 35、`bhagavat` 15）。
少數 lemma 真的 0（如 `bodhi` 不在 lemma 表），才顯示 `—`。

## 2.6 `links` 422

**這版 UI 不需要用 `links`。** 它保留給「S2587 句內細分」的未來索引；
目前 `MT_BY_U` 只從 `units` 建。422 條全部 `u=2587`，不要拿來建 `MT_BY_U`（會一個 u 對 422 條）。

## 2.7 `track_id` / `rut_id`

**先維持 `track_id`。** 新程式可讀 `rut_id || track_id`；改名會在下一版一次做，
不會偷偷改欄位。

## 原型 app

- 本機：`build/surangama-mantra.html`
- 線上：<https://shutonggui.cn/incubator/surangama-mantra.html>（鏡像 <https://nissaya.cn/incubator/surangama-mantra.html>）
- 五會 143 unit；M1 11 exact、131 approx、1 gap。
- 有高頻詞、搜尋、手機卡片；頁首標 `PROTOTYPE`，頁尾寫明 approx。

## 要 reader 配合的

- `relation` 加 `approx` 的 `≈` 標記（已寫進 `mantra-tab.md`）。
- `coverage` 用 `exact_units`／`approx_units`／`gap_units`，不要只看 `units`。
- `MT_BY_U` 從 `units[].u` 建；因為全部 `u=2587`，要存陣列，不是單一 unit。
