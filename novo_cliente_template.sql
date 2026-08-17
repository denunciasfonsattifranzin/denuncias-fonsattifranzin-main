-- ========================================================
-- MODELO: cadastro de um novo cliente (tenant) no Canal de Denúncias
-- ========================================================
--
-- ANTES de rodar este SQL:
-- 1) Vá em Authentication > Users > Add user
-- 2) Cadastre o e-mail e senha da pessoa que vai administrar
--    o canal desse cliente (ex.: RH, comitê de apuração, etc.)
--
-- DEPOIS, preencha os itens abaixo e rode este script inteiro
-- no SQL Editor do Supabase:
--
--   [SLUG]  -> identificador curto, sem espaços/acentos, ex.: fonsattifranzin
--             (aparece na URL: seusite.com/?empresa=SLUG)
--   [NOME]  -> nome que aparece na tela pro denunciante
--   [COR]   -> cor principal da empresa, em hexadecimal, ex.: #B23A3A
--             (se não souber o código, veja em htmlcolorcodes.com)
--   [LOGO]  -> link direto para a imagem da logo (formato .png de
--             preferência, com fundo transparente) — ex.:
--             https://site-do-cliente.com/logo.png
--             Se a empresa ainda não tiver logo pronta, pode deixar
--             esse campo como está ("") que o sistema mostra só o nome.
--   [EMAIL] -> o e-mail que você acabou de cadastrar no passo 1
--
-- ========================================================

insert into tenants (slug, data) values
  ('[SLUG]', '{"name":"[NOME]","primary":"[COR]","background":"#F5E6E6","logo":"[LOGO]"}')
on conflict (slug) do update set data = excluded.data;

insert into firm_admins (user_id, slug)
select id, '[SLUG]' from auth.users where email = '[EMAIL]'
on conflict do nothing;

-- ========================================================
-- Para conferir se deu certo, rode esta consulta e veja se
-- o cliente novo aparece na lista:
--
-- select t.slug, t.data->>'name' as nome, t.data->>'primary' as cor,
--        t.data->>'logo' as logo, u.email as admin
-- from tenants t
-- join firm_admins fa on fa.slug = t.slug
-- join auth.users u on u.id = fa.user_id
-- order by t.slug;
-- ========================================================

-- ========================================================
-- Se a empresa já estiver cadastrada e você só quiser
-- adicionar/trocar a cor ou a logo depois, sem repetir tudo:
--
-- update tenants
-- set data = data || '{"primary":"[COR]","logo":"[LOGO]"}'
-- where slug = '[SLUG]';
-- ========================================================
