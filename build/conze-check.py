# -*- coding: utf-8 -*-
"""檢查 conze-cuts.json 的每個切點能不能對上原文。"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from conze_lib import corpus

src = (HERE / "conze-align.py").read_text(encoding="utf-8")
head = src.split("out, review = [], []")[0]
ns = {"__file__": str(HERE / "conze-align.py"), "__name__": "dbg"}
exec(compile(head, "conze-align.py", "exec"), ns)

C = ns["C"]
cuts = json.loads((HERE / "conze-cuts.json").read_text(encoding="utf-8"))
for k, markers in sorted(cuts.items(), key=lambda x: x[0]):
    if k.startswith("_"):
        continue
    bi = int(k)
    us = ns["pair_units"][bi]
    toks = ns["word_tokens"](C.pairs[bi][1]["text"])
    segs = ns["apply_cuts"](toks, markers, len(us))
    print(bi, "units", len(us), "markers", len(markers), "OK" if segs else "FAIL")
