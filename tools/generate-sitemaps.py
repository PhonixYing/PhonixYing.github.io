#!/usr/bin/env python3
"""生成主站及其子站的 sitemap。

用法（在仓库根目录执行）：

    python3 tools/generate-sitemaps.py

产出：
    sitemap.xml          —— 站点地图索引，指向下面的各个子地图
    sitemaps/main.xml    —— 主站自身页面
    sitemaps/<slug>.xml  —— 各子站页面

说明：
  - 子站仓库与本仓库同级（../<repo>），脚本只读取它们的静态 HTML 文件，不做任何修改。
  - 排除模板页（api-examples / markdown-examples）、404、搜索引擎验证文件、
    构建产物（.cloudflare-output、node_modules）等不应被收录的内容。
  - CharacterAssembly 自带 sitemap.xml 并由该仓库维护，索引里直接引用，不重复生成。
"""

import datetime
import os
import re
import subprocess
import sys
import urllib.request
import concurrent.futures as cf
import xml.etree.ElementTree as ET
from xml.dom import minidom

HOST = "https://phonixying.github.io"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARENT = os.path.dirname(ROOT)
OUT_DIR = os.path.join(ROOT, "sitemaps")

# 不应提交给搜索引擎的路径片段
EXCLUDE_DIRS = {
    "node_modules", ".cloudflare-output", ".git", ".github",
    "assets", "app-store-badges", "design-system", "LifeGuidWeb",
    "docs",  # 各站 docs/ 多为开发文档，视站点需要单独放行
}
EXCLUDE_FILES = re.compile(
    r"(^|/)(404|api-examples|markdown-examples)\.html$|"
    r"(^|/)google[0-9a-f]+\.html$|"
    r"(^|/)BingSiteAuth\.xml$"
)

# 主站页面（相对 HOST）
MAIN_PAGES = [
    ("", "1.0", "weekly"),
    ("/wecom-meeting/", "0.6", "monthly"),
]

# 子站配置：slug, URL 前缀, 本地仓库目录, 发布子目录（None 表示仓库根目录）
SITES = [
    ("ancientread", "/AncientRead/", "AncientRead", None),
    ("aqualog", "/AquaLog/", "AquaLog", None),
    ("fieldreportpro", "/FieldReportPro/", "FieldReportPro", None),
    ("petloss", "/PetLoss/", "PetLoss", None),
    ("ichinglifeguid", "/IChingLifeGuid/", "IChingLifeGuid", None),
    ("warrantykeeper", "/WarrantyKeeper/", "WarrantyKeeper", None),
    ("operapuzzle", "/Operapuzzle/", "Operapuzzle", None),
    ("rainbowbilble", "/RainbowBilble/", "RainbowBilble", None),
    ("stephealth", "/StepHealth/", "StepHealth", None),
    ("pixeldrop", "/PixelDrop/", "PixelDrop", "docs"),   # Pages 从 /docs 发布
    ("nightfalltrials", "/NightfallTrials/", "NightfallTrials", None),
]

# 没有本地仓库、页面清单从线上抓取得到的站点
MANUAL_SITES = {
    "erpcoach": {
        "prefix": "/ERPCoach/",
        "pages": [
            "/ERPCoach/", "/ERPCoach/en/", "/ERPCoach/es/", "/ERPCoach/fa/",
            "/ERPCoach/ja/", "/ERPCoach/ko/", "/ERPCoach/pt/", "/ERPCoach/ru/",
            "/ERPCoach/zh/", "/ERPCoach/privacy/",
        ],
    },
}

# 由子站仓库自行维护、索引中直接引用的站点地图
EXTERNAL_SITEMAPS = [
    f"{HOST}/CharacterAssembly/sitemap.xml",
]


def git_lastmod(repo_dir):
    """取仓库最近一次提交的日期；取不到就返回今天。"""
    try:
        out = subprocess.run(
            ["git", "-C", repo_dir, "log", "-1", "--format=%ad", "--date=short"],
            capture_output=True, text=True, timeout=20,
        )
        d = out.stdout.strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            return d
    except Exception:
        pass
    return datetime.date.today().isoformat()


def classify(rel):
    """按路径给出 (priority, changefreq)。"""
    low = rel.lower()
    if rel == "index.html":
        return "0.9", "weekly"
    if re.fullmatch(r"[a-z]{2}(-[A-Za-z]+)?/index\.html", rel):
        return "0.7", "weekly"
    if re.search(r"(privacy|terms|support|legal)", low):
        return "0.3", "yearly"
    if re.search(r"(articles|classics|grief-guide|blog|pets-in-heaven|remembrance|"
                 r"aquatic-pet-loss|pet-loss-support|donate|basics|casting|history)", low):
        return "0.6", "monthly"
    return "0.5", "monthly"


def to_url(prefix, rel):
    if rel == "index.html":
        return prefix
    if rel.endswith("/index.html"):
        return prefix + rel[: -len("index.html")]
    return prefix + rel


def collect(repo_dir):
    """扫描子站仓库里的可收录 HTML 页面，返回相对路径列表。"""
    found = []
    for base, dirs, files in os.walk(repo_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        rel_base = os.path.relpath(base, repo_dir).replace(os.sep, "/")
        for name in files:
            if not name.endswith(".html"):
                continue
            rel = name if rel_base == "." else f"{rel_base}/{name}"
            if EXCLUDE_FILES.search(rel):
                continue
            found.append(rel)
    return sorted(found)


def write_urlset(path, entries):
    """entries: [(loc, lastmod, changefreq, priority)]"""
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for loc, lastmod, changefreq, priority in entries:
        url = ET.SubElement(urlset, "url")
        ET.SubElement(url, "loc").text = loc
        ET.SubElement(url, "lastmod").text = lastmod
        ET.SubElement(url, "changefreq").text = changefreq
        ET.SubElement(url, "priority").text = priority
    xml = minidom.parseString(ET.tostring(urlset, encoding="utf-8")).toprettyxml(indent="  ")
    xml = "\n".join(
        line for line in xml.splitlines()
        if line.strip() and not line.strip().startswith("<?xml")
    )
    with open(path, "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n' + xml + "\n")


def write_index(path, sitemap_urls, lastmod):
    index = ET.Element("sitemapindex", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for loc in sitemap_urls:
        sm = ET.SubElement(index, "sitemap")
        ET.SubElement(sm, "loc").text = loc
        ET.SubElement(sm, "lastmod").text = lastmod
    xml = minidom.parseString(ET.tostring(index, encoding="utf-8")).toprettyxml(indent="  ")
    xml = "\n".join(
        line for line in xml.splitlines()
        if line.strip() and not line.strip().startswith("<?xml")
    )
    with open(path, "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n' + xml + "\n")


def head_status(url):
    req = urllib.request.Request(
        url, method="HEAD", headers={"User-Agent": "Mozilla/5.0 (sitemap-generator)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return url, resp.status
    except urllib.error.HTTPError as err:
        return url, err.code
    except Exception:
        return url, 0


def verify(urls, workers=32):
    """并发 HEAD 检查。

    只剔除确认失效的 4xx（页面没发布）；5xx 与网络超时先重试一次，
    仍失败则保留，避免因为抖动把正常页面从站点地图里删掉。
    """
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        first = list(ex.map(head_status, urls))

    retry = [u for u, s in first if s != 200]
    if retry:
        with cf.ThreadPoolExecutor(max_workers=workers) as ex:
            again = dict(ex.map(head_status, retry))
    else:
        again = {}

    kept, dropped, flaky = [], [], []
    for url, status in first:
        final = again.get(url, status) if status != 200 else status
        if final == 200:
            kept.append((url, final))
        elif 400 <= final < 500:
            dropped.append((url, final))
        else:
            flaky.append((url, final))
            kept.append((url, final))
    return kept, dropped, flaky


def main():
    check_online = "--verify" in sys.argv
    os.makedirs(OUT_DIR, exist_ok=True)
    today = datetime.date.today().isoformat()
    main_lastmod = git_lastmod(ROOT)
    index_urls = []
    total = 0

    def emit(slug, entries, note=""):
        """可选线上校验 -> 写文件 -> 登记到索引。"""
        if check_online:
            kept, dropped, flaky = verify([e[0] for e in entries])
            ok_urls = {u for u, _ in kept}
            if dropped:
                print(f"  线上校验：剔除 {len(dropped)} 条不存在"
                      f"（例：{dropped[0][0]} -> {dropped[0][1]}）")
            if flaky:
                print(f"  线上校验：{len(flaky)} 条超时/5xx，保留")
            entries = [e for e in entries if e[0] in ok_urls]
        if not entries:
            print(f"{slug + '.xml':<20} 0 条，跳过")
            return 0
        write_urlset(os.path.join(OUT_DIR, f"{slug}.xml"), entries)
        index_urls.append(f"{HOST}/sitemaps/{slug}.xml")
        print(f"{slug + '.xml':<20} {len(entries):>5} 条  {note}")
        return len(entries)

    # 1. 主站
    entries = [
        (HOST + path, main_lastmod, freq, prio) for path, prio, freq in MAIN_PAGES
    ]
    total += emit("main", entries)

    # 2. 本地子站
    for slug, prefix, repo, src in SITES:
        repo_dir = os.path.join(PARENT, repo)
        scan_dir = os.path.join(repo_dir, src) if src else repo_dir
        if not os.path.isdir(scan_dir):
            print(f"{slug:<20} 跳过（本地无 ../{repo}/{src or ''}）")
            continue
        lastmod = git_lastmod(repo_dir)
        entries = []
        for rel in collect(scan_dir):
            prio, freq = classify(rel)
            entries.append((HOST + to_url(prefix, rel), lastmod, freq, prio))
        total += emit(slug, entries, f"lastmod={lastmod}")

    # 3. 页面清单手工维护的子站
    for slug, cfg in MANUAL_SITES.items():
        entries = []
        for path in cfg["pages"]:
            prio, freq = ("0.9", "weekly") if path == cfg["prefix"] else ("0.7", "weekly")
            if "privacy" in path:
                prio, freq = "0.3", "yearly"
            entries.append((HOST + path, today, freq, prio))
        total += emit(slug, entries, "(手工清单)")

    # 4. 子站自带的站点地图
    index_urls.extend(EXTERNAL_SITEMAPS)

    write_index(os.path.join(ROOT, "sitemap.xml"), index_urls, today)
    print(f"\n总计 {total} 条 URL，索引含 {len(index_urls)} 个站点地图 -> sitemap.xml")


if __name__ == "__main__":
    main()
