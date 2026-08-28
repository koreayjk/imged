#!/usr/bin/env python3
"""Khan Academy 코스 구조 수집기.

칸아카데미는 SPA라서 정적 fetch로는 목록이 안 나온다. Playwright 헤드리스 브라우저로
코스 페이지를 열고, 페이지가 스스로 호출하는 내부 GraphQL(ContentForPath) 응답을
가로채서 코스 → 유닛 → 레슨 → 영상(youtube_id, duration) 구조를 뽑는다.

사용법:
    pip install playwright
    python scripts/scrape_khan.py                 # 전체 코스
    python scripts/scrape_khan.py pre-algebra     # 특정 key만

출력:
    data/raw/<key>/course.json          원본 GraphQL 응답 (디버깅·파싱 보정용)
    data/parsed/<key>.json              정규화된 구조
    data/parsed/_scrape_report.json     수집 요약 (영상 수, 누락 youtube_id 등)

환경:
    - PLAYWRIGHT_BROWSERS_PATH가 설정된 환경이면 그대로 사용.
    - 크로미움 실행 파일을 직접 지정하려면 KHAN_CHROMIUM=/path/to/chromium
"""

import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
PARSED_DIR = ROOT / "data" / "parsed"
BASE = "https://www.khanacademy.org"
NAV_TIMEOUT_MS = 45_000
SETTLE_MS = 4_000          # 네비게이션 후 GraphQL 응답 대기
PAGE_DELAY_SEC = 0.8       # 페이지 간 딜레이 (서버 부담 최소화)


def log(*args):
    print(time.strftime("[%H:%M:%S]"), *args, flush=True)


# ---------------------------------------------------------------- JSON 유틸

def walk(obj):
    """중첩 JSON의 모든 dict를 순회."""
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk(v)


def find_videos(obj):
    """__typename == Video 인 노드 전부 수집. {slug: {...}}"""
    out = {}
    for node in walk(obj):
        if node.get("__typename") == "Video" or ("youtubeId" in node and "slug" in node):
            slug = node.get("slug")
            if not slug:
                continue
            cur = out.setdefault(slug, {})
            for src, dst in [
                ("translatedTitle", "title"), ("title", "title"),
                ("youtubeId", "youtube_id"), ("duration", "duration_sec"),
                ("relativeUrl", "relative_url"), ("urlWithinCurationNode", "relative_url"),
                ("id", "khan_id"), ("contentId", "khan_id"),
            ]:
                if node.get(src) is not None and dst not in cur:
                    cur[dst] = node[src]
    return out


# ---------------------------------------------------------------- 구조 파싱

def parse_course_structure(raw_payloads):
    """ContentForPath 응답들에서 course 구조(units→lessons→videos)를 추출."""
    course = None
    for payload in raw_payloads:
        for node in walk(payload):
            if node.get("__typename") == "Course" and node.get("unitChildren"):
                course = node
                break
        if course:
            break
    if not course:
        return None

    units = []
    for unit in course.get("unitChildren") or []:
        lessons = []
        children = unit.get("allOrderedChildren") or unit.get("children") or []
        for child in children:
            tn = child.get("__typename", "")
            if tn == "Lesson":
                items = child.get("curatedChildren") or child.get("contentItems") or []
                videos, exercise_count = [], 0
                for item in items:
                    itn = item.get("__typename", "")
                    if itn == "Video":
                        videos.append({
                            "title": item.get("translatedTitle") or item.get("title"),
                            "slug": item.get("slug"),
                            "youtube_id": item.get("youtubeId"),
                            "duration_sec": item.get("duration"),
                            "relative_url": item.get("urlWithinCurationNode") or item.get("relativeUrl"),
                        })
                    elif itn == "Exercise":
                        exercise_count += 1
                lessons.append({
                    "title": child.get("translatedTitle") or child.get("title"),
                    "slug": child.get("slug"),
                    "videos": videos,
                    "exercise_count": exercise_count,
                })
            # TopicQuiz / TopicUnitTest 등은 스킵 (자체 문항으로 대체)
        units.append({
            "title": unit.get("translatedTitle") or unit.get("title"),
            "slug": unit.get("slug"),
            "relative_url": unit.get("relativeUrl"),
            "lessons": lessons,
        })
    return {
        "course_title": course.get("translatedTitle") or course.get("title"),
        "course_slug": course.get("slug"),
        "units": units,
    }


# ---------------------------------------------------------------- 브라우저

class Capture:
    """페이지가 호출하는 ContentForPath GraphQL 응답을 모은다."""

    def __init__(self):
        self.payloads = []

    def attach(self, page):
        page.on("response", self._on_response)

    def _on_response(self, response):
        if "graphql" in response.url and "ContentForPath" in response.url:
            asyncio.ensure_future(self._save(response))

    async def _save(self, response):
        try:
            self.payloads.append(await response.json())
        except Exception:
            pass


async def goto_and_capture(page, url, capture):
    n_before = len(capture.payloads)
    await page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
    # GraphQL 응답이 최소 1개 들어올 때까지 대기
    deadline = time.time() + SETTLE_MS / 1000
    while time.time() < deadline:
        if len(capture.payloads) > n_before:
            await page.wait_for_timeout(1200)  # 후속 응답 여유
            break
        await page.wait_for_timeout(200)
    return capture.payloads[n_before:]


async def scrape_course(context, course_cfg):
    key = course_cfg["key"]
    raw_dir = RAW_DIR / key
    raw_dir.mkdir(parents=True, exist_ok=True)

    page = await context.new_page()
    capture = Capture()
    capture.attach(page)

    structure, used_slug, course_payloads = None, None, []
    for slug in course_cfg["slug_candidates"]:
        url = f"{BASE}/{slug}"
        log(f"  {key}: trying {url}")
        try:
            payloads = await goto_and_capture(page, url, capture)
        except Exception as e:
            log(f"  {key}: goto failed ({e})")
            continue
        structure = parse_course_structure(payloads)
        if structure and structure["units"]:
            used_slug, course_payloads = slug, payloads
            break
        await asyncio.sleep(PAGE_DELAY_SEC)

    if not structure:
        (raw_dir / "course.json").write_text(
            json.dumps(capture.payloads, ensure_ascii=False)[:50_000_000])
        await page.close()
        return {"key": key, "ok": False, "error": "course structure not found (slug 후보 전부 실패)"}

    (raw_dir / "course.json").write_text(json.dumps(course_payloads, ensure_ascii=False))

    # 코스 응답만으로 youtube_id가 다 안 나오면 레슨/영상 페이지를 방문해 보충
    missing = [v for u in structure["units"] for l in u["lessons"]
               for v in l["videos"] if not v.get("youtube_id")]
    if missing:
        log(f"  {key}: {len(missing)}개 영상에 youtube_id 없음 → 페이지 방문으로 보충")
        known = {}
        for u in structure["units"]:
            for l in u["lessons"]:
                pending = [v for v in l["videos"] if not v.get("youtube_id")]
                if not pending:
                    continue
                target = pending[0]
                rel = target.get("relative_url")
                if not rel:
                    continue
                try:
                    payloads = await goto_and_capture(page, BASE + rel, capture)
                    known.update(find_videos(payloads))
                except Exception as e:
                    log(f"  {key}: visit {rel} failed ({e})")
                for v in l["videos"]:
                    hit = known.get(v["slug"])
                    if hit:
                        v.setdefault("youtube_id", hit.get("youtube_id"))
                        v["youtube_id"] = v["youtube_id"] or hit.get("youtube_id")
                        v["duration_sec"] = v.get("duration_sec") or hit.get("duration_sec")
                await asyncio.sleep(PAGE_DELAY_SEC)
        # 여전히 누락인 영상은 개별 방문
        for u in structure["units"]:
            for l in u["lessons"]:
                for v in l["videos"]:
                    if v.get("youtube_id") or not v.get("relative_url"):
                        continue
                    try:
                        payloads = await goto_and_capture(page, BASE + v["relative_url"], capture)
                        hit = find_videos(payloads).get(v["slug"])
                        if hit:
                            v["youtube_id"] = hit.get("youtube_id")
                            v["duration_sec"] = v.get("duration_sec") or hit.get("duration_sec")
                    except Exception as e:
                        log(f"  {key}: visit {v['relative_url']} failed ({e})")
                    await asyncio.sleep(PAGE_DELAY_SEC)

    await page.close()

    # youtube URL 부여 + 집계
    n_videos = n_missing = total_sec = 0
    for u in structure["units"]:
        for l in u["lessons"]:
            for v in l["videos"]:
                n_videos += 1
                if v.get("youtube_id"):
                    v["youtube_url"] = f"https://www.youtube.com/watch?v={v['youtube_id']}"
                else:
                    n_missing += 1
                total_sec += v.get("duration_sec") or 0

    out = {
        "key": key,
        "tier": course_cfg["tier"],
        "subject": course_cfg["subject"],
        "slug": used_slug,
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **structure,
    }
    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    (PARSED_DIR / f"{key}.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    return {"key": key, "ok": True, "slug": used_slug,
            "units": len(structure["units"]), "videos": n_videos,
            "missing_youtube_id": n_missing, "total_video_minutes": round(total_sec / 60)}


async def main():
    from playwright.async_api import async_playwright

    only = set(sys.argv[1:])
    courses = json.loads((ROOT / "config" / "courses.json").read_text())["courses"]
    if only:
        courses = [c for c in courses if c["key"] in only]

    launch_kwargs = {"headless": True}
    exe = os.environ.get("KHAN_CHROMIUM")
    if exe:
        launch_kwargs["executable_path"] = exe

    report = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(**launch_kwargs)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            locale="en-US",
        )
        for cfg in courses:
            log(f"course: {cfg['key']}")
            try:
                result = await scrape_course(context, cfg)
            except Exception as e:
                result = {"key": cfg["key"], "ok": False, "error": repr(e)}
            log(f"  -> {result}")
            report.append(result)
        await browser.close()

    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    (PARSED_DIR / "_scrape_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2))
    log("done. report -> data/parsed/_scrape_report.json")


if __name__ == "__main__":
    asyncio.run(main())
