# 指力训练 · Hangboard Timer

> 一个单页的指力板（fingerboard）训练计时器。
> 打开即用，可加到手机主屏当 App。

---

## 在线使用

部署后地址形如：`https://<github用户名>.github.io/jf-hangboard/`

---

## 功能

### 训练法预设

| 预设 | 数值 |
|---|---|
| Repeaters 7:3（经典） | 7秒悬挂 / 3秒休息 / 6次 × 3组 / 组间3分 |
| Repeaters 10:5 | 10 / 5 / 6 × 3 / 组间3分 |
| Max Hangs 10s | 10秒悬挂 / 休3分 / 1次 × 5组 |
| Abrahangs | 7 / 3 / 6 × 6组 |
| Density 5:5 | 5 / 5 / 10 × 3 / 组间2分 |
| 入门 6:4 | 6 / 4 / 5 × 3 / 组间2.5分 |
| 自定义 | 全部参数可调 |

### 可调参数

- **单次悬挂** 1–60 秒
- **间隔休息** 1–120 秒
- **循环次数**（每组几次）1–20
- **组数** 1–12
- **组间休息** 10–600 秒
- **开始热身** 0–900 秒
- **结尾放松** 0–900 秒
- **开始倒数** 0–15 秒

### 动作轮换

可自定义动作列表（开握 / 半抠 / 全抠 / 捏握 / 口袋 …），**每次悬挂自动轮换**，屏幕上显示当前该用哪个握法。

### 提示

- **提示音**：阶段切换、最后 3 秒倒数
- **震动**：需要手机支持
- **屏幕常亮**：训练中不自动锁屏（Wake Lock API）

### 训练记录

完成的训练自动存本地（localStorage），显示最近 8 次：日期 / 训练法 / 组×次×秒 / 总时长。

### 快捷键（电脑端）

- `空格` 开始 / 暂停
- `R` 重置
- `→` 跳过当前阶段

---

## 技术说明

### 为什么用「绝对时间戳」而不是计数器

早期版本用 `requestAnimationFrame` 累加时间，结果：

- **手机锁屏 / 切到后台时，rAF 会被系统暂停** → 计时器停住，回来时时间不准
- 普通 `setInterval` 累加也会因节流丢失时间

现在改成：**记录每个阶段的绝对结束时刻 `segEndAt`**，
每次 tick 用 `(segEndAt - now)` 反算剩余。即使被节流，回来后立即校准到真实进度。

### 文件

```
index.html     结构 + 样式
app.js         全部逻辑
manifest.json  PWA 配置（可加到主屏）
icon-*.png     图标
```

无任何依赖，纯静态。可直接双击 `index.html` 本地打开。

---

## 部署到 GitHub Pages

```bash
# 1. 建仓库（public）
gh repo create <用户名>/jf-hangboard --public --description "指力训练计时器"

# 2. 推文件
git init && git add . && git commit -m "init"
git remote add origin https://github.com/<用户名>/jf-hangboard.git
git branch -M main && git push -u origin main

# 3. 开启 Pages
gh api -X POST repos/<用户名>/jf-hangboard/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

**地址：** `https://<用户名>.github.io/jf-hangboard/`

### 加到手机主屏（iPhone）

Safari 打开网址 → 分享 → **添加到主屏幕**

之后像 App 一样全屏打开，没有浏览器地址栏。

---

## 训练建议（不是医疗建议）

| 水平 | 建议 |
|---|---|
| 完全新手 | 先练 2–3 个月基础，指力板容易伤手指 |
| 入门 | 入门 6:4 低强度，每周 2 次，中间隔 48 小时 |
| 进阶 | Repeaters 7:3，每周 2–3 次 |
| 力量期 | Max Hangs，组间充分休息（3 分钟以上） |

**⚠️ 手指肌腱恢复很慢。疼就停，别硬撑。**
