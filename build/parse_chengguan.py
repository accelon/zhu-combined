# -*- coding: utf-8 -*-
"""把《成觀法師英譯金剛經》PDF 依「左半頁／右半頁」重組成欄，
每欄保留「中文經文」與「英文譯文（逐行）」；腳註字級較小，先濾掉。

輸出：src/chengguan-cols.json [{page, side, zh, en:[line,...]}]
"""
import json
import re
import sys
from pathlib import Path

import pdfplumber

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "vendor" / "pdf" / "成觀法師英譯金剛經.pdf"
OUT = ROOT / "src" / "chengguan-cols.json"

CJK = re.compile(r"[\u3400-\u9fff]")
BODY_SIZE = 12.4


def cjk_ratio(s):
    return len(CJK.findall(s)) / len(s) if s else 0


def half_lines(page, x0, x1):
    words = [w for w in page.extract_words(extra_attrs=["size"])
             if w["x0"] >= x0 and w["x1"] <= x1 and w["size"] >= BODY_SIZE]
    rows = {}
    for w in words:
        rows.setdefault(round(w["top"] / 4), []).append(w)
    out = []
    for k in sorted(rows):
        line = sorted(rows[k], key=lambda x: x["x0"])
        text = " ".join(w["text"] for w in line).strip()
        if text:
            out.append((line[0]["top"], text))
    return [(t, x) for t, x in out if t > 70]


def main():
    cols = []
    with pdfplumber.open(str(PDF)) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            mid = page.width / 2
            for side, (a, b) in (("L", (0, mid)), ("R", (mid, page.width))):
                lines = half_lines(page, a, b)
                zh = "".join(re.sub(r"\s+", "", x) for t, x in lines if cjk_ratio(x) > 0.3)
                en = [re.sub(r"\s+", " ", x) for t, x in lines if cjk_ratio(x) <= 0.1]
                if not zh and not en:
                    continue
                cols.append({"page": pno, "side": side, "zh": zh, "en": en})
    OUT.write_text(json.dumps(cols, ensure_ascii=False, indent=1), encoding="utf-8")
    print("cols", len(cols), "zh", sum(len(c["zh"]) for c in cols), "en lines", sum(len(c["en"]) for c in cols))


if __name__ == "__main__":
    main()
