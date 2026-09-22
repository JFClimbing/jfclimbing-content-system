#!/usr/bin/env python3
"""把笔记图片/OCR 与创作者中心的作品数据合并，建 videos/ + predictions/ 结构"""
import json
import os
import re
import shutil

BASE = "/var/minis/mounts/运营/content-lab"
IMP = os.path.join(BASE, ".cheat-cache/douyin-import")
NOTES = os.path.join(IMP, "notes")

works = json.load(open(os.path.join(IMP, "works.json"), encoding="utf-8"))

# 笔记顺序（新→旧），与 works 顺序一一对应；最后一条为额外项
note_ids = [l.strip() for l in open(os.path.join(IMP, "note_ids.txt"), encoding="utf-8") if l.strip()]

if len(works) != 18 or len(note_ids) < 18:
    print(f"⚠️ works={len(works)} notes={len(note_ids)}")


def short(t, n=8):
    t = re.sub(r"[#＃][^\s#＃]*", "", t)
    t = re.sub(r"[^\w\u4e00-\u9fff]+", "", t)
    return t[:n] or "untitled"


def slug_to_folder(rec, nid):
    return f"{rec['date']}_{nid}_{short(rec['title'])}"


rows = []
os.makedirs(os.path.join(BASE, "videos"), exist_ok=True)

for i, rec in enumerate(works):
    nid = note_ids[i] if i < len(note_ids) else ""
    folder = slug_to_folder(rec, nid)
    vdir = os.path.join(BASE, "videos", folder)
    os.makedirs(vdir, exist_ok=True)

    # script.md = 文案(caption) + 图片 OCR 文本
    nd = os.path.join(NOTES, nid) if nid else ""
    slide = ""
    if nd and os.path.exists(os.path.join(nd, "slide_text.md")):
        slide = open(os.path.join(nd, "slide_text.md"), encoding="utf-8").read()

    with open(os.path.join(vdir, "script.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# {rec['title']}\n\n")
        fh.write(f"> **来源**：抖音图文 · note `{nid}`\n")
        fh.write(f"> **发布**：{rec['date']} {rec['time']}\n")
        fh.write(f"> **图片数**：{rec.get('imgs','?')}\n")
        fh.write("> **说明**：图文帖没有脚本，正文 = 文案 + 图片文字。两者都在下面。\n\n")
        fh.write("---\n\n## 一、文案（caption，作者原文）\n\n")
        fh.write(rec["title"].strip() + "\n\n")
        fh.write("---\n\n## 二、图片文字（Vision OCR）\n\n")
        fh.write(slide.strip() or "（无）")
        fh.write("\n")

    # report.md = 实绩数据
    with open(os.path.join(vdir, "report.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# 实绩报告 — {short(rec['title'], 20)}\n\n")
        fh.write(f"- **note id**: `{nid}`\n")
        fh.write(f"- **url**: https://www.douyin.com/note/{nid}\n")
        fh.write(f"- **发布时间**: {rec['date']} {rec['time']}\n")
        fh.write(f"- **数据源**: 抖音创作者中心（adapter=内置浏览器）\n\n")
        fh.write("| 指标 | 值 |\n|---|---|\n")
        fh.write(f"| 播放 | {rec['plays']:,} |\n")
        fh.write(f"| 点赞 | {rec['likes']} |\n")
        fh.write(f"| 评论 | {rec['comments']} |\n")
        fh.write(f"| 收藏 | {rec['collects']} |\n")
        fh.write(f"| 分享 | {rec['shares']} |\n")
        fh.write(f"| 划走率 | {rec['swipe_away_pct']}% |\n")
        fh.write(f"| 文案展开率 | {rec['caption_expand_pct']}% |\n")
        fh.write(f"| 平均浏览图片数 | {rec['avg_imgs_viewed']} |\n")
        fh.write(f"| 吸粉量 | {rec['new_followers']} |\n")

    rows.append({"folder": folder, "nid": nid, **rec})

json.dump(rows, open(os.path.join(IMP, "video_index.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

print(f"建了 {len(rows)} 个 videos/ 子目录\n")
for r in rows:
    print(f"  {r['folder'][:46]:<48} 播放 {r['plays']:>6,}  划走 {r['swipe_away_pct']:.1f}%")
