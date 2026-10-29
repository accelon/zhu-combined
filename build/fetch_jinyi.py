# -*- coding: utf-8 -*-
"""抓顯密文庫（xianmi.co）金剛經現代文的 31 個分頁 markdown（只留【譯語】）。

用法：python build/fetch_jinyi.py
輸出：src/jinyi-raw.json  [{sec, title, jing, yi}]
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
SRC.mkdir(exist_ok=True)
BASE = "https://www.xianmi.co/zh-tw/md/p02/e/1790/"
UA = {"User-Agent": "Mozilla/5.0"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=40).read().decode("utf-8")


index = get(BASE + "index.md")
items = re.findall(r"\d+\.\s*\[([^\]]+)\]\((\d+)/\)", index)
print("index items", len(items))

json.dump(items, open(SRC / "jinyi-index.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

out = []
for title, num in items:
    md = get(BASE + f"{num}.md")
    # 去掉 YAML front matter
    body = re.sub(r"^---[\s\S]*?\n---\n", "", md).strip()
    # 只取【譯語】：從【譯語】到【注釋】或結尾
    m = re.search(r"【譯語】([\s\S]*?)(?=【注釋】|$)", body)
    yi = m.group(1).strip() if m else ""
    m2 = re.search(r"【經文】([\s\S]*?)(?=【譯語】|【注釋】|$)", body)
    jing = re.sub(r"\s+", "", m2.group(1)) if m2 else ""
    out.append({"title": title, "num": num, "jing": jing, "yi": re.sub(r"[ \t]+", "", yi)})
    print(num, title, "yi", len(yi))

json.dump(out, open(SRC / "jinyi-raw.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote src/jinyi-raw.json", len(out))
