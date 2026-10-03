-- 0007: 영어 선별 결과
-- 입학 기준(CEFR B1 이상)을 어디서 판정했는지 남기고, 과정·레벨 배정 근거로 쓴다.

alter table public.profiles
  add column if not exists cefr_band text
    check (cefr_band in ('pre_a2', 'pre_b1', 'b1', 'b2', 'c1')),
  add column if not exists cefr_pct int check (cefr_pct between 0 and 100);

comment on column public.profiles.cefr_band is
  '영어 선별 테스트 결과 밴드. pre_a2·pre_b1은 과정 진입 불가(선수 영어 과정 먼저).';

-- 응시 이력 — 재응시로 올라갔는지 추적한다
create table if not exists public.screening_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  version int not null default 1,
  pct int not null check (pct between 0 and 100),
  band text not null,
  section_scores jsonb not null default '{}'::jsonb,
  blocked_by_lesson boolean not null default false,
  taken_at timestamptz not null default now()
);

alter table public.screening_attempts enable row level security;

create policy "own read screening" on public.screening_attempts for select
  using (user_id = auth.uid() or public.is_admin());
create policy "own insert screening" on public.screening_attempts for insert
  with check (user_id = auth.uid());
create policy "admin delete screening" on public.screening_attempts for delete
  using (public.is_admin());

create index if not exists screening_attempts_user_idx
  on public.screening_attempts (user_id, taken_at desc);
