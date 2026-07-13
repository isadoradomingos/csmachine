"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { EtiquetaPercepcao, type Percepcao } from "@/components/Percepcao";

type ClienteCarteira = {
  id: string;
  marca: string;
  bandeira: string | null;
  last_contact: string | null;
};

type ItemFila = {
  id: string;
  marca: string;
  banda: string;      // banda do health score (ou "N/A")
  score: number | null;
  percepcao: Percepcao;
  percepcaoData: string | null;
  diasSemContato: number | null;
  prioridade: number;
  divergente: boolean; // score bom mas percepção de risco (ou vice-versa)
};

const CORES: Record<string, string> = {
  Verde: "#16a34a", Amarelo: "#f59e0b", Vermelho: "#dc2626", "N/A": "#94a3b8",
};
const ROTULO_BANDA: Record<string, string> = {
  Verde: "Saudável", Amarelo: "Em risco", Vermelho: "Crítico", "N/A": "Sem nota",
};

// Prioridade base pela banda
const BASE_BANDA: Record<string, number> = { Vermelho: 100, Amarelo: 60, "N/A": 40, Verde: 20 };
// Ajuste pela percepção do CSM
const AJUSTE_PERCEP: Record<string, number> = { risco: 30, atencao: 0, estavel: -30 };

function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function diasDesde(data: string | null): number | null {
  if (!data) return null;
  const d = new Date(data);
  const hoje = new Date();
  return Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function FilaPriorizacao({ clientes, onAbrirCliente, onContarCriticos }: { clientes: ClienteCarteira[]; onAbrirCliente: (id: string) => void; onContarCriticos?: (n: number) => void }) {
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  const montar = useCallback(async () => {
    setCarregando(true);
    if (clientes.length === 0) { setItens([]); setCarregando(false); return; }

    // 1) Health score das redes (paginado) -> mapa por nome normalizado
    const scorePorNome: Record<string, { score: number | null; banda: string }> = {};
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("hs_scores")
        .select("rede, score, banda")
        .eq("tipo", "rede")
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      for (const r of data as { rede: string; score: number | null; banda: string }[]) {
        const chave = norm(r.rede);
        if (chave && !scorePorNome[chave]) scorePorNome[chave] = { score: r.score, banda: r.banda };
      }
      if (data.length < 1000) break;
      from += 1000;
    }

    // 2) Percepção mais recente de cada cliente da carteira
    const ids = clientes.map(c => c.id);
    const percepPorCliente: Record<string, { percepcao: Percepcao; data: string }> = {};
    let cf = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("client_id, date, percepcao")
        .in("client_id", ids)
        .not("percepcao", "is", null)
        .order("date", { ascending: false })
        .range(cf, cf + 999);
      if (error || !data || data.length === 0) break;
      for (const row of data as { client_id: string; date: string; percepcao: string }[]) {
        // como vem ordenado desc, o primeiro de cada cliente é o mais recente
        if (!percepPorCliente[row.client_id]) {
          percepPorCliente[row.client_id] = { percepcao: row.percepcao as Percepcao, data: row.date };
        }
      }
      if (data.length < 1000) break;
      cf += 1000;
    }

    // 3) Monta os itens com prioridade
    const lista: ItemFila[] = clientes.map(c => {
      const hs = scorePorNome[norm(c.marca)];
      const banda = hs?.banda ?? "N/A";
      const score = hs?.score ?? null;
      const p = percepPorCliente[c.id];
      const percepcao = p?.percepcao ?? null;
      const percepcaoData = p?.data ?? null;

      const base = BASE_BANDA[banda] ?? 40;
      const ajuste = percepcao ? (AJUSTE_PERCEP[percepcao] ?? 0) : 0;
      const prioridade = base + ajuste;

      // Divergência: score saudável mas percepção de risco, ou score crítico mas percepção estável
      const divergente =
        (banda === "Verde" && percepcao === "risco") ||
        (banda === "Vermelho" && percepcao === "estavel");

      return {
        id: c.id,
        marca: c.marca,
        banda,
        score,
        percepcao,
        percepcaoData,
        diasSemContato: diasDesde(c.last_contact),
        prioridade,
        divergente,
      };
    });

    // 4) Ordena por prioridade desc, desempata por dias sem contato desc (mais tempo = mais urgente)
    lista.sort((a, b) => {
      if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade;
      const da = a.diasSemContato ?? -1;
      const db = b.diasSemContato ?? -1;
      return db - da;
    });

    setItens(lista);
    // Críticos = banda Vermelho OU percepção de risco
    const criticos = lista.filter(i => i.banda === "Vermelho" || i.percepcao === "risco").length;
    if (onContarCriticos) onContarCriticos(criticos);
    setCarregando(false);
  }, [clientes, onContarCriticos]);

  useEffect(() => {
    // montar é async; setState após await não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    montar();
  }, [montar]);

  const filtrados = useMemo(() => {
    const t = norm(busca.trim());
    if (!t) return itens;
    return itens.filter(i => norm(i.marca).includes(t));
  }, [itens, busca]);

  if (carregando) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div>
      <input
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar cliente na fila..."
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
      />

      {filtrados.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Nenhum cliente na fila.</p>
      ) : (
        <ul className="divide-y divide-slate-200/60">
          {filtrados.map((item, idx) => {
            const cor = CORES[item.banda] ?? "#94a3b8";
            return (
              <li key={item.id}>
                <button
                  onClick={() => onAbrirCliente(item.id)}
                  className={`w-full text-left px-3 py-3 flex items-center justify-between gap-3 hover:bg-slate-100 transition-colors rounded-lg ${item.divergente ? "ring-1 ring-red-200 bg-red-50/40" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-300 w-5 shrink-0 tabular-nums">{idx + 1}</span>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.marca}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs" style={{ color: cor }}>
                          {item.score !== null ? `${Math.round(item.score)} · ` : ""}{ROTULO_BANDA[item.banda]}
                        </span>
                        {item.percepcao && <EtiquetaPercepcao value={item.percepcao} />}
                        {item.divergente && (
                          <span className="text-xs text-red-600 font-medium">⚠ nota e percepção divergem</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {item.diasSemContato !== null ? (
                      <p className={`text-xs tabular-nums ${item.diasSemContato > 20 ? "text-amber-600" : "text-gray-400"}`}>
                        há {item.diasSemContato} {item.diasSemContato === 1 ? "dia" : "dias"}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300">sem contato</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
