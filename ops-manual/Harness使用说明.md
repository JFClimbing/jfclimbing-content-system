# Harness 使用说明（DeepSeek 已接入）

> 建立于 2026-09-26 ｜ 手机端（Minis）已可调用 DeepSeek

---

## 一、装了什么

| 层 | 内容 | 状态 |
|---|---|---|
| Provider | DeepSeek（`api.deepseek.com`） | ✅ 原有 |
| 模型 | `deepseek-v4-pro`（1M 上下文）· `deepseek-flash`（支持图片输入） | ✅ 原有 |
| **模型组** | `DeepSeek · 内容系统`（新增） | ✅ **本次新建** |
| **Agent 可见** | `defaults.agentLoopGroups` 已挂上该组 | ✅ **本次开启** |

**验证方式**：`minis-model-use list` → 应返回 2 个模型。

---

## 二、为什么需要它

`cheat-on-content` 的三条不可妥协原则里，有两条**必须靠外部模型**才能成立：

| 原则 | 要求 | 之前 |
|---|---|---|
| **#1 盲预测** | 打分必须在看不到实绩的**隔离**环境里做 | ⚠️ 只能主 Agent 自估（已被污染） |
| **#2 升级 = 全量重打** | rubric 升级需**跨模型独立审核** | ❌ 做不了 |

现在两条都能做了。

---

## 三、命令

### ① 隔离盲打分（Channel B）

```bash
python3 /root/bin/cheat_blind.py <预测文件或草稿.md> --platform douyin|xhs
```

**硬隔离保证**：
- ✅ 只喂 `rubric_notes.md` / `rubric_notes-xhs.md`（公式与维度定义）
- ❌ **不喂** `rubric-memo.md`（含真实样本名 + 实绩）
- ❌ **不喂** `data/` 任何快照
- ❌ **自动砍掉**草稿里的 `## 评分` / `## 预测` / `## 复盘` 段 —— 只喂「内容快照」

**输出**：`predictions/<名字>_BLIND.md`（含模型、时间、输入 sha256、tokens）

**容错**：失败自动重试 2 次，最后降级到 `deepseek-flash`。

### ② 一键全平台数据刷新

```bash
python3 /root/bin/refresh_all.py            # 抓取 + 日报 + 同步 GitHub
python3 /root/bin/refresh_all.py --no-push  # 只抓取
```

### ③ 数据同步

```bash
python3 /root/bin/gh_sync.py push   # 内容仓（预测/脚本/手册）
python3 /root/bin/gh_data.py        # 三平台数据仓（data/douyin · xiaohongshu · wechat）
```

---

## 四、⭐ 第一次双通道对照（2026-09-26）

拿两条**已发布**的预测做回测，看两个独立通道的分歧：

| 集 | 主 Agent 自估 | **DeepSeek 盲打分** | 差值 | 分歧维度 |
|---|---:|---:|---:|---|
| 粉袋镁粉（第10集） | 8.90 | **8.29** | −0.61 | NA / SR / SAT |
| 安全带（第8集） | 8.60 | **7.40** | **−1.20** | AB / SR / SAT |

### 规律：**DeepSeek 在 SR（分享力）和 SAT（人格）上系统性更严格**

| 维度 | 我的倾向 | DeepSeek 的倾向 |
|---|---|---|
| ER / HP / QL / NA | 一致 | 一致 |
| **SR 分享力** | 常给 4–5 | **常给 3** |
| **SAT 人格** | 常给 4 | **常给 2–3** |

→ **我可能长期高估了「教学人格」和「分享力」这两个维度。**
→ 这两维恰好是 **OBS-027（composite 与实绩脱钩）** 最可疑的来源：
  如果 SR/SAT 本来就该更低，那高 composite 的样本会自然被压回合理区间。

⚠️ 样本仅 2 条，**是线索不是结论**。要等 3–5 条盲打分积累。

---

## 五、使用纪律（别破坏隔离）

1. **打分前不要让我看实绩**。如果我已经看过某集的播放数，那条就不能再用于盲打分。
2. **盲打分结果单独存** `_BLIND.md`，不要覆盖主预测文件。
3. **两个通道分歧 >1.5 分** → 说明内容判断本身不确定 → **在预测里放宽区间**，别硬给中枢。
4. **跨模型审核**（原则 #2）用的是同一个接口，但提示词不同，需另写脚本。

---

## 六、限制

- `minis-model-use` 是**同步阻塞调用**，慢（`deepseek-v4-pro` 单次 30–90 秒）
- 输入过长会超时 → 脚本已限制 rubric 3800 字 + 内容 5200 字
- **图片不能走这条线**（`deepseek-v4-pro` 只有 text_input；`flash` 支持 image_input 但本脚本未启用）
- 公众号数据仍需人工截图（微信 API 锁死）
