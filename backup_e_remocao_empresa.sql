-- ========================================================
-- BACKUP e remoção de uma empresa (tenant) do Canal de Denúncias
-- Use quando um cliente cancelar e a empresa precisar ser removida.
--
-- Troque [SLUG] pelo slug exato da empresa em TODO o script.
-- ========================================================


-- ---------- PASSO 1 — Backup dos dados da empresa (tenant) ----------
-- Rode esta consulta, depois clique no botão de exportar/download
-- (acima da tabela de resultados) e escolha "Export as CSV".
-- Salve o arquivo com um nome como: backup_[SLUG]_tenant.csv

select slug, data
from tenants
where slug = '[SLUG]';


-- ---------- PASSO 2 — Backup de todas as denúncias da empresa ----------
-- Rode esta consulta e exporte como CSV também.
-- Salve como: backup_[SLUG]_denuncias.csv
-- (a coluna "denuncia_completa" traz o registro inteiro: relato,
--  mensagens, anexos, histórico de fases — tudo)

select
  d.protocolo,
  d.criado_em,
  d.data as denuncia_completa
from denuncias d
where d.slug = '[SLUG]'
order by d.criado_em;


-- ---------- PASSO 3 — Backup de quem administrava essa empresa ----------
-- Opcional, mas ajuda a lembrar quem tinha acesso, caso precise
-- recriar o acesso no futuro.

select u.email, fa.slug
from firm_admins fa
join auth.users u on u.id = fa.user_id
where fa.slug = '[SLUG]';


-- ==========================================================
-- ⚠️  SÓ AVANCE PARA O PASSO 4 DEPOIS DE CONFIRMAR
--     QUE OS 3 ARQUIVOS ACIMA FORAM BAIXADOS COM SUCESSO.
--     A exclusão abaixo é PERMANENTE e não pode ser desfeita.
-- ==========================================================


-- ---------- PASSO 4 — Excluir a empresa e todos os seus dados ----------

delete from denuncias where slug = '[SLUG]';
delete from firm_admins where slug = '[SLUG]';
delete from tenants where slug = '[SLUG]';

-- Conferir que não sobrou nada (as 3 consultas abaixo devem
-- retornar "No rows returned"):
-- select * from tenants where slug = '[SLUG]';
-- select * from denuncias where slug = '[SLUG]';
-- select * from firm_admins where slug = '[SLUG]';
