"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from "recharts";

type BandaCount = { banda: string; valor: number; cor: string };

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

export default function SaudeCarteira() {
  const [dados, setDados] = useState<BandaCount[]>([]);
  const [total, setTotal] = useState(0);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [semDados, setSemDados] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("hs_scores")
      .select("banda, calculado_em")
      .eq("tipo", "rede");

    if (error || !data || data.length === 0) {
      setSemDados(true);
      setCarregando(false);
      return;
    }

    const cont: Record<string, number> = { Verde: 0, Amarelo: 0, Vermelho: 0, "N/A": 0 };
    let maisRecente = "";
    for (const row of data as { banda: string; calculado_em: string }[]) {
      if (row.banda in cont) cont[row.banda]++;
      if (row.calculado_em > maisRecente) maisRecente = row.calculado_em;
    }

    const arr: BandaCount[] = (["Verde", "Amarelo", "Vermelho", "N/A"] as const)
      .filter(b => cont[b] > 0)
      .map(b => ({ banda: ROTULO[b], valor: cont[b], cor: CORES[b] }));

    setDados(arr);
    setTotal(data.length);
    setUltimo(maisRecente || null);
    setSemDados(false);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // carregar é async; setState após await não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

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
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={dados} dataKey="valor" nameKey="banda" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {dados.map((d, i) => <Cell key={i} fill={d.cor} />)}
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
      )}
    </div>
  );
}
