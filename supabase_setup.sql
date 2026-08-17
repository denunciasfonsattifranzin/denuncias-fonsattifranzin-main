-- ========================================================
-- Canal de Denúncia — modelo de dados seguro
-- Rode este script inteiro no SQL Editor do Supabase
-- (apague antes as tabelas/policies antigas, se você já
--  tinha criado a versão anterior "app_storage")
-- ========================================================

drop table if exists app_storage;

-- Empresas-cliente (tenants)
create table if not exists tenants (
  slug text primary key,
  data jsonb not null   -- nome, cores, textos... NUNCA senha aqui
);

-- Quem pode administrar cada tenant (liga um usuário autenticado a um slug)
create table if not exists firm_admins (
  user_id uuid references auth.users(id) primary key,
  slug text references tenants(slug) not null
);

-- Denúncias
create table if not exists denuncias (
  slug text not null,
  protocolo text not null,
  data jsonb not null,
  criado_em timestamptz default now(),
  primary key (slug, protocolo)
);

alter table tenants enable row level security;
alter table firm_admins enable row level security;
alter table denuncias enable row level security;
-- De propósito: nenhuma "policy" pública é criada. Isso bloqueia
-- qualquer leitura/escrita direta via API REST do Supabase.
-- Todo acesso passa obrigatoriamente pelas funções abaixo.

-- ---------- funções ----------

-- Dados públicos do tenant (nome, cores) para montar a tela inicial
create or replace function get_tenant_public(p_slug text)
returns jsonb language sql security definer as $$
  select data from tenants where slug = p_slug;
$$;
grant execute on function get_tenant_public to anon, authenticated;

-- Admin (autenticado) atualiza os dados do tenant
create or replace function save_tenant(p_slug text, p_data jsonb)
returns boolean language plpgsql security definer as $$
begin
  if not exists (select 1 from firm_admins where user_id = auth.uid() and slug = p_slug) then
    raise exception 'não autorizado';
  end if;
  insert into tenants (slug, data) values (p_slug, p_data)
  on conflict (slug) do update set data = excluded.data;
  return true;
end;
$$;
grant execute on function save_tenant to authenticated;

-- Cria ou atualiza uma denúncia (usado tanto para o envio inicial quanto
-- para respostas do denunciante ou do comitê). Exige saber o protocolo exato,
-- que funciona como uma senha de uso único.
create or replace function upsert_denuncia(p_slug text, p_protocolo text, p_data jsonb)
returns boolean language plpgsql security definer as $$
begin
  insert into denuncias (slug, protocolo, data) values (p_slug, p_protocolo, p_data)
  on conflict (slug, protocolo) do update set data = excluded.data;
  return true;
end;
$$;
grant execute on function upsert_denuncia to anon, authenticated;

-- Consulta uma denúncia específica pelo protocolo (denunciante ou admin)
create or replace function get_denuncia_by_protocolo(p_slug text, p_protocolo text)
returns jsonb language sql security definer as $$
  select data from denuncias where slug = p_slug and protocolo = p_protocolo;
$$;
grant execute on function get_denuncia_by_protocolo to anon, authenticated;

-- Lista todos os protocolos de um tenant — só funciona para admin autorizado
create or replace function admin_list_protocolos(p_slug text)
returns table(protocolo text) language sql security definer as $$
  select protocolo from denuncias
  where slug = p_slug
    and exists (select 1 from firm_admins where user_id = auth.uid() and slug = p_slug);
$$;
grant execute on function admin_list_protocolos to authenticated;

-- Usada pela tela de login para confirmar se o usuário logado é admin do tenant
create or replace function is_authorized_admin(p_slug text)
returns boolean language sql security definer as $$
  select exists (select 1 from firm_admins where user_id = auth.uid() and slug = p_slug);
$$;
grant execute on function is_authorized_admin to authenticated;

-- ========================================================
-- Como cadastrar um cliente novo (ex.: Fonsatti | Franzin):
--
-- 1) Crie o tenant:
--    insert into tenants (slug, data) values
--      ('fonsattifranzin', '{"name":"Fonsatti | Franzin","primary":"#A4823E"}');
--
-- 2) Crie o login do administrador em
--    Authentication > Users > Add user (no painel do Supabase)
--
-- 3) Autorize esse usuário a administrar o tenant (troque o e-mail e o slug):
--    insert into firm_admins (user_id, slug)
--    select id, 'fonsattifranzin' from auth.users where email = 'contato@fonsattifranzin.com.br';
-- ========================================================
