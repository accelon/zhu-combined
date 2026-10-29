# -*- coding: utf-8 -*-
"""把英文譯本的純文字抽出來（PDF 用 pypdf；HTML 用 regex 去標籤）。"""
import re
import sys
from pathlib import Path

from pypdf import PdfReader

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

# 成觀 PDF（原始素材放在 vendor/，不進版控）
pdf = ROOT / "vendor" / "pdf" / "成觀法師英譯金剛經.pdf"
r = PdfReader(str(pdf))
pages = []
for i, p in enumerate(r.pages, 1):
    pages.append(f"===== PAGE {i} =====\n" + (p.extract_text() or ""))
text = "\n".join(pages)
(SRC / "chengguan-raw.txt").write_text(text, encoding="utf-8")
print("chengguan pages", len(r.pages), "chars", len(text))
print(text[:1200])

# Muller HTML
html = (SRC / "muller.html").read_text(encoding="utf-8", errors="replace")
body = re.sub(r"<script[\s\S]*?</script>", "", html)
body = re.sub(r"<style[\s\S]*?</style>", "", body)
body = re.sub(r"<br\s*/?>", "\n", body)
body = re.sub(r"</p>", "\n\n", body)
body = re.sub(r"<[^>]+>", "", body)
body = body.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
(SRC / "muller.txt").write_text(body, encoding="utf-8")
lines = [x.strip() for x in body.splitlines() if x.strip()]
print("muller lines", len(lines))
for x in lines[:25]:
    print(repr(x[:110]))
