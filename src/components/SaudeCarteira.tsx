"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from "recharts";

type BandaKey = "Verde" | "Amarelo" | "Vermelho" | "N/A";
type RedeScore = {
  rede: string;
  operacao: string;
  score: number | null;
  banda: BandaKey;
  codigo_matriz: string | null;
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
  const [redes, setRedes] = useState<RedeScore[]>([]);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [semDados, setSemDados] = useState(false);
  const [filtroBanda, setFiltroBanda] = useState<BandaKey | null>(null);
  const [busca, setBusca] = useState("");
  const [clientesPorNome, setClientesPorNome] = useState<Record<string, string>>({});
  const [csmPorCodigo, setCsmPorCodigo] = useState<Record<string, string>>({});
  const [csms, setCsms] = useState<{ id: string; nome: string }[]>([]);
  const [filtroCsm, setFiltroCsm] = useState<string>("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const linhas: RedeScore[] = [];
    let from = 0;
    let maisRecente = "";
    for (;;) {
      const { data, error } = await supabase
        .from("hs_scores")
        .select("rede, operacao, score, banda, codigo_matriz, importado_em")
        .eq("tipo", "rede")
        .order("score", { ascending: true, nullsFirst: false })
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      for (const row of data as (RedeScore & { importado_em: string })[]) {
        linhas.push(row);
        if (row.importado_em > maisRecente) maisRecente = row.importado_em;
      }
      if (data.length < 1000) break;
      from += 1000;
    }

    // Matrizes não-avaliadas (banda N/A) entram como "redes sem nota"
    let fromNA = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("hs_scores")
        .select("rede, operacao, score, banda, codigo, importado_em")
        .eq("tipo", "central").eq("banda", "N/A").eq("tipo_central", "Matriz")
        .range(fromNA, fromNA + 999);
      if (error || !data || data.length === 0) break;
      for (const row of data as (RedeScore & { codigo: string | null; importado_em: string })[]) {
        linhas.push({ rede: row.rede, operacao: row.operacao, score: null, banda: "N/A", codigo_matriz: row.codigo });
        if (row.importado_em > maisRecente) maisRecente = row.importado_em;
      }
      if (data.length < 1000) break;
      fromNA += 1000;
    }

    if (linhas.length === 0) { setSemDados(true); setCarregando(false); return; }

    // Carrega clientes para casar rede -> cliente pelo CÓDIGO (clients.bandeira = codigo_matriz)
    const mapaClientes: Record<string, string> = {};
    let cf = 0;
    const mapaCsmCodigo: Record<string, string> = {};
    for (;;) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, bandeira, csm_id")
        .range(cf, cf + 999);
      if (error || !data || data.length === 0) break;
      for (const c of data as { id: string; bandeira: string | null; csm_id: string | null }[]) {
        const chave = (c.bandeira ?? "").trim();
        if (chave && !mapaClientes[chave]) mapaClientes[chave] = c.id;
        if (chave && c.csm_id) mapaCsmCodigo[chave] = c.csm_id;
      }
      if (data.length < 1000) break;
      cf += 1000;
    }
    setClientesPorNome(mapaClientes);
    setCsmPorCodigo(mapaCsmCodigo);

    // Lista de CSMs (para o dropdown)
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name");
    if (perfis) {
      // só CSMs que têm ao menos um cliente casado com o HS
      const idsComCarteira = new Set(Object.values(mapaCsmCodigo));
      setCsms((perfis as { id: string; full_name: string }[])
        .filter(p => idsComCarteira.has(p.id))
        .map(p => ({ id: p.id, nome: p.full_name })));
    }

    setRedes(linhas);
    setUltimo(maisRecente || null);
    setSemDados(false);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // carregar é async; setState após await não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  // Base: redes do CSM selecionado (ou todas). Casa a matriz da rede -> csm_id do cliente
  const redesDoCsm = useMemo(() => {
    if (!filtroCsm) return redes;
    return redes.filter(r => {
      const cod = (r.codigo_matriz ?? "").trim();
      return cod && csmPorCodigo[cod] === filtroCsm;
    });
  }, [redes, filtroCsm, csmPorCodigo]);

  // Donut (contagem por banda) reativo ao filtro de CSM
  const dadosDonut = useMemo(() => {
    const cont: Record<string, number> = { Verde: 0, Amarelo: 0, Vermelho: 0, "N/A": 0 };
    redesDoCsm.forEach(r => { if (r.banda in cont) cont[r.banda]++; });
    return (["Verde", "Amarelo", "Vermelho", "N/A"] as const)
      .filter(b => cont[b] > 0)
      .map(b => ({ banda: ROTULO[b], bandaKey: b, valor: cont[b], cor: CORES[b] }));
  }, [redesDoCsm]);

  const redesFiltradas = useMemo(() => {
    const termo = norm(busca.trim());
    return redesDoCsm.filter(r => {
      if (filtroBanda && r.banda !== filtroBanda) return false;
      if (termo && !norm(r.rede).includes(termo)) return false;
      return true;
    });
  }, [redesDoCsm, filtroBanda, busca]);

  return (
    <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <p className="text-sm font-medium text-gray-700">Saúde da carteira (Health Score)</p>
          <p className="text-xs text-gray-400">
            Distribuição das redes por banda de risco
            {ultimo ? ` · atualizado em ${new Date(ultimo).toLocaleDateString("pt-BR")}` : ""}
          </p>
        </div>
        {csms.length > 0 && (
          <select
            value={filtroCsm}
            onChange={e => { setFiltroCsm(e.target.value); setFiltroBanda(null); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os CSMs</option>
            {csms.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
      </div>

      {carregando ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-100" />
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
                  data={dadosDonut}
                  dataKey="valor"
                  nameKey="banda"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  onClick={(_, index) => {
                    const b = dadosDonut[index]?.bandaKey;
                    if (b) setFiltroBanda(prev => (prev === b ? null : b));
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {dadosDonut.map((d, i) => (
                    <Cell key={i} fill={d.cor} opacity={filtroBanda && filtroBanda !== d.bandaKey ? 0.35 : 1} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center shrink-0 sm:pr-6">
              <p className="text-3xl font-semibold text-gray-900">{redesDoCsm.length}</p>
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
              {dadosDonut.map(d => d.bandaKey).map(b => (
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
                const clientId = r.codigo_matriz ? clientesPorNome[String(r.codigo_matriz).trim()] ?? null : null;
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
