# -*- coding: utf-8 -*-
"""Conze 英譯 → 本專案 unit 對齊。

粗切：梵文錨點把 Conze 段落對到 pdf-entries 的梵文句子（= unit），
      再用 build/conze-ranges.json 校訂的起點切段。
細分：段內把所有英文切成連續片段（切點優先落在句末，其次子句逗號），
      以「相對位置 + 逐詞注英譯的詞彙重疊」做單調 DP，全文不重不漏。
輸出：conze-en.json（給 build-data 用）＋ _conze-review.tsv（人工校對）
"""
import json
import math
import re
from pathlib import Path

from conze_lib import corpus

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

C = corpus()
units = C.units
entries = C.entries
pair_units = C.load_ranges()

# ---------- 詞彙表：逐詞注的英譯 ----------
STOP = set("""a an the of to in on at by for from with and or but if as is are was were be been
being it its this that these those he she they them his her their you your i we our not no nor
so such than then there here which who whom whose what when where why how all any both each few
more most other some only own same too very can could may might must shall should will would do
does did done have has had also yet thus therefore because however again further moreover o
lord subhuti bhagavan well-gone sugata tathagata one ones there's it's""".split())


def content_words(s):
    out = []
    for w in re.findall(r"[A-Za-z][A-Za-z'\-]*", s):
        w = w.lower().strip("'-")
        if len(w) < 3 or w in STOP:
            continue
        out.append(w)
    return out


unit_vocab = [set() for _ in units]
unit_sa = [0] * len(units)
for e in entries:
    u = e["u"]
    if u < 0:
        continue
    for g in e.get("en") or []:
        for w in content_words(g):
            unit_vocab[u].add(w)
    unit_sa[u] += len(re.sub(r"\s+", "", e["sa"] or ""))


def weight(k):
    """段內權重：梵文長度（兩譯共同的底本）優先，沒有梵文才用漢字數。"""
    return max(4, unit_sa[k] if unit_sa[k] >= 20 else len(units[k]["t"]))

N = len(units)
df = {}
for v in unit_vocab:
    for w in v:
        df[w] = df.get(w, 0) + 1
IDF = {w: math.log(N / d) for w, d in df.items()}
MAXW = math.log(N)


def word_tokens(text):
    return re.findall(r"\S+", re.sub(r"\s+", " ", text).strip())


CLAUSE_START = set("""the and but or so then for when if because though although yet he she they it
this these those there thus hence therefore however while as with in on at by from to of his her
their its not now again further moreover also all any no more most only even still such what which
who whom whose where why how""".split())


def cut_cost(toks, i, n):
    if i >= n:
        return 0.0
    prev = toks[i - 1]
    if re.search(r"[.!?]['\"”’]?$", prev):
        return 0.0
    if re.search(r"[,;:]['\"”’]?$", prev):
        return 1.0
    return 6.0


def norm_tok(s):
    return re.sub(r"[^a-z0-9']", "", s.lower())


def apply_cuts(toks, markers, m):
    """依人工指定的切點（每段結尾的幾個詞）切段；對不上就回 None。"""
    segs, start = [], 0
    for mk in markers:
        want = [norm_tok(w) for w in mk.split()]
        want = [w for w in want if w]
        found = -1
        for e in range(start + 1, len(toks) + 1):
            tail = [norm_tok(w) for w in toks[max(start, e - len(want)):e]]
            if tail == want:
                found = e
                break
        if found < 0:
            return None
        segs.append(" ".join(toks[start:found]))
        start = found
    segs.append(" ".join(toks[start:]))
    if len(segs) != m or any(not s.strip() for s in segs):
        return None
    return segs


def align_block(us, text):
    toks = word_tokens(text)
    n, m = len(toks), len(us)
    if m == 0:
        return []
    if n <= m:
        # 太少詞：直接每個 unit 一個詞（保底）
        return [" ".join(toks[i:i + 1]) for i in range(min(n, m))]

    L = [weight(k) for k in us]
    totL = sum(L)
    cum = [0.0]
    for x in L:
        cum.append(cum[-1] + x / totL)

    # 每個 token 的內容詞權重（用於詞彙重疊）
    tw = []
    for t in toks:
        tw.append([(IDF.get(w, MAXW), w) for w in content_words(t)])

    cc = [cut_cost(toks, i, n) for i in range(n + 1)]
    INF = 1e18
    POS = 2.5
    LEX = 0.7
    dp = [[INF] * (n + 1) for _ in range(m + 1)]
    bk = [[-1] * (n + 1) for _ in range(m + 1)]
    dp[0][0] = 0.0

    for j in range(1, m + 1):
        vocab = unit_vocab[us[j - 1]]
        unitW = sum(IDF.get(w, MAXW) for w in vocab)
        target = cum[j]
        pmin, pmax = j, n - (m - j)
        for q in range(j - 1, pmax):
            base = dp[j - 1][q]
            if base == INF:
                continue
            tot, hit = 0.0, 0.0
            for p in range(q + 1, pmax + 1):
                for wgt, w in tw[p - 1]:
                    tot += wgt
                    if w in vocab:
                        hit += wgt
                if p < pmin:
                    continue
                lex = hit / math.sqrt(tot * unitW) if tot > 0 and unitW > 0 else 0.0
                v = base + cc[q] + POS * abs(p / n - target) - LEX * min(lex, 1.5)
                if v < dp[j][p]:
                    dp[j][p] = v
                    bk[j][p] = q

    p, cuts = n, [n]
    for j in range(m, 0, -1):
        p = bk[j][p]
        if p < 0:
            p = 0
        cuts.append(p)
    cuts.reverse()
    return [" ".join(toks[cuts[j]:cuts[j + 1]]) for j in range(m)]


out, review = [], []
prev_u = -1
CUTS = {}
_p = HERE / "conze-cuts.json"
if _p.exists():
    CUTS = {int(k): v for k, v in json.loads(_p.read_text(encoding="utf-8")).items() if not k.startswith("_")}
for bi, ((sa, en), us) in enumerate(zip(C.pairs, pair_units)):
    if bi == 0:
        continue
    segs = None
    if bi in CUTS:
        segs = apply_cuts(word_tokens(en["text"]), CUTS[bi], len(us))
        if segs is None:
            print(f"!! 手動切點對不上：pair {bi}")
    if segs is None:
        segs = align_block(us, en["text"])
    for u, seg in zip(us, segs):
        seg = seg.strip()
        if not seg:
            continue
        assert u >= prev_u, (bi, u, prev_u)
        prev_u = u
        out.append({"t": seg, "u": u, "sec": units[u]["sec"], "page": en["page"]})
        review.append((bi + 1, en["page"], u, " ".join(units[u]["t"].split()), seg))

json.dump(out, open(ROOT / "conze-en.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
with open(HERE / "_conze-review.tsv", "w", encoding="utf-8") as f:
    f.write("block\tpage\tu\t羅什\tConze\n")
    for r in review:
        f.write("\t".join(str(x) for x in r) + "\n")
print("fragments", len(out), "units covered", len({o['u'] for o in out}))

# 完整性檢查：片段接起來要等於原文（歸敬偈除外）
src_words = sum(len(word_tokens(en["text"])) for bi, (sa, en) in enumerate(C.pairs) if bi)
out_words = sum(len(word_tokens(o["t"])) for o in out)
print("words", out_words, "/", src_words)
assert out_words == src_words, "英文片段有漏字或多字"
