"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

export default function AdminUsuarioPage() {
  const router = useRouter();
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOperacao, setFilterOperacao] = useState("");
  const [filterCluster, setFilterCluster] = useState("");
  const [sortOrder, setSortOrder] = useState<"" | "recente" | "antigo">("");
  const [followUpCount, setFollowUpCount] = useState(0);
  const [semRetornoCount, setSemRetornoCount] = useState(0);
  const [semRetornoClients, setSemRetornoClients] = useState<any[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [modal, setModal] = useState<{ title: string; clients: any[] } | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalOrder, setModalOrder] = useState<"asc" | "desc">("desc");
  const [modalFilterType, setModalFilterType] = useState<"mais" | "menos" | "entre">("mais");
  const [modalFilterDays, setModalFilterDays] = useState("");
  const [modalFilterDays2, setModalFilterDays2] = useState("");
  const [editForm, setEditForm] = useState({ full_name: "", email: "", monthly_goal: 49, hasMeta: true, role: "csm" });
  const [userEmail, setUserEmail] = useState("");
  const [saving, setSaving] = useState(false);


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
      .eq("id", id)
      .single();
    setProfile(profile);

    // Buscar email via função segura
    const { data: emailData } = await supabase
      .rpc("get_user_email", { user_id_input: id as string });
    setUserEmail(emailData ?? "");

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", id);
    const roleList = (userRoles ?? []).map((r: any) => r.role);
    setRoles(roleList);

    const { data: clients } = await supabase
      .from("clients")
      .select("id, marca, bandeira, operacao, plano, cluster, status, last_contact")
      .eq("csm_id", id)
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
      .eq("clients.csm_id", id)
      .gte("date", startOfMonth.toISOString().split("T")[0]);
    setContactCount(count ?? 0);

    const followUp = (clients ?? []).filter((c: any) => daysSince(c.last_contact) > 20).length;
    setFollowUpCount(followUp);

    // Calcular Tentativas de contato sem retorno
    const { data: allContacts } = await supabase
      .from("client_contacts")
      .select("client_id, date, type")
      .in("client_id", (clients ?? []).map((c: any) => c.id))
      .order("date", { ascending: false });

    const clientContactsMap: Record<string, any[]> = {};
    (allContacts ?? []).forEach((c: any) => {
      if (!clientContactsMap[c.client_id]) clientContactsMap[c.client_id] = [];
      clientContactsMap[c.client_id].push(c);
    });

    let semRetorno = 0;
    (clients ?? []).forEach((client: any) => {
      const contatos = clientContactsMap[client.id] ?? [];
      const ultimoEfetivo = contatos.find((c: any) => c.type === "efetivo" || c.type === "consultoria_produto");
      const tentativasApos = ultimoEfetivo
        ? contatos.filter((c: any) => c.type === "tentativa" && c.date > ultimoEfetivo.date)
        : contatos.filter((c: any) => c.type === "tentativa");
      if (tentativasApos.length >= 3) semRetorno++;
    });
    setSemRetornoCount(semRetorno);

    const semRetornoList = (clients ?? []).filter((client: any) => {
      const contatos = clientContactsMap[client.id] ?? [];
      const ultimoEfetivo = contatos.find((c: any) => c.type === "efetivo" || c.type === "consultoria_produto");
      const tentativasApos = ultimoEfetivo
        ? contatos.filter((c: any) => c.type === "tentativa" && c.date > ultimoEfetivo.date)
        : contatos.filter((c: any) => c.type === "tentativa");
      return tentativasApos.length >= 3;
    });
    setSemRetornoClients(semRetornoList);

    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await supabase.from("profiles").update({
      full_name: editForm.full_name,
      monthly_goal: editForm.hasMeta ? editForm.monthly_goal : null,
    }).eq("id", id);

    // Atualizar email se mudou
    if (editForm.email && editForm.email !== userEmail) {
      await fetch("/api/update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id, email: editForm.email }),
      });
      setUserEmail(editForm.email);
    }

    // Atualizar roles
    await supabase.from("user_roles").delete().eq("user_id", id);
    if (editForm.role === "csm_admin") {
      await supabase.from("user_roles").insert([
        { user_id: id, role: "csm" },
        { user_id: id, role: "admin" },
      ]);
    } else {
      await supabase.from("user_roles").insert({ user_id: id, role: editForm.role });
    }

    setSaving(false);
    setShowEdit(false);
    await load();
  }

  async function handleToggleAtivo(desativar: boolean) {
    const msg = desativar
      ? `Desativar ${profile?.full_name}? O acesso será bloqueado e os clientes ficarão sem CSM.`
      : `Reativar ${profile?.full_name}? O acesso será restaurado mas a carteira estará vazia.`;
    if (!confirm(msg)) return;

    await supabase.from("profiles").update({ ativo: !desativar }).eq("id", id);

    if (desativar) {
      // Remover csm_id dos clientes
      await supabase.from("clients").update({ csm_id: null }).eq("csm_id", id);
    }

    await load();
  }

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

  const roleLabel = (r: string) => r === "admin" ? "Admin" : "CSM";
  const roleColor = (r: string) => r === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700";

  if (loading) return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Carregando...</p>
    </div>
  );

  const hasMeta = profile?.monthly_goal != null;

  return (
    <div className="min-h-screen bg-slate-800">
      <header className="sticky top-0 z-40 bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header do usuário */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm px-6 py-6">
          {(() => {
            const goal = profile?.monthly_goal ?? 0;
            const pct = goal > 0 ? Math.min(100, Math.round((contactCount / goal) * 100)) : 0;
            return (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold shrink-0">
                      {profile?.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-semibold text-gray-900">{profile?.full_name}</h2>
                        {roles.map(r => (
                          <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>
                            {roleLabel(r)}
                          </span>
                        ))}
                        {profile?.ativo === false && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5">{clients.length} clientes na carteira</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => {
                        setEditForm({
                          full_name: profile?.full_name ?? "",
                          email: userEmail,
                          monthly_goal: profile?.monthly_goal ?? 49,
                          hasMeta: profile?.monthly_goal != null,
                          role: roles.includes("admin") && roles.includes("csm") ? "csm_admin" : roles[0] ?? "csm",
                        });
                        setShowEdit(true);
                      }}
                      className="text-xs border border-gray-200 bg-white text-gray-700 px-3 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                      Editar
                    </button>
                    {hasMeta && (
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Progresso mensal</p>
                        <p className="text-3xl font-bold tabular-nums text-gray-900 mt-1">
                          {contactCount}<span className="text-xl text-gray-300"> / {goal}</span>
                        </p>
                        <p className="text-xs text-gray-400">consultorias de produto · {pct}%</p>
                      </div>
                    )}
                  </div>
                </div>

                {hasMeta && (
                  <div className="mt-5 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, #2563eb, #facc15, #ef4444)",
                      }}
                    />
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Cards indicadores */}
        <div className="grid grid-cols-2 gap-4">
          <div
            onClick={() => setModal({ title: "Oportunidades de follow-up", clients: clients.filter(c => daysSince(c.last_contact) > 20).map(c => ({ ...c, daysSinceContact: daysSince(c.last_contact) })) })}
            className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Oportunidades de follow-up</p>
              <span className="text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{followUpCount}</p>
            <p className="text-xs text-gray-400 mt-1">clientes sem contato há mais de 20 dias</p>
          </div>

          <div
            onClick={() => setModal({ title: "Tentativas de contato sem retorno", clients: semRetornoClients })}
            className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Tentativas de contato sem retorno</p>
              <span className="text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{semRetornoCount}</p>
            <p className="text-xs text-gray-400 mt-1">clientes com 3+ tentativas de contato sem retorno</p>
          </div>
        </div>

        {/* Carteira */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/60">
            <h3 className="font-medium text-gray-900">Carteira</h3>
          </div>
          <div className="px-6 py-3 border-b border-slate-200/60 flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Buscar por nome ou bandeira..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select value={filterOperacao} onChange={e => setFilterOperacao(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">Todas as operações</option>
              <option value="corridas">Corridas</option>
              <option value="entregas">Entregas</option>
            </select>
            <select value={filterCluster} onChange={e => setFilterCluster(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">Todos os clusters</option>
              <option value="high_touch">High Touch</option>
              <option value="mid_touch">Mid Touch</option>
              <option value="growth_touch">Growth Touch</option>
              <option value="no_touch">No Touch</option>
            </select>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">Ordem de contato</option>
              <option value="recente">Contato mais recente</option>
              <option value="antigo">Contato mais antigo</option>
            </select>
          </div>
          <div className="px-6 py-2 border-b border-slate-200/60">
            <span className="text-xs text-gray-400">{filtered.length} clientes</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">Nenhum cliente encontrado.</div>
          ) : (
            <ul className="divide-y divide-slate-200/60">
              {filtered.map((c) => (
                <li key={c.id} onClick={() => router.push(`/clients/${c.id}`)} className="px-6 py-4 hover:bg-slate-100 cursor-pointer transition-colors">
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Modal de clientes */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{modal.title}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>

            {/* Filtros — só para follow-up */}
            {modal.title === "Oportunidades de follow-up" && (
              <div className="px-6 py-3 border-b border-slate-200/60 space-y-2">
                <input
                  type="text"
                  placeholder="Buscar por nome ou bandeira..."
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
              </div>
            )}

            {/* Busca simples para tentativas */}
            {modal.title === "Tentativas de contato sem retorno" && (
              <div className="px-6 py-3 border-b border-slate-200/60">
                <input
                  type="text"
                  placeholder="Buscar por nome ou bandeira..."
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="px-6 py-2 border-b border-slate-200/60">
              <span className="text-xs text-gray-400">
                {(() => {
                  let list = modal.clients;
                  if (modalSearch) list = list.filter((c: any) => c.marca.toLowerCase().includes(modalSearch.toLowerCase()) || c.bandeira?.includes(modalSearch));
                  if (modal.title === "Oportunidades de follow-up" && modalFilterDays) {
                    const d1 = parseInt(modalFilterDays);
                    const d2 = parseInt(modalFilterDays2);
                    if (!isNaN(d1)) {
                      list = list.filter((c: any) => {
                        const days = daysSince(c.last_contact);
                        if (modalFilterType === "mais") return days > d1;
                        if (modalFilterType === "menos") return days < d1;
                        if (modalFilterType === "entre" && !isNaN(d2)) return days >= d1 && days <= d2;
                        return true;
                      });
                    }
                  }
                  return `${list.length} clientes`;
                })()}
              </span>
            </div>

            <ul className="divide-y divide-slate-200/60 overflow-y-auto flex-1">
              {(() => {
                let list = [...modal.clients];
                if (modalSearch) list = list.filter((c: any) => c.marca.toLowerCase().includes(modalSearch.toLowerCase()) || c.bandeira?.includes(modalSearch));
                if (modal.title === "Oportunidades de follow-up") {
                  const d1 = parseInt(modalFilterDays);
                  const d2 = parseInt(modalFilterDays2);
                  if (!isNaN(d1)) {
                    list = list.filter((c: any) => {
                      const days = daysSince(c.last_contact);
                      if (modalFilterType === "mais") return days > d1;
                      if (modalFilterType === "menos") return days < d1;
                      if (modalFilterType === "entre" && !isNaN(d2)) return days >= d1 && days <= d2;
                      return true;
                    });
                  }
                  list.sort((a: any, b: any) => modalOrder === "desc"
                    ? daysSince(b.last_contact) - daysSince(a.last_contact)
                    : daysSince(a.last_contact) - daysSince(b.last_contact)
                  );
                }
                if (list.length === 0) return [<li key="empty" className="px-6 py-8 text-center text-sm text-gray-400">Nenhum cliente encontrado.</li>];
                return list.map((c: any) => (
                  <li key={c.id} onClick={() => { setModal(null); router.push(`/clients/${c.id}`); }} className="px-6 py-4 hover:bg-slate-100 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.marca}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Bandeira {c.bandeira} · {c.last_contact ? `último contato há ${daysSince(c.last_contact)} dias` : "sem contato registrado"}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">→</span>
                    </div>
                  </li>
                ));
              })()}
            </ul>
          </div>
        </div>
      )}

      {/* Modal editar usuário */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Editar usuário</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="csm">CSM</option>
                  <option value="admin">Admin</option>
                  <option value="csm_admin">CSM + Admin</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.hasMeta}
                    onChange={e => setEditForm({ ...editForm, hasMeta: e.target.checked })}
                    className="rounded"
                  />
                  Possui meta mensal de contatos
                </label>
                {editForm.hasMeta && (
                  <input
                    type="number"
                    value={editForm.monthly_goal}
                    onChange={e => setEditForm({ ...editForm, monthly_goal: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>

              {/* Botão desativar/reativar */}
              <div className="pt-2 border-t border-gray-100">
                {profile?.ativo !== false ? (
                  <button
                    type="button"
                    onClick={() => { setShowEdit(false); handleToggleAtivo(true); }}
                    className="w-full rounded-lg border border-red-200 text-red-500 px-4 py-2 text-sm hover:bg-red-50 transition-colors"
                  >
                    Desativar usuário
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setShowEdit(false); handleToggleAtivo(false); }}
                    className="w-full rounded-lg border border-green-200 text-green-600 px-4 py-2 text-sm hover:bg-green-50 transition-colors"
                  >
                    Reativar usuário
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
