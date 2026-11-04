// PWA 產物：manifest、service worker、圖示。由 build-vcpp*.mjs 呼叫。
//
// 產出（與單檔同一個目錄）：
//   <name>.webmanifest   每個應用一份（start_url 指自己那支 html）
//   sw.js                同目錄共用（快取 shell 與圖示，離線可開）
//   icon-192.png / icon-512.png
//
// 執行環境必須是 https（或 localhost）才裝得起來；file:// 直接開會自動跳過。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', 'assets');

export const SW_SOURCE = `/* 由 zhu-combined 的 build/pwa.mjs 產生：離線快取（network-first，離線回快取） */
const CACHE = 'zhu-cache-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});
`;

export function writePWA({ outFile, title, sub, themeColor = '#8a5a2f', background = '#f6efda', startUrl = '', manifestName = '' }) {
  const dir = path.dirname(outFile);
  const base = path.basename(outFile);
  const stem = base.replace(/\.html?$/i, '');
  const name = String(title || '經注閱讀器').trim();
  const short = name.length > 12 ? name.slice(0, 12) : name;

  const manifest = {
    name,
    short_name: short,
    description: String(sub || ''),
    start_url: './' + (startUrl || base),
    scope: './',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    background_color: background,
    theme_color: themeColor,
    lang: 'zh-Hant',
    icons: [
      { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };

  const manifestName2 = manifestName || (String(startUrl || stem).replace(/\.html?$/i, '') + '.webmanifest');
  fs.writeFileSync(path.join(dir, manifestName2), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'sw.js'), SW_SOURCE, 'utf8');
  for (const f of ['icon-192.png', 'icon-512.png']) {
    const src = path.join(ASSETS, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, f));
  }
  return { manifestName: manifestName2, swName: 'sw.js' };
}
