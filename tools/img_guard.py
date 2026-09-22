#!/usr/bin/env python3
"""img_guard.py — 图片体积守护
用法:
  python3 /root/bin/img_guard.py sweep      # 一键扫描压缩
  python3 /root/bin/img_guard.py check      # 只看不改
  python3 /root/bin/img_guard.py guard      # 前台守夜人（每3秒巡一次，30分钟后自动停）
目标：所有聊天附件 <=1200px 长边 + JPEG q75，控制在 <=200KB
"""
import os, sys, time, json, hashlib
from PIL import Image

DIRS = [
    "/var/minis/attachments",
]
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".bmp", ".tiff"}
MAX_SIDE   = 1200
QUALITY    = 75
MIN_BEFORE = 300 * 1024   # 已小于300KB的跳过
SKIP_DIM   = 1400          # 长边<=1400px的也跳过（已经是小图）

def img_files():
    """yield all image paths under DIRS"""
    for d in DIRS:
        for root, _, files in os.walk(d):
            for f in files:
                if os.path.splitext(f)[1].lower() in EXTS:
                    yield os.path.join(root, f)

def compress_one(p, dry=False):
    """compress one file; return (saved_bytes, note) or None if skipped"""
    sz = os.path.getsize(p)
    if sz < MIN_BEFORE:
        return None
    try:
        im = Image.open(p)
    except Exception as e:
        return 0, f"open error: {e}"
    w, h = im.size
    if max(w, h) <= SKIP_DIM and sz < 500*1024:
        return None  # small dim & small size: skip
    if max(w, h) > MAX_SIDE:
        r = MAX_SIDE / max(w, h)
        im = im.resize((max(1, int(w*r)), max(1, int(h*r))), Image.LANCZOS)
    if im.mode in ("RGBA", "P", "LA", "CMYK"):
        im = im.convert("RGB")
    ext = os.path.splitext(p)[1].lower()
    out_p = p
    if ext not in {".jpg", ".jpeg"}:
        out_p = os.path.splitext(p)[0] + ".jpg"
    if dry:
        return sz, f"would -> {im.size} {os.path.basename(out_p)}"
    im.save(out_p, "JPEG", quality=QUALITY, optimize=True)
    if out_p != p and os.path.exists(out_p):
        os.remove(p)
    new_sz = os.path.getsize(out_p)
    saved = sz - new_sz
    return saved, f"{sz//1024}KB->{new_sz//1024}KB {im.size} {os.path.basename(out_p)}"

def sweep(dry=False):
    total_saved = 0; count = 0; skipped = 0; errors = 0
    before_total = 0
    for p in sorted(img_files()):
        before_total += os.path.getsize(p)
        result = compress_one(p, dry=dry)
        if result is None:
            skipped += 1; continue
        saved, note = result
        if saved >= 0:
            count += 1; total_saved += saved
            if count <= 15 or saved > 2*1024*1024:
                print(f"  {'[dry] ' if dry else ''}{note}")
        else:
            errors += 1
            print(f"  err {os.path.basename(p)}: {note}")
    after_total = before_total - total_saved
    print(f"\n{'[DRY RUN] ' if dry else ''}扫描完成:")
    print(f"  处理 {count} 个文件 | 跳过 {skipped} | 错误 {errors}")
    print(f"  总体积: {before_total//1024//1024}MB → {after_total//1024//1024}MB (省 {total_saved//1024//1024}MB)")
    return count, total_saved

def guard(interval=3, timeout=1800):
    """前台守夜人：每interval秒巡检一次，timeout秒后自动停"""
    seen = set()
    # load initial seen set
    for p in img_files():
        seen.add((p, os.path.getsize(p)))
    start = time.time()
    cycle = 0
    while time.time() - start < timeout:
        time.sleep(interval); cycle += 1
        new_or_changed = []
        for p in img_files():
            sz = os.path.getsize(p)
            key = (p, sz)
            if key not in seen:
                new_or_changed.append(p)
                seen.add(key)
        if new_or_changed:
            print(f"[guard cycle {cycle}] 发现 {len(new_or_changed)} 个新/大图:")
            for p in new_or_changed:
                result = compress_one(p)
                if result and result[0] > 0:
                    print(f"  {result[1]}")
        elif cycle % 60 == 0:
            print(f"[guard cycle {cycle}] 无新图 (已巡{int(time.time()-start)}秒)")
    print(f"[guard] {timeout}秒守卫结束")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "sweep":
        sweep()
    elif cmd == "check":
        sweep(dry=True)
    elif cmd == "guard":
        guard()
    else:
        print("用法: img_guard.py [sweep|check|guard]")
