"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { intervaloDoPreset, type Preset } from "@/components/AdminAnalytics";

type CsmRanking = { id: string; nome: string; nomeCompleto: string; consultorias: number; contatos: number };

function ymd(d: Date) { return d.toISOString().split("T")[0]; }

export default function RankingCsm({ preset, custom }: { preset: Preset; custom: { de: string; ate: string } }) {
  const [dados, setDados] = useState<CsmRanking[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { inicio, fim } = intervaloDoPreset(preset, custom);
    if (fim < inicio) { setDados([]); setCarregando(false); return; }

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

    const consult: Record<string, number> = {};
    const contatos: Record<string, number> = {};
    rows.forEach(r => {
      const cl = Array.isArray(r.clients) ? r.clients[0] : r.clients;
      const csmId = cl?.csm_id;
      if (!csmId) return;
      contatos[csmId] = (contatos[csmId] ?? 0) + 1;
      if (r.type === "consultoria_produto") consult[csmId] = (consult[csmId] ?? 0) + 1;
    });

    const ids = [...new Set([...Object.keys(consult), ...Object.keys(contatos)])];
    let arr: CsmRanking[] = [];
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const nomePorId: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string }) => { nomePorId[p.id] = p.full_name ?? "—"; });

      const contagemPrimeiro: Record<string, number> = {};
      ids.forEach(id => { const pr = (nomePorId[id] ?? "—").split(" ")[0]; contagemPrimeiro[pr] = (contagemPrimeiro[pr] ?? 0) + 1; });
      function rotulo(nc: string): string {
        const p = nc.trim().split(/\s+/);
        const pr = p[0] ?? "—";
        if ((contagemPrimeiro[pr] ?? 0) > 1 && p.length > 1) return `${pr} ${p[p.length - 1][0]}.`;
        return pr;
      }

      arr = ids.map(id => ({
        id,
        nome: rotulo(nomePorId[id] ?? "—"),
        nomeCompleto: nomePorId[id] ?? "—",
        consultorias: consult[id] ?? 0,
        contatos: contatos[id] ?? 0,
      })).sort((a, b) => b.consultorias - a.consultorias || b.contatos - a.contatos);
    }

    setDados(arr);
    setCarregando(false);
  }, [preset, custom]);

  useEffect(() => {
    // carregar() é async; setState ocorre após await, não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <p className="text-sm font-medium text-gray-700 mb-1">Ranking de CSMs</p>
      <p className="text-xs text-gray-400 mb-4">Consultorias e contatos por CSM no período (todos os CSMs)</p>
      {carregando ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      ) : dados.length === 0 ? (
        <p className="text-sm text-gray-400 py-16 text-center">Nenhum contato registrado no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 56)}>
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
                const item = payload && payload[0] ? (payload[0].payload as CsmRanking) : null;
                return item ? item.nomeCompleto : "";
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="consultorias" name="Consultorias" fill="#2563eb" radius={[0, 4, 4, 0]} />
            <Bar dataKey="contatos" name="Contatos (total)" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
