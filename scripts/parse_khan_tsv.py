#!/usr/bin/env python3
"""Khan Academy 공식 TSV 익스포트 → data/parsed/<key>.json 변환.

칸은 콘텐츠 트리 전체를 공개 GCS 버킷으로 매일 내보낸다 (Learning Equality의
Kolibri 수입용). 헤드리스 브라우저나 내부 API 해시 없이 이걸 쓰는 게 가장 안정적.

    버킷:  public-content-export-data
    최신:  https://storage.googleapis.com/public-content-export-data/en-export-recent.tsv

사용법:
    python scripts/parse_khan_tsv.py /path/to/en-export-recent.tsv
    (파일 인자를 생략하면 위 URL에서 임시 디렉터리로 자동 다운로드)

출력: data/parsed/<key>.json  (generate_syllabus.py 입력 형식)
      data/parsed/_scrape_report.json
"""

import csv
import json
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARSED_DIR = ROOT / "data" / "parsed"
TSV_URL = "https://storage.googleapis.com/public-content-export-data/en-export-recent.tsv"

csv.field_size_limit(sys.maxsize)


def load_rows(tsv_path):
    by_id, courses_by_slug = {}, {}
    with open(tsv_path, newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            by_id[row["id"]] = row
            if row["kind"] == "Course":
                courses_by_slug.setdefault(row["slug"], row)
    return by_id, courses_by_slug


def children(row, by_id, kinds):
    out = []
    raw = row.get("children_ids") or "[]"
    try:
        refs = json.loads(raw)
    except json.JSONDecodeError:
        return out
    for ref in refs:
        child = by_id.get(ref.get("id"))
        if child and child["kind"] in kinds:
            out.append(child)
    return out


def build_course(course_row, by_id, cfg):
    units = []
    for unit_row in children(course_row, by_id, {"Unit"}):
        lessons = []
        for lesson_row in children(unit_row, by_id, {"Lesson"}):
            videos, exercise_count = [], 0
            for item in children(lesson_row, by_id, {"Video", "Exercise"}):
                if item["kind"] == "Video":
                    yid = item.get("youtube_id") or None
                    videos.append({
                        "title": item["original_title"],
                        "slug": item["slug"],
                        "youtube_id": yid,
                        "youtube_url": f"https://www.youtube.com/watch?v={yid}" if yid else None,
                        "duration_sec": int(item["duration"]) if item.get("duration") else None,
                        "relative_url": item.get("canonical_url", "").replace(
                            "https://www.khanacademy.org", ""),
                    })
                else:
                    exercise_count += 1
            lessons.append({
                "title": lesson_row["original_title"],
                "slug": lesson_row["slug"],
                "videos": videos,
                "exercise_count": exercise_count,
            })
        units.append({
            "title": unit_row["original_title"],
            "slug": unit_row["slug"],
            "relative_url": unit_row.get("canonical_url", "").replace(
                "https://www.khanacademy.org", ""),
            "lessons": lessons,
        })
    return {
        "key": cfg["key"],
        "tier": cfg["tier"],
        "subject": cfg["subject"],
        "slug": course_row["slug"],
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "tsv-export",
        "course_title": course_row["original_title"],
        "course_slug": course_row["slug"],
        "units": units,
    }


def main():
    if len(sys.argv) > 1:
        tsv_path = sys.argv[1]
    else:
        tsv_path = str(Path(tempfile.gettempdir()) / "khan-en-export.tsv")
        if not Path(tsv_path).exists():
            print(f"downloading {TSV_URL} -> {tsv_path} (~300MB)")
            urllib.request.urlretrieve(TSV_URL, tsv_path)

    print("loading TSV...")
    by_id, courses_by_slug = load_rows(tsv_path)
    print(f"nodes: {len(by_id)}, courses: {len(courses_by_slug)}")

    course_cfgs = json.loads((ROOT / "config" / "courses.json").read_text())["courses"]
    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    report = []
    for cfg in course_cfgs:
        row = None
        for slug in cfg["slug_candidates"]:
            slug = slug.split("/")[-1]  # 'math/pre-algebra' → 'pre-algebra'
            if slug in courses_by_slug:
                row = courses_by_slug[slug]
                break
        if not row:
            report.append({"key": cfg["key"], "ok": False, "error": "slug not found in TSV"})
            print(f"  !! {cfg['key']}: slug not found")
            continue
        out = build_course(row, by_id, cfg)
        n_videos = sum(len(l["videos"]) for u in out["units"] for l in u["lessons"])
        n_missing = sum(1 for u in out["units"] for l in u["lessons"]
                        for v in l["videos"] if not v["youtube_id"])
        total_min = round(sum(v["duration_sec"] or 0 for u in out["units"]
                              for l in u["lessons"] for v in l["videos"]) / 60)
        (PARSED_DIR / f"{cfg['key']}.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2))
        report.append({"key": cfg["key"], "ok": True, "slug": row["slug"],
                       "title": row["original_title"], "units": len(out["units"]),
                       "videos": n_videos, "missing_youtube_id": n_missing,
                       "total_video_minutes": total_min})
        print(f"  ok {cfg['key']}: {row['original_title']} | units={len(out['units'])} "
              f"videos={n_videos} ({total_min}분, yt누락 {n_missing})")

    (PARSED_DIR / "_scrape_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2))
    print("report -> data/parsed/_scrape_report.json")


if __name__ == "__main__":
    main()
