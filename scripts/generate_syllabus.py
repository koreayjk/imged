#!/usr/bin/env python3
"""GED 실라버스 생성기.

입력:
    data/parsed/<course>.json     scrape_khan.py 산출물 (코스→유닛→레슨→영상)
    config/ged_scope.json         GED 범위 필터 (들을 영상 / 뺄 영상 규칙)
    config/durations.json         기간별 트랙 배치 (6m/1y/2y/3y)
    config/video_overrides.json   (선택) 영상 단위 수동 포함/제외 오버라이드

출력:
    docs/syllabus/영상선별_<course>.md      코스별 영상 선별표 (포함/제외 + 사유 + 집계)
    docs/syllabus/실라버스_<기간>.md         주차·일자별 상세 실라버스
    data/syllabus/<duration>.json           앱 시딩용 JSON (roadmap_days 원형)
    docs/syllabus/_검증_리포트.md            분량 vs 주차 배분 검증 (§6-3)

사용법:
    python scripts/generate_syllabus.py            # 전체 기간
    python scripts/generate_syllabus.py 6m 1y      # 특정 기간만
"""

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARSED = ROOT / "data" / "parsed"
OUT_MD = ROOT / "docs" / "syllabus"
OUT_JSON = ROOT / "data" / "syllabus"

TIER_ORDER = {"T0": 0, "T1": 1, "T2": 2, "T3": 3}
DEFAULT_VIDEO_SEC = 7 * 60  # duration 누락 시 칸 평균치로 가정
SUBJECT_LABEL = {"math": "수학", "rla": "RLA(영어)", "science": "과학", "social": "사회"}


def load_json(path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def fmt_min(sec):
    return f"{round(sec / 60)}분"


def yt_link(v):
    if v.get("youtube_url"):
        return f"[{v['title']}]({v['youtube_url']})"
    return f"{v['title']} (youtube_id 미수집)"


# ---------------------------------------------------------------- 필터링

def unit_decision(course_key, unit_title, scope, duration_tier):
    """유닛 포함 여부: (action, priority, reason). action: include|exclude"""
    rules = scope["courses"].get(course_key)
    if not rules:
        return "include", "normal", "필터 규칙 없음 → 기본 포함"
    t = (unit_title or "").lower()

    if rules.get("default_action") == "exclude_unless_listed":
        for entry in rules.get("include", []):
            if re.search(entry["match"], t):
                tier_min = entry.get("tier_min", "T0")
                if TIER_ORDER[tier_min] > TIER_ORDER[duration_tier]:
                    return "exclude", "normal", f"{tier_min} 이상 기간에서만 포함 ({entry['reason']})"
                return "include", entry.get("priority", "normal"), entry["reason"]
        return "exclude", "normal", rules.get("exclude_reason_default", "GED 범위 밖")

    for entry in rules.get("exclude", []):
        if re.search(entry["match"], t):
            return "exclude", "normal", entry["reason"]
    for entry in rules.get("optional", []):
        if re.search(entry["match"], t):
            return "include", "low", entry["reason"]
    return "include", "normal", "GED 범위 내"


def filter_course(course, scope, overrides, duration_tier):
    """코스를 순회하며 영상별 결정 리스트 생성."""
    ov = (overrides or {}).get(course["key"], {})
    included, excluded = [], []
    for unit in course["units"]:
        action, priority, reason = unit_decision(course["key"], unit["title"], scope, duration_tier)
        for lesson in unit["lessons"]:
            for v in lesson["videos"]:
                v_action, v_reason = action, reason
                if v.get("slug") in ov.get("exclude", {}):
                    v_action, v_reason = "exclude", ov["exclude"][v["slug"]]
                elif v.get("slug") in ov.get("include", {}):
                    v_action, v_reason = "include", ov["include"][v["slug"]]
                rec = {
                    "course": course["key"], "course_title": course["course_title"],
                    "subject": course["subject"],
                    "unit": unit["title"], "lesson": lesson["title"],
                    "title": v["title"], "slug": v.get("slug"),
                    "youtube_id": v.get("youtube_id"), "youtube_url": v.get("youtube_url"),
                    "duration_sec": v.get("duration_sec") or DEFAULT_VIDEO_SEC,
                    "priority": priority, "reason": v_reason,
                }
                (included if v_action == "include" else excluded).append(rec)
    return included, excluded


# ---------------------------------------------------------------- 스케줄링

def schedule_duration(dur_key, dur, courses_by_key, scope, overrides, session):
    weeks_total = dur["weeks"]
    days_per_week = dur["study_days_per_week"]
    video_ratio = session["video_ratio"]

    # 트랙별 영상 큐 구성
    queues, selections = {}, {}
    for track in dur["tracks"]:
        q = []
        for key in track["playlist"]:
            course = courses_by_key.get(key)
            if not course:
                continue
            inc, exc = filter_course(course, scope, overrides, dur["tier"])
            selections.setdefault(key, (inc, exc))
            q.extend(inc)
        queues[track["name"]] = q

    warnings, days = [], []
    cursors = {name: 0 for name in queues}
    int_start, int_end = dur["integration"]["weeks"]
    mock_cycle = ["math", "rla", "science", "social"]

    for week in range(1, weeks_total + 1):
        for dow in range(1, days_per_week + 1):
            day = {"week": week, "day": dow, "blocks": []}
            day["blocks"].append({"type": "warmup", "minutes": session["warmup_min"],
                                  "note": "복습 큐 5문항 (오답 간격 반복)"})
            if int_start <= week <= int_end:
                subj = mock_cycle[(dow - 1) % len(mock_cycle)]
                total_min = dur["daily_total_min"] - session["warmup_min"] - session["checkin_min"]
                last_two = week > int_end - 2
                day["blocks"].append({
                    "type": "mock" if last_two else "integration",
                    "subject": subj, "minutes": total_min,
                    "note": ("풀-모의고사 + 오답 분석" if last_two
                             else f"{SUBJECT_LABEL[subj]} 취약 스킬 복습 + 실전 문항 세트"),
                })
            else:
                for track in dur["tracks"]:
                    w0, w1 = track["weeks"]
                    if not (w0 <= week <= w1):
                        continue
                    q, cur = queues[track["name"]], cursors[track["name"]]
                    budget = track["daily_min"] * 60 * video_ratio
                    vids, used = [], 0
                    while cur < len(q) and (not vids or used + q[cur]["duration_sec"] <= budget):
                        vids.append(q[cur])
                        used += q[cur]["duration_sec"]
                        cur += 1
                    cursors[track["name"]] = cur
                    practice_min = round(track["daily_min"] * (1 - video_ratio))
                    block = {"type": "study", "track": track["name"], "label": track["label"],
                             "minutes": track["daily_min"], "videos": vids,
                             "practice_minutes": practice_min}
                    if not vids:
                        block["note"] = "영상 큐 소진 → 문항 연습·복습으로 대체"
                    day["blocks"].append(block)
            if dow == days_per_week:
                day["blocks"].append({"type": "weekly_test", "note": f"위클리 테스트 (이번 주 범위 문항)"})
                if week % 4 == 0:
                    day["blocks"].append({"type": "monthly_test", "note": "먼슬리 테스트 (최근 4주 누적 범위)"})
            day["blocks"].append({"type": "checkin", "minutes": session["checkin_min"],
                                  "note": "이해도 자가평가 + 질문 등록"})
            days.append(day)

    # 큐 소진/초과 검증 (§6-3)
    for track in dur["tracks"]:
        q, cur = queues[track["name"]], cursors[track["name"]]
        if cur < len(q):
            remain = q[cur:]
            remain_min = round(sum(v["duration_sec"] for v in remain) / 60)
            per_day = track["daily_min"] * video_ratio
            extra_days = math.ceil(remain_min / per_day) if per_day else 0
            extra_weeks = math.ceil(extra_days / days_per_week)
            warnings.append(
                f"[{dur['label']}/{track['label']}] 영상 {len(remain)}개({remain_min}분) 미배치 — "
                f"트랙 주차를 약 {extra_weeks}주 늘리거나 범위 축소 필요")
        else:
            # 소진 시점 계산
            total = len(q)
            warnings.append(
                f"[{dur['label']}/{track['label']}] 영상 {total}개 전부 배치 완료") if total else None

    return {"days": days, "selections": selections, "warnings": [w for w in warnings if w]}


# ---------------------------------------------------------------- 출력

def write_selection_docs(all_selections, courses_by_key):
    OUT_MD.mkdir(parents=True, exist_ok=True)
    for key, (inc, exc) in all_selections.items():
        course = courses_by_key[key]
        lines = [f"# 영상 선별표 — {course['course_title']}", "",
                 f"- 코스: `{course.get('slug', key)}` / 과목: {SUBJECT_LABEL.get(course['subject'], course['subject'])} / 티어: {course.get('tier')}",
                 f"- **들을 영상: {len(inc)}개 ({fmt_min(sum(v['duration_sec'] for v in inc))})** / "
                 f"뺄 영상: {len(exc)}개 ({fmt_min(sum(v['duration_sec'] for v in exc))})", ""]
        for section, videos in (("## ✅ 들을 영상", inc), ("## ❌ 뺄 영상", exc)):
            lines += ["", section, ""]
            cur_unit = None
            for v in videos:
                if v["unit"] != cur_unit:
                    cur_unit = v["unit"]
                    lines += ["", f"### {cur_unit}", ""]
                excluded = videos is exc
                mark = "❌" if excluded else ("🔹" if v["priority"] == "low" else "✅")
                note = f" · _{v['reason']}_" if excluded or v["priority"] == "low" else ""
                lines.append(f"- {mark} {yt_link(v)} — {fmt_min(v['duration_sec'])} · {v['lesson']}{note}")
        (OUT_MD / f"영상선별_{key}.md").write_text("\n".join(lines))


def write_syllabus_md(dur_key, dur, result):
    lines = [f"# GED 실라버스 — {dur['label']} 과정", "",
             f"- 총 {dur['weeks']}주 / 주 {dur['study_days_per_week']}일 학습 / 티어 {dur['tier']}",
             f"- 세션 구조: 워밍업 5분 → 트랙 학습(영상 40% + 문항 60%) → 체크인 5분",
             ""]
    if dur.get("milestone"):
        lines += [f"> 📌 {dur['milestone']}", ""]
    lines += ["## 트랙 배치", "", "| 트랙 | 주차 | 1일 배정 | 코스 순서 |", "|---|---|---|---|"]
    for t in dur["tracks"]:
        lines.append(f"| {t['label']} | {t['weeks'][0]}–{t['weeks'][1]}주 | {t['daily_min']}분 | {' → '.join(t['playlist'])} |")
    lines += [f"| 실전 통합 | {dur['integration']['weeks'][0]}–{dur['integration']['weeks'][1]}주 | 전체 | 4과목 순환 + 모의고사 |", ""]

    cur_week = None
    for day in result["days"]:
        if day["week"] != cur_week:
            cur_week = day["week"]
            lines += ["", f"## {cur_week}주차", ""]
        parts = []
        for b in day["blocks"]:
            if b["type"] == "study":
                if b["videos"]:
                    vids = "<br>".join(f"▸ {yt_link(v)} ({fmt_min(v['duration_sec'])})" for v in b["videos"])
                    parts.append(f"**{b['label']} {b['minutes']}분** — 영상 {len(b['videos'])}개 + 문항 {b['practice_minutes']}분<br>{vids}")
                else:
                    parts.append(f"**{b['label']} {b['minutes']}분** — {b.get('note', '문항 연습')}")
            elif b["type"] in ("integration", "mock"):
                icon = "📝" if b["type"] == "mock" else "🔄"
                parts.append(f"{icon} **{SUBJECT_LABEL[b['subject']]} {b['minutes']}분** — {b['note']}")
            elif b["type"] == "weekly_test":
                parts.append("🧪 위클리 테스트")
            elif b["type"] == "monthly_test":
                parts.append("🏁 먼슬리 테스트")
        lines.append(f"**Day {day['day']}**")
        lines.append("")
        for p in parts:
            lines.append(f"- {p}")
        lines.append("")
    (OUT_MD / f"실라버스_{dur['label']}.md").write_text("\n".join(lines))


def main():
    only = set(sys.argv[1:])
    scope = load_json(ROOT / "config" / "ged_scope.json")
    durations_cfg = load_json(ROOT / "config" / "durations.json")
    overrides = load_json(ROOT / "config" / "video_overrides.json", {})

    courses_by_key = {}
    for f in PARSED.glob("*.json"):
        if f.name.startswith("_"):
            continue
        c = load_json(f)
        if c and c.get("units"):
            courses_by_key[c["key"]] = c
    if not courses_by_key:
        sys.exit("data/parsed/ 에 코스 데이터가 없습니다. 먼저 scripts/scrape_khan.py 를 실행하세요.")

    OUT_JSON.mkdir(parents=True, exist_ok=True)
    OUT_MD.mkdir(parents=True, exist_ok=True)
    all_warnings, merged_selections = [], {}

    for dur_key, dur in durations_cfg["durations"].items():
        if only and dur_key not in only:
            continue
        missing = [k for t in dur["tracks"] for k in t["playlist"] if k not in courses_by_key]
        if missing:
            all_warnings.append(f"[{dur['label']}] 코스 데이터 누락: {sorted(set(missing))} — 해당 코스 없이 생성됨")
        result = schedule_duration(dur_key, dur, courses_by_key, scope, overrides,
                                   durations_cfg["session"])
        merged_selections.update(result["selections"])
        write_syllabus_md(dur_key, dur, result)
        (OUT_JSON / f"{dur_key}.json").write_text(json.dumps(
            {"duration": dur_key, "label": dur["label"], "days": result["days"]},
            ensure_ascii=False))
        all_warnings.extend(result["warnings"])
        print(f"{dur['label']}: {len(result['days'])}일 생성")

    write_selection_docs(merged_selections, courses_by_key)

    report = ["# 분량 검증 리포트 (§6-3)", "",
              "생성 시각 기준, 트랙별 영상 배치 결과와 조정 필요 사항.", ""]
    report += [f"- {w}" for w in all_warnings]
    (OUT_MD / "_검증_리포트.md").write_text("\n".join(report))
    print("검증 리포트 -> docs/syllabus/_검증_리포트.md")


if __name__ == "__main__":
    main()
