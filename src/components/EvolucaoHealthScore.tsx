"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type Snapshot = {
  data_snapshot: string;
  verde: number;
  amarelo: number;
  vermelho: number;
  sem_nota: number;
  total: number;
};

const CORES = { verde: "#16a34a", amarelo: "#f59e0b", vermelho: "#dc2626" };

export default function EvolucaoHealthScore() {
  const [dados, setDados] = useState<Snapshot[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase
      .from("hs_historico")
      .select("data_snapshot, verde, amarelo, vermelho, sem_nota, total")
      .order("data_snapshot", { ascending: true });
    setDados((data as Snapshot[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  // Formata a data para "mês/ano" (ex: ago/26)
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const grafico = dados.map(d => {
    const [ano, mes] = d.data_snapshot.split("-");
    return {
      rotulo: `${meses[parseInt(mes, 10) - 1]}/${ano.slice(2)}`,
      Verde: d.verde,
      Amarelo: d.amarelo,
      Vermelho: d.vermelho,
    };
  });

  if (carregando) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700/40" />;
  }

  return (
    <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <p className="text-sm font-medium text-gray-700 mb-1">Evolução do Health Score</p>
      <p className="text-xs text-gray-400 mb-4">Distribuição das redes por banda ao longo dos meses</p>

      {grafico.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">
          Ainda não há histórico. A evolução aparece aqui a partir da próxima importação.
        </p>
      ) : grafico.length === 1 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">Primeiro mês registrado ({grafico[0].rotulo}).</p>
          <p className="text-xs text-gray-400 mt-1">
            O gráfico de tendência aparece a partir do segundo mês, quando houver com o que comparar.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
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
  );
}
