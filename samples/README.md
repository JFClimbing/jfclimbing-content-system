# samples/

抓取落盘目录，按「平台-账号」分目录存放。

```
samples/
├── 抖音-骄峰/        # 抖音抓取的原始数据（亦可放 workspace/data/ 快照的副本）
└── 小红书-骄峰/      # 小红书笔记数据 + 图片 OCR 文本
```

- 抖音快照默认写到 `workspace/data/dy_works_<日期>.json`（见 `tools/dy_review.py` / `dy_review_windows.py`）。
- 小红书数据落盘到 `samples/小红书-<账号>/notes.md`。
