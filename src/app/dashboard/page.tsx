"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type ModalClient = {
  id: string;
  marca: string;
  bandeira: string;
  last_contact: string | null;
  daysSinceContact: number;
  tentativasSemRetorno?: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOperacao, setFilterOperacao] = useState("");
  const [filterCluster, setFilterCluster] = useState("");
  const [sortOrder, setSortOrder] = useState<"" | "recente" | "antigo">("");
  const [contactCount, setContactCount] = useState(0);
  const [tentativasMap, setTentativasMap] = useState<Record<string, number>>({});
  const [consultoriasSet, setConsultoriasSet] = useState<Set<string>>(new Set());
  const [semHistoricoSet, setSemHistoricoSet] = useState<Set<string>>(new Set());
  const [semRetornoClients, setSemRetornoClients] = useState<ModalClient[]>([]);
  const [modal, setModal] = useState<{ type: "followup" | "semretorno" } | null>(null);

  // Estados do modal de follow-up
  const [modalSearch, setModalSearch] = useState("");
  const [modalOrder, setModalOrder] = useState<"asc" | "desc">("desc");
  const [modalFilterType, setModalFilterType] = useState<"mais" | "menos" | "entre">("mais");
  const [modalFilterDays, setModalFilterDays] = useState("");
  const [modalFilterDays2, setModalFilterDays2] = useState("");

  function daysSince(date: string | null): number {
    if (!date) return 999;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(profile);

    const { data: clients } = await supabase
      .from("clients")
      .select("id, marca, bandeira, operacao, plano, cluster, status, last_contact")
      .eq("csm_id", user.id)
      .eq("status", "ativo")
      .order("marca")
      .limit(10000);
    setClients(clients ?? []);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { count } = await supabase
      .from("client_contacts")
      .select("id, clients!inner(csm_id)", { count: "exact", head: true })
      .eq("type", "consultoria_produto")
      .eq("clients.csm_id", user.id)
      .gte("date", startOfMonth.toISOString().split("T")[0]);
    setContactCount(count ?? 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: tentativas } = await supabase
      .from("client_contacts")
      .select("client_id")
      .eq("type", "tentativa")
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

    const tentMap: Record<string, number> = {};
    (tentativas ?? []).forEach((t: any) => {
      tentMap[t.client_id] = (tentMap[t.client_id] ?? 0) + 1;
    });
    setTentativasMap(tentMap);

    const { data: consultorias } = await supabase
      .from("client_contacts")
      .select("client_id")
      .eq("type", "consultoria_produto")
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

    const consultSet = new Set((consultorias ?? []).map((c: any) => c.client_id));
    setConsultoriasSet(consultSet);

    const { data: todosContatos } = await supabase
      .from("client_contacts")
      .select("client_id");

    const comHistorico = new Set((todosContatos ?? []).map((c: any) => c.client_id));
    const semHistorico = new Set((clients ?? []).map((c: any) => c.id).filter((id: string) => !comHistorico.has(id)));
    setSemHistoricoSet(semHistorico);

    // Calcular clientes com 3+ tentativas sem retorno
    const { data: allContacts } = await supabase
      .from("client_contacts")
      .select("client_id, date, type")
      .in("client_id", (clients ?? []).map((c: any) => c.id))
      .order("date", { ascending: false });

    const semRetorno: ModalClient[] = [];
    const clientContactsMap: Record<string, any[]> = {};
    (allContacts ?? []).forEach((c: any) => {
      if (!clientContactsMap[c.client_id]) clientContactsMap[c.client_id] = [];
      clientContactsMap[c.client_id].push(c);
    });

    (clients ?? []).forEach((client: any) => {
      const contatos = clientContactsMap[client.id] ?? [];
      const ultimoEfetivo = contatos.find((c: any) => c.type === "efetivo" || c.type === "consultoria_produto");
      const tentativasApos = ultimoEfetivo
        ? contatos.filter((c: any) => c.type === "tentativa" && c.date > ultimoEfetivo.date)
        : contatos.filter((c: any) => c.type === "tentativa");

      if (tentativasApos.length >= 3) {
        semRetorno.push({
          id: client.id,
          marca: client.marca,
          bandeira: client.bandeira,
          last_contact: client.last_contact,
          daysSinceContact: daysSince(client.last_contact),
          tentativasSemRetorno: tentativasApos.length,
        });
      }
    });

    setSemRetornoClients(semRetorno);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const followUpClients = clients
    .filter(c => daysSince(c.last_contact) > 20)
    .map(c => ({ ...c, daysSinceContact: daysSince(c.last_contact) }));

  const filtered = clients
    .filter(c => {
      const matchSearch = c.marca.toLowerCase().includes(search.toLowerCase()) || c.bandeira?.includes(search);
      const matchOperacao = filterOperacao ? c.operacao === filterOperacao : true;
      const matchCluster = filterCluster ? c.cluster === filterCluster : true;
      return matchSearch && matchOperacao && matchCluster;
    })
    .sort((a, b) => {
      if (sortOrder === "recente") return daysSince(a.last_contact) - daysSince(b.last_contact);
      if (sortOrder === "antigo") return daysSince(b.last_contact) - daysSince(a.last_contact);
      return 0;
    });

  const clusterLabel: Record<string, string> = {
    high_touch: "High Touch",
    mid_touch: "Mid Touch",
    growth_touch: "Growth Touch",
    no_touch: "No Touch",
  };

  const operacaoColor: Record<string, string> = {
    corridas: "bg-blue-100 text-blue-700",
    entregas: "bg-orange-100 text-orange-700",
  };

  // Filtrar e ordenar clientes do modal de follow-up
  const filteredModalClients = followUpClients
    .filter(c => {
      const matchSearch = c.marca.toLowerCase().includes(modalSearch.toLowerCase()) || c.bandeira?.includes(modalSearch);
      const days = c.daysSinceContact;
      const d1 = parseInt(modalFilterDays);
      const d2 = parseInt(modalFilterDays2);
      let matchDays = true;
      if (modalFilterDays && !isNaN(d1)) {
        if (modalFilterType === "mais") matchDays = days > d1;
        else if (modalFilterType === "menos") matchDays = days < d1;
        else if (modalFilterType === "entre" && !isNaN(d2)) matchDays = days >= d1 && days <= d2;
      }
      return matchSearch && matchDays;
    })
    .sort((a, b) => modalOrder === "desc" ? b.daysSinceContact - a.daysSinceContact : a.daysSinceContact - b.daysSinceContact);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{profile?.full_name}</span>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700">Sair</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header com barra de progresso */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Olá, {profile?.full_name?.split(" ")[0]} 👋</h2>
            <p className="text-sm text-gray-400 mt-0.5">{clients.length} clientes na sua carteira</p>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Progresso mensal</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{contactCount} / {profile?.monthly_goal ?? 49} <span className="text-lg font-medium text-gray-500">contatos</span></p>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((contactCount / (profile?.monthly_goal ?? 49)) * 100))}%`,
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
              }}
            />
          </div>
        </div>

        {/* Cards indicadores */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div onClick={() => { setModalSearch(""); setModalOrder("desc"); setModalFilterType("mais"); setModalFilterDays(""); setModalFilterDays2(""); setModal({ type: "followup" }); }} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Oportunidades de follow-up</p>
              <span className="text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{followUpClients.length}</p>
            <p className="text-xs text-gray-400 mt-1">clientes sem contato há mais de 20 dias</p>
          </div>

          <div onClick={() => setModal({ type: "semretorno" })} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Tentativas sem retorno</p>
              <span className="text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{semRetornoClients.length}</p>
            <p className="text-xs text-gray-400 mt-1">clientes com 3+ tentativas sem contato efetivo</p>
          </div>
        </div>

        {/* Busca e filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="Buscar por nome ou bandeira..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[200px] rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={filterOperacao} onChange={(e) => setFilterOperacao(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todas as operações</option>
            <option value="corridas">Corridas</option>
            <option value="entregas">Entregas</option>
          </select>
          <select value={filterCluster} onChange={(e) => setFilterCluster(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todos os clusters</option>
            <option value="high_touch">High Touch</option>
            <option value="mid_touch">Mid Touch</option>
            <option value="growth_touch">Growth Touch</option>
            <option value="no_touch">No Touch</option>
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Ordenar por nome</option>
            <option value="recente">Contato mais recente</option>
            <option value="antigo">Contato mais antigo</option>
          </select>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Sua carteira</h3>
            <span className="text-xs text-gray-400">{filtered.length} clientes</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">Nenhum cliente encontrado.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <li key={c.id} onClick={() => router.push(`/clients/${c.id}`)} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{c.marca}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${operacaoColor[c.operacao] ?? "bg-gray-100 text-gray-600"}`}>
                          {c.operacao}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Bandeira {c.bandeira}
                        {c.cluster ? ` · ${clusterLabel[c.cluster]}` : ""}
                        {c.plano ? ` · ${c.plano.charAt(0).toUpperCase() + c.plano.slice(1)}` : ""}
                        {c.last_contact ? ` · último contato há ${daysSince(c.last_contact)} dias` : " · sem contato registrado"}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {semHistoricoSet.has(c.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Nenhuma tentativa de contato no histórico
                          </span>
                        )}
                        {consultoriasSet.has(c.id) ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            Consultoria de Produto realizada nos últimos 30 dias
                          </span>
                        ) : tentativasMap[c.id] > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                            {tentativasMap[c.id]} tentativa{tentativasMap[c.id] > 1 ? "s" : ""} de contato nos últimos 30 dias
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Modal follow-up */}
      {modal?.type === "followup" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Oportunidades de follow-up</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>

            {/* Filtros do modal */}
            <div className="px-6 py-3 border-b border-gray-100 space-y-2">
              <input type="text" placeholder="Buscar por nome ou bandeira..." value={modalSearch} onChange={e => setModalSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 flex-wrap">
                <select value={modalOrder} onChange={e => setModalOrder(e.target.value as "asc" | "desc")} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white focus:outline-none">
                  <option value="desc">Mais antigos primeiro</option>
                  <option value="asc">Mais recentes primeiro</option>
                </select>
                <select value={modalFilterType} onChange={e => setModalFilterType(e.target.value as any)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white focus:outline-none">
                  <option value="mais">Mais de X dias</option>
                  <option value="menos">Menos de X dias</option>
                  <option value="entre">Entre X e Y dias</option>
                </select>
                <input type="number" placeholder="X dias" value={modalFilterDays} onChange={e => setModalFilterDays(e.target.value)} className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none" />
                {modalFilterType === "entre" && (
                  <input type="number" placeholder="Y dias" value={modalFilterDays2} onChange={e => setModalFilterDays2(e.target.value)} className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none" />
                )}
              </div>
              <p className="text-xs text-gray-400">{filteredModalClients.length} clientes</p>
            </div>

            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {filteredModalClients.length === 0 ? (
                <li className="px-6 py-8 text-center text-sm text-gray-400">Nenhum cliente encontrado.</li>
              ) : filteredModalClients.map(c => (
                <li key={c.id} onClick={() => { setModal(null); router.push(`/clients/${c.id}`); }} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.marca}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Bandeira {c.bandeira} · sem contato há {c.daysSinceContact === 999 ? "—" : `${c.daysSinceContact} dias`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">→</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal tentativas sem retorno */}
      {modal?.type === "semretorno" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Tentativas sem retorno</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{semRetornoClients.length} clientes</span>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {semRetornoClients.length === 0 ? (
                <li className="px-6 py-8 text-center text-sm text-gray-400">Nenhum cliente nesta categoria.</li>
              ) : semRetornoClients.map(c => (
                <li key={c.id} onClick={() => { setModal(null); router.push(`/clients/${c.id}`); }} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.marca}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Bandeira {c.bandeira} · {c.tentativasSemRetorno} tentativas sem retorno
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">→</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
