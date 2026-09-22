#!/usr/bin/env python3
"""生成 18 份 reconstructed prediction（事后反推，非盲预测）"""
import json
import os

BASE = "/var/minis/mounts/运营/content-lab"
IMP = os.path.join(BASE, ".cheat-cache/douyin-import")
rows = json.load(open(os.path.join(IMP, "video_index.json"), encoding="utf-8"))

# key = note id -> (ER,HP,QL,NA,AB,SR,SAT, 备注)
S = {
"7684345317802785243": (4,4,5,5,5,4,4, "D/H/O 锁系统科普，8图覆盖完整；标题给了明确范围（一期讲透三种锁）"),
"7683840639843141747": (1,3,0,1,3,2,1, "调查问卷，只有 1 张图、无信息量；话题对但形式是征集不是教学"),
"7677106626935030235": (2,3,2,1,3,3,4, "装备静物展示；「穷有穷的玩法」人格在，但没给可抄的答案"),
"7667969041302226866": (3,5,4,4,4,2,2, "绳子破损应急隔离；痛点极具体（会不会断？），步骤可复制"),
"7667856969382599398": (4,5,4,3,5,2,2, "下降器掉了怎么下降——生死场景，人人都怕；意大利半扣可复制"),
"7667607227935824238": (3,4,5,4,3,1,1, "三种抓结横向对比 + 优缺点表，QL 高但受众偏进阶"),
"7667475959138917491": (2,3,3,3,3,1,1, "双渔人结单点教学；标题有悬念但内容窄"),
"7667254236002586739": (3,5,4,4,4,1,2, "「少了半条命」威胁式钩子；双套结打法 + 使用场景"),
"7667224378807252582": (2,2,3,4,3,1,1, "追踪法八字结；标题纯技术名，无痛点无利益点"),
"7650553496135374282": (3,3,3,4,3,2,2, "龟龟下降步骤图解；中规中矩"),
"7647790779717401161": (4,4,5,5,5,3,2, "GriGri 结构 + 完整下方保护教学，引用了 vdiff 资料；覆盖最全"),
"7645309649080109450": (3,3,4,5,3,1,1, "下降转上升五步递进；技术含量高但受众窄"),
"7644971046067828186": (4,5,5,4,5,2,2, "ATC 构造 + 上方保护 + 释放操作；「避坑关键细节」获得感强"),
"7642707639805371890": (3,4,4,5,4,1,1, "ATC 下降完整流程；标题承诺「从安装到落地」"),
"7642387059416819657": (3,2,5,4,4,1,1, "ATC+8字结+双套，内容扎实但标题是技术名词堆叠，无痛点"),
"7642014311447130826": (3,4,4,4,4,2,1, "上方保护系统 + 3:1 倍力；「秘密武器」有钩子"),
"7641940241334596594": (4,5,4,5,5,2,2, "建站入门「新手第一课该学什么？」；新手刚需 + 强钩子"),
"7641557545722830922": (3,5,5,4,3,2,2, "训练板 DIY「100块搞定」——价格锚点；材料清单齐全"),
}


def short(t, n=8):
    import re
    t = re.sub(r"[#＃][^\s#＃]*", "", t)
    t = re.sub(r"[^\w\u4e00-\u9fff]+", "", t)
    return t[:n] or "untitled"


os.makedirs(os.path.join(BASE, "predictions"), exist_ok=True)
made = []

for r in rows:
    nid = r["nid"]
    er, hp, ql, na, ab, sr, sat, note = S[nid]
    comp = round((er + hp + ql + na + ab + sr + sat) / 7 * 2, 2)
    fn = f"{r['date']}_{nid}_{short(r['title'])}.md"
    p = os.path.join(BASE, "predictions", fn)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(f"""# {r['title']}

> ⚠️ **Reconstructed retrospective — NOT a blind prediction**
> 本文件由 `/cheat-init` 的历史导入流程生成。7 维分是基于**已知实绩数据 + 内容文本**反向打出的，
> **不是发布前的盲预测**，因此**不计入 `calibration_samples`**，也不能用于验证 rubric 准确性。
> 用途：给后续 `找选题` / 第一次 `升级 rubric` 提供"我的历史被怎么打分"的参照。

---

## 元数据

- **video_id / note_id**: `{nid}`
- **URL**: https://www.douyin.com/note/{nid}
- **发布时间**: {r['date']} {r['time']}
- **形态**: 图文（{r.get('imgs','?')}）
- **Rubric Version**: v0（tutorial-builder 等权占位）
- **Calibration Samples (at predict time)**: 0（reconstructed，非校准样本）
- **目标时长/篇幅**: 图文帖（N/A）

---

## 预测（Reconstructed — 事后反推）

| 维度 | 分 | 说明 |
|---|---|---|
| ER 情感共鸣 | {er} | |
| HP 钩子/需求锚定 | {hp} | |
| QL 可复制密度 | {ql} | |
| NA 递进感 | {na} | |
| AB 问题普遍性 | {ab} | |
| SR 趋势共振 | {sr} | |
| SAT 教学人格 | {sat} | |

**composite = ({er}+{hp}+{ql}+{na}+{ab}+{sr}+{sat}) / 7 × 2 = {comp}**

**打分校准备注**：{note}

**Bucket bet（事后标注）**：以 baseline 中位数 2,752 为 1× —— 实际 {r['plays']:,} = **{r['plays']/2752:.2f} ×** baseline

---

## 复盘

**实绩（抖音创作者中心）**

| 指标 | 值 |
|---|---|
| 播放 | {r['plays']:,} |
| 点赞 | {r['likes']} |
| 评论 | {r['comments']} |
| 收藏 | {r['collects']} |
| 分享 | {r['shares']} |
| 划走率 | {r['swipe_away_pct']}% |
| 文案展开率 | {r['caption_expand_pct']}% |
| 平均浏览图片数 | {r['avg_imgs_viewed']} |
| 吸粉量 | {r['new_followers']} |

> 导入自历史，无当时的盲判断可比对。
""")
    made.append((fn, comp, r['plays']))

print(f"生成 {len(made)} 份 reconstructed prediction\n")
print(f"{'composite':>9} {'播放':>7} {'倍数':>6}  文件名")
for fn, c, p in sorted(made, key=lambda x: -x[1]):
    print(f"{c:>9} {p:>7,} {p/2752:>5.2f}x  {fn[:58]}")

# 排序一致性
by_c = [x[2] for x in sorted(made, key=lambda x: -x[1])]
by_p = [x[2] for x in sorted(made, key=lambda x: -x[2])]
print(f"\n新公式排序 vs 实际排序：完全一致 {sum(1 for a,b in zip(by_c,by_p) if a==b)}/18 条同位置")
