"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { operacaoLabel } from "@/lib/labels";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type Snapshot = {
  data_snapshot: string;
  verde: number;
  amarelo: number;
  vermelho: number;
  total: number;
  nota_media: number | null;
};

const CORES = {
  verde: "#16a34a", amarelo: "#f59e0b", vermelho: "#dc2626",
  mediaGeral: "#94a3b8", mediaCategoria: "#7c3aed",
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Tooltip com ordem fixa: Média geral → Média da categoria → Verde → Amarelo → Vermelho
type TooltipItem = { name?: string; value?: number | string; color?: string; dataKey?: string };
function TooltipCustom({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  const acha = (chave: string) => payload.find(p => p.dataKey === chave);
  const mediaGeral = acha("Média geral");
  // a média da categoria é a chave que começa com "Média " e não é a geral
  const mediaCategoria = payload.find(p => (p.dataKey ?? "").startsWith("Média ") && p.dataKey !== "Média geral");
  const verde = acha("Verde");
  const amarelo = acha("Amarelo");
  const vermelho = acha("Vermelho");

  const ordem = [mediaGeral, mediaCategoria, verde, amarelo, vermelho].filter(Boolean) as TooltipItem[];

  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ fontWeight: 600, marginBottom: 4, color: "#1e293b" }}>{label}</p>
      {ordem.map((item, i) => (
        <p key={i} style={{ color: item.color, margin: "2px 0" }}>
          {item.name} : {item.value}
        </p>
      ))}
    </div>
  );
}

export default function EvolucaoHealthScore() {
  const [totalGeral, setTotalGeral] = useState<Snapshot[]>([]);
  const [porCsm, setPorCsm] = useState<(Snapshot & { csm_id: string })[]>([]);
  const [porOperacao, setPorOperacao] = useState<(Snapshot & { operacao: string })[]>([]);
  const [csms, setCsms] = useState<{ id: string; nome: string }[]>([]);
  const [operacoes, setOperacoes] = useState<string[]>([]);
  const [filtroCsm, setFiltroCsm] = useState<string>("");
  const [filtroOperacao, setFiltroOperacao] = useState<string>("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);

    const { data: geral } = await supabase
      .from("hs_historico")
      .select("data_snapshot, verde, amarelo, vermelho, total, nota_media")
      .order("data_snapshot", { ascending: true });
    setTotalGeral((geral as Snapshot[]) ?? []);

    const { data: csmData } = await supabase
      .from("hs_historico_csm")
      .select("data_snapshot, csm_id, verde, amarelo, vermelho, total, nota_media")
      .order("data_snapshot", { ascending: true });
    setPorCsm((csmData as (Snapshot & { csm_id: string })[]) ?? []);

    const { data: opData } = await supabase
      .from("hs_historico_operacao")
      .select("data_snapshot, operacao, verde, amarelo, vermelho, total, nota_media")
      .order("data_snapshot", { ascending: true });
    const ops = (opData as (Snapshot & { operacao: string })[]) ?? [];
    setPorOperacao(ops);
    setOperacoes([...new Set(ops.map(o => o.operacao))].sort());

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

  function escolherCsm(v: string) { setFiltroCsm(v); if (v) setFiltroOperacao(""); }
  function escolherOperacao(v: string) { setFiltroOperacao(v); if (v) setFiltroCsm(""); }

  const temFiltro = !!(filtroCsm || filtroOperacao);
  const rotuloCategoria = filtroCsm
    ? `Média ${csms.find(c => c.id === filtroCsm)?.nome ?? "CSM"}`
    : filtroOperacao ? `Média ${operacaoLabel(filtroOperacao)}` : "";

  // mapa data -> nota_media geral (para a linha de referência sempre presente)
  const notaGeralPorData = useMemo(() => {
    const m: Record<string, number | null> = {};
    totalGeral.forEach(d => { m[d.data_snapshot] = d.nota_media; });
    return m;
  }, [totalGeral]);

  const grafico = useMemo(() => {
    let fonte: Snapshot[];
    if (filtroCsm) fonte = porCsm.filter(r => r.csm_id === filtroCsm);
    else if (filtroOperacao) fonte = porOperacao.filter(r => r.operacao === filtroOperacao);
    else fonte = totalGeral;
    return fonte.map(d => {
      const [ano, mes] = d.data_snapshot.split("-");
      const linha: Record<string, string | number | null> = {
        rotulo: `${MESES[parseInt(mes, 10) - 1]}/${ano.slice(2)}`,
        Verde: d.verde,
        Amarelo: d.amarelo,
        Vermelho: d.vermelho,
        "Média geral": notaGeralPorData[d.data_snapshot] ?? null,
      };
      // Linha da categoria só quando há filtro (senão seria igual à geral)
      if (temFiltro) linha[rotuloCategoria] = d.nota_media;
      return linha;
    });
  }, [filtroCsm, filtroOperacao, porCsm, porOperacao, totalGeral, notaGeralPorData, temFiltro, rotuloCategoria]);

  if (carregando) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700/40" />;
  }

  const selectCls = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <p className="text-sm font-medium text-gray-700">Evolução do Health Score</p>
          <p className="text-xs text-gray-400">Distribuição das marcas por banda e nota média ao longo dos meses</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {csms.length > 0 && (
            <select value={filtroCsm} onChange={e => escolherCsm(e.target.value)} className={selectCls}>
              <option value="">Todos os CSMs</option>
              {csms.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          {operacoes.length > 0 && (
            <select value={filtroOperacao} onChange={e => escolherOperacao(e.target.value)} className={selectCls}>
              <option value="">Todos os serviços</option>
              {operacoes.map(o => <option key={o} value={o}>{operacaoLabel(o)}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="mt-3">
        {grafico.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            {temFiltro
              ? "Ainda não há histórico para este recorte neste período."
              : "Ainda não há histórico. A evolução aparece aqui a partir da próxima importação."}
          </p>
        ) : grafico.length === 1 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">Primeiro mês registrado ({grafico[0].rotulo}).</p>
            <p className="text-xs text-gray-400 mt-1">O gráfico de tendência aparece a partir do segundo mês.</p>
            <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
              <span className="text-sm"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: CORES.verde }} />Verde: {String(grafico[0].Verde)}</span>
              <span className="text-sm"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: CORES.amarelo }} />Amarelo: {String(grafico[0].Amarelo)}</span>
              <span className="text-sm"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: CORES.vermelho }} />Vermelho: {String(grafico[0].Vermelho)}</span>
              {grafico[0]["Média geral"] != null && (
                <span className="text-sm"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: CORES.mediaGeral }} />Nota média: {String(grafico[0]["Média geral"])}</span>
              )}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={grafico} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: "#475569" }} />
              <YAxis yAxisId="qtd" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <YAxis yAxisId="nota" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip content={<TooltipCustom />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="qtd" type="monotone" dataKey="Verde" stroke={CORES.verde} strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="qtd" type="monotone" dataKey="Amarelo" stroke={CORES.amarelo} strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="qtd" type="monotone" dataKey="Vermelho" stroke={CORES.vermelho} strokeWidth={2} dot={{ r: 3 }} />
              {/* Média geral: referência sempre presente (cinza tracejada) */}
              <Line yAxisId="nota" type="monotone" dataKey="Média geral" stroke={CORES.mediaGeral} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
              {/* Média da categoria: só quando há filtro (roxa) */}
              {temFiltro && (
                <Line yAxisId="nota" type="monotone" dataKey={rotuloCategoria} stroke={CORES.mediaCategoria} strokeWidth={2} strokeDasharray="2 2" dot={{ r: 3 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
