"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import ImportarHealthScore from "@/components/ImportarHealthScore";

type ResumoBanda = { Verde: number; Amarelo: number; Vermelho: number; "N/A": number };

const CORES_BANDA: Record<string, string> = {
  Verde: "#16a34a",
  Amarelo: "#f59e0b",
  Vermelho: "#dc2626",
  "N/A": "#94a3b8",
};

export default function HealthScorePage() {
  const router = useRouter();
  const [resumoRede, setResumoRede] = useState<ResumoBanda | null>(null);
  const [ultimaImportacao, setUltimaImportacao] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Carrega o resumo das redes já importadas
  const carregarResumo = useCallback(async () => {
    setCarregando(true);
    const linhas: { banda: string; importado_em: string }[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("hs_scores")
        .select("banda, importado_em")
        .eq("tipo", "rede")
        .range(from, from + 999);
      if (error) { setCarregando(false); return; }
      if (!data || data.length === 0) break;
      linhas.push(...(data as { banda: string; importado_em: string }[]));
      if (data.length < 1000) break;
      from += 1000;
    }
    if (linhas.length > 0) {
      const r: ResumoBanda = { Verde: 0, Amarelo: 0, Vermelho: 0, "N/A": 0 };
      let maisRecente = "";
      for (const row of linhas) {
        const b = (row.banda ?? "N/A");
        if (b in r) r[b as keyof ResumoBanda]++;
        else r["N/A"]++;
        if (row.importado_em > maisRecente) maisRecente = row.importado_em;
      }
      setResumoRede(r);
      setUltimaImportacao(maisRecente || null);
    } else {
      setResumoRede(null);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // carregarResumo é async; setState após await não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarResumo();
  }, [carregarResumo]);

  const totalRedes = resumoRede ? resumoRede.Verde + resumoRede.Amarelo + resumoRede.Vermelho + resumoRede["N/A"] : 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800">
      <header className="bg-white dark:bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="font-semibold text-gray-900">Health Score</h1>
        <button onClick={() => router.push("/admin")} className="text-sm text-gray-500 hover:text-gray-700">← Voltar ao admin</button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Importar planilha */}
        <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-700 mb-1">Importar planilha do Health Score</p>
          <p className="text-xs text-gray-400 mb-4">
            Suba a planilha (.xlsx ou .csv) com as abas de Rede e Central. O Health Score já vem calculado —
            a importação apenas lê e grava os dados. Reimportar substitui a base anterior.
          </p>
          <ImportarHealthScore onConcluido={() => carregarResumo()} />
        </div>

        {/* Resumo por banda (redes) */}
        {carregando ? (
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700/40" />
        ) : resumoRede ? (
          <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <p className="text-sm font-medium text-gray-700">Distribuição das redes por banda</p>
              {ultimaImportacao && (
                <p className="text-xs text-gray-400">Importado em {new Date(ultimaImportacao).toLocaleString("pt-BR")}</p>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">{totalRedes} redes classificadas</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["Verde", "Amarelo", "Vermelho", "N/A"] as const).map(b => {
                const qtd = resumoRede[b];
                const pct = totalRedes > 0 ? Math.round((qtd / totalRedes) * 100) : 0;
                return (
                  <div key={b} className="rounded-xl border border-slate-200/80 p-4" style={{ borderLeftColor: CORES_BANDA[b], borderLeftWidth: 4 }}>
                    <p className="text-xs text-gray-400">{b === "N/A" ? "Não avaliado" : b}</p>
                    <p className="text-2xl font-semibold text-gray-900">{qtd}</p>
                    <p className="text-xs text-gray-400">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
            <p className="text-sm text-gray-500">Nenhum dado importado ainda. Suba a planilha acima para começar.</p>
          </div>
        )}
      </main>
    </div>
  );
}
