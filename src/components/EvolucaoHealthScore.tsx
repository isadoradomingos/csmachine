"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type Snapshot = {
  data_snapshot: string;
  verde: number;
  amarelo: number;
  vermelho: number;
  total: number;
};

const CORES = { verde: "#16a34a", amarelo: "#f59e0b", vermelho: "#dc2626" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function EvolucaoHealthScore() {
  const [totalGeral, setTotalGeral] = useState<Snapshot[]>([]);
  const [porCsm, setPorCsm] = useState<(Snapshot & { csm_id: string })[]>([]);
  const [csms, setCsms] = useState<{ id: string; nome: string }[]>([]);
  const [filtroCsm, setFiltroCsm] = useState<string>("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);

    // histórico geral (todos)
    const { data: geral } = await supabase
      .from("hs_historico")
      .select("data_snapshot, verde, amarelo, vermelho, total")
      .order("data_snapshot", { ascending: true });
    setTotalGeral((geral as Snapshot[]) ?? []);

    // histórico por CSM
    const { data: csmData } = await supabase
      .from("hs_historico_csm")
      .select("data_snapshot, csm_id, verde, amarelo, vermelho, total")
      .order("data_snapshot", { ascending: true });
    setPorCsm((csmData as (Snapshot & { csm_id: string })[]) ?? []);

    // nomes dos CSMs que têm histórico
    const idsComHistorico = [...new Set(((csmData as { csm_id: string }[]) ?? []).map(r => r.csm_id))];
    if (idsComHistorico.length > 0) {
      const { data: perfis } = await supabase
        .from("profiles").select("id, full_name").in("id", idsComHistorico).order("full_name");
      setCsms(((perfis as { id: string; full_name: string }[]) ?? []).map(p => ({ id: p.id, nome: p.full_name })));
    }

    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  // Monta os dados do gráfico conforme o filtro
  const grafico = useMemo(() => {
    const fonte: Snapshot[] = filtroCsm
      ? porCsm.filter(r => r.csm_id === filtroCsm)
      : totalGeral;
    return fonte.map(d => {
      const [ano, mes] = d.data_snapshot.split("-");
      return {
        rotulo: `${MESES[parseInt(mes, 10) - 1]}/${ano.slice(2)}`,
        Verde: d.verde,
        Amarelo: d.amarelo,
        Vermelho: d.vermelho,
      };
    });
  }, [filtroCsm, porCsm, totalGeral]);

  if (carregando) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700/40" />;
  }

  return (
    <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <p className="text-sm font-medium text-gray-700">Evolução do Health Score</p>
          <p className="text-xs text-gray-400">Distribuição das redes por banda ao longo dos meses</p>
        </div>
        {csms.length > 0 && (
          <select
            value={filtroCsm}
            onChange={e => setFiltroCsm(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os CSMs</option>
            {csms.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
      </div>

      <div className="mt-3">
        {grafico.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            {filtroCsm
              ? "Ainda não há histórico por CSM para este período. Aparece a partir da próxima importação."
              : "Ainda não há histórico. A evolução aparece aqui a partir da próxima importação."}
          </p>
        ) : grafico.length === 1 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">Primeiro mês registrado ({grafico[0].rotulo}).</p>
            <p className="text-xs text-gray-400 mt-1">O gráfico de tendência aparece a partir do segundo mês.</p>
            <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
              <span className="text-sm"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: CORES.verde }} />Verde: {grafico[0].Verde}</span>
              <span className="text-sm"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: CORES.amarelo }} />Amarelo: {grafico[0].Amarelo}</span>
              <span className="text-sm"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: CORES.vermelho }} />Vermelho: {grafico[0].Vermelho}</span>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={grafico} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: "#475569" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Verde" stroke={CORES.verde} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Amarelo" stroke={CORES.amarelo} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Vermelho" stroke={CORES.vermelho} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
