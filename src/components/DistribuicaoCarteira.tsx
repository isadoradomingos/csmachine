"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type Fatia = { nome: string; valor: number; chave: string };
type ClienteMin = { id: string; marca: string; csm_nome: string };

const CLUSTER_LABEL: Record<string, string> = { A: "A", B: "B", C: "C", D: "D" };
const OPERACAO_LABEL: Record<string, string> = {};

const CORES_CLUSTER = ["#2563eb", "#8b5cf6", "#f59e0b", "#64748b", "#ec4899", "#14b8a6"];
const CORES_OPERACAO = ["#2563eb", "#16a34a", "#f59e0b", "#a855f7"];

function label(mapa: Record<string, string>, chave: string): string {
  if (!chave) return "Não definido";
  return mapa[chave] ?? chave.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export default function DistribuicaoCarteira() {
  const router = useRouter();
  const [porCluster, setPorCluster] = useState<Fatia[]>([]);
  const [porOperacao, setPorOperacao] = useState<Fatia[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  // clientes agrupados por chave de cluster e de operação (para o modal)
  const [clientesPorCluster, setClientesPorCluster] = useState<Record<string, ClienteMin[]>>({});
  const [clientesPorOperacao, setClientesPorOperacao] = useState<Record<string, ClienteMin[]>>({});

  // modal
  const [modal, setModal] = useState<{ titulo: string; clientes: ClienteMin[] } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    type Row = { id: string; marca: string; cluster: string | null; operacao: string | null; csm_id: string | null };
    const rows: Row[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, marca, cluster, operacao, csm_id")
        .eq("status", "ativo")
        .order("marca")
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < 1000) break;
      from += 1000;
    }

    // nomes dos CSMs
    const { data: perfis } = await supabase.from("profiles").select("id, full_name");
    const nomePorId: Record<string, string> = {};
    (perfis ?? []).forEach((p: { id: string; full_name: string }) => { nomePorId[p.id] = p.full_name; });

    const clusterCount: Record<string, number> = {};
    const operacaoCount: Record<string, number> = {};
    const cliCluster: Record<string, ClienteMin[]> = {};
    const cliOperacao: Record<string, ClienteMin[]> = {};

    rows.forEach(r => {
      const c = r.cluster ?? "";
      const o = r.operacao ?? "";
      const cli: ClienteMin = { id: r.id, marca: r.marca, csm_nome: r.csm_id ? (nomePorId[r.csm_id] ?? "—") : "—" };
      clusterCount[c] = (clusterCount[c] ?? 0) + 1;
      operacaoCount[o] = (operacaoCount[o] ?? 0) + 1;
      (cliCluster[c] = cliCluster[c] ?? []).push(cli);
      (cliOperacao[o] = cliOperacao[o] ?? []).push(cli);
    });

    const clusterArr = Object.entries(clusterCount)
      .map(([k, v]) => ({ nome: label(CLUSTER_LABEL, k), valor: v, chave: k }))
      .sort((a, b) => b.valor - a.valor);
    const operacaoArr = Object.entries(operacaoCount)
      .map(([k, v]) => ({ nome: label(OPERACAO_LABEL, k), valor: v, chave: k }))
      .sort((a, b) => b.valor - a.valor);

    setPorCluster(clusterArr);
    setPorOperacao(operacaoArr);
    setClientesPorCluster(cliCluster);
    setClientesPorOperacao(cliOperacao);
    setTotal(rows.length);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // carregar() é async; setState ocorre após await, não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  function abrirModalCluster(chave: string, nome: string) {
    const clientes = (clientesPorCluster[chave] ?? []).slice().sort((a, b) => a.marca.localeCompare(b.marca));
    setModal({ titulo: `Cluster ${nome}`, clientes });
  }
  function abrirModalOperacao(chave: string, nome: string) {
    const clientes = (clientesPorOperacao[chave] ?? []).slice().sort((a, b) => a.marca.localeCompare(b.marca));
    setModal({ titulo: nome, clientes });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Por cluster (pizza) */}
      <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-700 mb-1">Carteira por cluster</p>
        <p className="text-xs text-gray-400 mb-4">Distribuição dos {total} clientes ativos por nível de atendimento · clique para ver a lista</p>
        {carregando ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-100" />
        ) : porCluster.length === 0 ? (
          <p className="text-sm text-gray-400 py-16 text-center">Sem dados de cluster.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={porCluster} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label labelLine={false}
                onClick={(_, index) => { const f = porCluster[index]; if (f) abrirModalCluster(f.chave, f.nome); }}
                style={{ cursor: "pointer" }}
              >
                {porCluster.map((_, i) => <Cell key={i} fill={CORES_CLUSTER[i % CORES_CLUSTER.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Por operação (barras) */}
      <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-700 mb-1">Carteira por operação</p>
        <p className="text-xs text-gray-400 mb-4">Distribuição dos {total} clientes ativos por tipo de operação · clique para ver a lista</p>
        {carregando ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-100" />
        ) : porOperacao.length === 0 ? (
          <p className="text-sm text-gray-400 py-16 text-center">Sem dados de operação.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porOperacao} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#475569" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} cursor={{ fill: "#f1f5f9" }} />
              <Bar
                dataKey="valor" name="Clientes" radius={[4, 4, 0, 0]}
                onClick={(_, index) => { const f = porOperacao[index]; if (f) abrirModalOperacao(f.chave, f.nome); }}
                style={{ cursor: "pointer" }}
              >
                {porOperacao.map((_, i) => <Cell key={i} fill={CORES_OPERACAO[i % CORES_OPERACAO.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Modal com a lista de clientes do grupo clicado */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-gray-900">{modal.titulo}</h3>
                <p className="text-xs text-gray-400">{modal.clientes.length} {modal.clientes.length === 1 ? "cliente" : "clientes"}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <ul className="overflow-y-auto divide-y divide-slate-100">
              {modal.clientes.length === 0 ? (
                <li className="px-6 py-8 text-center text-sm text-gray-400">Nenhum cliente neste grupo.</li>
              ) : modal.clientes.map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => router.push(`/clients/${c.id}`)}
                    className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-gray-800">{c.marca}</span>
                    <span className="text-xs text-gray-400">{c.csm_nome}</span>
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
