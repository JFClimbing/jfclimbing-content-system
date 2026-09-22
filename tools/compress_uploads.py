#!/usr/bin/env python3
"""压缩 /var/minis/attachments/uploads 下的大图（原地替换）
目标：长边 <= 1200px，JPEG q72 —— 对"看内容"完全够用，体积能降 90%+
"""
import os
from PIL import Image

D = "/var/minis/attachments/uploads"

# 会话里出现过的文件（目录 listing 不可用，所以按名单处理）
FILES = [
    "photo_06550D0B.png", "photo_C9C2C2CF.jpeg", "photo_CF55BFB5.jpeg",
    "photo_9DD88B8B.jpeg", "photo_666BCC8C.jpeg", "photo_C2A1D110.jpeg",
    "photo_D89E20EF.jpeg", "photo_DD7F6CC1.jpeg", "photo_34EF7B1F.jpeg",
    "photo_EDFFBE6C.jpeg", "photo_A5D6C486.jpeg", "photo_CC9767CE.jpeg",
    "photo_DCCEE1F8.png", "photo_5E624093.png", "photo_BB696DEC.png",
    "photo_D43A0158.png", "photo_AFBE4B5F.png", "photo_CE65AD10.jpeg",
    "photo_CB0B9ECC.jpeg", "photo_DE9C52F6.jpeg", "photo_DC3C4751.jpeg",
    "photo_89A80389.png", "photo_9D8B7B04.png", "photo_9419CDFC.png",
    "photo_1CE1A069.png", "photo_5E624093.png",
]

MAX = 1200
before = after = 0
done = []
for n in FILES:
    p = os.path.join(D, n)
    if not os.path.exists(p):
        continue
    try:
        s0 = os.path.getsize(p)
        im = Image.open(p)
        if im.mode in ("RGBA", "P", "LA"):
            im = im.convert("RGB")
        w, h = im.size
        if max(w, h) > MAX:
            r = MAX / max(w, h)
            im = im.resize((max(1, int(w * r)), max(1, int(h * r))), Image.LANCZOS)
        newp = p.rsplit(".", 1)[0] + ".jpg"
        im.save(newp, "JPEG", quality=72, optimize=True)
        if newp != p and os.path.exists(newp):
            os.remove(p)
        s1 = os.path.getsize(newp)
        before += s0
        after += s1
        done.append((n, s0, s1))
    except Exception as e:
        print(f"  ✗ {n}: {e}")

print(f"处理 {len(done)} 个文件")
print(f"  {before/1024/1024:.1f} MB  →  {after/1024/1024:.1f} MB  "
      f"（省 {100*(1-after/max(before,1)):.0f}%）\n")
for n, a, b in sorted(done, key=lambda x: -x[1])[:12]:
    print(f"  {a/1024/1024:6.1f} MB → {b/1024:6.0f} KB   {n}")
