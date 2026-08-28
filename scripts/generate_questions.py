#!/usr/bin/env python3
"""GED 문항 AI 대량 생성 — 공식 블루프린트 기반.

공식 GED 시험 스펙(config/blueprint/)을 '사양서'로 넣어 Gemini가 새 문항을 생성한다.
공식 문항을 복제하지 않으며, 생성물은 자동 검증을 거쳐 status='draft'로 저장되어
관리자 검수 후에만 학생에게 노출된다.

사용법:
    export GEMINI_API_KEY=AIza...
    python scripts/generate_questions.py --subject math --per-target 4
    python scripts/generate_questions.py --subject rla --count 60
    python scripts/generate_questions.py --all --per-target 3

출력: config/generated/<subject>_<타임스탬프>.json  (검수 대기 문항)
      실행 요약은 stdout
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLUEPRINT = ROOT / "config" / "blueprint" / "ged_blueprint.json"
MATH_TARGETS = ROOT / "config" / "blueprint" / "ged_math_targets.json"
OUT_DIR = ROOT / "config" / "generated"
EXISTING = [
    ROOT / "config" / "sample_questions.json",
    ROOT / "config" / "question_bank_math.json",
    ROOT / "config" / "question_bank_rla.json",
]

MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"]

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "questions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "skill_tag": {"type": "STRING"},
                    "ged_target": {"type": "STRING", "description": "official target code, e.g. Q.2.a"},
                    "difficulty": {"type": "INTEGER", "description": "1-4"},
                    "dok": {"type": "INTEGER", "description": "Depth of Knowledge 1-3"},
                    "stimulus_en": {"type": "STRING", "description": "short passage/table if needed, else empty"},
                    "stimulus_ko": {"type": "STRING"},
                    "stem_en": {"type": "STRING"},
                    "stem_ko": {"type": "STRING"},
                    "choices_en": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "exactly 4"},
                    "answer_index": {"type": "INTEGER", "description": "0-3"},
                    "explanation_en": {"type": "STRING"},
                    "explanation_ko": {"type": "STRING"},
                    "distractor_rationale": {"type": "STRING", "description": "why each wrong option is tempting"},
                },
                "required": ["skill_tag", "ged_target", "difficulty", "dok", "stem_en", "stem_ko",
                             "choices_en", "answer_index", "explanation_en", "explanation_ko"],
            },
        }
    },
    "required": ["questions"],
}


def load_existing_stems():
    stems = set()
    for f in EXISTING:
        if not f.exists():
            continue
        for q in json.loads(f.read_text()).get("questions", []):
            stems.add(normalize(q["stem_i18n"].get("en", "")))
    for f in OUT_DIR.glob("*.json") if OUT_DIR.exists() else []:
        for q in json.loads(f.read_text()).get("questions", []):
            stems.add(normalize(q["stem_i18n"].get("en", "")))
    return stems


def normalize(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def build_prompt(subject, spec, targets, batch_size, avoid_samples):
    lines = [
        f"You are a senior GED® item writer for {spec['name']}.",
        "",
        "## Test specification (official blueprint — use as a SPEC, never copy official items)",
        f"- Domains: " + ", ".join(f"{d['label']} {int(d['weight']*100)}%" for d in spec["domains"]),
        f"- Item types in the real test: {', '.join(spec['item_types'])}",
        "- For this batch, write MULTIPLE-CHOICE items with exactly 4 options.",
    ]
    if "calculator" in spec:
        lines.append(f"- Calculator policy: {spec['calculator']}")
    lines += ["", "## Style rules (from the official assessment guide)"]
    lines += [f"- {s}" for s in spec["style_notes"]]

    if targets:
        lines += ["", "## Assessment targets to cover in this batch (use the exact code in ged_target)"]
        for code, desc in targets:
            lines.append(f"- {code}: {desc}")

    lines += ["", "## Quality rules"]
    lines += [f"- {r}" for r in BP["quality_rules"]]
    lines += [
        "",
        "## Output requirements",
        f"- Produce exactly {batch_size} NEW questions.",
        "- stem_en / choices_en / explanation_en in English; stem_ko / explanation_ko in natural Korean for a teenage learner.",
        "- stimulus_en: include a SHORT passage, table (as plain text), or scenario when the target needs one; otherwise empty string.",
        "- skill_tag: lowercase-hyphenated topic slug (e.g. 'ratios-rates', 'linear-equations-graphs', 'reading-inference').",
        "- Vary numbers, contexts, and difficulty across the batch. Do not reuse the same scenario twice.",
        "- Every item must be solvable and verifiable; double-check arithmetic before answering.",
    ]
    if avoid_samples:
        lines += ["", "## Already in the bank — do NOT repeat these (write different items)"]
        lines += [f"- {s}" for s in avoid_samples[:25]]
    return "\n".join(lines)


def call_gemini(api_key, prompt, max_tokens=32000):
    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "temperature": 0.9,
            "maxOutputTokens": max_tokens,
        },
    }).encode()
    last_err = None
    for model in MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Content-Type": "application/json", "x-goog-api-key": api_key})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                payload = json.loads(r.read())
            parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = "".join(p["text"] for p in parts if p.get("text") and not p.get("thought"))
            if not text:
                last_err = f"{model}: empty ({payload.get('candidates',[{}])[0].get('finishReason')})"
                continue
            return model, json.loads(text)
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:200]
            last_err = f"{model}: HTTP {e.code} {detail}"
            if e.code == 404:
                continue          # 이 키에서 없는 모델 → 다음 후보
            if e.code == 429:
                print("   429 rate limit — 30초 대기 후 재시도")
                time.sleep(30)
                continue
            break
        except Exception as e:                      # noqa: BLE001
            last_err = f"{model}: {e}"
            continue
    raise RuntimeError(last_err or "gemini call failed")


def validate(q, subject, seen_stems):
    """자동 검증. 통과 못하면 사유 반환."""
    stem = q.get("stem_en", "").strip()
    ch = q.get("choices_en") or []
    if len(stem) < 10:
        return "stem too short"
    if len(ch) != 4:
        return f"choices != 4 ({len(ch)})"
    if len({normalize(c) for c in ch}) != 4:
        return "duplicate choices"
    if not isinstance(q.get("answer_index"), int) or not 0 <= q["answer_index"] <= 3:
        return "answer_index out of range"
    for bad in ("all of the above", "none of the above", "위의 모두", "정답 없음"):
        if any(bad in c.lower() for c in ch):
            return "forbidden choice text"
    if not q.get("stem_ko", "").strip() or not q.get("explanation_ko", "").strip():
        return "missing Korean"
    if not q.get("explanation_en", "").strip():
        return "missing English explanation"
    key = normalize(stem)
    if key in seen_stems:
        return "duplicate of existing item"
    seen_stems.add(key)
    return None


def to_bank_format(q, subject):
    letters = ["a", "b", "c", "d"]
    stem_en = q["stem_en"].strip()
    stem_ko = q["stem_ko"].strip()
    stim_en = (q.get("stimulus_en") or "").strip()
    stim_ko = (q.get("stimulus_ko") or "").strip()
    if stim_en:
        stem_en = f"{stim_en}\n\n{stem_en}"
        stem_ko = f"{stim_ko or stim_en}\n\n{stem_ko}"
    return {
        "subject": subject,
        "skill_tag": q["skill_tag"].strip().lower(),
        "ged_target": q.get("ged_target", "").strip(),
        "difficulty": max(1, min(5, int(q.get("difficulty", 2)))),
        "dok": max(1, min(3, int(q.get("dok", 2)))),
        "format": "mc",
        "purpose": "practice",
        "status": "draft",
        "stem_i18n": {"en": stem_en, "ko": stem_ko},
        "choices": [{"id": letters[i], "text_i18n": {"en": c.strip()}}
                    for i, c in enumerate(q["choices_en"])],
        "answer": {"choice": letters[q["answer_index"]]},
        "explanation_i18n": {"en": q["explanation_en"].strip(), "ko": q["explanation_ko"].strip()},
        "distractor_rationale": (q.get("distractor_rationale") or "").strip(),
        "source": "ai-generated",
    }


def target_batches(subject, per_target, count):
    """생성 배치 목록: [(타깃 리스트, 배치 크기)]"""
    if subject == "math":
        targets = sorted(json.loads(MATH_TARGETS.read_text()).items())
        group = 4                       # 한 요청에 타깃 4개씩
        out = []
        for i in range(0, len(targets), group):
            chunk = targets[i:i + group]
            out.append((chunk, len(chunk) * per_target))
        return out
    # 그 외 과목은 도메인 기반
    spec = BP["subjects"][subject]
    total = count or 40
    out = []
    for d in spec["domains"]:
        n = max(4, round(total * d["weight"]))
        out.append(([(d["key"], d["label"])], n))
    return out


BP = json.loads(BLUEPRINT.read_text())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", choices=["math", "rla", "science", "social"])
    ap.add_argument("--all", action="store_true", help="4과목 전부")
    ap.add_argument("--per-target", type=int, default=3, help="수학: 타깃당 문항 수")
    ap.add_argument("--count", type=int, default=0, help="비수학: 과목당 총 문항 수")
    ap.add_argument("--dry-run", action="store_true", help="프롬프트만 출력")
    args = ap.parse_args()

    subjects = ["math", "rla", "science", "social"] if args.all else [args.subject or "math"]
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and not args.dry_run:
        sys.exit("GEMINI_API_KEY 환경변수가 필요합니다. (https://aistudio.google.com/apikey)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    seen = load_existing_stems()
    print(f"기존 문항 {len(seen)}개 로드 (중복 방지)")

    for subject in subjects:
        spec = BP["subjects"][subject]
        batches = target_batches(subject, args.per_target, args.count)
        accepted, rejected = [], []
        print(f"\n=== {subject} ({spec['name']}) — {len(batches)}개 배치 ===")

        for i, (targets, size) in enumerate(batches, 1):
            avoid = [s for s in list(seen)[:0]]      # 프롬프트 길이 절약: 샘플 생략
            prompt = build_prompt(subject, spec, targets, size, avoid)
            label = ", ".join(t[0] for t in targets)
            if args.dry_run:
                print(f"\n--- batch {i} ({label}, {size}문항) ---\n{prompt[:1200]}")
                continue
            print(f"[{i}/{len(batches)}] {label} — {size}문항 요청…", flush=True)
            try:
                model, out = call_gemini(api_key, prompt)
            except Exception as e:                    # noqa: BLE001
                print(f"   실패: {e}")
                continue
            for q in out.get("questions", []):
                why = validate(q, subject, seen)
                if why:
                    rejected.append((q.get("stem_en", "")[:60], why))
                else:
                    accepted.append(to_bank_format(q, subject))
            print(f"   → 누적 채택 {len(accepted)} / 반려 {len(rejected)} (model={model})")
            time.sleep(2)                              # 무료 티어 배려

        if args.dry_run or not accepted:
            continue
        stamp = time.strftime("%Y%m%d-%H%M%S")
        path = OUT_DIR / f"{subject}_{stamp}.json"
        path.write_text(json.dumps(
            {"_comment": f"AI 생성 문항 (검수 대기). subject={subject}, blueprint 기반.",
             "generated_at": stamp, "questions": accepted}, ensure_ascii=False, indent=1))
        print(f"\n✅ {subject}: {len(accepted)}문항 저장 → {path.relative_to(ROOT)}")
        if rejected:
            print(f"   반려 {len(rejected)}건:")
            for stem, why in rejected[:8]:
                print(f"   - [{why}] {stem}")


if __name__ == "__main__":
    main()
