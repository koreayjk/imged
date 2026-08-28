#!/usr/bin/env python3
"""Supabase 시드 SQL 생성.

입력:  data/parsed/*.json (레슨), data/syllabus/*.json (실라버스 템플릿),
       config/sample_questions.json (스타터 문항)
출력:  supabase/seed/0001_lessons.sql
       supabase/seed/0002_syllabus_templates.sql
       supabase/seed/0003_sample_questions.sql

적용:  Supabase SQL Editor에 순서대로 붙여넣거나 psql로 실행.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "supabase" / "seed"
SEED.mkdir(parents=True, exist_ok=True)


def q(value):
    """SQL 문자열 리터럴 이스케이프."""
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def jb(obj):
    return q(json.dumps(obj, ensure_ascii=False)) + "::jsonb"


def gen_lessons():
    lines = ["-- lessons 시딩 (data/parsed 기준). 재실행 시 전체 교체.",
             "delete from public.lessons;", ""]
    for f in sorted((ROOT / "data" / "parsed").glob("*.json")):
        if f.name.startswith("_"):
            continue
        c = json.loads(f.read_text())
        order = 0
        rows = []
        for u in c["units"]:
            for l in u["lessons"]:
                for v in l["videos"]:
                    if not v.get("youtube_id"):
                        continue
                    video_source = {"type": "youtube", "ref": v["youtube_id"],
                                    "duration_sec": v.get("duration_sec"), "title": v["title"]}
                    rows.append(
                        f"({q(c['subject'])}, {q(c['key'])}, {q(c['tier'])}, "
                        f"{q(u['slug'])}, {q(u['title'])}, {q(l['slug'])}, {q(l['title'])}, "
                        f"{order}, {q(u['slug'])}, {jb({'en': v['title']})}, "
                        f"{jb(video_source)}, {max(1, round((v.get('duration_sec') or 420) / 60))})")
                    order += 1
        if rows:
            lines.append(f"-- {c['course_title']} ({len(rows)}개)")
            lines.append("insert into public.lessons (subject, course_key, tier, unit_slug, unit_title, "
                         "lesson_slug, lesson_title, order_index, skill_tag, title_i18n, video_source, estimated_minutes) values")
            lines.append(",\n".join(rows) + ";")
            lines.append("")
    (SEED / "0001_lessons.sql").write_text("\n".join(lines))
    print(f"0001_lessons.sql: {sum(1 for line in lines if line.startswith('('))} rows-ish")


def gen_templates():
    lines = ["-- 실라버스 템플릿 시딩 (data/syllabus 기준). 재실행 시 전체 교체.",
             "delete from public.syllabus_template_days;",
             "delete from public.syllabus_templates;", ""]
    n_days = 0
    for f in sorted((ROOT / "data" / "syllabus").glob("*.json")):
        t = json.loads(f.read_text())
        dur, level = t["duration"], t["level"]
        lines.append(f"-- {t['label']} · {t['level_label']} ({len(t['days'])}일)")
        lines.append(
            "with tpl as (insert into public.syllabus_templates (duration, level) "
            f"values ({q(dur)}, {q(level)}) returning id)")
        rows = [f"((select id from tpl), {d['week']}, {d['day']}, {jb(d['blocks'])})"
                for d in t["days"]]
        n_days += len(rows)
        lines.append("insert into public.syllabus_template_days (template_id, week, day, blocks) values")
        lines.append(",\n".join(rows) + ";")
        lines.append("")
    (SEED / "0002_syllabus_templates.sql").write_text("\n".join(lines))
    print(f"0002_syllabus_templates.sql: {n_days} template days")


QUESTION_FILES = ["sample_questions.json", "question_bank_math.json", "question_bank_rla.json"]


def gen_questions():
    qs = []
    for name in QUESTION_FILES:
        qs.extend(json.loads((ROOT / "config" / name).read_text())["questions"])
    lines = ["-- 스타터 문항 시딩. 재실행 시 전체 교체 (검수 후 published 상태로 게시).",
             "delete from public.questions where status = 'reviewed' and created_at < now();",
             "insert into public.questions (subject, skill_tag, difficulty, format, purpose, "
             "stem_i18n, choices, answer, explanation_i18n, status) values"]
    rows = []
    for item in qs:
        rows.append(
            f"({q(item['subject'])}, {q(item['skill_tag'])}, {item['difficulty']}, {q(item['format'])}, "
            f"{q(item['purpose'])}, {jb(item['stem_i18n'])}, {jb(item['choices'])}, {jb(item['answer'])}, "
            f"{jb(item['explanation_i18n'])}, 'published')")
    lines.append(",\n".join(rows) + ";")
    (SEED / "0003_sample_questions.sql").write_text("\n".join(lines))
    print(f"0003_sample_questions.sql: {len(rows)} questions")


if __name__ == "__main__":
    gen_lessons()
    gen_templates()
    gen_questions()
