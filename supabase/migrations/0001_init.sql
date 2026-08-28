-- GED 자율학습 앱 — 초기 스키마 (기능 명세서 §6 + 배치테스트 설계 §6)
-- Supabase SQL Editor 또는 `supabase db push`로 적용

-- ─────────────────────────────────────────────── profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin')),
  name text not null,
  native_lang text not null default 'ko' check (native_lang in ('en', 'ko', 'zh', 'th')),
  target_duration text check (target_duration in ('6m', '1y', '2y', '3y')),
  placement_math text check (placement_math in ('basic', 'inter', 'adv')),
  placement_english text check (placement_english in ('basic', 'inter', 'adv')),
  enrolled_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'paused', 'graduated', 'dropped'))
);

-- ─────────────────────────────────────────────── 배치 테스트
create table public.placement_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  subject text not null check (subject in ('math', 'english')),
  score_pct numeric(5,2) not null,
  level_assigned text not null check (level_assigned in ('basic', 'inter', 'adv')),
  confirmed_by uuid references public.profiles,
  taken_at timestamptz not null default now()
);

create table public.diagnostic_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  subject text not null,
  skill_tag text not null,
  score numeric(5,2),
  mastered boolean not null default false,
  taken_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────── 콘텐츠
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('math', 'rla', 'science', 'social')),
  course_key text not null,          -- 'pre-algebra' 등 (config/courses.json key)
  tier text not null check (tier in ('T0', 'T1', 'T2', 'T3')),
  unit_slug text not null,
  unit_title text not null,
  lesson_slug text not null,
  lesson_title text not null,
  order_index int not null,          -- 코스 내 전역 순서
  skill_tag text not null,           -- unit_slug 기반
  title_i18n jsonb not null default '{}'::jsonb,
  summary_i18n jsonb not null default '{}'::jsonb,
  video_source jsonb not null,       -- {type:'youtube'|'self', ref, duration_sec, title}
  attribution text not null default 'Khan Academy (CC BY-NC-SA)',
  estimated_minutes int not null default 7,
  unique (course_key, lesson_slug, order_index)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('math', 'rla', 'science', 'social')),
  skill_tag text not null,
  week_index int,
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  format text not null default 'mc' check (format in ('mc', 'dropdown', 'drag_drop', 'short', 'hotspot')),
  stem_i18n jsonb not null,          -- {en: "...", ko: "..."}
  choices jsonb,                     -- [{id:'a', text_i18n:{...}}, ...]
  answer jsonb not null,             -- {choice:'a'} | {text:'42'} | ...
  explanation_i18n jsonb not null default '{}'::jsonb,
  purpose text not null default 'practice' check (purpose in ('practice', 'placement')),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published')),
  stats jsonb not null default '{"attempts": 0, "correct": 0, "avg_seconds": 0}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────── 실라버스 템플릿 (기간×레벨, 파이프라인 산출물)
create table public.syllabus_templates (
  id uuid primary key default gen_random_uuid(),
  duration text not null check (duration in ('6m', '1y', '2y', '3y')),
  level text not null check (level in ('basic', 'inter', 'adv')),
  version int not null default 1,
  generated_at timestamptz not null default now(),
  unique (duration, level, version)
);

create table public.syllabus_template_days (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.syllabus_templates on delete cascade,
  week int not null,
  day int not null,
  blocks jsonb not null,             -- generate_syllabus.py의 day.blocks 그대로
  unique (template_id, week, day)
);

-- ─────────────────────────────────────────────── 로드맵 (학생별 인스턴스)
create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  target_duration text not null check (target_duration in ('6m', '1y', '2y', '3y')),
  level_math text not null default 'basic',
  level_english text not null default 'basic',
  version int not null default 1,
  status text not null default 'active' check (status in ('draft', 'active', 'superseded')),
  generated_at timestamptz not null default now()
);

create table public.roadmap_days (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps on delete cascade,
  scheduled_date date not null,
  week int not null,
  day int not null,
  blocks jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'partial', 'done')),
  unique (roadmap_id, scheduled_date)
);

-- ─────────────────────────────────────────────── 학습 실행
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  video_ref text not null,           -- youtube_id
  watched_seconds int not null default 0,
  completion_pct numeric(5,2) not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, video_ref)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  chosen jsonb not null,
  is_correct boolean not null,
  seconds int not null default 0,
  source text not null default 'daily' check (source in ('daily', 'weekly', 'monthly', 'phase', 'mock', 'review', 'placement')),
  attempted_at timestamptz not null default now()
);

create table public.review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  next_due_at timestamptz not null,
  interval_index int not null default 0,   -- 0:1일 1:3일 2:7일 3:21일
  streak int not null default 0,
  graduated boolean not null default false,
  unique (user_id, question_id)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  type text not null check (type in ('weekly', 'monthly', 'phase', 'mock')),
  week_from int, week_to int,
  question_ids jsonb not null default '[]'::jsonb,
  score numeric(5,2),
  taken_at timestamptz not null default now()
);

create table public.question_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  ref_type text not null check (ref_type in ('lesson', 'question')),
  ref_id text not null,
  body text not null,
  answer text,
  answered_by uuid references public.profiles,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────── RLS
alter table public.profiles enable row level security;
alter table public.placement_tests enable row level security;
alter table public.diagnostic_results enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.syllabus_templates enable row level security;
alter table public.syllabus_template_days enable row level security;
alter table public.roadmaps enable row level security;
alter table public.roadmap_days enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.attempts enable row level security;
alter table public.review_queue enable row level security;
alter table public.assessments enable row level security;
alter table public.question_threads enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- 본인 행 조회/수정, 관리자는 전체
create policy "own or admin read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admin write profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "self update profile" on public.profiles for update using (id = auth.uid());

-- 콘텐츠: 로그인 사용자 전체 읽기, 쓰기는 관리자
create policy "authed read lessons" on public.lessons for select using (auth.role() = 'authenticated');
create policy "admin write lessons" on public.lessons for all using (public.is_admin()) with check (public.is_admin());
create policy "authed read published questions" on public.questions for select
  using (auth.role() = 'authenticated' and (status = 'published' or public.is_admin()));
create policy "admin write questions" on public.questions for all using (public.is_admin()) with check (public.is_admin());
create policy "authed read templates" on public.syllabus_templates for select using (auth.role() = 'authenticated');
create policy "admin write templates" on public.syllabus_templates for all using (public.is_admin()) with check (public.is_admin());
create policy "authed read template days" on public.syllabus_template_days for select using (auth.role() = 'authenticated');
create policy "admin write template days" on public.syllabus_template_days for all using (public.is_admin()) with check (public.is_admin());

-- 학생 데이터: 본인 행만, 관리자 전체
do $$
declare t text;
begin
  foreach t in array array['placement_tests','diagnostic_results','roadmaps','lesson_progress','attempts','review_queue','assessments','question_threads']
  loop
    execute format('create policy "own read %1$s" on public.%1$s for select using (user_id = auth.uid() or public.is_admin())', t);
    execute format('create policy "own insert %1$s" on public.%1$s for insert with check (user_id = auth.uid() or public.is_admin())', t);
    execute format('create policy "own update %1$s" on public.%1$s for update using (user_id = auth.uid() or public.is_admin())', t);
    execute format('create policy "admin delete %1$s" on public.%1$s for delete using (public.is_admin())', t);
  end loop;
end $$;

-- roadmap_days는 roadmap 경유 소유권
create policy "own read roadmap_days" on public.roadmap_days for select
  using (exists (select 1 from roadmaps r where r.id = roadmap_id and (r.user_id = auth.uid() or public.is_admin())));
create policy "own write roadmap_days" on public.roadmap_days for all
  using (exists (select 1 from roadmaps r where r.id = roadmap_id and (r.user_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from roadmaps r where r.id = roadmap_id and (r.user_id = auth.uid() or public.is_admin())));

-- 인덱스
create index on public.lessons (course_key, order_index);
create index on public.questions (subject, skill_tag) where status = 'published';
create index on public.attempts (user_id, attempted_at desc);
create index on public.review_queue (user_id, next_due_at) where not graduated;
create index on public.roadmap_days (roadmap_id, scheduled_date);
create index on public.lesson_progress (user_id);
