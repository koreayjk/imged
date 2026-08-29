#!/usr/bin/env python3
"""칸 아카데미 공식 export에서 강의 설명을 추출한다.

실라버스에 배치된 영상의 `translated_description_html`(CC BY-NC-SA)을 평문으로 정리해
data/video_summaries.json 으로 쓴다. 앱의 강의 화면이 이걸 '요약'으로 보여준다.
모국어(ko/zh/th) 번역은 별도 단계(supabase/functions/translate-summaries)에서 채운다.

    python3 scripts/extract_summaries.py [--tsv 경로]
"""
import argparse, csv, glob, html, json, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TSV_URL = "https://storage.googleapis.com/public-content-export-data/en-export-recent.tsv"
OUT = ROOT / "data" / "video_summaries.json"

csv.field_size_limit(sys.maxsize)


def to_text(raw: str) -> str:
    """설명 HTML → 평문. 태그는 전부 제거하고 <br>·</p>만 줄바꿈으로 살린다."""
    s = re.sub(r"<\s*br\s*/?\s*>", "\n", raw, flags=re.I)
    s = re.sub(r"</\s*p\s*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = s.replace(" ", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def needed_video_ids() -> set[str]:
    ids = set()
    for f in glob.glob(str(ROOT / "data" / "syllabus" / "*.json")):
        for day in json.load(open(f, encoding="utf-8"))["days"]:
            for b in day["blocks"]:
                for v in b.get("videos", []):
                    if v.get("youtube_id"):
                        ids.add(v["youtube_id"])
    return ids


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tsv", default=None, help="내려받아 둔 export 경로 (없으면 다운로드)")
    args = ap.parse_args()

    tsv = Path(args.tsv) if args.tsv else ROOT / "data" / "raw" / "en-export-recent.tsv"
    if not tsv.exists():
        tsv.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {TSV_URL} -> {tsv} (~300MB)")
        urllib.request.urlretrieve(TSV_URL, tsv)

    need = needed_video_ids()
    print(f"실라버스 사용 영상: {len(need)}편")

    out: dict[str, dict[str, str]] = {}
    with open(tsv, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh, delimiter="\t"):
            if row.get("kind") != "Video":
                continue
            yid = row.get("youtube_id")
            if not yid or yid in out or yid not in need:
                continue
            text = to_text(row.get("translated_description_html") or "")
            if text:
                out[yid] = {"en": text}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, sort_keys=True), encoding="utf-8")
    missing = len(need) - len(out)
    size_kb = OUT.stat().st_size / 1024
    print(f"설명 확보 {len(out)}편 / 누락 {missing}편 → {OUT.relative_to(ROOT)} ({size_kb:.0f}KB)")


if __name__ == "__main__":
    main()
