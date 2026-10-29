# -*- coding: utf-8 -*-
"""把《金剛經梵文注解》PDF 的文字層解析成逐句 JSON。"""
import json
import re
import sys
from pathlib import Path

# Windows 主控台常是 GBK，印藏文／梵文會炸；統一改用 UTF-8 輸出
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SRC = Path(__file__).with_name("pdf-text.txt")
OUT = Path(__file__).with_name("pdf-entries.json")

raw = SRC.read_text(encoding="utf-8")
# 去頁碼分隔與頁眉頁腳
lines = []
for line in raw.splitlines():
    s = line.strip()
    if s.startswith("===== PAGE"):
        continue
    if s in ("《金剛經》梵文注解", "瀋陽北塔翻譯組"):
        continue
    if re.fullmatch(r"\d{1,3}", s):
        continue
    lines.append(line.rstrip())

text = "\n".join(lines)
# 去掉 TOC 行（含 ......）
text = "\n".join(l for l in text.splitlines() if "......" not in l)

HEAD = re.compile(r"^([一二三四五六七八九十]+)、\s*(.+?分)\s*$")
ENTRY = re.compile(r"^(\d+)-(\d+)\.\s*(.*)$")
LATIN = re.compile(r"[A-Za-zāīūṛṅñṭḍṇśṣṃḥ']")

# 先切分
sections = []
cur_sec = None
buf = []
for line in text.splitlines():
    m = HEAD.match(line.strip())
    if m:
        if cur_sec is not None:
            sections.append((cur_sec, "\n".join(buf)))
        cur_sec = m.group(2)
        buf = []
    elif cur_sec is not None:
        buf.append(line)
if cur_sec is not None:
    sections.append((cur_sec, "\n".join(buf)))
print("sections:", len(sections), [s[0] for s in sections][:5])

entries = []
for sec_i, (title, body) in enumerate(sections, 1):
    blines = body.splitlines()
    idx = []
    for i, line in enumerate(blines):
        m = ENTRY.match(line)
        if m and LATIN.search(m.group(3)):
            idx.append((i, m))
    for k, (i, m) in enumerate(idx):
        end = idx[k + 1][0] if k + 1 < len(idx) else len(blines)
        block = blines[i:end]
        # 梵文（含續行）
        sa_parts = [m.group(3).strip()]
        j = 1
        while j < len(block) and not block[j].lstrip().startswith(("[", "【")):
            if block[j].strip():
                sa_parts.append(block[j].strip())
            j += 1
        sa = " ".join(sa_parts)
        rest = "\n".join(block[j:])
        def grab(label):
            # 停在下一行 [標籤] 或任何位置的【注】【解】；有些條目的【注】同一行開始，
            # 只用 \n【 會把整段詞性分析併進藏譯（2-4、17-23 就是這樣）。
            mm = re.search(r"\[" + label + r"\]\s*([\s\S]*?)(?=\n\[|\n?【|$)", rest)
            if not mm:
                return ""
            return re.sub(r"\s+", "", mm.group(1))
        shi = grab("什譯")
        zang = grab("奘譯")
        jing = grab("凈譯")
        tib = grab("藏譯")
        note = ""
        mnote = re.search(r"【注】\s*([\s\S]*?)(?=\n【解】|$)", rest)
        if mnote:
            note = mnote.group(1).strip()
        mjie = re.search(r"【解】\s*([\s\S]*?)$", rest)
        jie = mjie.group(1).strip() if mjie else ""
        entries.append({
            "sec": sec_i, "secTitle": title, "no": f"{m.group(1)}-{m.group(2)}",
            "sa": re.sub(r"\s+", " ", sa).strip(),
            "shi": shi, "zang": zang, "jing": jing, "tib": tib,
            "note": note, "jie": jie,
        })

print("entries:", len(entries))
print("first:", json.dumps(entries[0], ensure_ascii=False)[:300])
print("target:", [e for e in entries if e["no"] == "7-5"])
missing = [e["no"] for e in entries if not e["shi"]]
print("missing 什譯:", len(missing), missing[:10])
OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
print("wrote", OUT)
