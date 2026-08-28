-- 0003: 에세이(GED Extended Response) 프롬프트 + 제출·채점 기록

create table public.essay_prompts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_i18n jsonb not null,
  passage text not null,            -- 지문 (영어)
  prompt_i18n jsonb not null,       -- 작성 과제 지시문
  time_limit_min int not null default 45,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  prompt_id uuid references public.essay_prompts,
  body text not null,
  word_count int not null default 0,
  scores jsonb,                     -- {trait1, trait2, trait3, total}
  feedback jsonb,                   -- 채점 상세 (grade-essay 함수 산출)
  model text,
  graded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.essay_prompts enable row level security;
alter table public.essays enable row level security;

create policy "authed read essay_prompts" on public.essay_prompts for select
  using (auth.role() = 'authenticated' and (published or public.is_admin()));
create policy "admin write essay_prompts" on public.essay_prompts for all
  using (public.is_admin()) with check (public.is_admin());

create policy "own read essays" on public.essays for select
  using (user_id = auth.uid() or public.is_admin());
create policy "own insert essays" on public.essays for insert
  with check (user_id = auth.uid());
create policy "admin delete essays" on public.essays for delete using (public.is_admin());

create index on public.essays (user_id, created_at desc);

-- 스타터 프롬프트 2개 (GED Extended Response 형식)
insert into public.essay_prompts (slug, title_i18n, passage, prompt_i18n) values
(
  'school-uniforms',
  '{"en": "Should Schools Require Uniforms?", "ko": "학교는 교복을 의무화해야 할까?"}',
  'An excerpt from a school board editorial:

"Supporters of school uniforms argue that they reduce distractions and level social differences. When every student wears the same clothing, no one is judged for what their family can afford. A 2019 survey of 450 principals found that 68 percent believed uniforms improved classroom focus. Uniforms may also save families money over time, since a few standard items replace a larger wardrobe.

Opponents answer that uniforms limit self-expression at exactly the age when young people are forming their identities. Clothing is one of the few ways students can show who they are. Critics also note that uniform policies create new costs: families must buy specific items from approved sellers, which can be more expensive than second-hand everyday clothes. Finally, several studies have found no clear link between uniforms and better grades or attendance."',
  '{"en": "In your response, analyze both positions to determine which one is better supported. Use relevant and specific evidence from the passage to support your answer. You have 45 minutes. Aim for 4-7 paragraphs.", "ko": "두 입장을 분석하여 어느 쪽이 더 잘 뒷받침되는지 판단하고, 지문의 구체적 근거를 인용해 주장을 펼치세요. 제한 시간 45분, 4~7문단 분량을 권장합니다."}'
),
(
  'phones-in-class',
  '{"en": "Cell Phones in the Classroom", "ko": "교실 안의 휴대폰"}',
  'An excerpt from an education magazine:

"Some teachers now build cell phones into their lessons. Students use them to look up sources, answer live quizzes, and record group projects. For schools that cannot afford a laptop for every student, the phone in each pocket is the cheapest computer lab available. A teacher in Ohio reported that participation in her history class doubled after she introduced phone-based quiz games.

Other educators see phones as the single biggest obstacle to learning. Notifications interrupt concentration every few minutes, and social media tempts even disciplined students. A study of 91 schools in England found that test scores rose by 6 percent after phones were banned, with the largest gains among struggling students. These educators argue that whatever phones add in convenience, they subtract far more in attention."',
  '{"en": "Weigh the evidence on both sides and argue which position is better supported. Cite specific details from the passage. You have 45 minutes. Aim for 4-7 paragraphs.", "ko": "양쪽의 근거를 비교 평가하고 어느 입장이 더 잘 뒷받침되는지 논증하세요. 지문의 구체적 내용을 인용해야 합니다. 제한 시간 45분, 4~7문단 분량을 권장합니다."}'
);
