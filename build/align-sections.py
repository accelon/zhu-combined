# -*- coding: utf-8 -*-
"""把「今譯」（顯密文庫現代文）、Muller、中台、成觀英譯切成 {sec, sentences}，再對到 unit。

四者都按昭明三十二分排列，所以直接用「分」當錨：一個分內的句子，
按句末／逗號切點與長度比例，單調分配到該分的 unit。

用法：python build/align-sections.py
輸出：jinyi.json、muller.json、ctzen.json、chengguan.json（[{t,u,sec}]）
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DATA = json.loads((ROOT / "build" / "_pdf-u.json").read_text(encoding="utf-8"))
UNITS = DATA["units"]

CJK = re.compile(r"[\u3400-\u9fff]")


def is_cjk(s: str) -> bool:
    if not s:
        return False
    return len(CJK.findall(s)) / max(1, len(s)) > 0.35


def split_sentences_zh(text: str):
    text = re.sub(r"\s+", "", text)
    # 去掉「第一章　證信序文 發起因緣」這種小標題
    text = re.sub(r"^第[一二三四五六七八九十百]+章[^。！？]*?(?=[這在當其佛爾時])", "", text)
    out = []
    buf = ""
    for ch in text:
        buf += ch
        if ch in "。！？":
            out.append(buf)
            buf = ""
    if buf.strip():
        out.append(buf)
    return [x for x in out if len(x) >= 4]


def split_sentences_en(text: str):
    text = re.sub(r"\s+", " ", text).strip()
    out, start = [], 0
    for m in re.finditer(r"(?<=[.!?])[\"'”’]?\s+(?=[A-Z\"'“(])", text):
        out.append(text[start:m.end()].strip())
        start = m.end()
    if text[start:].strip():
        out.append(text[start:].strip())
    return [x for x in out if len(x) >= 10]


# ---------- 今譯 ----------
def jinyi_sections():
    raw = json.loads((SRC / "jinyi-raw.json").read_text(encoding="utf-8"))
    out = []
    for it in raw:
        m = re.search(r"分第([一二三四五六七八九十]+)", it["title"])
        if not m:
            continue
        sec = zh_num(m.group(1))
        yi = it["yi"]
        if "第十一" in it["title"]:
            # 第十、第十一合在一頁：用「恆河沙」那句切開
            k = yi.find("恆河")
            k2 = yi.find("恒河")
            k = min([x for x in (k, k2) if x >= 0], default=-1)
            if k > 40:
                # 往前找句首
                p = max(yi.rfind("。", 0, k), 0)
                out.append({"sec": 10, "text": yi[: p + 1]})
                out.append({"sec": 11, "text": yi[p + 1 :]})
                continue
        out.append({"sec": sec, "text": yi})
    return out


def zh_num(s: str) -> int:
    digits = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
    if s == "十":
        return 10
    if s.startswith("十"):
        return 10 + digits.get(s[1:], 0)
    if "十" in s:
        a, b = s.split("十")
        return digits.get(a, 0) * 10 + (digits.get(b, 0) if b else 0)
    return digits.get(s, 0)


# ---------- Muller ----------
def muller_sections():
    lines = [x.strip() for x in (SRC / "muller.txt").read_text(encoding="utf-8").splitlines() if x.strip()]
    start = next(i for i, x in enumerate(lines) if re.match(r"^1\.\s+Convocation", x))
    secs, cur, buf = [], 0, []
    for x in lines[start:]:
        m = re.match(r"^(\d+)\.\s+\S.*\[T 235\.8\.", x)
        if m:
            if cur:
                secs.append({"sec": cur, "text": " ".join(buf)})
            cur = int(m.group(1))
            buf = []
            continue
        if not cur:
            continue
        if is_cjk(x):
            continue  # 中文經文
        if x.startswith("http") or x in ("top page",):
            continue
        buf.append(x)
    if cur:
        secs.append({"sec": cur, "text": " ".join(buf)})
    return secs


# ---------- 中台山（PDF，32 段，英文在前、中文經文在後） ----------
def ctzen_sections():
    raw = (SRC / "ctzen-raw.txt").read_text(encoding="utf-8")
    raw = re.sub(r"=+\s*PAGE\s*\d+\s*=+", " ", raw)  # PDF 分頁雜訊
    lines = [x.rstrip() for x in raw.splitlines() if x.strip()]
    heads = []
    want = 1
    for i, x in enumerate(lines):
        m = re.match(r"^\s*(\d{1,2})\.\s+[A-Z]", x)
        if not m:
            continue
        n = int(m.group(1))
        if n == want:  # 只取 1..32 這段正文，後面的附錄重新從 1 數
            heads.append((i, n))
            want += 1
        elif n == 1 and want > 1:
            break
    secs = []
    for k, (i, n) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        buf = []
        for x in lines[i + 1 : end]:
            s = x.strip()
            if not s or is_cjk(s):
                continue
            if re.fullmatch(r"\d{1,2}", s):          # 單獨一行的頁碼／段號
                continue
            if "The Diamond of Perfect Wisdom" in s and len(s) < 60:
                continue
            s = re.sub(r"^\d{1,2}[.)]?\s+(?=[A-Z])", "", s)  # 行首黏到的段號
            if s:
                buf.append(s)
        text = " ".join(buf)
        # 書末不屬於經文的東西：四聖諦、八正道、懺悔文、迴向、寺院地址
        for stop in ("THE FOUR NOBLE TRUTHS", "Suffering exists in everyone", "REPENTA",
                     "DEDICATION OF MERITS", "Chung Tai Chan Monastery", "Tel:", "http://www.ctworld"):
            j = text.find(stop)
            if j >= 0:
                text = text[:j]
        text = re.sub(r"^\d{1,2}\s+", "", text).strip()
        secs.append({"sec": n, "text": text})

    # PDF 字距造成「字母被拆開」：t he / shoul d / give s / four -line
    # 語料裡本來就有正確的整字，拿它當字典把碎字接回去。
    vocab = Counter()
    for s in secs:
        for w in re.findall(r"[a-z][a-z'-]+", s["text"].lower()):
            vocab[w] += 1
    for s in secs:
        s["text"] = fix_splits(s["text"], vocab)
    return secs


TWO_OK = set("of to in it is as at by he we be or on no do so up us my me if an am go ox".split())


def _core(t):
    m = re.match(r"^([^A-Za-z'-]*)([A-Za-z][A-Za-z'-]*)(.*)$", t)
    return (m.group(1), m.group(2), m.group(3)) if m else ("", t, "")


def fix_splits(text, vocab):
    toks = [t for t in text.split(" ") if t]
    out = []
    i = 0
    while i < len(toks):
        t = toks[i]
        lead, core, tail = _core(t)
        # 「four -line」→「four-line」
        if core.startswith("-") and out:
            out[-1] += t
            i += 1
            continue
        frag = re.fullmatch(r"[a-z]{1,2}", core)
        if frag and core != "a" and core not in TWO_OK:
            # 往前接
            if out:
                p_lead, p_core, p_tail = _core(out[-1])
                if re.fullmatch(r"[A-Za-z]+", p_core) and not p_tail:
                    cand = (p_core + core).lower()
                    if len(cand) > len(p_core) and cand in vocab:
                        out[-1] = p_lead + p_core + core + tail
                        i += 1
                        continue
            # 往後接
            if i + 1 < len(toks):
                n_lead, n_core, n_tail = _core(toks[i + 1])
                if re.fullmatch(r"[A-Za-z][A-Za-z'-]*", n_core) and n_core != "a":
                    cand = (core + n_core).lower()
                    if len(cand) > len(n_core) and cand in vocab:
                        out.append(lead + core + n_core + n_tail)
                        i += 2
                        continue
                    # 保底一：下一字以母音開頭 → 缺的是詞首字母
                    if len(core) == 1 and len(n_core) >= 2 and n_core[0] in "aeiou":
                        out.append(lead + core + n_core + n_tail)
                        i += 2
                        continue
                    # 保底二：「immense jo y」→「immense joy」
                    if len(core) == 2 and len(n_core) == 1:
                        out.append(lead + core + n_core + n_tail)
                        i += 2
                        continue
            # 保底三：複數／第三人稱的 s、過去式的 d 接在前一個字後面
            if core in ("s", "d") and out:
                p_lead, p_core, p_tail = _core(out[-1])
                if re.fullmatch(r"[A-Za-z]+", p_core) and not p_tail and len(p_core) >= 3:
                    out[-1] = p_lead + p_core + core + tail
                    i += 1
                    continue
        out.append(t)
        i += 1
    return " ".join(out)


# ---------- 成觀（PDF，每欄＝中文經文＋英文譯文，英文裡有 Segment 標記） ----------
TITLE_END = re.compile(r"[.:!?”\"]$")


def chengguan_sections():
    cols = json.loads((SRC / "chengguan-cols.json").read_text(encoding="utf-8"))
    start = next(i for i, c in enumerate(cols)
                 if any("Segment" in x and "Exordium" in x for x in c["en"]))
    lines = [x for c in cols[start:] for x in c["en"]]
    # 只到經末
    end = next((i for i, x in enumerate(lines) if x.startswith("End of The Diamond")), len(lines))
    lines = lines[:end]

    segs, cur, buf = [], 0, []
    drop_title = False
    for x in lines:
        if x.startswith("Segment"):
            if cur:
                segs.append({"sec": cur, "lines": buf})
            cur = len(segs) + 1
            buf = []
            rest = re.sub(r"^Segment\s*[^\s:]*\s*:\s*", "", x).strip()
            drop_title = not rest
            continue
        if drop_title:
            drop_title = False
            continue
        buf.append(x)
    if cur:
        segs.append({"sec": cur, "lines": buf})

    out = []
    for s in segs:
        text = ""
        for ln in s["lines"]:
            ln = ln.strip()
            if not ln:
                continue
            if text.endswith("-") and re.match(r"^[a-z]", ln):
                text = text[:-1] + ln  # 行末連字號＝斷詞，接回去
            else:
                text += (" " if text else "") + ln
        out.append({"sec": s["sec"], "text": text})
    return out


# ---------- 分內對齊 ----------
def units_of(sec):
    # 真言（u214）是音譯，沒有對應的英文／白話，排除以免整段位移
    return [u for u in UNITS if u["sec"] == sec and not u["t"].startswith("真言")]


def align_section(us, sents, lang):
    """把一個分的句子單調切成 len(us) 段（可空）。"""
    if not us or not sents:
        return []
    L = [max(4, len(u["t"])) for u in us]
    tot = sum(L)
    cum = [0.0]
    for x in L:
        cum.append(cum[-1] + x / tot)
    n, m = len(sents), len(us)
    # 以「詞」為單位切：英文用空白、中文用字
    toks = [s.split() for s in sents] if lang == "en" else [[c for c in s] for s in sents]
    flat = [t for ts in toks for t in ts]
    # 句子在 flat 中的區間
    spans, acc = [], 0
    for ts in toks:
        spans.append((acc, acc + len(ts)))
        acc += len(ts)
    N = len(flat)
    if N == 0:
        return []

    def cutcost(i):
        if i >= N:
            return 0.0
        prev = flat[i - 1]
        if lang == "en":
            if re.search(r"[.!?][\"'”’]?$", prev):
                return 0.0
            if re.search(r"[,;:][\"'”’]?$", prev):
                return 0.7
            return 4.0
        return 0.0 if prev in "。！？" else (0.8 if prev in "，；：" else 3.0)

    INF = 1e18
    dp = [[INF] * (N + 1) for _ in range(m + 1)]
    bk = [[-1] * (N + 1) for _ in range(m + 1)]
    dp[0][0] = 0.0
    cc = [cutcost(i) for i in range(N + 1)]
    for j in range(1, m + 1):
        target = cum[j]
        for p in range(1, N + 1):
            best, bp = INF, -1
            for q in range(0, p):
                v = dp[j - 1][q]
                if v == INF:
                    continue
                v += cc[q] + 2.0 * abs(p / N - target)
                if v < best:
                    best, bp = v, q
            dp[j][p] = best
            bk[j][p] = bp
    p, cuts = N, [N]
    for j in range(m, 0, -1):
        p = bk[j][p]
        cuts.append(p)
    cuts.reverse()
    segs = ["".join(flat[cuts[j]:cuts[j + 1]]) if lang != "en" else " ".join(flat[cuts[j]:cuts[j + 1]]) for j in range(m)]
    return segs


def build(secs, lang, name):
    out = []
    for s in secs:
        us = units_of(s["sec"])
        if not us:
            print("!! no units for sec", s["sec"])
            continue
        sents = split_sentences_zh(s["text"]) if lang == "zh" else split_sentences_en(s["text"])
        segs = align_section(us, sents, lang)
        for u, seg in zip(us, segs):
            seg = seg.strip()
            if seg:
                out.append({"t": seg, "u": u["u"], "sec": s["sec"]})
    path = ROOT / f"{name}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    units_covered = len({o["u"] for o in out})
    print(f"{name}: {len(out)} fragments, {units_covered} units, {sum(len(o['t']) for o in out)} chars")


if __name__ == "__main__":
    jy = jinyi_sections()
    print("jinyi sections", len(jy), [x["sec"] for x in jy])
    mu = muller_sections()
    print("muller sections", len(mu), [x["sec"] for x in mu])
    cz = ctzen_sections()
    print("ctzen sections", len(cz), [x["sec"] for x in cz][:35])
    cg = chengguan_sections()
    print("chengguan sections", len(cg), [x["sec"] for x in cg][:35])
    build(jy, "zh", "jinyi")
    build(mu, "en", "muller")
    build(cz, "en", "ctzen")
    build(cg, "en", "chengguan")
