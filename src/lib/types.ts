// Tipos centrais do CS Machine — espelham as tabelas do Supabase usadas no app.

export type Profile = {
  id: string;
  full_name: string;
  monthly_goal: number | null;
  ativo?: boolean | null;
};

export type Client = {
  id: string;
  marca: string;
  bandeira: string | null;
  operacao: string;
  cluster: string | null;
  plano: string | null;
  status?: string | null;
  health?: string | null;
  last_contact: string | null;
  data_inicio?: string | null;
  csm_id?: string | null;
  percepcoes_gerais?: string | null;
};

export type UserRole = {
  user_id: string;
  role: string;
};

export type Contact = {
  id: string;
  client_id?: string;
  date: string;
  type: "tentativa" | "efetivo" | "consultoria_produto" | string;
  note: string;
  canal: string | null;
};

// Cliente exibido em modais de listagem (follow-up, sem retorno)
export type ModalClient = {
  id: string;
  marca: string;
  bandeira: string | null;
  last_contact: string | null;
  daysSinceContact: number;
  tentativasSemRetorno?: number;
};
