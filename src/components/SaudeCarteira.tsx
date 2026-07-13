"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from "recharts";

type BandaKey = "Verde" | "Amarelo" | "Vermelho" | "N/A";
type BandaCount = { banda: string; bandaKey: BandaKey; valor: number; cor: string };
type RedeScore = {
  rede: string;
  operacao: string;
  score: number | null;
  banda: BandaKey;
  sub_volume: number | null;
  sub_queda: number | null;
  sub_perdidas: number | null;
  client_id: string | null;
};

const CORES: Record<string, string> = {
  Verde: "#16a34a",
  Amarelo: "#f59e0b",
  Vermelho: "#dc2626",
  "N/A": "#94a3b8",
};
const ROTULO: Record<string, string> = {
  Verde: "Saudável (Verde)",
  Amarelo: "Em risco (Amarelo)",
  Vermelho: "Crítico (Vermelho)",
  "N/A": "Não avaliado",
};
const ROTULO_CURTO: Record<string, string> = {
  Verde: "Saudável",
  Amarelo: "Em risco",
  Vermelho: "Crítico",
  "N/A": "Não avaliado",
};

function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function SaudeCarteira() {
  const router = useRouter();
  const [dados, setDados] = useState<BandaCount[]>([]);
  const [redes, setRedes] = useState<RedeScore[]>([]);
  const [total, setTotal] = useState(0);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [semDados, setSemDados] = useState(false);
  const [filtroBanda, setFiltroBanda] = useState<BandaKey | null>(null);
  const [busca, setBusca] = useState("");
  const [clientesPorNome, setClientesPorNome] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    const linhas: RedeScore[] = [];
    let from = 0;
    let maisRecente = "";
    for (;;) {
      const { data, error } = await supabase
        .from("hs_scores")
        .select("rede, operacao, score, banda, sub_volume, sub_queda, sub_perdidas, client_id, calculado_em")
        .eq("tipo", "rede")
        .order("score", { ascending: true, nullsFirst: false })
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      for (const row of data as (RedeScore & { calculado_em: string })[]) {
        linhas.push(row);
        if (row.calculado_em > maisRecente) maisRecente = row.calculado_em;
      }
      if (data.length < 1000) break;
      from += 1000;
    }

    if (linhas.length === 0) { setSemDados(true); setCarregando(false); return; }

    // Carrega clientes para casar rede -> cliente por nome (client_id não é preenchido no hs_scores)
    const mapaClientes: Record<string, string> = {};
    let cf = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, marca")
        .range(cf, cf + 999);
      if (error || !data || data.length === 0) break;
      for (const c of data as { id: string; marca: string }[]) {
        const chave = norm(c.marca);
        if (chave && !mapaClientes[chave]) mapaClientes[chave] = c.id;
      }
      if (data.length < 1000) break;
      cf += 1000;
    }
    setClientesPorNome(mapaClientes);

    const cont: Record<string, number> = { Verde: 0, Amarelo: 0, Vermelho: 0, "N/A": 0 };
    linhas.forEach(r => { if (r.banda in cont) cont[r.banda]++; });

    const arr: BandaCount[] = (["Verde", "Amarelo", "Vermelho", "N/A"] as const)
      .filter(b => cont[b] > 0)
      .map(b => ({ banda: ROTULO[b], bandaKey: b, valor: cont[b], cor: CORES[b] }));

    setDados(arr);
    setRedes(linhas);
    setTotal(linhas.length);
    setUltimo(maisRecente || null);
    setSemDados(false);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // carregar é async; setState após await não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const redesFiltradas = useMemo(() => {
    const termo = norm(busca.trim());
    return redes.filter(r => {
      if (filtroBanda && r.banda !== filtroBanda) return false;
      if (termo && !norm(r.rede).includes(termo)) return false;
      return true;
    });
  }, [redes, filtroBanda, busca]);

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <p className="text-sm font-medium text-gray-700">Saúde da carteira (Health Score)</p>
          <p className="text-xs text-gray-400">
            Distribuição das redes por banda de risco
            {ultimo ? ` · atualizado em ${new Date(ultimo).toLocaleDateString("pt-BR")}` : ""}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Score parcial</span>
      </div>

      {carregando ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      ) : semDados ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-400">Nenhum health score calculado ainda.</p>
          <p className="text-xs text-gray-400 mt-1">Importe os dados e rode o cálculo na tela de Health Score.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="valor"
                  nameKey="banda"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  onClick={(_, index) => {
                    const b = dados[index]?.bandaKey;
                    if (b) setFiltroBanda(prev => (prev === b ? null : b));
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {dados.map((d, i) => (
                    <Cell key={i} fill={d.cor} opacity={filtroBanda && filtroBanda !== d.bandaKey ? 0.35 : 1} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center shrink-0 sm:pr-6">
              <p className="text-3xl font-semibold text-gray-900">{total}</p>
              <p className="text-xs text-gray-400">redes avaliadas</p>
            </div>
          </div>

          {/* Filtros + busca */}
          <div className="mt-4 pt-4 border-t border-slate-200/60">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <button
                onClick={() => setFiltroBanda(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filtroBanda === null ? "border-transparent bg-slate-700 text-white" : "border-slate-200 text-gray-500 bg-white hover:bg-slate-100"}`}
              >
                Todas
              </button>
              {(["Verde", "Amarelo", "Vermelho", "N/A"] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setFiltroBanda(prev => (prev === b ? null : b))}
                  className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                  style={filtroBanda === b
                    ? { backgroundColor: CORES[b], borderColor: "transparent", color: "white" }
                    : { backgroundColor: "white", borderColor: "#e2e8f0", color: "#64748b" }}
                >
                  {ROTULO_CURTO[b]}
                </button>
              ))}
            </div>

            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar rede por nome..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <p className="text-xs text-gray-400 mt-2">
              {redesFiltradas.length} {redesFiltradas.length === 1 ? "rede" : "redes"}
              {filtroBanda ? ` · ${ROTULO_CURTO[filtroBanda]}` : ""}
            </p>

            <ul className="mt-2 divide-y divide-slate-200/60 max-h-96 overflow-y-auto rounded-lg border border-slate-200/60">
              {redesFiltradas.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma rede encontrada.</li>
              ) : redesFiltradas.map((r, i) => {
                const cor = CORES[r.banda];
                const clientId = r.client_id ?? clientesPorNome[norm(r.rede)] ?? null;
                const clicavel = !!clientId;
                return (
                  <li key={`${r.rede}-${r.operacao}-${i}`}>
                    <button
                      onClick={() => { if (clientId) router.push(`/clients/${clientId}`); }}
                      disabled={!clicavel}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${clicavel ? "hover:bg-slate-100 cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{r.rede}</p>
                          <p className="text-xs text-gray-400">{r.operacao}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold" style={{ color: cor }}>
                          {r.score !== null ? Math.round(r.score) : "—"}
                        </span>
                        {clicavel && <span className="text-xs text-gray-400">→</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
