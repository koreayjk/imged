-- 0002: 가입 트리거 + 학생 상태 동기화 테이블 (파일럿 MVP)

-- 가입 시 profiles 행 자동 생성 (name/native_lang은 클라이언트 signUp 메타데이터에서)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, native_lang, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'native_lang', 'ko'),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 학생 앱 상태 블롭 (진도·출석·시도 이력). 문제은행이 DB로 옮겨가면 세분화 테이블로 이전.
create table public.student_state (
  user_id uuid primary key references public.profiles on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.student_state enable row level security;

create policy "own read student_state" on public.student_state for select
  using (user_id = auth.uid() or public.is_admin());
create policy "own upsert student_state" on public.student_state for insert
  with check (user_id = auth.uid());
create policy "own update student_state" on public.student_state for update
  using (user_id = auth.uid());
create policy "admin delete student_state" on public.student_state for delete
  using (public.is_admin());
