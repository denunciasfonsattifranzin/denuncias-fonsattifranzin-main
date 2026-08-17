-- 1) Corrige o nome do tenant "demo" (Empresa 1)
update tenants set data = '{"name":"Empresa 1","primary":"#A4823E"}' where slug = 'demo';

-- 2) Cria o tenant da Empresa 2, com um slug próprio
insert into tenants (slug, data) values
  ('empresa2', '{"name":"Empresa 2","primary":"#A4823E"}')
on conflict (slug) do nothing;

-- 3) Remove o segundo e-mail do tenant "demo" (ele não deve administrar a Empresa 1)
delete from firm_admins
where slug = 'demo'
  and user_id = (select id from auth.users where email = 'henriquepadua20@hotmail.com');

-- 4) Autoriza esse e-mail a administrar a Empresa 2, no lugar
insert into firm_admins (user_id, slug)
select id, 'empresa2' from auth.users where email = 'henriquepadua20@hotmail.com';

-- 5) Conferir o resultado final
select t.slug, t.data->>'name' as nome, u.email as admin
from tenants t
join firm_admins fa on fa.slug = t.slug
join auth.users u on u.id = fa.user_id
order by t.slug;
