"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  intervaloDoPreset, SeletorPeriodo, type Preset,
  TIPOS_CONHECIDOS, COR_TOTAL, nomeTipo, corTipo,
} from "@/components/AdminAnalytics";

// Uma linha por CSM: id + nome + total + uma chave por tipo de contato (dinâmico)
type CsmBarra = { id: string; nome: string; nomeCompleto: string; total: number; [tipo: string]: number | string };

function ymd(d: Date) { return d.toISOString().split("T")[0]; }

export default function RankingCsm() {
  const [preset, setPreset] = useState<Preset>("este_mes");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const [dados, setDados] = useState<CsmBarra[]>([]);
  const [tiposPresentes, setTiposPresentes] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { inicio, fim } = intervaloDoPreset(preset, custom);
    if (fim < inicio) { setDados([]); setTiposPresentes([]); setCarregando(false); return; }

    type Row = { type: string; clients?: { csm_id: string | null } | { csm_id: string | null }[] | null };
    const rows: Row[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("type, clients!inner(csm_id)")
        .gte("date", ymd(inicio))
        .lte("date", ymd(fim))
        .order("date")
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < 1000) break;
      from += 1000;
    }

    // Conta por CSM e por tipo (dinâmico) + total
    const porCsm: Record<string, { total: number; tipos: Record<string, number> }> = {};
    const tiposSet = new Set<string>();
    rows.forEach(r => {
      const cl = Array.isArray(r.clients) ? r.clients[0] : r.clients;
      const csmId = cl?.csm_id;
      if (!csmId) return;
      if (!porCsm[csmId]) porCsm[csmId] = { total: 0, tipos: {} };
      porCsm[csmId].total += 1;
      porCsm[csmId].tipos[r.type] = (porCsm[csmId].tipos[r.type] ?? 0) + 1;
      tiposSet.add(r.type);
    });

    const ids = Object.keys(porCsm);
    let arr: CsmBarra[] = [];
    const tiposArr = [...tiposSet];

    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const nomePorId: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string }) => { nomePorId[p.id] = p.full_name ?? "—"; });

      // Desambiguação de nomes homônimos (Ana J. / Ana L.)
      const contagemPrimeiro: Record<string, number> = {};
      ids.forEach(id => { const pr = (nomePorId[id] ?? "—").split(" ")[0]; contagemPrimeiro[pr] = (contagemPrimeiro[pr] ?? 0) + 1; });
      function rotulo(nc: string): string {
        const p = nc.trim().split(/\s+/);
        const pr = p[0] ?? "—";
        if ((contagemPrimeiro[pr] ?? 0) > 1 && p.length > 1) return `${pr} ${p[p.length - 1][0]}.`;
        return pr;
      }

      arr = ids.map(id => {
        const linha: CsmBarra = {
          id,
          nome: rotulo(nomePorId[id] ?? "—"),
          nomeCompleto: nomePorId[id] ?? "—",
          total: porCsm[id].total,
        };
        // preenche cada tipo (0 quando ausente, pra barra não sumir)
        tiposArr.forEach(t => { linha[t] = porCsm[id].tipos[t] ?? 0; });
        return linha;
      }).sort((a, b) => b.total - a.total);
    }

    // Ordena tipos: conhecidos primeiro (ordem do dicionário), depois novos alfabéticos
    const ordemConhecidos = Object.keys(TIPOS_CONHECIDOS);
    const tiposOrdenados = tiposArr.sort((a, b) => {
      const ia = ordemConhecidos.indexOf(a), ib = ordemConhecidos.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    setDados(arr);
    setTiposPresentes(tiposOrdenados);
    setCarregando(false);
  }, [preset, custom]);

  useEffect(() => {
    // carregar() é async; setState ocorre após await, não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  // altura: espaço por CSM proporcional ao nº de barras (tipos + total)
  const barrasPorCsm = tiposPresentes.length + 1;
  const alturaPorCsm = Math.max(48, barrasPorCsm * 16);

  return (
    <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Número de contatos registrados por CSM</p>
          <p className="text-xs text-gray-400">Contatos registrados por CSM no período (todos os CSMs)</p>
        </div>
        <SeletorPeriodo preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
      </div>
      {carregando ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-100" />
      ) : dados.length === 0 ? (
        <p className="text-sm text-gray-400 py-16 text-center">Nenhum contato registrado no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, dados.length * alturaPorCsm)}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="id"
              tick={{ fontSize: 12, fill: "#475569" }}
              width={80}
              tickFormatter={(id: string) => dados.find(d => d.id === id)?.nome ?? ""}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              cursor={{ fill: "#f1f5f9" }}
              labelFormatter={(_l, payload) => {
                const item = payload && payload[0] ? (payload[0].payload as CsmBarra) : null;
                return item ? item.nomeCompleto : "";
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="total" name="Total" fill={COR_TOTAL} radius={[0, 4, 4, 0]} />
            {tiposPresentes.map((tipo, i) => (
              <Bar key={tipo} dataKey={tipo} name={nomeTipo(tipo)} fill={corTipo(tipo, i)} radius={[0, 4, 4, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
