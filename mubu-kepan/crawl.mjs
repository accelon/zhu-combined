#!/usr/bin/env node
// 幕布（mubu.com）科判抓取器
//
//   node mubu-kepan/crawl.mjs
//
// 做三件事：
//   1. 抓「佛經科判資源列表」與「佛經整理目錄」兩份目錄（含清單裡每一條的存活檢查）
//   2. 用 explore 搜尋 + 作者反查，找出所有公開可讀的科判文件
//   3. 把每份科判存成 docs/<n>-<title>.md（縮排大綱）＋ raw/<id>.json（原始 definition）
//
// 匿名可讀的只有 explore 精選與社群公開文件；清單裡的 mubu.com/doc/xxx 舊分享連結
// 大多已刪（API 回 code 16），腳本會逐條檢查並列進 index.md 的「已失效」表。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(ROOT, "docs");
const RAW = path.join(ROOT, "raw");
fs.mkdirSync(DOCS, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers(ref) {
  const g = () => crypto.randomUUID();
  return {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    Origin: "https://mubu.com",
    Referer: ref,
    "Jwt-Token": "",
    "data-unique-id": g(),
    "x-request-id": g(),
    "x-reg-entrance": ref,
    "x-session-id": g(),
  };
}

async function post(apiPath, body, ref = "https://mubu.com/explore/1eys4Vhta6b") {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api2.mubu.com${apiPath}`, {
        method: "POST",
        headers: headers(ref),
        body: JSON.stringify(body),
      });
      const text = await res.text();
      return JSON.parse(text);
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(600);
    }
  }
}

// ---------------------------------------------------------------- HTML → text

const ENT = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const unent = (s) => s.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENT[m] ?? m);

/** 把幕布的富文本 HTML 轉成 Markdown 行內格式 */
function inline(html) {
  let s = String(html ?? "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // 連結
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) => `[${plain(body)}](${href})`);
  // 樣式（順序：先處理巢狀）
  s = s.replace(/<span[^>]*class="[^"]*\bbold\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (_, b) => `**${b.trim() ? b : ""}**`);
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, b) => `**${b}**`);
  s = s.replace(/<span[^>]*class="[^"]*\bunderline\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (_, b) => `<u>${b}</u>`);
  s = s.replace(/<span[^>]*class="[^"]*\bitalic\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (_, b) => `*${b}*`);
  s = s.replace(/<span[^>]*class="[^"]*\bstrikethrough\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (_, b) => `~~${b}~~`);
  s = s.replace(/<span[^>]*class="[^"]*\bcode\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (_, b) => `\`${b}\``);
  s = s.replace(/<[^>]+>/g, "");
  s = unent(s);
  // 收掉跨行時多餘的 **
  s = s.replace(/\*\*\s*\*\*/g, "").replace(/\*\*\n+\*\*/g, "\n");
  return s;
}

function plain(html) {
  return unent(String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
}

// ---------------------------------------------------------------- outline → md

function countNodes(nodes) {
  let n = 0;
  for (const x of nodes || []) n += 1 + countNodes(x.children);
  return n;
}

function maxDepth(nodes, d = 0) {
  let m = d;
  for (const x of nodes || []) if (x.children?.length) m = Math.max(m, maxDepth(x.children, d + 1));
  return m;
}

function toMarkdown(def) {
  const lines = [];
  const walk = (nodes, depth) => {
    for (const node of nodes) {
      let txt = inline(node.text).trim();
      const head = node.heading ? "#".repeat(Math.min(6, node.heading + 1)) + " " : "";
      if (head) { txt = txt.replace(/\*\*/g, ""); lines.push(`\n${head}${txt}`); }
      else lines.push(`${"  ".repeat(depth)}${node.finish ? "- [ ] " : "- "}${txt}`);
      if (node.note) {
        for (const l of inline(node.note).split("\n")) lines.push(`${"  ".repeat(depth + 1)}> ${l}`);
      }
      for (const img of node.images || []) {
        const src = img.src || img.url || "";
        if (src) lines.push(`${"  ".repeat(depth + 1)}![](${src})`);
      }
      if (node.children?.length) walk(node.children, depth + 1);
    }
  };
  walk(def.nodes || [], 0);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function safeName(s) {
  return String(s).replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80);
}

// ---------------------------------------------------------------- 抓文件

async function fetchExplore(id) {
  const r = await post("/v3/api/explore/get", { exploreDocId: id }, `https://mubu.com/explore/${id}`);
  if (r.code !== 0) return { code: r.code, msg: r.msg };
  const meta = r.data;
  return {
    code: 0,
    kind: "explore",
    id,
    title: meta.title,
    author: meta.userInfo?.userName || "",
    authorId: meta.userInfo?.userId || null,
    collect: meta.collectCount,
    view: meta.viewCount,
    srcDocId: meta.srcDocId,
    definition: meta.definition,
    url: `https://mubu.com/explore/${id}`,
  };
}

async function fetchDoc(id) {
  const r = await post("/v3/api/document/view/get", { docId: id }, `https://mubu.com/doc/${id}`);
  if (r.code !== 0) return { code: r.code, msg: r.msg };
  return {
    code: 0,
    kind: "doc",
    id,
    title: r.data.name,
    author: "",
    definition: r.data.definition,
    version: r.data.baseVersion,
    url: `https://mubu.com/doc/${id}`,
  };
}

// ---------------------------------------------------------------- 主流程

const CATALOGS = [
  { explore: "1eys4Vhta6b", label: "佛經科判資源列表" },
  { explore: "4Q57srEo6b", label: "佛經整理目錄--更新中" },
];

const KEYWORDS = [
  "科判", "科文", "科判-败空破有", "佛经科判", "金刚经科判", "大乘科判",
  "瑜伽师地论 科判", "中论 科判", "俱舍论 科判", "成唯识论 科判", "法华经 科判",
];

const BUD = /经|經|论|論|律|颂|頌|疏|钞|科判|科文|菩萨|菩薩|般若|唯识|唯識|中观|中觀|瑜伽|法华|華嚴|华严|楞严|楞伽|俱舍|大乘|如来|如來|菩提|前行|加行|道次第|四部|宗义|宗義|因明|量论|量論/;

async function main() {
  const log = (...a) => console.log(...a);

  // 1) 目錄
  const catalogDocs = [];
  for (const c of CATALOGS) {
    const e = await fetchExplore(c.explore);
    if (e.code !== 0) { log("目錄讀取失敗", c.label, e.code); continue; }
    const def = JSON.parse(e.definition);
    e.nodeCount = countNodes(def.nodes);
    e.label = c.label;
    catalogDocs.push(e);
    fs.writeFileSync(path.join(RAW, `explore-${e.id}.json`), JSON.stringify(e, null, 1), "utf8");
    log(`目錄 ${e.title}：${e.nodeCount} 個節點`);
    await sleep(250);
  }

  // 2) 清單裡的每一條：查存活
  const listDoc = catalogDocs.find((c) => c.label === "佛經科判資源列表") || catalogDocs[0];
  const listDef = JSON.parse(listDoc.definition);
  const entries = [];
  const walkList = (nodes, section) => {
    for (const n of nodes) {
      const text = plain(n.text).trim();
      const heading = n.heading || 0;
      const sec = heading && heading <= 3 && text ? text : section;
      const href = (String(n.text).match(/href="([^"]+)"/) || [])[1];
      if (href) entries.push({ section: sec, text, url: href, docId: (href.match(/\/doc\/([A-Za-z0-9_-]+)/) || [])[1] });
      if (n.children) walkList(n.children, sec);
    }
  };
  walkList(listDef.nodes, "");
  log(`清單條目：${entries.length}`);

  const missing = [];
  for (const e of entries) {
    if (!e.docId) continue;
    const d = await fetchDoc(e.docId);
    e.alive = d.code === 0;
    if (!e.alive) missing.push({ title: e.section || e.text, url: e.url, docId: e.docId, code: d.code });
    await sleep(200);
  }
  log(`清單存活：${entries.filter((e) => e.alive).length} / ${entries.filter((e) => e.docId).length}`);

  // 3) 搜尋科判文件
  const cand = new Map();
  const add = (o) => { if (o?.id && !cand.has(o.id)) cand.set(o.id, o); };
  for (const kw of KEYWORDS) {
    for (let start = 0; start < 100; start += 20) {
      const r = await post("/v3/api/explore/search", { keyword: kw, start, count: 20 });
      if (r.code !== 0) break;
      const rows = r.data?.rows || [];
      for (const row of rows) {
        if (!/科判|科文|科攝|科摄/.test(row.title || "")) continue;
        if (!BUD.test(row.title || "")) continue;
        add({ kind: "explore", id: row.exploreDocId, title: row.title, author: row.userInfo?.userName, authorId: row.userInfo?.userId });
      }
      if (rows.length < 20) break;
      await sleep(200);
    }
  }
  log(`科判候選（搜尋）：${cand.size}`);

  // 4) 作者反查：同一作者的其他科判
  const authors = new Map();
  for (const c of cand.values()) if (c.authorId) authors.set(c.authorId, c.author);
  for (const [uid, name] of authors) {
    const d = await post("/v3/api/community/get_user_community_document", { userId: uid, start: 0, count: 200 });
    for (const doc of d.data || []) {
      if (!/科判|科文|科攝|科摄/.test(doc.title || "")) continue;
      if (!BUD.test(doc.title || "")) continue;
      if (![...cand.values()].some((x) => x.id === doc.documentId)) {
        add({ kind: "doc", id: doc.documentId, title: doc.title, author: name, authorId: uid, collect: doc.collectCount, view: doc.viewCount });
      }
    }
    await sleep(200);
  }
  log(`科判候選（含作者反查）：${cand.size}`);

  // 5) 下載 + 轉檔
  let docs = [];
  let i = 0;
  const list = [...cand.values()];
  const worker = async () => {
    while (i < list.length) {
      const c = list[i++];
      const got = c.kind === "explore" ? await fetchExplore(c.id) : await fetchDoc(c.id);
      if (got.code !== 0) { log("  ✗", c.title, got.code); await sleep(200); continue; }
      if (!got.author) got.author = c.author || "";
      let def;
      try { def = JSON.parse(got.definition); } catch { log("  ✗ parse", c.title); await sleep(200); continue; }
      got.nodeCount = countNodes(def.nodes);
      got.depth = maxDepth(def.nodes);
      got.dead = false;
      docs.push(got);
      await sleep(200);
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  docs.sort((a, b) => b.nodeCount - a.nodeCount);

  // 同一份文件常同時有 explore（精選）與 doc（社群）兩個入口，內容完全相同；
  // 用 definition 的雜湊去重，留下 explore 版（有作者、連結穩定）。
  const crypto = await import("node:crypto");
  // 只比對內容（節點 id、modified、顏色、收合狀態都是各副本自己的狀態）
  const canon = (ns) => (ns || []).map((n) => [n.text, n.note || "", n.heading || 0, canon(n.children)]);
  const hash = (defJson) => crypto.createHash("sha1").update(JSON.stringify(canon(JSON.parse(defJson).nodes))).digest("hex");
  const byHash = new Map();
  for (const d of docs) {
    const h = hash(d.definition);
    const prev = byHash.get(h);
    if (!prev) { byHash.set(h, { ...d, mirrors: [] }); continue; }
    prev.mirrors.push({ id: d.id, kind: d.kind, url: d.url });
    if (prev.kind !== "explore" && d.kind === "explore") Object.assign(prev, { ...d, mirrors: prev.mirrors });
  }
  const unique = [...byHash.values()].sort((a, b) => b.nodeCount - a.nodeCount);
  docs = unique;

  // 再合併「同一份文件、兩個入口」但內容有一兩字差異的副本
  const normTitle = (t) => String(t).replace(/[0-9０-９、《》〈〉「」・·:：\-—–－（）()\s]/g, "");
  const byTitle = new Map();
  for (const d of docs) {
    const key = normTitle(d.title);
    const prev = byTitle.get(key);
    if (prev && Math.abs(prev.nodeCount - d.nodeCount) <= 3) {
      prev.mirrors.push({ id: d.id, kind: d.kind, url: d.url, nodes: d.nodeCount });
      continue;
    }
    byTitle.set(key, d);
  }
  docs = [...byTitle.values()].sort((a, b) => b.nodeCount - a.nodeCount);

  docs.forEach((d, idx) => {
    d.title = d.title.replace(/\s+/g, " ").trim();
    d.file = `${String(idx + 1).padStart(2, "0")}-${safeName(d.title)}.md`;
    fs.writeFileSync(path.join(RAW, `${d.kind}-${d.id}.json`), JSON.stringify(d, null, 1), "utf8");
    const md = `# ${d.title}\n\n> ${d.author || "（未署名）"} · ${d.url} · ${d.nodeCount} 節點\n\n${toMarkdown(JSON.parse(d.definition))}`;
    fs.writeFileSync(path.join(DOCS, d.file), md, "utf8");
  });
  log(`下載科判：${docs.length} 份（去重後）`);

  // 6) 目錄文件另存 markdown
  const CATDIR = path.join(ROOT, "catalogs");
  fs.mkdirSync(CATDIR, { recursive: true });
  for (const c of catalogDocs) {
    const def = JSON.parse(c.definition);
    c.file = `${safeName(c.title)}.md`;
    fs.writeFileSync(
      path.join(CATDIR, c.file),
      `# ${c.title}\n\n> ${c.author || "（未署名）"} · ${c.url} · ${c.nodeCount} 節點\n\n${toMarkdown(def)}`,
      "utf8",
    );
  }

  // 7) 資料與索引
  const data = {
    generatedAt: new Date().toISOString(),
    source: "mubu.com",
    catalogs: catalogDocs.map((c) => ({ id: c.id, title: c.title, author: c.author, url: c.url, nodes: c.nodeCount, file: `catalogs/${c.file}` })),
    docs: docs.map((d) => ({
      id: d.id, kind: d.kind, title: d.title, author: d.author, url: d.url,
      nodes: d.nodeCount, depth: d.depth, file: `docs/${d.file}`, raw: `raw/${d.kind}-${d.id}.json`,
      mirrors: d.mirrors || [],
    })),
    listEntries: entries.map((e) => ({ section: e.section, text: e.text, url: e.url, docId: e.docId, alive: e.alive })),
  };
  fs.writeFileSync(path.join(ROOT, "data.json"), JSON.stringify(data, null, 2), "utf8");

  // 純結構（給下游程式用的精簡大綱）
  const tree = (ns) =>
    (ns || []).map((n) => {
      const o = { t: inline(n.text).trim() };
      if (n.heading) o.h = n.heading;
      if (n.note) o.note = inline(n.note).trim();
      if (n.children?.length) o.k = tree(n.children);
      return o;
    });
  const trees = docs.map((d) => ({
    id: d.id, title: d.title, author: d.author, url: d.url, nodes: d.nodeCount,
    tree: tree(JSON.parse(d.definition).nodes),
  }));
  fs.writeFileSync(path.join(ROOT, "kepan-trees.json"), JSON.stringify(trees, null, 1), "utf8");

  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines = [];
  lines.push("# 幕布科判抓取結果", "");
  lines.push(`抓取時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Shanghai" })}　·　來源：mubu.com`);
  lines.push("");
  lines.push(`## 一、抓到的科判（${docs.length} 份）`, "");
  lines.push("| # | 科判 | 作者 | 節點 | 檔案 | 原連結 |");
  lines.push("|---|---|---|---|---|---|");
  docs.forEach((d, idx) => lines.push(`| ${idx + 1} | ${esc(d.title)} | ${esc(d.author || "—")} | ${d.nodeCount} | [${esc(d.file)}](<docs/${d.file}>) | ${d.url} |`));
  lines.push("");
  lines.push("## 二、目錄（索引性質，非科判本文）", "");
  for (const c of catalogDocs) lines.push(`- [${c.title}](<catalogs/${c.file}>) — ${c.nodeCount} 節點，作者 ${c.author}（[原連結](${c.url})）`);
  lines.push("");
  const aliveN = entries.filter((e) => e.alive).length;
  lines.push(`## 三、〈佛經科判資源列表〉逐條檢查（${entries.length} 條，可讀 ${aliveN} 條）`, "");
  if (!aliveN) lines.push("> 清單裡 64 個 mubu 分享連結全部已被刪除（`document/view/get` 一律回 `code 16`），只能抓到清單本身。", "");
  lines.push("| 章節 | 條目 | 連結 | 狀態 |");
  lines.push("|---|---|---|---|");
  for (const e of entries) lines.push(`| ${esc(e.section)} | ${esc(e.text)} | ${e.url} | ${e.alive ? "可讀" : "已失效（code 16）"} |`);
  fs.writeFileSync(path.join(ROOT, "index.md"), lines.join("\n") + "\n", "utf8");
  log("→ index.md / data.json / docs/ / raw/ / catalogs/");
}

await main();
