import sys
from PIL import Image
import numpy as np

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.array(im)
bg = a[-1, 0].astype(int)
diff = np.abs(a.astype(int) - bg).sum(axis=2)
rows = np.where(diff.max(axis=1) > 6)[0]
last = int(rows.max()) + 1 if len(rows) else a.shape[0]
crop = im.crop((0, 0, im.width, min(last + 24, im.height)))
pad = Image.new('RGB', (crop.width, crop.height + 36), (251, 248, 240))
pad.paste(crop, (0, 0))
pad.save(out, quality=90, optimize=True, progressive=True)
print(out, pad.size)
