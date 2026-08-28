# GED 자율학습 앱 — 기능 명세서

> Claude Code 인계용. 커리큘럼 규칙은 별도 문서 `GED_실라버스_설계.md` 참조.

---

## 0. 개요

### 컨셉
칸 아카데미 영상을 유튜브 임베드로 가져와 GED 기간별 커리큘럼(6개월/1년/2년/3년)에 배치한다. 학생은 매일 지정된 것만 따라간다. 자체 문제은행으로 주기 테스트를 돌리고, 관리자는 진도와 취약점을 보며 관리한다. **다국어 해설이 차별점**이며, 영상은 추후 자체 제작으로 교체한다.

- 대상: 치앙마이 학생 (다국적, 영어 편차 큼)
- 교사 없음. 관리자만 존재
- 학생 무료

### 확정된 기술 결정

| 항목 | 결정 |
|---|---|
| 백엔드 | **Supabase** (Postgres + Auth + Storage + Edge Functions) |
| 코드 저장소 | **GitHub** |
| 인터넷 | **상시 연결 전제.** 오프라인 모드 불필요 |
| 주 디바이스 | **PC 우선**, 모바일 반응형 지원 |
| 인증 | **이메일 + 비밀번호** (Supabase Auth 표준). 학생 이메일은 등록 시 생성 |
| 배포 | 웹앱 우선 → 추후 앱스토어/플레이스토어 배포 |

### 배포 경로에 따른 초기 선택
스토어 배포를 전제로 하므로, 웹앱을 나중에 래핑할 수 있는 스택으로 시작한다.
- 권장: React + Vite (웹) → Capacitor로 네이티브 래핑
- 또는: React Native / Expo로 처음부터 통합
- **웹 전용 API에 의존하지 말 것.** 파일 접근, 알림, 라우팅은 래핑 호환 방식으로

---

## 1. 비교 분석 (기능 근거)

| 기능 | Kolibri | Khan Teacher | GED Flash/Aztec | GED Academy | **우리** |
|---|---|---|---|---|---|
| 콘텐츠 보유 | ✅ | ✅ | ✅ | ✅ | ❌ 임베드 |
| GED 형식 문항 | ❌ | ❌ | ✅ | ✅ | ✅ 자체제작 |
| 진단 배치 | ✅ | ✅ | ✅ | ✅ 적응형 | ✅ |
| 서브스킬 추적 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Time-on-task | ✅ | ✅ | ✅ | ✅ | ✅ |
| 과제 배정·마감 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 다국어 해설 | 일부 | ❌ | 스페인어만 | 스페인어만 | ✅ **차별점** |
| 기간별 자동 로드맵 | ❌ | ❌ | ❌ | 적응형 | ✅ **차별점** |

### 비교로 확보한 필수 기능
1. **GED 형식 모방** — 실제 GED는 드래그앤드롭, 드롭다운, 핫스팟 문항이 있다. 형식이 낯설면 아는 문제도 틀린다
2. **Time-on-task** — 완료 여부가 아니라 "몇 분 붙어 있었나". 교사 없는 환경의 유일한 부정 탐지 수단
3. **마스터리 건너뛰기** — 진단 통과 스킬은 로드맵에서 자동 제거. 없으면 상위권 학생이 이탈
4. **보충 계획 자동 생성** — 취약 스킬 3개를 시스템이 뽑아 로드맵에 삽입 제안
5. **반 전체 오답 집계** — 다수가 같은 문항을 틀리면 콘텐츠 결함. 문제은행 품질 루프

---

## 2. 아키텍처

```
┌──────────────────────────────────────────────┐
│ ① 커리큘럼 엔진                                │
│   기간 + 진단 → 일별 로드맵 생성 / 지연 시 재배치 │
├──────────────────────────────────────────────┤
│ ② 콘텐츠 레이어 (교체 가능)                     │
│   lesson ─┬─ video_source (youtube → self)   │
│           └─ questions[]                     │
├──────────────────────────────────────────────┤
│ ③ 학습 실행                                    │
│   오늘의 과제 / 시청 추적 / 채점 / 복습 큐        │
├──────────────────────────────────────────────┤
│ ④ 평가                                        │
│   데일리·위클리·먼슬리·페이즈·모의고사            │
├──────────────────────────────────────────────┤
│ ⑤ 관리자                                      │
│   대시보드 / 배정·승인 / 이탈 알림 / 문항 관리    │
├──────────────────────────────────────────────┤
│ ⑥ 다국어 (전 계층 관통) en / ko / zh / th       │
└──────────────────────────────────────────────┘
```

**핵심 원칙:** 레슨과 영상을 분리한다. 자체 영상으로 교체할 때 `video_source`만 갈아끼우면 학생 이력·문제은행·진도가 전부 보존된다.

---

## 3. 기능 명세 — 학생

### A. 오늘의 과제 (홈)
- 오늘 할 것만 표시. 선택지 없음. 순서 고정
- 진행 바 (3/5 완료)
- 항목별: 유형 아이콘 / 제목(모국어) / 예상 소요시간
- 미완료 항목 중 다음 것만 활성화 (순차 강제)
- PC: 좌측 로드맵 사이드바 + 우측 오늘 과제 / 모바일: 단일 컬럼

### B. 레슨 플레이어
- YouTube IFrame Player API 임베드
- 재생·일시정지·이탈 이벤트로 실시청 시간 누적
- 90% 이상 시청 시 완료 처리 (스킵 방지)
- 하단: 모국어 요약 3~5줄
- 출처 표기 필수: `Khan Academy (CC BY-NC-SA)`

### C. 문제 풀이
- 문항 형식: 객관식 / 드롭다운 채우기 / 드래그앤드롭 / 단답 / 핫스팟
- 즉시 채점 + 해설 (모국어 우선, 영어 병기 토글)
- 문항별 소요시간 기록

### D. 복습 큐
- 오답 자동 재등장: 1일 / 3일 / 7일 / 21일
- 4회 연속 정답 시 졸업

### E. 내 진도
- 과목별 진행률, 연속 학습일, 다음 마일스톤까지 남은 일수
- 취약 스킬 상위 3개

### F. 질문 남기기
- 레슨·문항별 질문 등록 → 관리자 큐

---

## 4. 기능 명세 — 관리자

### A. 학생 등록
1. 기본 정보 + 모국어 선택 + 이메일 계정 생성
2. 진단 실시(4과목) → Course Challenge 점수 입력
3. 목표 기간 선택 (6개월/1년/2년/3년)
4. 로드맵 자동 생성 → 관리자 검토·조정 → 확정

### B. 대시보드
- 계획 대비 진도율 (전체 / 학생별)
- 최근 14일 출석 히트맵
- ⚠️ 이탈 위험 알림: 3일 이상 미접속 / 2주 연속 지연 / 정답률 급락
- 과목별 정답률, 스킬별 취약 상위 5개
- 미답변 질문 큐 (뱃지)

### C. 학생 상세
- 일별 로그 (시청시간 / 정답률 / 소요시간)
- 자동 생성 보충 계획 → 승인 시 로드맵 삽입
- 기간 재조정 (1년 → 2년 연장 등, 로드맵 재생성)
- 개별 과제 수동 배정

### D. 콘텐츠 관리
- 레슨 CRUD, 영상 소스 교체
- 링크 유효성 자동 검사 결과 (깨진 youtube_id 알림)
- 문항 CRUD + AI 초안 생성 → 검수 → 게시
- 문항 품질 플래그: 정답률 20% 미만 또는 90% 초과

### E. 리포트
- CSV 내보내기 (점수·출석·학습시간)
- 후원자·이사회 보고용 요약

---

## 5. 시스템 자동 처리

| 기능 | 실행 위치 |
|---|---|
| 로드맵 생성 | Supabase Edge Function |
| 마스터리 스킵 | 로드맵 생성 시 |
| 간격 반복 스케줄링 | Edge Function (일 1회) |
| 기간별 자동 출제 | `week_index` 범위 쿼리 |
| 지연 보정 재배치 | 일 1회 배치 |
| 이탈 알림 | 일 1회 배치 |
| 링크 유효성 검사 | 주 1회 배치 |

---

## 6. 데이터 모델 (Supabase / Postgres)

```sql
-- auth.users 는 Supabase Auth 사용

profiles
  id uuid PK → auth.users
  role text            -- 'student' | 'admin'
  name text
  native_lang text     -- 'ko' | 'zh' | 'th' | 'en'
  target_duration text -- '6m' | '1y' | '2y' | '3y'
  enrolled_at, status

diagnostic_results
  id, user_id, subject, skill_tag, score, mastered bool, taken_at

lessons
  id, subject, phase, track, week_index, day_index, order_in_day
  khan_course, khan_unit, khan_section, skill_tag
  title_i18n jsonb, summary_i18n jsonb
  video_source jsonb   -- {type:'youtube'|'self', ref, duration_sec}
  attribution text
  estimated_minutes int

questions
  id, subject, skill_tag, week_index, difficulty smallint
  format text          -- 'mc'|'dropdown'|'drag_drop'|'short'|'hotspot'
  stem_i18n jsonb, choices jsonb, answer jsonb
  explanation_i18n jsonb
  status text          -- 'draft'|'reviewed'|'published'
  stats jsonb          -- {attempts, correct_rate, avg_seconds}

roadmaps
  id, user_id, generated_at, version, target_duration

roadmap_days
  id, roadmap_id, scheduled_date, day_index
  items jsonb          -- [{type:'lesson'|'quiz'|'review', ref_id, required}]
  status text          -- 'pending'|'partial'|'done'

lesson_progress
  id, user_id, lesson_id, watched_seconds, completion_pct, completed_at

attempts
  id, user_id, question_id, chosen jsonb, is_correct, seconds, attempted_at
  source text          -- 'daily'|'weekly'|'monthly'|'phase'|'mock'|'review'

review_queue
  id, user_id, question_id, next_due_at, streak, graduated bool

assessments
  id, user_id, type, week_from, week_to, question_ids jsonb, score, taken_at

question_threads
  id, user_id, ref_type, ref_id, body, answered_by, answered_at
```

**RLS 필수:** 학생은 본인 행만 조회·수정. 관리자는 전체. `profiles.role` 기준 정책 작성.

---

## 7. 개발 순서

### MVP — 수학 1과목, 파일럿 5~10명
1. Supabase 프로젝트 + GitHub 저장소 초기화
2. **Khan 콘텐츠 스크래핑** → lessons 시딩 (실라버스 문서 §6-1)
3. Auth (이메일) + profiles + RLS
4. 오늘의 과제 화면 + YouTube 플레이어 + 시청 추적
5. 문항 CRUD + 객관식 풀이 + 즉시 채점
6. 관리자 대시보드 최소판 (진도율 + 출석)
7. 한국어 해설 우선

### Phase 2
8. 로드맵 자동 생성 (4개 기간)
9. 진단 + 마스터리 스킵
10. 간격 반복 복습 큐
11. 주간·월간 자동 출제
12. 나머지 언어 (zh / th / en)

### Phase 3
13. GED 특수 문항 형식 (드래그앤드롭 등)
14. 보충 계획 자동 생성 + 이탈 알림
15. AI 문항 초안 파이프라인
16. 에세이 첨삭 (자체 루브릭 — Khan Writing Coach는 Khanmigo 유료라 사용 불가)
17. 과학·사회·RLA 확장

### Phase 4
18. Capacitor 래핑 → 앱스토어·플레이스토어 배포
19. 자체 영상 제작 및 `video_source` 교체

---

## 8. 남은 미결 사항

1. **다국어 우선순위** — 실제 학생 구성비 확인 필요. 태국어가 1순위일 가능성
2. **미성년자 개인정보** — 태국 현지 및 앱스토어 정책상 미성년 계정 처리 방식
3. **에세이 채점 방식** — 자체 루브릭 + AI 채점 여부
4. **문항 제작 인력** — AI 초안을 검수할 담당자 지정
