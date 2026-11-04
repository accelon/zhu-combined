# 部署 vcpp.html

`D:\2026\zhu-combined` 是獨立專案；資料管線、建置、部署都在這個目錄，不寫入
`adb-converter`。

## 目標

| 站 | URL | 遠端目錄 |
|---|---|---|
| 主站 | <https://shutonggui.cn/incubator/vcpp.html> | `/var/www/html/incubator` |
| 鏡像 | <https://nissaya.cn/incubator/vcpp.html> | `/var/www/html/incubator` |
| 孵化區列表 | <https://shutonggui.cn/incubator/> | `/var/www/html/incubator` |

> ⚠️ **`/huixintang/` 是官網工作區的目錄，不要往那裡寫**（2026-11-04 誤覆蓋過它的
> `index.html`）。本專案的檔案一律放 `/incubator/`，而且**不上傳 `index.html`**。

2026-11-04 起目錄裡是這樣：

| 遠端檔（`/incubator/` 下） | 是什麼 |
|---|---|
| `vcpp.html` | **科判版**（正式入口） |
| `vcpp-nokepan.html` | 舊的「無科判」版 |
| `shuzheng-u38.md` | 第 38 句的書證長文 |
| `vcpp.html.gz` | 預先用 gzip -9 壓好的同一份（2,237,829 bytes），給「直接送 .gz」的設定用 |

孵化區是**共用目錄**：只換上面三個檔，不動 `index.html`、`projects.json`（那是官網工作區的）、
也不留 `.prev` 備份；清理暫存只清 `.tmp-vcpp*`、`.tmp-shuzheng*`。

孵化區那張卡片的內容來自 `/incubator/projects.json`（本 repo 的 `deploy/incubator.json` 是同一份），
用 `node deploy-incubator.mjs` 同步兩站；規則見 `D:\nissaya.cn\html\incubator\discipline.md`。

`/var/www/html/huixintang` 是**共用目錄**，裡面還有 `glyph-browser.html`、`pinxing.html`
等別人的檔案；部署只覆蓋 `vcpp.html`、`index.html`、`shuzheng-u38.md` 與其 `.prev`，
不要清空整個目錄。

## 建置：單檔（預設全部全文）

```powershell
cd D:\2026\zhu-combined
node build-vcpp.mjs                     # 預設：收全部全文，約 2.7MB
node build-vcpp.mjs --limit 40000       # 輕量版，約 1.6MB（去掉 11 部大部頭）
node build-vcpp.mjs --max 16            # 放寬單檔大小上限（MiB，預設 8）
```

產出 `vcpp.html`（2026-10-31 10:55 實測：全部全文 **2,988,053 bytes／2.85 MiB**（含操作導覽）；
輕量版 1,670,694 bytes／1.59 MiB）。

- 若改了操作導覽（`tours/*.tour`、`src/tour/`），先跑 `bun run build-tour.mjs`（更新 `src/tour/tour-data.ts` 與 `tour.js`，單檔會內嵌）；發版前可用 `bun run build-tour.mjs --check` 確認沒有漏打包。
- CSS、`app.js`、`zhu-data.js` 全部內嵌；資料以 gzip 壓縮、base64 存放，開啟時用
  `DecompressionStream('gzip')` 解回 `window.ZHU`，再啟動 app。
- 大小上限由 `--max` 決定（預設 8 MiB），超過才以非 0 結束；舊版硬性 2 MiB 已取消。
- 預設不再刪大部頭：`works[].text` 全部收錄，卡片可以真正「展開」全文。
  要回到舊的輕量行為：`--limit 40000`，會去掉 11 部
  `T1700, X464, X468, X471, X475, X487, X489, X491, X504, X505, X509`。
- 完整資料仍保留在本機 `zhu-data.js`（`index.html` 開發版用），部署只上傳單檔。

## 部署

```powershell
cd D:\2026\zhu-combined
node deploy.mjs --check   # 只看兩站目錄與權限
node deploy.mjs           # 上傳、切換、HTTP 驗證
node deploy.mjs --primary-only
node deploy.mjs --mirror-only
```

- 連線憑證在 `.local/server.env`（`HOST/PORT/USER/PASS/DOCROOT`，另有 `MIRROR_HOST`）
  與 `.local/hostkey.txt`、`.local/hostkey-nissaya.cn.txt`；`.local/` 不進版控，
  帳密不會被印出。
- docroot 預設由 `server.env` 的 `DOCROOT` 推得：
  `/var/www/html/accelon26` → `/var/www/html/huixintang`。
  可用 `--docroot`、`--mirror-docroot` 覆寫。
- 上傳流程：先傳 `DOCROOT/.tmp-<name>`，再遠端 `mv` 成正式檔；既有檔先備份成
  `<name>.prev`。最後刪掉舊的 `app.js`、`style.css`、`zhu-data.js`（以及它們的
  `.prev`），因為輕量版已不需要外檔。
- 每次部署都會順便產生並上傳 `vcpp.html.gz`（`deploy.mjs` 裡現壓，level 9）。
  目前伺服器 `mod_deflate` 已開（3,063,854 → 2,248,876，−26.6%），`.gz` 只是備用；
  要真的改送 `.gz`，見下一節。
- 孵化區清單另外傳：`node deploy-incubator.mjs`（先跑 `incubator/check.mjs` 驗格式，
  再上傳 `/var/www/html/incubator/projects.json`，同樣走 `.tmp` → `.prev` → `mv -f`）。
  它**只換這一個檔**，不動 `incubator/index.html`、其他項目與首頁。
- 使用的工具：`C:\Program Files\PuTTY\pscp.exe`、`plink.exe`，以 `-hostkey` 鎖定指紋。

## 驗證

`deploy.mjs` 會從公開 HTTPS 抓回並檢查：

- `vcpp.html`：HTTP 200、含 `金剛經合注`、`zhu-b64`、`__startApp`，且 **≤ `--max`**（預設 8 MiB）。
- `index.html`：HTTP 200、含 `zhu-b64`。
- `shuzheng-u38.md`：HTTP 200、大小 > 1000 bytes。

2026-10-29 21:40 實測兩站（全量版；含「主文鎖羅什＋手機先梵文再面板」改版、死碼清理）：

```text
https://shutonggui.cn/huixintang/vcpp.html  200  2944383 bytes
https://nissaya.cn/huixintang/vcpp.html     200  2944383 bytes
```

兩站皆 2,988,053 bytes（全量版，含操作導覽）；`deploy.mjs` 的 8MB 上限足以容納。

## 回滾

遠端保留 `<name>.prev`：

```bash
ssh yap@shutonggui.cn
cd /var/www/html/huixintang
mv -f vcpp.html.prev vcpp.html
mv -f index.html.prev index.html
```

## 與 adb-converter 的關係

- 本目錄的資料管線 `build/build-data.ts` 只**讀** `D:\2026\adb-converter\build` 的語料
  （`tei-all.txt`、`wxzj-tei-2026R2.txt`、`ys-text-full.txt`、`jingqun/*.tsv`），
  不寫入；可用 `ZHU_CORPUS` 指向別處。
- `vcpp.html` 的建置與部署完全在 `D:\2026\zhu-combined`，不需要 adb-converter 的程式。


## 傳輸壓縮（2026-11-04 起）

主站與鏡像都已開 gzip（伺服器端 curl 實測）。`deploy.mjs` 每次部署完會多印一行「傳輸實測」，
直接看線上送的是不是壓縮過的：

| 站 | 做法 | 實際傳輸 |
|---|---|---|
| shutonggui.cn（Apache） | `mod_deflate` 現壓（`conf-enabled/deflate-zhu.conf`） | 2,248,876 bytes（chunked，無 Content-Length） |
| nissaya.cn（nginx） | `gzip_static on` 直接送 `vcpp.html.gz` | **2,237,829 bytes**（= .gz 大小，ETag `…-222585`） |
| 原檔 | — | 3,063,854 bytes |

差 11 KB 是 Apache 用 zlib 預設等級、我們預壓用 level 9 的差別。nginx 那條**完全不花 CPU**；
Apache 若也想要零 CPU，把 `vcpp.html.gz` 接上 rewrite（見文末）即可。

**在 Windows 上用 `Invoke-WebRequest` 看不到 gzip**：它會自動解壓並把 `Content-Encoding`
拿掉，`RawContentLength` 回報的是解壓後大小。要驗證請在伺服器上跑：

```bash
curl -skI -H "Accept-Encoding: gzip" https://shutonggui.cn/incubator/vcpp.html | grep -iE 'content-encoding|vary'
curl -sk -o /dev/null -w '%{size_download}
' -H "Accept-Encoding: gzip" https://shutonggui.cn/incubator/vcpp.html
```

想把 `vcpp.html.gz` 直接送（省下每次現壓的 CPU）時，加這段並重載 Apache：

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTP:Accept-Encoding} gzip
  RewriteCond %{REQUEST_FILENAME}.gz -s
  RewriteRule ^(.+.html)$ $1.gz [L]
  <FilesMatch "\.html\.gz$">
    ForceType text/html
    Header set Content-Encoding gzip
    Header append Vary Accept-Encoding
    SetEnv no-gzip 1          # 關鍵：不然 mod_deflate 會再壓一次
  </FilesMatch>
</IfModule>
```
