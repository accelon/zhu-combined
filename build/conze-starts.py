# -*- coding: utf-8 -*-
"""列出每個 Conze 段落的起點 unit 與其首句，供校對起點。"""
from pathlib import Path

from conze_lib import corpus

HERE = Path(__file__).resolve().parent

C = corpus()
units = C.units
pair_units = C.load_ranges()

rows = []
for bi, ((sa, en), us) in enumerate(zip(C.pairs, pair_units)):
    if bi == 0:
        continue
    u = us[0]
    rows.append(f"{bi}\t{len(us)}u\t{u}\t{' '.join(units[u]['t'].split())[:20]}\t{en['text'][:70]}")
(HERE / "_starts.tsv").write_text("\n".join(rows), encoding="utf-8")
print("\n".join(rows))
