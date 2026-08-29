-- 본인 계정에 관리자 권한 부여
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- (앱에서 먼저 이 이메일로 회원가입이 되어 있어야 합니다)

update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'imamerica2414@gmail.com');

-- 확인: role이 admin으로 나오면 성공
select p.id, u.email, p.name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'imamerica2414@gmail.com';
