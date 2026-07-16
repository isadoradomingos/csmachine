"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Profile, Client } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import SaudeCarteira from "@/components/SaudeCarteira";
import DistribuicaoCarteira from "@/components/DistribuicaoCarteira";
import BuscaClientes from "@/components/BuscaClientes";
import { FilaPriorizacao } from "@/components/FilaPriorizacao";
import MenuLateral from "@/components/MenuLateral";

type ConsultoriaCliente = { id: string; marca: string; bandeira: string | null; csm_id: string | null };
type ConsultoriaMes = { client_id: string; date: string; clients: ConsultoriaCliente | ConsultoriaCliente[] | null };
type ContatoMin = { client_id: string; date: string; type: string };

type ModalClient = {
  id: string;
  marca: string;
  bandeira: string | null;
  last_contact: string | null;
  daysSinceContact: number;
  tentativasSemRetorno?: number;
};

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const csmParam = searchParams.get("csm");
  const [viewingOther, setViewingOther] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"carteira" | "estatisticas">("carteira");
  const [criticosCount, setCriticosCount] = useState<number | null>(null);
  const [filterOperacao, setFilterOperacao] = useState("");
  const [filterCluster, setFilterCluster] = useState("");
  const [sortOrder, setSortOrder] = useState<"" | "recente" | "antigo">("");
  // Filtros novos (aplicados)
  const [filterBanda, setFilterBanda] = useState("");
  const [filterPercepcao, setFilterPercepcao] = useState("");
  // Painel de filtros (rascunho até clicar em Aplicar)
  const [showFiltros, setShowFiltros] = useState(false);
  const [rascunho, setRascunho] = useState({ operacao: "", cluster: "", banda: "", percepcao: "", ordem: "" as "" | "recente" | "antigo" });
  // Mapas por cliente
  const [bandaPorCliente, setBandaPorCliente] = useState<Record<string, string>>({});
  const [percepcaoPorCliente, setPercepcaoPorCliente] = useState<Record<string, string>>({});
  const [contactCount, setContactCount] = useState(0);
  const [tentativasMap, setTentativasMap] = useState<Record<string, number>>({});
  const [consultoriasSet, setConsultoriasSet] = useState<Set<string>>(new Set());
  const [semHistoricoSet, setSemHistoricoSet] = useState<Set<string>>(new Set());
  const [semRetornoClients, setSemRetornoClients] = useState<ModalClient[]>([]);
  const [consultoriasMes, setConsultoriasMes] = useState<ConsultoriaMes[]>([]);
  const [modal, setModal] = useState<{ type: "followup" | "semretorno" | "consultorias" | "fila" } | null>(null);

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

    // Papéis do usuário logado
    const { data: rolesUser } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const listaRoles = (rolesUser ?? []).map((r: { role: string }) => r.role);
    const ehCsm = listaRoles.some(r => r === "csm" || r === "csm_admin");
    const ehAdmin = listaRoles.some(r => r === "admin" || r === "csm_admin");

    // Quem é SÓ admin (sem carteira) não deve ver o dashboard da própria carteira:
    // ao acessar sem ?csm=, é levado ao Painel de Gestão.
    if (!csmParam && !ehCsm && ehAdmin) {
      router.replace("/admin");
      return;
    }

    // Determina de qual CSM mostrar a carteira:
    // - por padrão, o próprio usuário logado
    // - se veio ?csm=ID na URL E o usuário logado é admin, mostra a carteira daquele CSM
    let targetId = user.id;
    let ehOutro = false;
    if (csmParam && csmParam !== user.id) {
      if (ehAdmin) { targetId = csmParam; ehOutro = true; }
    }
    setViewingOther(ehOutro);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", targetId)
      .single();
    setProfile(profile);

    const { data: clients } = await supabase
      .from("clients")
      .select("id, marca, bandeira, operacao, plano, cluster, status, last_contact")
      .eq("csm_id", targetId)
      .eq("status", "ativo")
      .order("marca")
      .limit(10000);
    setClients(clients ?? []);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { data: consultoriasDoMes } = await supabase
      .from("client_contacts")
      .select("client_id, date, type, clients!inner(id, marca, bandeira, csm_id)")
      .neq("type", "tentativa")
      .eq("clients.csm_id", targetId)
      .gte("date", startOfMonth.toISOString().split("T")[0])
      .order("date", { ascending: false });
    setConsultoriasMes(consultoriasDoMes ?? []);
    setContactCount((consultoriasDoMes ?? []).length);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: tentativas } = await supabase
      .from("client_contacts")
      .select("client_id")
      .eq("type", "tentativa")
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

    const tentMap: Record<string, number> = {};
    (tentativas ?? []).forEach((t: { client_id: string }) => {
      tentMap[t.client_id] = (tentMap[t.client_id] ?? 0) + 1;
    });
    setTentativasMap(tentMap);

    const { data: consultorias } = await supabase
      .from("client_contacts")
      .select("client_id")
      .neq("type", "tentativa")
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

    const consultSet = new Set((consultorias ?? []).map((c: { client_id: string }) => c.client_id));
    setConsultoriasSet(consultSet);

    const { data: todosContatos } = await supabase
      .from("client_contacts")
      .select("client_id");

    const comHistorico = new Set((todosContatos ?? []).map((c: { client_id: string }) => c.client_id));
    const semHistorico = new Set((clients ?? []).map((c: Client) => c.id).filter((id: string) => !comHistorico.has(id)));
    setSemHistoricoSet(semHistorico);

    // Calcular clientes com 3+ tentativas de contato sem retorno
    const { data: allContacts } = await supabase
      .from("client_contacts")
      .select("client_id, date, type")
      .in("client_id", (clients ?? []).map((c: Client) => c.id))
      .order("date", { ascending: false });

    const semRetorno: ModalClient[] = [];
    const clientContactsMap: Record<string, ContatoMin[]> = {};
    (allContacts ?? []).forEach((c: ContatoMin) => {
      if (!clientContactsMap[c.client_id]) clientContactsMap[c.client_id] = [];
      clientContactsMap[c.client_id].push(c);
    });

    (clients ?? []).forEach((client: Client) => {
      const contatos = clientContactsMap[client.id] ?? [];
      const ultimoEfetivo = contatos.find((c: ContatoMin) => c.type !== "tentativa");
      const tentativasApos = ultimoEfetivo
        ? contatos.filter((c: ContatoMin) => c.type === "tentativa" && c.date > ultimoEfetivo.date)
        : contatos.filter((c: ContatoMin) => c.type === "tentativa");

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

    // Health Score por cliente (casa pelo código = clients.bandeira) e percepção mais recente
    const bandaPorCodigo: Record<string, string> = {};
    let hf = 0;
    for (;;) {
      const { data, error } = await supabase.from("hs_scores").select("tipo, codigo, codigo_matriz, banda").range(hf, hf + 999);
      if (error || !data || data.length === 0) break;
      for (const r of data as { tipo: string; codigo: string | null; codigo_matriz: string | null; banda: string }[]) {
        if (r.tipo === "rede" && r.codigo_matriz) {
          bandaPorCodigo[String(r.codigo_matriz).trim()] = r.banda;
        } else if (r.tipo === "central" && r.codigo) {
          const k = String(r.codigo).trim();
          if (!bandaPorCodigo[k]) bandaPorCodigo[k] = r.banda;
        }
      }
      if (data.length < 1000) break;
      hf += 1000;
    }
    const bandaMap: Record<string, string> = {};
    (clients ?? []).forEach((c: Client) => { const b = c.bandeira ? bandaPorCodigo[String(c.bandeira).trim()] : undefined; if (b) bandaMap[c.id] = b; });
    setBandaPorCliente(bandaMap);

    // Percepção mais recente por cliente
    const ids = (clients ?? []).map((c: Client) => c.id);
    const percepMap: Record<string, string> = {};
    if (ids.length > 0) {
      let pf = 0;
      for (;;) {
        const { data, error } = await supabase.from("client_contacts")
          .select("client_id, date, percepcao")
          .in("client_id", ids)
          .not("percepcao", "is", null)
          .order("date", { ascending: false })
          .range(pf, pf + 999);
        if (error || !data || data.length === 0) break;
        for (const row of data as { client_id: string; percepcao: string }[]) {
          if (!percepMap[row.client_id]) percepMap[row.client_id] = row.percepcao;
        }
        if (data.length < 1000) break;
        pf += 1000;
      }
    }
    setPercepcaoPorCliente(percepMap);

    setLoading(false);
  }, [router, csmParam]);

  useEffect(() => {
    // load() é async; os setState ocorrem após await, não são síncronos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);


  const followUpClients = clients
    .filter(c => daysSince(c.last_contact) > 20)
    .map(c => ({ ...c, daysSinceContact: daysSince(c.last_contact) }));

  const filtered = clients
    .filter(c => {
      const matchSearch = c.marca.toLowerCase().includes(search.toLowerCase()) || c.bandeira?.includes(search);
      const matchOperacao = filterOperacao ? c.operacao === filterOperacao : true;
      const matchCluster = filterCluster ? c.cluster === filterCluster : true;
      const matchBanda = filterBanda ? (bandaPorCliente[c.id] ?? "N/A") === filterBanda : true;
      const matchPercepcao = filterPercepcao ? percepcaoPorCliente[c.id] === filterPercepcao : true;
      return matchSearch && matchOperacao && matchCluster && matchBanda && matchPercepcao;
    })
    .sort((a, b) => {
      if (sortOrder === "recente") return daysSince(a.last_contact) - daysSince(b.last_contact);
      if (sortOrder === "antigo") return daysSince(b.last_contact) - daysSince(a.last_contact);
      return 0;
    });

  const clusterLabel: Record<string, string> = {
    A: "A",
    B: "B",
    C: "C",
    D: "D",
  };

  const operacaoColor: Record<string, string> = {
    Corridas: "bg-blue-100 text-blue-700",
    Entregas: "bg-orange-100 text-orange-700",
    Mototáxi: "bg-purple-100 text-purple-700",
    Táxi: "bg-emerald-100 text-emerald-700",
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Carregando...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MenuLateral />
          <Image src="/machine-logo.png" alt="Machine" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{profile?.full_name}</span>
        </div>
      </header>

      {viewingOther && (
        <div className="bg-blue-600 text-white px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm">
            Você está vendo a carteira de <span className="font-semibold">{profile?.full_name}</span> como administrador.
          </span>
          <button
            onClick={() => router.push("/admin")}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors font-medium"
          >
            ← Voltar ao Painel de Gestão
          </button>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Abas */}
        <div className="flex gap-1 mb-6 border-b border-slate-300 dark:border-slate-700">
          {([
            { id: "carteira", label: "Minha carteira" },
            { id: "estatisticas", label: "Estatísticas gerais" },
          ] as const).map(aba => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                abaAtiva === aba.id
                  ? "border-blue-500 text-blue-600 dark:text-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {aba.label}
            </button>
          ))}
        </div>

        {abaAtiva === "carteira" && (
        <>
        {/* Painel de progresso */}
        {(() => {
          const goal = profile?.monthly_goal ?? 0;
          const temMeta = goal > 0;
          const pct = temMeta ? Math.min(100, Math.round((contactCount / goal) * 100)) : 0;
          return (
            <section className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm px-6 py-6 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Olá, {profile?.full_name?.split(" ")[0]} 👋</h2>
                  <p className="text-sm text-gray-400 mt-1">{clients.length} clientes na sua carteira</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Progresso mensal</p>
                  <button
                    onClick={() => setModal({ type: "consultorias" })}
                    title="Ver os contatos que você registrou este mês"
                    className="text-3xl font-bold tabular-nums text-gray-900 mt-1 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    {contactCount}{temMeta && <span className="text-xl text-gray-300"> / {goal}</span>}
                  </button>
                  <p className="text-xs text-gray-400">contatos no mês{temMeta ? ` · ${pct}%` : ""}</p>
                </div>
              </div>
              {temMeta ? (
                <div className="mt-5 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: "linear-gradient(90deg, #2563eb, #facc15, #ef4444)",
                    }}
                  />
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-400">Nenhuma meta mensal definida.</p>
              )}
            </section>
          );
        })()}

        {/* Cards indicadores */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <button onClick={() => setModal({ type: "fila" })} className="text-left bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 cursor-pointer transition-all hover:shadow-md hover:border-blue-300 group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600">Fila de priorização de contato</p>
              <span className="h-7 w-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h6" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900 tabular-nums">{criticosCount ?? "—"}</p>
            <div className="flex items-center justify-between mt-1 gap-2">
              <p className="text-xs text-gray-400">
                {criticosCount === 1 ? "cliente em estado crítico" : "clientes em estado crítico"} · priorizados por Health Score + percepção
              </p>
              <span className="text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">ver fila →</span>
            </div>
          </button>

          <button onClick={() => setModal({ type: "semretorno" })} className="text-left bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 cursor-pointer transition-all hover:shadow-md hover:border-red-300 group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600">Tentativas de contato sem retorno</p>
              <span className="h-7 w-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900 tabular-nums">{semRetornoClients.length}</p>
            <div className="flex items-center justify-between mt-1 gap-2">
              <p className="text-xs text-gray-400">clientes com 3+ tentativas de contato sem retorno</p>
              <span className="text-xs font-medium text-red-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">ver lista →</span>
            </div>
          </button>
        </div>

        {/* Busca e filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="Buscar por nome ou bandeira..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white dark:bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="relative">
            <button
              onClick={() => {
                setRascunho({ operacao: filterOperacao, cluster: filterCluster, banda: filterBanda, percepcao: filterPercepcao, ordem: sortOrder });
                setShowFiltros(v => !v);
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm bg-white dark:bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filtro
              {(() => {
                const n = [filterOperacao, filterCluster, filterBanda, filterPercepcao, sortOrder].filter(Boolean).length;
                return n > 0 ? <span className="ml-1 h-5 min-w-5 px-1.5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{n}</span> : null;
              })()}
            </button>

            {showFiltros && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowFiltros(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-lg z-40 p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Operação</label>
                    <select value={rascunho.operacao} onChange={e => setRascunho({ ...rascunho, operacao: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Todas</option>
                      <option value="Corridas">Corridas</option>
                      <option value="Entregas">Entregas</option>
                      <option value="Mototáxi">Mototáxi</option>
                      <option value="Táxi">Táxi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cluster</label>
                    <select value={rascunho.cluster} onChange={e => setRascunho({ ...rascunho, cluster: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Todos</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Health Score</label>
                    <select value={rascunho.banda} onChange={e => setRascunho({ ...rascunho, banda: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Todos</option>
                      <option value="Verde">Saudável</option>
                      <option value="Amarelo">Em risco</option>
                      <option value="Vermelho">Crítico</option>
                      <option value="N/A">Não avaliado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Percepção do CSM</label>
                    <select value={rascunho.percepcao} onChange={e => setRascunho({ ...rascunho, percepcao: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Todas</option>
                      <option value="estavel">Estável</option>
                      <option value="atencao">Atenção</option>
                      <option value="risco">Risco</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ordem de contato</label>
                    <select value={rascunho.ordem} onChange={e => setRascunho({ ...rascunho, ordem: e.target.value as "" | "recente" | "antigo" })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Padrão</option>
                      <option value="recente">Contato mais recente</option>
                      <option value="antigo">Contato mais antigo</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setRascunho({ operacao: "", cluster: "", banda: "", percepcao: "", ordem: "" });
                        setFilterOperacao(""); setFilterCluster(""); setFilterBanda(""); setFilterPercepcao(""); setSortOrder("");
                        setShowFiltros(false);
                      }}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-gray-600 hover:bg-slate-50"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={() => {
                        setFilterOperacao(rascunho.operacao); setFilterCluster(rascunho.cluster);
                        setFilterBanda(rascunho.banda); setFilterPercepcao(rascunho.percepcao); setSortOrder(rascunho.ordem);
                        setShowFiltros(false);
                      }}
                      className="flex-1 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700"
                    >
                      Aplicar filtros
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Sua carteira</h3>
            <span className="text-xs text-gray-400">{filtered.length} clientes</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">Nenhum cliente encontrado.</div>
          ) : (
            <ul className="divide-y divide-slate-200/70">
              {filtered.map((c) => (
                <li key={c.id} onClick={() => router.push(`/clients/${c.id}`)} className="px-6 py-4 hover:bg-slate-100 cursor-pointer transition-colors group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{c.marca}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${operacaoColor[c.operacao] ?? "bg-gray-100 text-gray-600"}`}>
                          {c.operacao}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Bandeira {c.bandeira}
                        {c.cluster ? ` · ${clusterLabel[c.cluster] ?? c.cluster}` : ""}
                        {c.plano ? ` · ${c.plano.charAt(0).toUpperCase() + c.plano.slice(1)}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {semHistoricoSet.has(c.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                            Nenhuma tentativa de contato no histórico
                          </span>
                        )}
                        {consultoriasSet.has(c.id) ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            Contato realizado nos últimos 30 dias
                          </span>
                        ) : tentativasMap[c.id] > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                            {tentativasMap[c.id]} tentativa{tentativasMap[c.id] > 1 ? "s" : ""} de contato nos últimos 30 dias
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {c.last_contact ? (
                          <>
                            <p className={`text-sm font-medium tabular-nums ${daysSince(c.last_contact) > 20 ? "text-amber-600" : "text-gray-700"}`}>
                              há {daysSince(c.last_contact)} {daysSince(c.last_contact) === 1 ? "dia" : "dias"}
                            </p>
                            <p className="text-[11px] text-gray-400">último contato</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-300">—</p>
                            <p className="text-[11px] text-gray-400">sem contato</p>
                          </>
                        )}
                      </div>
                      <span className="text-gray-300 group-hover:text-gray-500 transition-colors">›</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
        )}

        {abaAtiva === "estatisticas" && (
          <div className="space-y-6">
            <BuscaClientes />
            <DistribuicaoCarteira />
            <SaudeCarteira />
          </div>
        )}

        {/* Fila oculta: monta sempre para calcular o nº de críticos do card (sem exibir) */}
        <div className="hidden" aria-hidden="true">
          <FilaPriorizacao clientes={clients} onAbrirCliente={() => {}} onContarCriticos={setCriticosCount} />
        </div>
      </main>

      {/* Modal follow-up */}
      {modal?.type === "followup" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
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
                <select value={modalFilterType} onChange={e => setModalFilterType(e.target.value as "mais" | "menos" | "entre")} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white focus:outline-none">
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

      {/* Modal Tentativas de contato sem retorno */}
      {modal?.type === "semretorno" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Tentativas de contato sem retorno</h3>
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
                        Bandeira {c.bandeira} · {c.tentativasSemRetorno} tentativas de contato sem retorno
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
      {/* Modal Consultorias do mês */}
      {modal?.type === "fila" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Fila de priorização de contato</h3>
                <p className="text-xs text-gray-400 mt-0.5">Ordenada por Health Score e sua percepção · os mais urgentes primeiro</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto">
              <FilaPriorizacao clientes={clients} onAbrirCliente={(cid) => { setModal(null); router.push(`/clients/${cid}`); }} />
            </div>
          </div>
        </div>
      )}

      {modal?.type === "consultorias" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Contatos no mês</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{consultoriasMes.length} {consultoriasMes.length === 1 ? "contato" : "contatos"}</span>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {consultoriasMes.length === 0 ? (
                <li className="px-6 py-8 text-center text-sm text-gray-400">Nenhum contato registrado este mês.</li>
              ) : consultoriasMes.map((c, i) => {
                const cliente = Array.isArray(c.clients) ? c.clients[0] : c.clients;
                return (
                  <li key={`${c.client_id}-${c.date}-${i}`} onClick={() => { setModal(null); router.push(`/clients/${c.client_id}`); }} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{cliente?.marca}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Bandeira {cliente?.bandeira} · consultoria em {new Date(c.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">→</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><p className="text-slate-400 text-sm">Carregando...</p></div>}>
      <DashboardInner />
    </Suspense>
  );
}
