-- =====================================================================
-- HEALTH SCORE — Ajuste da tabela hs_scores (Fase 3)
-- Agora ela guarda score por CENTRAL e por REDE (coluna "tipo").
-- Seguro: recria a tabela vazia (ela ainda não tem scores calculados).
-- =====================================================================

drop table if exists hs_scores;

create table hs_scores (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('central','rede')),
  -- identificação: para central usa cod_interno; para rede usa o nome da rede
  cod_interno    text,                            -- preenchido quando tipo='central'
  rede           text not null,
  operacao       text not null check (operacao in ('Corridas','Entregas')),
  client_id      uuid references clients(id),     -- ligação com cliente do CRM (redes)
  nome           text,                            -- nome amigável (central) ou nome da rede
  score          numeric,                         -- 0-100 (parcial nesta fase)
  banda          text check (banda in ('Verde','Amarelo','Vermelho','N/A')),
  -- sub-notas do bloco Uso (0/50/100) para transparência
  sub_volume     numeric,
  sub_queda      numeric,
  sub_perdidas   numeric,
  -- metadados úteis
  n_centrais     int,                             -- quantas centrais compõem a rede (tipo='rede')
  volume_total   numeric,                         -- soma de finalizadas na janela (peso da agregação)
  parcial        boolean not null default true,
  calculado_em   timestamptz not null default now()
);

-- Uma linha por central, uma por rede (por operação)
create unique index hs_scores_central_uk on hs_scores (cod_interno, operacao) where tipo = 'central';
create unique index hs_scores_rede_uk    on hs_scores (rede, operacao)        where tipo = 'rede';
create index hs_scores_tipo_idx  on hs_scores (tipo);
create index hs_scores_banda_idx on hs_scores (banda);
create index hs_scores_client_idx on hs_scores (client_id);

-- RLS com o padrão correto do CRM (role public + autenticado)
alter table hs_scores enable row level security;
create policy "hs_scores_rw" on hs_scores
  for all to public using (auth.uid() is not null) with check (auth.uid() is not null);
