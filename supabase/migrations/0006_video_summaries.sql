-- 0006: 강의 요약 (영어 원문 + 모국어 번역)
-- 영어 원문은 앱 번들(data/video_summaries.json)에 들어 있고,
-- 이 테이블은 번역본을 담는다. 학생 화면은 번역이 있으면 번역을, 없으면 영어를 보여준다.

create table public.video_summaries (
  youtube_id text primary key,
  summary_i18n jsonb not null default '{}'::jsonb,   -- {ko, zh, th} — en은 번들 원문 사용
  source text not null default 'khan',               -- 원문 출처
  model text,                                        -- 번역에 쓴 모델
  translated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.video_summaries enable row level security;

create policy "authed read video_summaries" on public.video_summaries for select
  using (auth.role() = 'authenticated');
create policy "admin write video_summaries" on public.video_summaries for all
  using (public.is_admin()) with check (public.is_admin());

create index on public.video_summaries (translated_at);
