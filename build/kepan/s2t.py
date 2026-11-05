# 簡 → 繁（台灣字形：為／裡／著）：把 JSON 陣列裡的每個字串轉成繁體（opencc s2t）。
# 用法：python s2t.py names.json   （就地改寫，UTF-8）
import io, json, sys
import opencc

p = sys.argv[1]
data = json.load(io.open(p, encoding='utf-8'))
cc = opencc.OpenCC('s2tw')
out = [cc.convert(x) if isinstance(x, str) else x for x in data]
io.open(p, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False))

