-- =====================================================================
-- TEMA (claro/escuro) — preferência do usuário
-- Adiciona a coluna de tema ao perfil. Seguro: só adiciona uma coluna.
-- Valores: 'light' ou 'dark'. Default 'dark' (o app hoje é escuro).
-- =====================================================================

alter table profiles
  add column if not exists tema text
  check (tema is null or tema in ('light', 'dark'))
  default 'dark';

comment on column profiles.tema is
  'Preferência de tema do usuário: light ou dark. Default dark (tema atual do app).';
