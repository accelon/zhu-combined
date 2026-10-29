# -*- coding: utf-8 -*-
"""把慈舟《金剛經中道了義疏》的 markdown 清成純文字，給 build-data 當一部注疏。
輸出：src/cizhou-body.txt
"""
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
md = (ROOT / "src" / "cizhou.md").read_text(encoding="utf-8")
md = re.sub(r"^---[\s\S]*?\n---\n", "", md)

# 兩次「自　序」：第二次才是正文開頭（前面是目錄）
idx = [m.start() for m in re.finditer(r"自\s*序", md)]
start = idx[1] if len(idx) > 1 else idx[0]
body = md[start:]

lines = []
for ln in body.splitlines():
    s = ln.strip()
    if not s:
        continue
    if re.match(r"^[\d\.\s]*$", s):
        continue
    lines.append(s)
text = "\n".join(lines)
(ROOT / "src" / "cizhou-body.txt").write_text(text, encoding="utf-8")
print("chars", len(text), "lines", len(lines))
print(text[:200])
