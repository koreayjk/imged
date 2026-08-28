-- 0004: AI 생성 문항 검수 파이프라인

-- questions 테이블 확장 (검수 메타)
-- status에 'rejected' 추가
alter table public.questions drop constraint if exists questions_status_check;
alter table public.questions add constraint questions_status_check
  check (status in ('draft', 'reviewed', 'published', 'rejected'));
alter table public.questions add column if not exists ged_target text;
alter table public.questions add column if not exists dok smallint;
alter table public.questions add column if not exists source text not null default 'human';
alter table public.questions add column if not exists distractor_rationale text;
alter table public.questions add column if not exists reviewed_by uuid references public.profiles;
alter table public.questions add column if not exists reviewed_at timestamptz;
alter table public.questions add column if not exists review_note text;

-- 검수 대기 문항 조회용 인덱스
create index if not exists questions_review_idx on public.questions (status, subject, created_at desc);

-- 관리자만 draft/reviewed 문항 조회 가능 (기존 정책이 이미 그렇게 되어 있음)
-- 검수 승인/반려 헬퍼
create or replace function public.review_question(
  q_id uuid, decision text, note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if decision not in ('published', 'draft', 'rejected') then
    raise exception 'invalid decision: %', decision;
  end if;
  update public.questions
     set status = decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = coalesce(note, review_note)
   where id = q_id;
end $$;
