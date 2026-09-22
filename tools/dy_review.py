#!/usr/bin/env python3
"""抖音作品数据 · 一键抓取 + 对答案

用法:
  python3 /root/bin/dy_review.py            # 抓取 + 对比上次快照 + 出报告
  python3 /root/bin/dy_review.py --save     # 抓取并存快照
  python3 /root/bin/dy_review.py --diff     # 只看与上次快照的差异
  python3 /root/bin/dy_review.py --table    # 打印全量表格

数据落盘: content-lab/data/dy_works_<YYYY-MM-DD>.json
"""
import json, os, re, subprocess, sys, glob, datetime

ROOT = "/var/minis/mounts/运营/content-lab"
DATA = ROOT + "/data"
PRED = ROOT + "/predictions"
JS = "/root/bin/dy_scrape.js"
REG = DATA + "/prediction_registry.json"
URL = "https://creator.douyin.com/creator-micro/content/manage"
os.makedirs(DATA, exist_ok=True)

METRIC_ORDER = ["播放", "点赞", "评论", "分享", "收藏", "划走率",
                "文案展开率", "平均浏览图片数", "吸粉量"]


# ───────────── 抓取 ─────────────
def _json_from_text(s):
    """minis-browser-use 的 text 尾部会附 '\n  tab_id: N'，要剥掉"""
    dec = json.JSONDecoder()
    s = s.strip()
    return dec.raw_decode(s)[0]


def scroll_load(n=14, amount=800, pause=0.8):
    """列表懒加载：反复向下滚，触发更多卡片渲染"""
    import time
    for _ in range(n):
        subprocess.run(["minis-browser-use", "scroll",
                        "--direction", "down", "--amount", str(amount)],
                       capture_output=True, timeout=60)
        time.sleep(pause)


def scrape(retries=2):
    subprocess.run(["minis-browser-use", "navigate", "--url", URL],
                   capture_output=True, timeout=90)
    import time as _t; _t.sleep(5)
    scroll_load()
    for _ in range(retries + 1):
        r = subprocess.run(["minis-browser-use", "execute_js", "--script",
                            open(JS, encoding="utf-8").read()],
                           capture_output=True, text=True, timeout=120)
        try:
            o = json.loads(r.stdout)
            inner = _json_from_text(o["data"]["text"])
            if inner.get("count"):
                return inner
            print("   ⚠️ 抓到 0 条，重试…")
        except Exception as e:
            print("   ⚠️ 解析失败:", e)
        import time; time.sleep(5)
    raise SystemExit("❌ 抓取失败 —— 可能登录态过期，需重新登录创作者中心")


# ───────────── 解析 ─────────────
def parse(cards):
    out = []
    for c in cards:
        lines = [x.strip() for x in c["head"].split("\n") if x.strip()]
        pinned = False
        n_img = None
        title = c.get("title") or ""
        for ln in lines:
            if ln == "置顶":
                pinned = True
            elif re.fullmatch(r"\d+张", ln):
                n_img = int(ln[:-1])
            elif not title:
                title = ln
        m = {k: c["metrics"].get(k, "-") for k in METRIC_ORDER}
        out.append({
            "title": title[:120],
            "date": c["date"],
            "sched": c["sched"],
            "status": c["status"],
            "pinned": pinned,
            "images": n_img,
            "raw": {k: m[k] for k in METRIC_ORDER},
        })
    return out


def num(v):
    try:
        return float(str(v).replace("%", "").replace(",", "").replace("万", "0000"))
    except Exception:
        return None


# ───────────── 快照 ─────────────
def save(posts):
    today = datetime.date.today().isoformat()
    p = f"{DATA}/dy_works_{today}.json"
    json.dump(posts, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"   💾 已存 {p}")
    return p


def last_snapshot(exclude=None):
    fs = sorted(glob.glob(f"{DATA}/dy_works_*.json"))
    fs = [f for f in fs if f != exclude]
    return json.load(open(fs[-1], encoding="utf-8")) if fs else None


# ───────────── 报告 ─────────────
def key(p):
    return (p["title"] or "")[:16]


def print_table(posts):
    print(f"\n{'日期':<12}{'张':>3}{'播放':>8}{'赞':>6}{'评':>5}{'享':>5}{'藏':>5}"
          f"{'划走':>8}{'展开':>8}{'浏览':>6}{'吸粉':>6}  标题")
    for p in posts:
        r = p["raw"]
        d = (p["date"] or p["sched"] or "")[:10]
        print(f"{d:<12}{str(p['images'] or '-'):>3}{r['播放']:>8}{r['点赞']:>6}"
              f"{r['评论']:>5}{r['分享']:>5}{r['收藏']:>5}{r['划走率']:>8}"
              f"{r['文案展开率']:>8}{r['平均浏览图片数']:>6}{r['吸粉量']:>6}  {p['title'][:22]}")


def print_diff(old, new):
    om = {key(p): p for p in old}
    print("\n" + "=" * 72)
    print("📈 与上次快照的差异（播放增量）")
    print("=" * 72)
    for p in new:
        k = key(p)
        if k in om:
            a, b = num(om[k]["raw"]["播放"]), num(p["raw"]["播放"])
            if a is not None and b is not None and b != a:
                d = b - a
                print(f"  {p['title'][:26]:<28} {a:>7.0f} → {b:>7.0f}  ({d:+.0f})")
        else:
            print(f"  🆕 {p['title'][:30]}  播放 {p['raw']['播放']}")



# ───────────── 自动对答案 ─────────────
def auto_check(posts, force=False):
    """扫登记表，把到期/已到期的预测与实测对比"""
    if not os.path.exists(REG):
        return
    reg = json.load(open(REG, encoding="utf-8"))
    today = datetime.date.today().isoformat()
    due = [it for it in reg["items"]
           if it["status"] == "pending" and it["check_at"] <= today]
    if force:
        due = [it for it in reg["items"] if it["status"] == "pending"]
    if not due:
        return
    print("\n" + "=" * 72)
    print("🎯 自动对答案")
    print("=" * 72)
    for it in due:
        hit = None
        for p in posts:
            if it["match"] in p["title"]:
                hit = p
                break
        if not hit:
            print(f"\n⏳ {it['title']}  —— 还没发（计划 {it['published']}）")
            continue
        print(f"\n📌 {it['title']}   （对答案日 {it['check_at']}）")
        for mk, pred in it["metrics"].items():
            act = hit["raw"].get(mk, "-")
            rng = (it.get("range") or {}).get(mk)
            ok = ""
            an = num(act)
            if isinstance(pred, (int, float)) and an is not None:
                dev = (an - pred) / pred * 100
                ok = f"  偏差 {dev:+.1f}%"
                if rng and not (rng[0] <= an <= rng[1]):
                    ok += "  ❌ 出区间"
                elif rng:
                    ok += "  ✅ 在区间"
            print(f"     {mk:<8} 预测 {str(pred):<8} 实测 {str(act):<8}{ok}")
        print(f"     其他实测：" + " · ".join(
            f"{k} {hit['raw'][k]}" for k in ["点赞", "分享", "收藏", "划走率"]
            if k not in it["metrics"]))
    print("\n" + "=" * 72)
    print("说明：本次已打印的条目仍为 pending —— 确认无误后把 registry 里 status 改成 done")
    print("=" * 72)


# ───────────── 主流程 ─────────────
if __name__ == "__main__":
    args = sys.argv[1:]
    if "--diff" in args:
        posts = parse(scrape()["cards"]); print_diff(last_snapshot(), posts)
        sys.exit(0)

    print("📡 正在抓取抖音创作者中心…")
    inner = scrape()
    posts = parse(inner["cards"])
    print(f"   ✅ 抓到 {len(posts)} 条作品")
    path = save(posts)

    if "--table" in args or True:
        print_table(posts)

    auto_check(posts, force="--force-check" in args)

    old = last_snapshot(exclude=path)
    if old:
        print_diff(old, posts)

    # 汇总
    pub = [p for p in posts if p["status"] == "published"]
    plays = [num(p["raw"]["播放"]) for p in pub if num(p["raw"]["播放"])]
    sch = [p for p in posts if p["status"] == "scheduled"]
    if plays:
        plays_sorted = sorted(plays)
        mid = plays_sorted[len(plays_sorted) // 2]
        print(f"\n已发布 {len(pub)} 条｜播放中位 {mid:,.0f}｜最高 {max(plays):,.0f}｜最低 {min(plays):,.0f}")
    if sch:
        print(f"定时待发 {len(sch)} 条：")
        for p in sch:
            print(f"   {p['sched']}  {p['title'][:30]}  ({p['images']}张)")
