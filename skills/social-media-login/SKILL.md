---
name: social-media-login
description: 自动登录抖音/小红书创作者中心，抓取后台数据（播放、点赞、评论、收藏、分享、划走率、文案展开率等），用于 cheat-on-content 的复盘对答案。触发词：登录抖音、登录小红书、抓数据、抓取后台数据、对答案、复盘、查看后台数据。
---

# 社交媒体数据抓取技能（抖音 / 小红书）

## 目的

自动登录抖音 / 小红书创作者中心，抓取作品后台数据，喂给 `cheat-on-content` 做「盲预测 → 对答案 → 复盘」，让复盘不再依赖用户手动贴数据。

## 平台与工具

| 平台 | 创作者中心 | 抓取工具 |
|------|-----------|---------|
| 抖音 | `creator.douyin.com/creator-micro/content/manage` | Minis：`tools/dy_review.py`；Windows：`tools/dy_review_windows.py` |
| 小红书 | `creator.xiaohongshu.com` | 待做（数据落盘 `samples/`） |

## 抖音数据抓取

### Minis / iOS
```bash
python3 /root/bin/dy_review.py          # 抓取 + 表格 + 增量 + 自动对答案
python3 /root/bin/dy_review.py --diff   # 只看与上次快照的播放增量
```
依赖 `minis-browser-use` 内置浏览器 + `/root/bin/dy_scrape.js` 抓取器。

### Windows（本机）
```bash
pip install playwright
python tools/dy_review_windows.py              # 首次会打开 Edge 让你扫码登录，之后自动抓取
python tools/dy_review_windows.py --login-only # 只打开浏览器登录，不抓取
python tools/dy_review_windows.py --diff       # 只看与上次快照的播放增量
```
使用**系统 Edge**（`channel="msedge"`），登录态持久化到 `.auth-edge/`（已 gitignore），无需下载 Chromium。

## 登录

1. 打开创作者中心
2. 验证码登录（手机号 + 短信）或扫码登录
3. 人脸 / 滑块验证需手动完成
4. 登录态会过期（几小时到几天）；抓取返回 0 条时，重新登录一次即可

## 抓取维度

- 播放、点赞、评论、分享、收藏
- 划走率、文案展开率、平均浏览图片数、吸粉量
- 发布时间、定时状态、是否置顶、图片张数

## 数据落盘

- `workspace/data/dy_works_<YYYY-MM-DD>.json` — 抖音每次抓取的快照
- `workspace/data/prediction_registry.json` — 预测登记表（自动对答案）
- `samples/<平台>-<账号>/` — 小红书等其它平台的落盘目录

## 自动对答案

脚本会扫 `prediction_registry.json`，把到期/已到期的预测与实测对比，输出偏差百分比。
当前已校准结论：中枢 ×0.85（主锁 −13% / 主绳 −11% 两次一致偏低 11-13%）。

## 注意事项

- 遵守平台条款，抓取间隔 ≥5 分钟，避免触发风控
- 登录态过期是常态，报错先重登
- 小红书正文图需要 `xsec_token`（创作中心内部接口不需要）
