#!/usr/bin/env node
// Dynalist 公開文件抓取器
//
//   node kepan-refs/crawl.mjs                     # 抓 README 裡預設的那份
//   node kepan-refs/crawl.mjs <docId|url> [out]   # 抓指定文件
//
// 做法：Dynalist 沒有匿名 HTTP API（/api/v1/doc/read 要 token，/api/file/load 直接 GET 是 404），
// 但公開文件頁面載入時，瀏覽器會抓 /api/bundle_binary，裡面就是整份文件的節點樹。
// 所以用本機 Edge（headless + CDP）開頁面，把那個回應的 body 截下來解析。
//
// 需要：Windows 上的 Edge（或改 EDGE 常數指向 Chrome）。

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const arg = process.argv[2] || "https://dynalist.io/d/yOAmrnNI0ynAAlZzM79nYqOC";
const docId = (arg.match(/\/d\/([A-Za-z0-9_-]+)/) || [, arg])[1];
const url = `https://dynalist.io/d/${docId}`;
const outName = process.argv[3] || "科判研究";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function captureBundle(url, waitMs = 25000) {
  const port = 11800 + Math.floor(Math.random() * 150);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "edge-dynalist-"));
  const child = spawn(EDGE, [
    "--headless=new", "--disable-gpu",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--window-size=1280,900", "--no-first-run", "--no-default-browser-check", "about:blank",
  ], { stdio: "ignore" });

  try {
    let page = null;
    for (let i = 0; i < 80 && !page; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      } catch {}
      if (!page) await sleep(250);
    }
    if (!page) throw new Error("找不到 devtools target");

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const hits = [];
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
      if (m.method === "Network.responseReceived" && /\/api\/bundle_binary/.test(m.params.response.url)) {
        hits.push(m.params.requestId);
      }
    });
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const send = (method, params = {}) => new Promise((res) => {
      const mid = ++id; pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

    // 先開好 Network 再導航，才不會漏掉早發的請求
    await send("Page.enable");
    await send("Network.enable");
    await send("Page.navigate", { url });

    const deadline = Date.now() + waitMs;
    while (!hits.length && Date.now() < deadline) await sleep(400);
    if (!hits.length) throw new Error("沒抓到 /api/bundle_binary（文件可能是私有的，或頁面沒載入）");

    let body = null;
    for (let k = 0; k < 12 && !body; k++) {
      const r = await send("Network.getResponseBody", { requestId: hits[hits.length - 1] });
      body = r.result?.body ?? null;
      if (!body) await sleep(500);
    }
    ws.close();
    if (!body) throw new Error("拿不到 bundle_binary 的回應內容");
    return JSON.parse(body);
  } finally {
    child.kill();
  }
}

function buildTree(doc) {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const meta = (n) => { try { return JSON.parse(n.meta || "{}"); } catch { return {}; } };

  const conv = (id) => {
    const n = byId.get(id);
    if (!n) return null;
    const m = meta(n);
    const o = { t: (m.c || "").trim() };
    if (m.n && String(m.n).trim()) o.note = String(m.n).trim();
    const kids = (n.children || []).map(conv).filter(Boolean);
    if (kids.length) o.k = kids;
    return o;
  };
  return (byId.get("root")?.children || []).map(conv).filter(Boolean);
}

function countTree(ns) {
  return ns.reduce((a, n) => a + 1 + countTree(n.k || []), 0);
}

function toMarkdown(ns) {
  const lines = [];
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      if (n.t) {
        lines.push(`${"  ".repeat(depth)}- ${n.t}`);
        if (n.note) for (const l of n.note.split("\n")) lines.push(`${"  ".repeat(depth + 1)}> ${l}`);
        if (n.k) walk(n.k, depth + 1);
      } else {
        // 空節點（多半是貼圖留下的空白項）：不輸出，但子節點升到同一層
        if (n.k) walk(n.k, depth);
      }
    }
  };
  walk(ns, 0);
  return lines.join("\n") + "\n";
}

const bundle = await captureBundle(url);
const item = (bundle.bundle || []).find((b) => b.path === "/api/doc/load");
if (!item) throw new Error("bundle 裡沒有 /api/doc/load");

const doc = JSON.parse(item.data);
const tree = buildTree(doc);
const titled = countTree(tree);
const total = doc.nodes.length;

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
const safe = outName.replace(/[\\/:*?"<>|]+/g, "_");
fs.writeFileSync(path.join(ROOT, `${safe}.json`), JSON.stringify({
  id: docId, url, title: doc.title, version: doc.version,
  nodes: total, contentNodes: titled, tree,
}, null, 1), "utf8");

fs.writeFileSync(path.join(ROOT, "docs", `${safe}.md`),
  `# ${doc.title}\n\n> Dynalist · ${url} · ${titled} 個節點（原始 ${total}，含已刪孤兒）\n\n${toMarkdown(tree)}`,
  "utf8");

console.log(`${doc.title}：${titled} 個節點（原始 ${total}，其中 ${total - 1 - titled} 個是已刪除、不在樹上的孤兒）→ docs/${safe}.md`);
