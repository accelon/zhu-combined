# -*- coding: utf-8 -*-
"""把 Conze PDF 的梵／英交錯段落切成 block。

PDF 排版是「一段梵文、一段英文」交替。逐行判斷梵／英（stopword 計分），
同型連行合併成 block；偈頌的短行直接以原文字串指定（只有 3 首偈）。
輸出 conze-blocks.json：[{n, type: 'sa'|'en', page, text}]
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "conze-raw.txt"
OUT = ROOT / "conze-blocks.json"

SA_MARK = re.compile(
    r"\b(iti|tat|tatra|atha|bhagav[aā]n?|subhūt[iḥ]r?|subhute|dharm[aā]|"
    r"khalu|punaḥ|yāvad|na|ca|api|sma|aha|avocat|bhavati|bhaviṣyanti|"
    r"tathāgat[aā]|bodhisattv[aā]|prajñāpāramitā|śrāvastyāṃ|sattvā|"
    r"kasy[aā]|hetoḥ|manyase|ukta|evam|idam|sa|te|tad)\b",
    re.I,
)
EN_MARK = re.compile(
    r"\b(the|of|and|is|are|to|in|with|that|which|he|his|as|be|not|will|"
    r"should|would|was|were|have|has|had|it|its|they|them|their|but|for|from|by|"
    r"this|these|those|who|whom|when|then|there|what|do|does|did|can|cannot|could|"
    r"may|might|must|so|if|or|at|on|into|all|any|no|one|only|also|even|yet|"
    r"therefore|because|thus|said|replied|asked|lord|subhuti)\b",
    re.I,
)

VERSE = {
    # 1
    "Ye mam rupena ca-adraksur": "sa",
    "Ye mam ghosena ca-anvayuh": "sa",
    "Mithya-prahana-prasrta": "sa",
    "Na mam draksyanti te janah": "sa",
    "Those who by my form did see me,": "en",
    "And those who followed me by voice": "en",
    "Wrong the efforts they engaged in,": "en",
    "Me those people will not see.": "en",
    # 2
    "Dharmato Buddha drastavya": "sa",
    "Dharmakaya hi nayakah": "sa",
    "Dharmata ca na vijneya": "sa",
    "Na sa sakya vijanitum.": "sa",
    "From the Dharma should one see the Buddhas,": "en",
    "From the Dharmabodies comes their guidance.": "en",
    "Yet Dharma's true nature cannot be discerned,": "en",
    "And no one can be conscious of it as an object.": "en",
    # 3
    "Taraka timiram dipo": "sa",
    "Maya-avasyaya budbudam": "sa",
    "Supinam vidyud abhram ca": "sa",
    "Evam drastavyam samskrtam.": "sa",
    "As stars, a fault of vision, as a lamp,": "en",
    "A mock show, dew drops, or a bubble,": "en",
    "A dream, a lightning flash, or cloud,": "en",
    "So should one view what is conditioned.": "en",
}


def classify(line: str, prev: str) -> str:
    s = line.strip()
    if s in VERSE:
        return VERSE[s]
    sa = len(SA_MARK.findall(s))
    en = len(EN_MARK.findall(s))
    if en > sa:
        return "en"
    if sa > en:
        return "sa"
    return prev or "sa"


def main():
    lines = RAW.read_text(encoding="utf-8").splitlines()
    for i, ln in enumerate(lines):
        if ln.strip().startswith("Om namo"):
            lines = lines[i:]
            break
    for i, ln in enumerate(lines):
        if ln.strip().startswith("Aus:"):
            lines = lines[:i]
            break

    # 前段英文尾巴黏在新段梵文前：先拆行
    split_lines = []
    for ln in lines:
        s = ln.rstrip()
        m = re.match(r"^([a-z][^.]{0,40}[.!?])\s+((?:Tat|Evam|Atha|Yas|Yo|Na|Api|Bhagavan|Tena|Punar|Sacet|Saced|Iha)\b.*)$", s.strip())
        if m:
            split_lines.append(m.group(1))
            split_lines.append(m.group(2))
        else:
            split_lines.append(s)

    blocks, cur_type, page0, buf = [], None, 1, []
    cur_page, prev_type = 1, None
    for ln in split_lines:
        m = re.match(r"===== PAGE (\d+) =====", ln.strip())
        if m:
            cur_page = int(m.group(1))
            continue
        s = ln.strip()
        if not s:
            continue
        t = classify(s, prev_type)
        prev_type = t
        if t != cur_type:
            if buf:
                blocks.append({"type": cur_type, "page": page0, "lines": buf})
            buf = [s]
            cur_type = t
            page0 = cur_page
        else:
            buf.append(s)
    if buf:
        blocks.append({"type": cur_type, "page": page0, "lines": buf})

    out = []
    for i, b in enumerate(blocks, 1):
        text = " ".join(b["lines"])
        text = re.sub(r"(\w)- (\w)", r"\1-\2", text)
        out.append({"n": i, "type": b["type"], "page": b["page"], "text": text})

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    print("blocks", len(out), Counter(b["type"] for b in out))
    for b in out[:6]:
        print(b["n"], b["type"], b["page"], b["text"][:90])
    print("...")
    for b in out[-4:]:
        print(b["n"], b["type"], b["page"], b["text"][:90])


if __name__ == "__main__":
    main()
