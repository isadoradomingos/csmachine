"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type Fatia = { nome: string; valor: number };

// Rótulos amigáveis para clusters conhecidos
const CLUSTER_LABEL: Record<string, string> = {
  high_touch: "High Touch",
  mid_touch: "Mid Touch",
  growth_touch: "Growth Touch",
  no_touch: "No Touch",
};
const OPERACAO_LABEL: Record<string, string> = {
  corridas: "Corridas",
  entregas: "Entregas",
  ambos: "Ambos",
};

const CORES_CLUSTER = ["#2563eb", "#8b5cf6", "#f59e0b", "#64748b", "#ec4899", "#14b8a6"];
const CORES_OPERACAO = ["#2563eb", "#16a34a", "#f59e0b", "#a855f7"];

function label(mapa: Record<string, string>, chave: string): string {
  if (!chave) return "Não definido";
  return mapa[chave] ?? chave.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export default function DistribuicaoCarteira() {
  const [porCluster, setPorCluster] = useState<Fatia[]>([]);
  const [porOperacao, setPorOperacao] = useState<Fatia[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    type Row = { cluster: string | null; operacao: string | null };
    const rows: Row[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("clients")
        .select("cluster, operacao")
        .eq("status", "ativo")
        .order("id")
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < 1000) break;
      from += 1000;
    }

    const clusterCount: Record<string, number> = {};
    const operacaoCount: Record<string, number> = {};
    rows.forEach(r => {
      const c = r.cluster ?? "";
      const o = r.operacao ?? "";
      clusterCount[c] = (clusterCount[c] ?? 0) + 1;
      operacaoCount[o] = (operacaoCount[o] ?? 0) + 1;
    });

    const clusterArr = Object.entries(clusterCount)
      .map(([k, v]) => ({ nome: label(CLUSTER_LABEL, k), valor: v }))
      .sort((a, b) => b.valor - a.valor);
    const operacaoArr = Object.entries(operacaoCount)
      .map(([k, v]) => ({ nome: label(OPERACAO_LABEL, k), valor: v }))
      .sort((a, b) => b.valor - a.valor);

    setPorCluster(clusterArr);
    setPorOperacao(operacaoArr);
    setTotal(rows.length);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // carregar() é async; setState ocorre após await, não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Por cluster (pizza) */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-700 mb-1">Carteira por cluster</p>
        <p className="text-xs text-gray-400 mb-4">Distribuição dos {total} clientes ativos por nível de atendimento</p>
        {carregando ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ) : porCluster.length === 0 ? (
          <p className="text-sm text-gray-400 py-16 text-center">Sem dados de cluster.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porCluster} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label labelLine={false}>
                {porCluster.map((_, i) => <Cell key={i} fill={CORES_CLUSTER[i % CORES_CLUSTER.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Por operação (barras) */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-700 mb-1">Carteira por operação</p>
        <p className="text-xs text-gray-400 mb-4">Distribuição dos {total} clientes ativos por tipo de operação</p>
        {carregando ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ) : porOperacao.length === 0 ? (
          <p className="text-sm text-gray-400 py-16 text-center">Sem dados de operação.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porOperacao} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#475569" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="valor" name="Clientes" radius={[4, 4, 0, 0]}>
                {porOperacao.map((_, i) => <Cell key={i} fill={CORES_OPERACAO[i % CORES_OPERACAO.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
