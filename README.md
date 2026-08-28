# GED 자율학습 앱

치앙마이 학생 대상 GED 자율학습 프로그램. 칸 아카데미 영상(유튜브 임베드) + 자체 문제은행 + 기간별(6개월/1년/2년/3년) 자동 로드맵.

- 기능 명세: [docs/GED_기능_명세서.md](docs/GED_기능_명세서.md)
- 커리큘럼 규칙: [docs/GED_실라버스_설계.md](docs/GED_실라버스_설계.md)

## 앱 (MVP)

```bash
cd app && npm install && npm run dev    # http://localhost:5173
```

- **데모 모드**: Supabase 없이 브라우저(localStorage)만으로 전체 플로우 동작 — 로그인 → 기간 선택 → 배치 테스트(상/중/하) → 오늘의 과제(순차 강제) → 유튜브 레슨(시청 추적, 90% 완료) → 문항 풀이(즉시 채점+모국어 해설) → 내 진도 / 관리자 대시보드
- **Supabase 연결**: `supabase/migrations/0001_init.sql` 적용 → `supabase/seed/*.sql` 순서대로 실행 → `app/.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정 (Auth 연동은 Phase 2)

## 실라버스 제작 파이프라인

앱 개발 전에 4과목 실라버스부터 확정한다. 파이프라인은 3단계:

```
1) 수집   scripts/scrape_khan.py      칸 코스 구조 → 유닛 → 레슨 → 영상(제목·유튜브 링크·길이)
2) 선별   config/ged_scope.json       GED 출제 범위 기준으로 들을 영상 / 뺄 영상 결정 (사유 포함)
3) 생성   scripts/generate_syllabus.py 6개월/1년/2년/3년 × 주차·일자별 상세 실라버스
```

### 실행 방법

```bash
pip install playwright
# 이 저장소의 원격 환경에서는 크로미움이 /opt/pw-browsers/chromium 에 있음:
#   KHAN_CHROMIUM=/opt/pw-browsers/chromium python scripts/scrape_khan.py
python scripts/scrape_khan.py          # 전체 코스 수집 (T0~T3, config/courses.json)
python scripts/generate_syllabus.py    # 4개 기간 실라버스 생성
```

### 산출물

| 파일 | 내용 |
|---|---|
| `data/parsed/<course>.json` | 코스별 정규화 구조 (영상 youtube_id, 길이 포함) |
| `docs/syllabus/영상선별_<course>.md` | 코스별 **들을 영상 / 뺄 영상** 목록 + 제외 사유 + 집계 |
| `docs/syllabus/실라버스_<기간>_<레벨>.md` | 기간(4종) × 레벨(기초/중급/상급) = 12종 주차·일자별 실라버스 |
| `docs/syllabus/제외목록_<기간>_<레벨>.md` | 레벨 스킵·시간 제약으로 빠진 영상 (보충 계획 소스) |
| `data/syllabus/<기간>_<레벨>.json` | 앱 시딩용 로드맵 원형 (roadmap_days) |
| `docs/syllabus/_검증_리포트.md` | 트랙별 분량 vs 주차 배분 검증 (설계 §6-3) |

레벨(상/중/하)은 온보딩 배치 테스트로 결정된다 — [docs/배치테스트_설계.md](docs/배치테스트_설계.md) 참조.

### 설정 파일

- `config/courses.json` — 수집 대상 코스 (티어 T0~T3, slug 후보)
- `config/ged_scope.json` — GED 범위 필터 규칙 (유닛 제목 정규식, 티어 조건, 제외 사유)
- `config/durations.json` — 기간별 트랙 배치 (주차 범위, 1일 배정 시간, 코스 순서)
- `config/levels.json` — 배치 레벨(기초/중급/상급)별 스킵 규칙·티어 보너스·확장 코스
- `config/video_overrides.json` — (선택) 영상 단위 수동 포함/제외 오버라이드

### 참고

- 영상선별 문서는 마지막에 생성된 기간의 티어 기준으로 작성된다 (전 기간 실행 시 T3 = 가장 넓은 범위).
- 유닛 제목 매칭 규칙(`ged_scope.json`)은 실제 스크래핑 결과와 대조해 확정할 것 (`_verify_after_scrape`).
- 스크래핑에는 `www.khanacademy.org` 네트워크 접근이 필요하다. 링크 검증까지 하려면 `www.youtube.com`도 필요.
