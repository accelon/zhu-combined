import opencc, io, sys

src, dst = sys.argv[1], sys.argv[2]
s = io.open(src, encoding='utf-8').read()
s = s.replace('lang="zh-Hant"', 'lang="zh-Hans"')
out = opencc.OpenCC('t2s').convert(s)
io.open(dst, 'w', encoding='utf-8').write(out)
print('converted ->', dst)
