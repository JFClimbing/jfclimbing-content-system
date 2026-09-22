---
name: image-compression
description: 自动压缩上传图片，避免会话体积超过32MB限制。触发词：压缩图片、图片太大、会话超限、32MB、上传失败、对话体积。
---

# 图片压缩技能（v2 · 2026-09-22）

## 问题本质

Minis 每次发消息时，App 会把 **当前会话的全部历史消息（含历史图片）** 发给模型。每张进入会话的图片都会占用请求体积，且 **一旦进历史就无法缩减**（压缩磁盘文件对已有会话无效）。

**三层防护**：
1. **压缩磁盘** → 新会话引用的图片更小（已有会话的历史不受影响）
2. **少发/分批** → 每次2-3张，控制进入历史的图片数量
3. **适时换会话** → 会话变重了就开新的，用交接文件续接

## 工具

### `/root/bin/img_guard.py` — 一键压缩（推荐，取代 rz.py）
```bash
# 扫描压缩所有 /var/minis/attachments/ 下的大图（>=300KB 或长边>1400px）
python3 /root/bin/img_guard.py sweep

# 只检查不改动
python3 /root/bin/img_guard.py check

# 前台守卫（每3秒巡检 uploads 目录，新图自动压缩）
python3 /root/bin/img_guard.py guard
```
- 目标：长边 ≤1200px，JPEG q75
- 覆盖 attachments 全目录（uploads + 根目录 UUID 文件）
- 幂等：已小的图不重复压

### `/root/bin/rz.py` — 旧工具（仅压缩已知名单，不推荐新用）

## 自动执行协议

**以下场景自动触发 `img_guard.py sweep`（不需要用户提醒）**：
1. **每次新会话** 首次回复前 — 扫一次 attachments
2. **用户发送/提到图片后** — 立即压缩当前批次
3. **用户说「压缩图片」「图片太大」「32MB」** — 立即运行

**压缩完成后顺手做**：
```bash
# 看看会话有没有积累太多 read_image
minis-sessions-cli status --id <当前session>
```

## 工作流程

### 用户通过聊天发图（attachments）
1. 收到图 → 跑 `img_guard.py sweep`
2. 用压缩后的版本做 read_image / 视觉审阅
3. 单次聊天不超过 **2-3 张图**，超过则分批

### 用户通过文件夹传图（mount 目录）
这是 **最安全的流程** — 图片不进会话历史，我从磁盘读即可：
1. 她把设计稿丢进 `运营/content-lab/videos/第XX集_xxx/img/`（或 `_待审/`）
2. 我先做 contact sheet（~60KB 缩略拼图）做全览
3. 细看时只读需要的那张（≤1200px），避免读原图
4. 审完后删临时文件

### 会话快要超限时
1. 告知用户：「这个会话快重了，我帮你在下个会话准备好交接」
2. 更新 `运营手册/会话交接.md`（当前状态/进度/待办）
3. `minis-sessions-cli send` 自动创建新会话并跳转
4. 新会话读交接文件恢复上下文

## 用户侧建议

1. **优先走文件夹**：设计稿/截图 → 运营目录 → 告诉我「图好了」
   比在对话框发图安全10倍（不占会话体积）
2. **聊天发图 2-3 张一批**：看一批→再发下一批
3. **不要重复发同一批图**
4. **大文件别直接发**：3024×4032 原图 15MB → 压缩后 200KB
   → 之后我帮压，别自己压缩（省你的操作）

## 底层命令

```bash
# 查看 attachments 总量与大文件
du -sh /var/minis/attachments /var/minis/attachments/uploads
find /var/minis/attachments -type f -exec du -k {} \; | sort -rn | head -10

# 查看当前会话 ID + 消息数
minis-sessions-cli list --limit 1

# 一次性看 attachments 大小分布
find /var/minis/attachments -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \) \
  -exec du -k {} \; | awk '{k=$1; if(k>2000) big++; else if(k>500) mid++; else small++} END{print big" 大(>2MB)," mid" 中(500K-2MB)," small" 小(<500K)"}'
```

minis_url: minis://skills/image-compression/SKILL.md