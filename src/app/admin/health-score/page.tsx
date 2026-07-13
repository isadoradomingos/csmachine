"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { calcularHealthScore, type CentralRaw } from "@/lib/healthScore";

type ResumoBanda = { Verde: number; Amarelo: number; Vermelho: number; "N/A": number };

const CORES_BANDA: Record<string, string> = {
  Verde: "#16a34a",
  Amarelo: "#f59e0b",
  Vermelho: "#dc2626",
  "N/A": "#94a3b8",
};

export default function HealthScorePage() {
  const router = useRouter();
  const [calculando, setCalculando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");
  const [resumoRede, setResumoRede] = useState<ResumoBanda | null>(null);
  const [ultimoCalculo, setUltimoCalculo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Carrega o resumo atual dos scores já calculados (se houver)
  const carregarResumo = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("hs_scores")
      .select("banda, calculado_em")
      .eq("tipo", "rede");
    if (error) { setCarregando(false); return; }
    if (data && data.length > 0) {
      const r: ResumoBanda = { Verde: 0, Amarelo: 0, Vermelho: 0, "N/A": 0 };
      let maisRecente = "";
      for (const row of data as { banda: string; calculado_em: string }[]) {
        if (row.banda in r) r[row.banda as keyof ResumoBanda]++;
        if (row.calculado_em > maisRecente) maisRecente = row.calculado_em;
      }
      setResumoRede(r);
      setUltimoCalculo(maisRecente || null);
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

  async function recalcular() {
    setCalculando(true);
    setErro("");
    setProgresso("Lendo centrais...");

    try {
      // 1) Lê as centrais (em lotes)
      type CentralRow = { cod_interno: string; nome: string; rede: string; operacao: string; plano: string | null; tipo: string | null; status_bandeira: string | null };
      const centraisRows: CentralRow[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("hs_centrais")
          .select("cod_interno, nome, rede, operacao, plano, tipo, status_bandeira")
          .range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        centraisRows.push(...(data as CentralRow[]));
        if (data.length < 1000) break;
        from += 1000;
      }

      setProgresso("Lendo dados mensais...");
      // 2) Lê os dados mensais (em lotes)
      type MensalRow = { cod_interno: string; mes: string; finalizadas: number | null; canceladas: number | null };
      const mensaisRows: MensalRow[] = [];
      from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("hs_centrais_mensal")
          .select("cod_interno, mes, finalizadas, canceladas")
          .range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        mensaisRows.push(...(data as MensalRow[]));
        if (data.length < 1000) break;
        from += 1000;
      }

      setProgresso("Calculando...");
      // 3) Monta a estrutura CentralRaw
      const mensaisPorCod = new Map<string, { mes: string; finalizadas: number | null; canceladas: number | null }[]>();
      for (const m of mensaisRows) {
        if (!mensaisPorCod.has(m.cod_interno)) mensaisPorCod.set(m.cod_interno, []);
        mensaisPorCod.get(m.cod_interno)!.push({ mes: m.mes, finalizadas: m.finalizadas, canceladas: m.canceladas });
      }
      const centrais: CentralRaw[] = centraisRows.map(c => ({
        ...c,
        mensais: mensaisPorCod.get(c.cod_interno) ?? [],
      }));

      const { porCentral, porRede } = calcularHealthScore(centrais);

      // 4) Grava os scores (limpa os antigos e insere os novos)
      setProgresso("Gravando resultados...");
      const agora = new Date().toISOString();

      const linhasCentral = porCentral.map(s => ({
        tipo: "central" as const,
        cod_interno: s.cod_interno,
        rede: s.rede,
        operacao: s.operacao,
        nome: s.nome,
        score: s.score,
        banda: s.banda,
        sub_volume: s.sub_volume,
        sub_queda: s.sub_queda,
        sub_perdidas: s.sub_perdidas,
        volume_total: s.volume_janela,
        parcial: true,
        calculado_em: agora,
      }));
      const linhasRede = porRede.map(s => ({
        tipo: "rede" as const,
        cod_interno: null,
        rede: s.rede,
        operacao: s.operacao,
        nome: s.rede,
        score: s.score,
        banda: s.banda,
        n_centrais: s.n_centrais,
        volume_total: s.volume_total,
        parcial: true,
        calculado_em: agora,
      }));

      // Limpa scores antigos
      const { error: delErr } = await supabase.from("hs_scores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;

      // Insere em lotes
      const todas = [...linhasCentral, ...linhasRede];
      for (let i = 0; i < todas.length; i += 300) {
        const lote = todas.slice(i, i + 300);
        const { error } = await supabase.from("hs_scores").insert(lote);
        if (error) throw error;
        setProgresso(`Gravando resultados... ${Math.min(i + 300, todas.length)}/${todas.length}`);
      }

      setProgresso("");
      setCalculando(false);
      await carregarResumo();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(`Erro ao calcular: ${msg}`);
      setCalculando(false);
      setProgresso("");
    }
  }

  const totalRedes = resumoRede ? resumoRede.Verde + resumoRede.Amarelo + resumoRede.Vermelho + resumoRede["N/A"] : 0;

  return (
    <div className="min-h-screen bg-slate-800">
      <header className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="font-semibold text-gray-900">Health Score</h1>
        <button onClick={() => router.push("/admin")} className="text-sm text-gray-500 hover:text-gray-700">← Voltar ao admin</button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Aviso de score parcial */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Versão parcial.</span> O score atual usa apenas o bloco
            Uso &amp; engajamento (Volume, Queda e Taxa de perdidas). Os demais critérios do playbook
            (Equilíbrio, Financeiro, Funcionalidades, NPS, Suporte e Filiais) serão somados conforme os dados forem importados.
          </p>
        </div>

        {/* Ação de recalcular */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-gray-700">Cálculo do Health Score</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {ultimoCalculo
                  ? `Último cálculo: ${new Date(ultimoCalculo).toLocaleString("pt-BR")}`
                  : "Ainda não calculado. Clique para gerar as notas a partir dos dados importados."}
              </p>
            </div>
            <button
              onClick={recalcular}
              disabled={calculando}
              className="text-sm px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {calculando ? (progresso || "Calculando...") : "Recalcular Health Score"}
            </button>
          </div>
          {calculando && progresso && <p className="text-xs text-slate-400 mt-3">{progresso}</p>}
          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mt-3">{erro}</p>}
        </div>

        {/* Resumo por banda (redes) */}
        {carregando ? (
          <div className="h-32 animate-pulse rounded-2xl bg-slate-700/40" />
        ) : resumoRede ? (
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-700 mb-1">Distribuição das redes por banda</p>
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
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
            <p className="text-sm text-gray-500">Nenhum score calculado ainda. Clique em “Recalcular Health Score” para gerar.</p>
          </div>
        )}
      </main>
    </div>
  );
}
