# -*- coding: utf-8 -*-
"""印出每個 Conze 段落對到的 unit，供人工校對（粗切）。"""
from pathlib import Path

from conze_lib import corpus

HERE = Path(__file__).resolve().parent

C = corpus()
ranges = C.load_ranges()
units = C.units

rows = []
for bi, ((sa, en), us) in enumerate(zip(C.pairs, ranges), 1):
    u0, u1 = us[0], us[-1]
    a = " ".join(units[u0]["t"].split())[:24]
    b = " ".join(units[u1]["t"].split())[:24]
    rows.append(
        f"{bi}\tp{en['page']}\t{len(us)}u {u0}-{u1}\t{a}｜{b}\t"
        f"{en['text'][:40]} … {en['text'][-40:]}"
    )
text = "\n".join(rows)
(HERE / "_blocks.tsv").write_text(text, encoding="utf-8")
print(text)
