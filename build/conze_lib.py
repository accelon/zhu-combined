# -*- coding: utf-8 -*-
"""Conze 英譯對齊的共用工具：讀 block、梵文錨點、段落 → unit 範圍。"""
import bisect
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

JUNK = re.compile(r"^(The Diamond Sutra|Aus:)", re.I)


def fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    for a, b in (("ṃ", "m"), ("ḥ", "h"), ("ṅ", "n"), ("ñ", "n"), ("ś", "s"), ("ṣ", "s"), ("ṭ", "t"), ("ḍ", "d")):
        s = s.replace(a, b)
    return s.lower()


def tokens(s: str):
    return [t for t in re.sub(r"[^a-z]+", " ", fold(s)).split() if t]


class Corpus:
    def __init__(self):
        blocks = json.loads((ROOT / "conze-blocks.json").read_text(encoding="utf-8"))
        data = json.loads((HERE / "_pdf-u.json").read_text(encoding="utf-8"))
        self.units = data["units"]
        self.entries = data["pdf"]

        sa_blocks, en_blocks = [], []
        for b in blocks:
            if JUNK.match(b["text"].strip()) or len(b["text"].strip()) < 12:
                continue
            (sa_blocks if b["type"] == "sa" else en_blocks).append(b)
        assert len(sa_blocks) == len(en_blocks), (len(sa_blocks), len(en_blocks))
        self.pairs = list(zip(sa_blocks, en_blocks))

        ctoks, cblock_of = [], []
        for bi, (sa, _) in enumerate(self.pairs):
            tk = tokens(sa["text"])
            ctoks += tk
            cblock_of += [bi] * len(tk)

        ptoks, pentry_of = [], []
        for ei, e in enumerate(self.entries):
            tk = tokens(e["sa"])
            ptoks += tk
            pentry_of += [ei] * len(tk)

        K = 4
        pos_p = {}
        for i in range(len(ptoks) - K + 1):
            pos_p.setdefault(tuple(ptoks[i:i + K]), []).append(i)

        anchor, seen = [], set()
        for i in range(len(ctoks) - K + 1):
            g = tuple(ctoks[i:i + K])
            if g in seen:
                continue
            seen.add(g)
            arr = pos_p.get(g)
            if arr and len(arr) == 1:
                anchor.append((i, arr[0]))

        tail_p, tail_i, parent = [], [], []
        for k, (ci, pj) in enumerate(anchor):
            j = bisect.bisect_left(tail_p, pj)
            if j == len(tail_p):
                tail_p.append(pj); tail_i.append(k); parent.append(tail_i[j - 1] if j else -1)
            else:
                tail_p[j] = pj; tail_i[j] = k; parent.append(tail_i[j - 1] if j else -1)
        chain = []
        k = tail_i[-1]
        while k >= 0:
            chain.append(anchor[k]); k = parent[k]
        chain.reverse()
        self.chain_c = [c for c, _ in chain]
        self.chain_p = [p for _, p in chain]
        self.cblock_of = cblock_of
        self.pentry_of = pentry_of
        self.ntok = len(ptoks)

    def c2p(self, ci):
        j = max(0, min(bisect.bisect_left(self.chain_c, ci) - 1, len(self.chain_c) - 1))
        return max(0, min(self.ntok - 1, self.chain_p[j] + (ci - self.chain_c[j])))

    def auto_ranges(self):
        out = []
        for bi in range(len(self.pairs)):
            idx = [i for i, x in enumerate(self.cblock_of) if x == bi]
            ea, ez = self.pentry_of[self.c2p(idx[0])], self.pentry_of[self.c2p(idx[-1])]
            us = [self.entries[e]["u"] for e in range(ea, ez + 1) if self.entries[e]["u"] >= 0]
            out.append((min(us), max(us)) if us else None)
        for bi, r in enumerate(out):
            if r is None:
                prev = next((out[j] for j in range(bi - 1, -1, -1) if out[j]), None)
                nxt = next((out[j] for j in range(bi + 1, len(out)) if out[j]), None)
                out[bi] = prev or nxt
        return out

    def load_ranges(self, path=None):
        """校訂過的起點（build/conze-ranges.json）優先，沒有就用自動的。

        回傳：每個 pair 一個 unit 清單（相鄰起點之間的所有 unit 歸前一段；
        起點相同時，該段只對應一個 unit）。
        """
        p = path or (HERE / "conze-ranges.json")
        if Path(p).exists():
            ov = json.loads(Path(p).read_text(encoding="utf-8"))
            n = len(self.pairs)
            starts = [0] * n
            for i in range(n):
                starts[i] = ov[str(i)] if str(i) in ov else None
            end = ov.get("end", len(self.units))
        else:
            auto = self.auto_ranges()
            starts = [r[0] for r in auto]
            end = len(self.units)
        out = []
        for i in range(len(self.pairs)):
            a = starts[i]
            b = starts[i + 1] if i + 1 < len(starts) else end
            if a is None:
                out.append([0])
            elif b <= a:
                out.append([a])
            else:
                out.append(list(range(a, b)))
        return out


def corpus():
    return Corpus()
