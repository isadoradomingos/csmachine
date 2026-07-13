"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export type Preset = "este_mes" | "esta_semana" | "hoje" | "personalizado";
export type CsmOpt = { id: string; nome: string };

type SeriePonto = { label: string; total: number; [tipo: string]: number | string };
export type DetalheContato = { id: string; clientId: string; cliente: string; csm: string; tipo: string };

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "este_mes", label: "Este mês" },
  { id: "esta_semana", label: "Esta semana" },
  { id: "hoje", label: "Hoje" },
  { id: "personalizado", label: "Personalizado" },
];

export const TIPOS_CONHECIDOS: Record<string, { nome: string; cor: string }> = {
  consultoria_produto: { nome: "Consultoria", cor: "#2563eb" },
  efetivo: { nome: "Efetivo", cor: "#16a34a" },
  tentativa: { nome: "Tentativa", cor: "#64748b" },
};
export const COR_TOTAL = "#f59e0b";
export const PALETA_AUTO = ["#a855f7", "#ec4899", "#14b8a6", "#f97316", "#0ea5e9", "#84cc16", "#eab308"];

export function nomeTipo(tipo: string): string {
  return TIPOS_CONHECIDOS[tipo]?.nome ?? tipo.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}
export function corTipo(tipo: string, i: number): string {
  return TIPOS_CONHECIDOS[tipo]?.cor ?? PALETA_AUTO[i % PALETA_AUTO.length];
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function ymd(d: Date) { return d.toISOString().split("T")[0]; }
function chaveDia(d: Date) { return `${String(d.getDate()).padStart(2, "0")}/${MESES[d.getMonth()]}`; }
function chaveMes(d: Date) { return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`; }

export function intervaloDoPreset(preset: Preset, custom: { de: string; ate: string }): { inicio: Date; fim: Date } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  const fim = new Date(hoje);
  if (preset === "hoje") {
    // início e fim já são hoje
  } else if (preset === "este_mes") {
    inicio.setDate(1); // primeiro dia do mês atual até hoje
  } else if (preset === "esta_semana") {
    // segunda-feira da semana atual até hoje
    const diaSemana = (hoje.getDay() + 6) % 7; // 0 = segunda
    inicio.setDate(hoje.getDate() - diaSemana);
  } else {
    if (custom.de) inicio.setTime(new Date(custom.de + "T00:00:00").getTime());
    if (custom.ate) fim.setTime(new Date(custom.ate + "T00:00:00").getTime());
  }
  return { inicio, fim };
}

// ============================================================
// Seletor de período (dropdown) — controle isolado, usado no topo da página
// ============================================================
export function SeletorPeriodo({
  preset, setPreset, custom, setCustom,
}: {
  preset: Preset; setPreset: (p: Preset) => void;
  custom: { de: string; ate: string }; setCustom: (c: { de: string; ate: string }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const presetLabel = PRESETS.find(p => p.id === preset)?.label ?? "";
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto(a => !a)}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {presetLabel}
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${aberto ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {aberto && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-lg z-30 overflow-hidden">
          {PRESETS.map(pr => (
            <button
              key={pr.id}
              onClick={() => { setPreset(pr.id); if (pr.id !== "personalizado") setAberto(false); }}
              className={`flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${preset === pr.id ? "text-blue-600 font-medium" : "text-gray-700"}`}
            >
              <span className="text-gray-300">›</span> {pr.label}
            </button>
          ))}
          {preset === "personalizado" && (
            <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50/50">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">De</label>
                <input type="date" value={custom.de} max={custom.ate || undefined}
                  onChange={e => setCustom({ ...custom, de: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Até</label>
                <input type="date" value={custom.ate} min={custom.de || undefined}
                  onChange={e => setCustom({ ...custom, ate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={() => setAberto(false)} disabled={!custom.de || !custom.ate}
                className="w-full rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                Aplicar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Seletor de CSM (dropdown simples) — usado no topo da página
// ============================================================
export function SeletorCsm({
  csmFiltro, setCsmFiltro, opcoes,
}: {
  csmFiltro: string; setCsmFiltro: (v: string) => void; opcoes: CsmOpt[];
}) {
  return (
    <select
      value={csmFiltro}
      onChange={e => setCsmFiltro(e.target.value)}
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
    >
      <option value="">Todos os CSMs</option>
      {opcoes.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
    </select>
  );
}

// ============================================================
// Gráfico principal (recebe filtros por props)
// ============================================================
// Gráfico principal (gerencia seu próprio período e filtro de CSM)
// ============================================================
export default function AdminAnalytics() {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>("este_mes");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const [csmFiltro, setCsmFiltro] = useState("");
  const [csmOpcoes, setCsmOpcoes] = useState<CsmOpt[]>([]);
  const [serie, setSerie] = useState<SeriePonto[]>([]);
  const [tiposPresentes, setTiposPresentes] = useState<string[]>([]);
  const [tiposOcultos, setTiposOcultos] = useState<Set<string>>(new Set());
  const [totalOculto, setTotalOculto] = useState(false);
  const [detalhesPorBucket, setDetalhesPorBucket] = useState<Record<string, DetalheContato[]>>({});
  const [bucketSelecionado, setBucketSelecionado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { inicio, fim } = intervaloDoPreset(preset, custom);
    if (fim < inicio) { setSerie([]); setDetalhesPorBucket({}); setCarregando(false); return; }

    const diffDias = Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1;
    const porMes = diffDias > 92;
    const inicioStr = ymd(inicio);
    const fimStr = ymd(fim);

    type Row = { id: string; date: string; type: string; client_id: string; clients?: { marca: string; csm_id: string | null } | { marca: string; csm_id: string | null }[] | null };
    const rows: Row[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("id, date, type, client_id, clients!inner(marca, csm_id)")
        .gte("date", inicioStr)
        .lte("date", fimStr)
        .order("date")
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < 1000) break;
      from += 1000;
    }

    const buckets: string[] = [];
    const bucketIndex: Record<string, number> = {};
    const cursor = new Date(inicio);
    if (porMes) {
      cursor.setDate(1);
      while (cursor <= fim) { const k = chaveMes(cursor); if (!(k in bucketIndex)) { bucketIndex[k] = buckets.length; buckets.push(k); } cursor.setMonth(cursor.getMonth() + 1); }
    } else {
      while (cursor <= fim) { const k = chaveDia(cursor); if (!(k in bucketIndex)) { bucketIndex[k] = buckets.length; buckets.push(k); } cursor.setDate(cursor.getDate() + 1); }
    }

    const serieArr: SeriePonto[] = buckets.map(b => ({ label: b, total: 0 }));
    const tiposSet = new Set<string>();
    const cruPorBucket: Record<string, { id: string; clientId: string; cliente: string; csmId: string | null; tipo: string }[]> = {};
    const csmSet: Record<string, boolean> = {};

    for (const r of rows) {
      const cl = Array.isArray(r.clients) ? r.clients[0] : r.clients;
      const csmId = cl?.csm_id ?? null;
      if (csmId) csmSet[csmId] = true;
      if (csmFiltro && csmId !== csmFiltro) continue;

      const d = new Date(r.date + "T00:00:00");
      const k = porMes ? chaveMes(d) : chaveDia(d);
      const idx = bucketIndex[k];
      if (idx !== undefined) {
        const ponto = serieArr[idx];
        ponto.total = (ponto.total as number) + 1;
        ponto[r.type] = ((ponto[r.type] as number) ?? 0) + 1;
        tiposSet.add(r.type);
        if (!cruPorBucket[k]) cruPorBucket[k] = [];
        cruPorBucket[k].push({ id: r.id, clientId: r.client_id, cliente: cl?.marca ?? "—", csmId, tipo: r.type });
      }
    }

    const tiposArr = [...tiposSet];
    serieArr.forEach(ponto => { tiposArr.forEach(t => { if (ponto[t] === undefined) ponto[t] = 0; }); });

    const ordemConhecidos = Object.keys(TIPOS_CONHECIDOS);
    const tiposOrdenados = tiposArr.sort((a, b) => {
      const ia = ordemConhecidos.indexOf(a), ib = ordemConhecidos.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const idsCsm = Object.keys(csmSet);
    const nomePorId: Record<string, string> = {};
    if (idsCsm.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", idsCsm);
      (profs ?? []).forEach((p: { id: string; full_name: string }) => { nomePorId[p.id] = p.full_name ?? "—"; });
    }

    const detalhes: Record<string, DetalheContato[]> = {};
    Object.entries(cruPorBucket).forEach(([k, lista]) => {
      detalhes[k] = lista.map(d => ({ id: d.id, clientId: d.clientId, cliente: d.cliente, csm: d.csmId ? (nomePorId[d.csmId] ?? "—") : "—", tipo: d.tipo }));
    });

    // Informa o page das opções de CSM (só quando em "Todos", para não perder opções ao filtrar)
    if (!csmFiltro) {
      const opcoes: CsmOpt[] = idsCsm.map(id => ({ id, nome: nomePorId[id] ?? "—" })).sort((a, b) => a.nome.localeCompare(b.nome));
      setCsmOpcoes(opcoes);
    }

    setSerie(serieArr);
    setTiposPresentes(tiposOrdenados);
    setDetalhesPorBucket(detalhes);
    setCarregando(false);
  }, [preset, custom, csmFiltro]);

  useEffect(() => {
    // carregar() é async; setState ocorre após await, não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  function toggleTipo(tipo: string) {
    setTiposOcultos(prev => { const next = new Set(prev); if (next.has(tipo)) next.delete(tipo); else next.add(tipo); return next; });
  }

  return (
    <div className="space-y-4 mb-8">
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Contatos registrados ao longo do tempo</p>
            <p className="text-xs text-gray-400">Evolução do volume de registros de atendimentos no período selecionado</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SeletorPeriodo preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
            <SeletorCsm csmFiltro={csmFiltro} setCsmFiltro={setCsmFiltro} opcoes={csmOpcoes} />
          </div>
        </div>

        {!carregando && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={() => setTotalOculto(v => !v)}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${totalOculto ? "border-slate-200 text-gray-400 bg-white" : "border-transparent text-white"}`}
              style={totalOculto ? {} : { backgroundColor: COR_TOTAL }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: totalOculto ? "#cbd5e1" : "#fff" }} />
              Total
            </button>
            {tiposPresentes.map((tipo, i) => {
              const oculto = tiposOcultos.has(tipo);
              const cor = corTipo(tipo, i);
              return (
                <button key={tipo} onClick={() => toggleTipo(tipo)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${oculto ? "border-slate-200 text-gray-400 bg-white" : "border-transparent text-white"}`}
                  style={oculto ? {} : { backgroundColor: cor }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: oculto ? "#cbd5e1" : "#fff" }} />
                  {nomeTipo(tipo)}
                </button>
              );
            })}
          </div>
        )}

        {carregando ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ) : serie.length === 0 ? (
          <p className="text-sm text-gray-400 py-16 text-center">Nenhum dado no período selecionado.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={serie} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                onClick={(state) => { const label = (state as { activeLabel?: string })?.activeLabel; if (label && detalhesPorBucket[label]?.length) setBucketSelecionado(label); }}
                style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {!totalOculto && (
                  <Line type="monotone" dataKey="total" name="Total" stroke={COR_TOTAL} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                )}
                {tiposPresentes.map((tipo, i) => (
                  tiposOcultos.has(tipo) ? null : (
                    <Line key={tipo} type="monotone" dataKey={tipo} name={nomeTipo(tipo)} stroke={corTipo(tipo, i)} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-400 mt-2 text-center">Clique em um ponto do gráfico para ver quem fez os contatos daquele período.</p>
          </>
        )}
      </div>

      {bucketSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBucketSelecionado(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Contatos de {bucketSelecionado}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{(detalhesPorBucket[bucketSelecionado] ?? []).length} contato(s)</p>
              </div>
              <button onClick={() => setBucketSelecionado(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <ul className="overflow-y-auto divide-y divide-slate-100">
              {(detalhesPorBucket[bucketSelecionado] ?? []).map((d) => (
                <li key={d.id}>
                  <button onClick={() => router.push(`/clients/${d.clientId}?contato=${d.id}`)}
                    className="w-full text-left px-6 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.cliente}</p>
                      <p className="text-xs text-gray-400">{d.csm}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{ backgroundColor: (TIPOS_CONHECIDOS[d.tipo]?.cor ?? "#64748b") + "22", color: TIPOS_CONHECIDOS[d.tipo]?.cor ?? "#475569" }}>
                      {nomeTipo(d.tipo)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
