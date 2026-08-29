-- 0005: 커리큘럼 방식 (집중형 / 병렬형)
--   focus    = 수학·영어 선행 후 과학·사회 집중 블록 (기존 동작, 기본값)
--   parallel = 4과목 상시 병렬

alter table public.profiles
  add column if not exists curriculum_style text not null default 'focus'
    check (curriculum_style in ('focus', 'parallel'));

comment on column public.profiles.curriculum_style is
  '커리큘럼 방식. 실라버스 템플릿 파일 <기간>_<레벨>_<방식>.json 선택에 사용.';

-- 로드맵도 같은 축을 갖는다 (재생성 시 어떤 방식으로 만들었는지 추적)
alter table public.roadmaps
  add column if not exists curriculum_style text not null default 'focus'
    check (curriculum_style in ('focus', 'parallel'));

alter table public.syllabus_templates
  add column if not exists style text not null default 'focus'
    check (style in ('focus', 'parallel'));

-- (duration, level, version) 유니크 제약에 style을 포함
alter table public.syllabus_templates
  drop constraint if exists syllabus_templates_duration_level_version_key;
alter table public.syllabus_templates
  add constraint syllabus_templates_duration_level_style_version_key
    unique (duration, level, style, version);
