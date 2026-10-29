// 抓《金剛經》墨書院（moshuyuan.com）全書，解析出「原文／註釋／譯文／讀解」。
// 產出：src/moshuyuan.json（結構化）、moshuyuan.md（可讀版）
import fs from 'node:fs/promises';

const BASE = 'https://www.moshuyuan.com/zh-tw';
const BOOK = `${BASE}/book/zibu/jin-gang-jing.html`;
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };

const WITH_APPENDIX = false; // 附錄＝通論，和 32 品經文無關，預設不抓
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(800 * (i + 1));
    }
  }
}

const stripTags = (h) =>
  h
    .replace(/<\s*(script|style)[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// 把 ①…⑳ 的註釋切成條目
const RING = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚';

function splitNotes(text) {
  const re = new RegExp(`([${RING}])`, 'g');
  const parts = text.split(re);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    const mark = parts[i];
    const body = (parts[i + 1] || '').trim();
    if (!body) continue;
    const m = body.match(/^([^：:]{1,24})[：:]\s*([\s\S]*)$/);
    out.push(m ? { mark, term: m[1].trim(), text: m[2].trim() } : { mark, term: '', text: body });
  }
  return out;
}

function parseChapter(html) {
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  const title = h2 ? stripTags(h2[1]) : '';
  // 文章本體：<h3 class="label-yuanwen">原文</h3>… 依 label 切段（有些章沒有註釋）
  const at = html.indexOf('id="chapterContent"');
  const body = at >= 0 ? html.slice(at) : html;
  const parts = body.split(/<h3[^>]*class="label-([a-z]+)"[^>]*>[\s\S]*?<\/h3>/);
  const sec = {};
  for (let i = 1; i < parts.length; i += 2) sec[parts[i]] = parts[i + 1] || '';
  const STOP = /墨書院|作者：釋迦牟尼佛|熱門排行|工具導航|關於我們|切換為簡體|小墨 AI|上一章|下一章/;
  const cut = (s) => {
    let t = stripTags(String(s || ''));
    const i = t.search(STOP);
    if (i >= 0) t = t.slice(0, i);
    return t.replace(/釋迦垂跡\s*$/, '').replace(/[\s\n]+$/, '').trim();
  };
  return {
    title,
    yuanwen: cut(sec.yuanwen),
    notes: splitNotes(cut(sec.zhushi)),
    yiwen: cut(sec.fanyi),
    dujie: cut(sec.dujie).replace(/\n+/g, '\n'),
  };
}

async function main() {
  const book = await get(BOOK);
  const links = [...book.matchAll(/href="([^"]*\/chapter\/zibu\/jin-gang-jing\/[^"]+)"/g)]
    .map((m) => (m[1].startsWith('http') ? m[1] : 'https://www.moshuyuan.com' + m[1]))
    .map((u) => u.split('#')[0]);
  const urls = [...new Set(links)].filter((u) => WITH_APPENDIX || !/fu-lu\.html$/.test(u));
  console.log('chapters', urls.length);

  const out = [];
  for (const [i, u] of urls.entries()) {
    let html;
    try {
      html = await get(u);
    } catch (e) {
      console.log('SKIP', u, e.message);
      continue;
    }
    const c = parseChapter(html);
    if (!c.title || (!c.yuanwen && !c.yiwen)) { console.log('SKIP(empty)', u); continue; }
    c.url = u;
    out.push(c);
    console.log(i + 1, c.title, '原文', c.yuanwen.length, '註', c.notes.length, '譯', c.yiwen.length, '讀', c.dujie.length);
    await sleep(300);
  }

  // 目錄有一條重複的「第十品」（不同網址、內容相同），去掉
  const seen = new Set();
  const chapters = out.filter((c) => {
    const k = c.title + '|' + c.yuanwen.slice(0, 40) + '|' + c.yiwen.slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  chapters.forEach((c, i) => { c.n = i + 1; });

  // 附錄是「金剛經通論」（源流、六譯、般若正觀…），不是經文也不是註釋，預設不收。
  // 要收就把 WITH_APPENDIX 改成 true。
  if (WITH_APPENDIX) try {
    const html = await get(`${BASE}/chapter/zibu/jin-gang-jing/fu-lu.html`);
    const at = html.indexOf('id="chapterContent"');
    if (at >= 0) {
      let txt = stripTags(html.slice(html.indexOf('>', at) + 1));
      const i = txt.search(/墨書院|熱門排行|工具導航|關於我們|回到目錄|上一章|下一章/);
      if (i >= 0) txt = txt.slice(0, i);
      txt = txt.replace(/[\s\n]+$/, '').trim();
      if (txt) chapters.push({ n: chapters.length + 1, title: '附錄', yuanwen: '', notes: [], yiwen: '', dujie: txt, appendix: true });
    }
  } catch (e) {
    console.log('附錄 skip', e.message);
  }

  await fs.writeFile('src/moshuyuan.json', JSON.stringify(chapters, null, 1), 'utf8');

  const md = chapters.map((c) => {
    const parts = [`## ${c.title}`];
    if (c.yuanwen) parts.push(`### 原文\n\n${c.yuanwen}`);
    if (c.notes.length) parts.push(`### 註釋\n\n${c.notes.map((n) => `- **${n.mark}${n.term ? ' ' + n.term : ''}**：${n.text}`).join('\n')}`);
    else if (!c.appendix) parts.push(`### 註釋\n\n（此章無註釋）`);
    if (c.yiwen) parts.push(`### 譯文\n\n${c.yiwen}`);
    if (c.dujie) parts.push(`### 讀解\n\n${c.dujie}`);
    return parts.join('\n\n') + '\n';
  });
  await fs.writeFile('moshuyuan.md', `# 金剛經 · 墨書院（原文／註釋／譯文／讀解）\n\n${md.join('\n')}`, 'utf8');
  console.log('chapters kept', chapters.length, 'notes total', chapters.reduce((s, c) => s + c.notes.length, 0));
  console.log('wrote src/moshuyuan.json + moshuyuan.md');
}

main().catch((e) => { console.error(e); process.exit(1); });
