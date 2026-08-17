-- ========================================================
-- Super admin — enxerga e administra TODAS as empresas
-- Rode este script no SQL Editor (não precisa apagar nada antes,
-- ele só adiciona coisas novas por cima do que já existe)
-- ========================================================

create table if not exists super_admins (
  user_id uuid references auth.users(id) primary key
);
alter table super_admins enable row level security;
-- De propósito: nenhuma policy pública. Só acessível via funções abaixo.

-- Verifica se o usuário logado é super admin
create or replace function is_super_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from super_admins where user_id = auth.uid());
$$;
grant execute on function is_super_admin to authenticated;

-- Lista todas as empresas cadastradas, com a contagem de denúncias de cada uma
create or replace function super_list_tenants()
returns table(slug text, name text, total bigint) language sql security definer as $$
  select t.slug, t.data->>'name' as name, count(d.protocolo)
  from tenants t
  left join denuncias d on d.slug = t.slug
  where exists (select 1 from super_admins where user_id = auth.uid())
  group by t.slug, t.data->>'name'
  order by t.slug;
$$;
grant execute on function super_list_tenants to authenticated;

-- Atualiza as funções existentes para também aceitar o super admin
-- (sem remover o acesso normal de quem já é admin de uma empresa específica)
create or replace function is_authorized_admin(p_slug text)
returns boolean language sql security definer as $$
  select exists (select 1 from firm_admins where user_id = auth.uid() and slug = p_slug)
      or exists (select 1 from super_admins where user_id = auth.uid());
$$;

create or replace function admin_list_protocolos(p_slug text)
returns table(protocolo text) language sql security definer as $$
  select protocolo from denuncias
  where slug = p_slug
    and (
      exists (select 1 from firm_admins where user_id = auth.uid() and slug = p_slug)
      or exists (select 1 from super_admins where user_id = auth.uid())
    );
$$;

create or replace function save_tenant(p_slug text, p_data jsonb)
returns boolean language plpgsql security definer as $$
begin
  if not exists (select 1 from firm_admins where user_id = auth.uid() and slug = p_slug)
     and not exists (select 1 from super_admins where user_id = auth.uid()) then
    raise exception 'não autorizado';
  end if;
  insert into tenants (slug, data) values (p_slug, p_data)
  on conflict (slug) do update set data = excluded.data;
  return true;
end;
$$;

-- ========================================================
-- Pra te tornar super admin (troque pelo seu e-mail de login):
--
-- insert into super_admins (user_id)
-- select id from auth.users where email = 'seu-email@dominio.com';
-- ========================================================
