-- =====================================================================
-- PERCEPÇÃO DO CS — base de dados
-- Adiciona o campo de percepção (opcional) aos registros de contato.
-- Seguro: só adiciona uma coluna nova, não altera nada existente.
-- =====================================================================

alter table client_contacts
  add column if not exists percepcao text
  check (percepcao is null or percepcao in ('estavel', 'atencao', 'risco'));

comment on column client_contacts.percepcao is
  'Percepção do CS sobre o cliente no momento do contato (opcional): estavel, atencao ou risco';
