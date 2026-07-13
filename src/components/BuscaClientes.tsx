"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type ClienteBusca = {
  id: string;
  marca: string;
  bandeira: string | null;
  operacao: string | null;
  cluster: string | null;
  plano: string | null;
  status: string | null;
};

// Normaliza para busca (ignora acento e caixa)
function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function BuscaClientes() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteBusca[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const linhas: ClienteBusca[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, marca, bandeira, operacao, cluster, plano, status")
        .order("marca")
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      linhas.push(...(data as ClienteBusca[]));
      if (data.length < 1000) break;
      from += 1000;
    }
    setClientes(linhas);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // carregar é async; setState após await não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const resultados = useMemo(() => {
    const termo = norm(busca.trim());
    if (!termo) return [];
    return clientes
      .filter(c => {
        const alvo = norm([c.marca, c.bandeira].filter(Boolean).join(" "));
        return alvo.includes(termo);
      })
      .slice(0, 30);
  }, [busca, clientes]);

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <p className="text-sm font-medium text-gray-700 mb-1">Buscar cliente</p>
      <p className="text-xs text-gray-400 mb-3">Pesquise por nome ou bandeira e abra a ficha completa do cliente</p>

      <input
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Ex: Buski, Urbano Norte..."
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {carregando ? (
        <p className="text-xs text-gray-400 mt-3">Carregando clientes...</p>
      ) : busca.trim() === "" ? (
        <p className="text-xs text-gray-400 mt-3">Digite para buscar entre {clientes.length} clientes.</p>
      ) : resultados.length === 0 ? (
        <p className="text-sm text-gray-400 mt-3 py-4 text-center">Nenhum cliente encontrado para “{busca}”.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200/60 max-h-80 overflow-y-auto rounded-lg border border-slate-200/60">
          {resultados.map(c => (
            <li key={c.id}>
              <button
                onClick={() => router.push(`/clients/${c.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.marca}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[c.operacao, c.cluster, c.plano].filter(Boolean).join(" · ") || "—"}
                    {c.status && c.status !== "ativo" ? ` · ${c.status}` : ""}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">→</span>
              </button>
            </li>
          ))}
          {resultados.length === 30 && (
            <li className="px-4 py-2 text-xs text-gray-400 text-center">Mostrando os primeiros 30 resultados. Refine a busca.</li>
          )}
        </ul>
      )}
    </div>
  );
}
