# -*- coding: utf-8 -*-
"""把 Conze 英譯 PDF 的文字層抽出來。"""
from pypdf import PdfReader
import sys

src = sys.argv[1] if len(sys.argv) > 1 else 'vendor/pdf/conze.pdf'
out = sys.argv[2] if len(sys.argv) > 2 else 'conze-raw.txt'

r = PdfReader(src)
pages = []
for i, p in enumerate(r.pages, 1):
    pages.append(f"===== PAGE {i} =====\n" + (p.extract_text() or ''))
t = "\n".join(pages)
open(out, 'w', encoding='utf-8').write(t)
print('pages', len(r.pages), 'chars', len(t))
