# JFClimbing Content System

> 📊 骄峰攀岩内容预测系统 —— 把感觉变成可校准预测

一套完整的抖音/小红书内容预测与运营工具包。AI 在任何平台（Claude / GPT / Minis / 自建）上都能复现。

---

## 🚀 快速开始（给新 AI 的 prompt）

```
你是「骄峰」的内容预测助手。请按以下顺序执行：

1. 读 skills/cheat-on-content/SKILL.md 了解方法论
2. 读 skills/cheat-on-content/skills/cheat-init/SKILL.md 初始化项目
3. 读 workspace/rubric_notes.md 了解评分标准
4. 读 workspace/benchmark.md 了解对标账号
5. 读 workspace/predictions/ 下的历史预测（按日期从旧到新）
6. 对每个新脚本：先打分 → 再预测 → 发布后复盘

一句话：你是一个内容预测机器，用 rubric 打分，用历史数据校准，用复盘进化公式。
```

---

## 📦 仓库结构

```
├── skills/
│   ├── cheat-on-content/     # 核心：打分 → 预测 → 复盘 → 升级 rubric
│   │   ├── SKILL.md          # 总协议 + 路由表
│   │   ├── skills/           # 子 skill（init/predict/score/retro/bump...）
│   │   ├── starter-rubrics/  # 各形态先验 rubric
│   │   ├── templates/        # 预测/复盘/候选人模板
│   │   ├── shared-references/ # 原则（盲预测/升级验证/观察生命周期）
│   │   ├── migrations/       # schema 升级路径
│   │   ├── adapters/         # 数据源适配器（抖音/热点）
│   │   └── hooks/            # 预测不可变性强制钩子
│   └── image-compression/    # 图片压缩技能（会话体积管理）
│       └── SKILL.md
├── tools/
│   ├── img_guard.py          # 附件自动压缩（sweep/check/guard 模式）
│   ├── make_predictions.py   # 预测生成器
│   ├── dy_review.py          # 抖音数据复盘（需要浏览器登录态）
│   ├── gen_candidates.py     # 候选选题生成
│   └── build_videos.py       # 视频构建工具
├── workspace/
│   ├── .cheat-state.json     # 项目状态（校准池数量/baseline/rubric版本）
│   ├── rubric_notes.md       # 当前 rubric（教程型，已校准25+样本）
│   ├── rubric_notes-xhs.md   # 小红书版 rubric
│   ├── rubric-memo.md        # 观察池（18条已验证假设）
│   ├── candidates.md         # 候选选题池
│   ├── benchmark.md          # 对标：杨秉润YANG（5条已拆解）
│   ├── STATUS.md             # 看板
│   ├── data/
│   │   └── prediction_registry.json  # 预测登记（9条，自动对答案）
│   └── predictions/          # 23份历史预测（含复盘数据）
│       ├── 2026-05-19_攀岩训练板diy.md  （第1份）
│       ├── ...
│       └── 2026-09-22_第08集_安全带.md  （最新）
├── scripts/                  # 脚本（12集内容）
│   ├── 第00集 ~ 第11集_*.md  # 逐集脚本（标题/正文/逐张图/标签）
│   ├── 发布包_总表.md         # 一页总表（发布时间/标题/简介/标签）
│   └── 发布排期-4周.md        # 排期逻辑 + 素材清单
├── ops-manual/               # 运营手册
│   ├── 标签规范.md           # 三层标签法（大词+精准词+人群词）
│   ├── 互动引导规范.md       # CTA 三件套
│   ├── 数据复盘自动化.md     # 自动对答案 SOP
│   └── ...（获客/小红书/粉丝群/术语等）
└── docs/
    └── 合集-攀岩装备基础篇.md # 合集设计文档（保护链框架）
```

---

## 🎯 核心方法论

### 预测循环

```
打分（7维度 × 0-5）→ 综合分 → 盲预测 → 发布 → T+3d 复盘 → 升级 rubric
```

### 7 维评分标准（教程型）

| 维度 | 含义 | 权重 |
|---|---|---|
| ER | 告知感 — "原来这么简单" 的顿悟 | 等权 |
| HP | 钩子力 — 10秒内确认"找对了" | 等权 |
| QL | 实用密度 — 能直接用的清单/步骤 | 等权 |
| NA | 递进感 — 从简到难的弧线 | 等权 |
| AB | 受众宽度 — 问题有多少人会遇到 | 等权 |
| SR | 分享力 — 转发给朋友的理由 | 等权 |
| SAT | 满意度 — 跟完后的感觉 | 等权 |

**公式**: composite = (ER+HP+QL+NA+AB+SR+SAT) / 7 × 2.0 → 0-10

### 三条铁律

1. **盲预测不可变** — 写完就不能改，只能追加复盘
2. **升级 = 全量重打** — rubric 变了，所有有实绩的样本重打分
3. **rubric 是工作台** — 被推翻的观察删掉，不保留考古层

---

## 📈 已校准数据

| 指标 | 值 | 来源 |
|---|---|---|
| 账号基线 | 2,883 播放（中位数） | 18条已发 |
| 预测偏差 | 中枢偏高 11-13% | 主锁(-13%)/主绳(-11%) 实测 |
| 校准系数 | ×0.85 | 两条实测的均值 |
| 最强标题模式 | 避坑型 3-5× > 装备名型 | OBS-016（已支持） |
| 最优张数 | 8张 | 划走率48.9% vs 10张52.9% |
| 最强钩子结构 | 五检查点/清单型 | 安全带预测8.6分 |

---

## 🔧 如何在新平台上使用

### 方法 A：直接喂给 AI（最简单）

把整个仓库 clone 下来，然后给 AI 说：

```
请阅读 skills/cheat-on-content/SKILL.md，然后用 workspace/rubric_notes.md 的标准
对 scripts/第09集_攀岩鞋.md 进行打分和预测。参考 workspace/predictions/ 下的历史预测格式。
```

### 方法 B：用 Python 脚本

```bash
# 图片压缩（防止会话超限）
python3 tools/img_guard.py sweep

# 检查附件大小
python3 tools/img_guard.py check
```

### 方法 C：初始化新项目

```bash
# 在新 AI 上初始化 cheat-on-content
# 读 skills/cheat-on-content/skills/cheat-init/SKILL.md 按提示操作
# 它会在 workspace/ 下创建 .cheat-state.json 和初始 rubric
```

---

## 📊 预测登记表（当前9条）

| ID | 内容 | 发布 | 播放预测 | 状态 |
|---|---|---|---|---|
| ep00 | 入门装备全景 | 09-18 | 5,000 | ✅ 实际1,315 ❌ |
| ep01 | 主锁科普 | 09-12 | 9,751 | ✅ 实际8,478 ⚠️-13% |
| ep02 | 主绳辅绳 | 09-15 | 3,600 | ✅ 实际3,198 ⚠️-11% |
| ep03 | 保护器 | 09-20 | 6,000 | ⏳ 待验证 |
| ep04 | 快挂 | 09-22 | 5,500 | ⏳ 待验证 |
| ep05 | 扁带 | 09-24 | 5,200 | ⏳ 待验证 |
| ep06 | 牛尾/自保 | 09-26 | 3,500 | 📝 预测已写 |
| ep07 | 头盔 | 09-28 | 4,200 | 📝 预测已写 |
| ep08 | 安全带 | 09-30 | 5,800 | 📝 预测已写 |

---

## 🛠 环境要求

- **Python 3.10+** + Pillow（图片处理）
- **可选**: 浏览器自动化（抖音数据抓取需要登录态）
- **任意 AI 平台**: Claude / GPT / Minis / 自建 — 方法论不依赖特定平台

---

## 📝 License

MIT — 随便用。

JFClimbing / 骄峰 Rock Climber · 2026
