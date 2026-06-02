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
  const [followUpCount, setFollowUpCount] = useState(0);
  const [semRetornoCount, setSemRetornoCount] = useState(0);
  const [semRetornoClients, setSemRetornoClients] = useState<any[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [modal, setModal] = useState<{ title: string; clients: any[] } | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", monthly_goal: 49, hasMeta: true, role: "csm" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

    // Calcular tentativas sem retorno
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

    // Atualizar roles
    await supabase.from("user_roles").delete().eq("user_id", id);
    await supabase.from("user_roles").insert({ user_id: id, role: editForm.role });
    if (editForm.role === "csm" && roles.includes("admin")) {
      await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
    }

    setSaving(false);
    setShowEdit(false);
    await load();
  }

  async function handleDelete() {
    if (!confirm(`Tem certeza que deseja remover o acesso de ${profile?.full_name}? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);

    const res = await fetch("/api/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setDeleting(false);
    }
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.marca.toLowerCase().includes(search.toLowerCase()) || c.bandeira?.includes(search);
    const matchOperacao = filterOperacao ? c.operacao === filterOperacao : true;
    const matchCluster = filterCluster ? c.cluster === filterCluster : true;
    return matchSearch && matchOperacao && matchCluster;
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
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  );

  const hasMeta = profile?.monthly_goal != null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header do usuário */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
          <div className="flex items-start justify-between">
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
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{clients.length} clientes na carteira</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs border border-gray-200 bg-white text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
              >
                Editar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Removendo..." : "Remover acesso"}
              </button>
            </div>
          </div>

          {/* Barra de progresso — só se tiver meta */}
          {hasMeta && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Progresso mensal</p>
                <p className="text-sm font-semibold text-gray-900">{contactCount} / {profile?.monthly_goal} contatos</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((contactCount / (profile?.monthly_goal ?? 1)) * 100))}%`,
                    background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cards indicadores */}
        <div className="grid grid-cols-2 gap-4">
          <div
            onClick={() => setModal({ title: "Oportunidades de follow-up", clients: clients.filter(c => daysSince(c.last_contact) > 20).map(c => ({ ...c, daysSinceContact: daysSince(c.last_contact) })) })}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow"
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
            onClick={() => setModal({ title: "Tentativas sem retorno", clients: semRetornoClients })}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Tentativas sem retorno</p>
              <span className="text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{semRetornoCount}</p>
            <p className="text-xs text-gray-400 mt-1">clientes com 3+ tentativas sem contato efetivo</p>
          </div>
        </div>

        {/* Carteira */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900">Carteira</h3>
          </div>
          <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-3">
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
          </div>
          <div className="px-6 py-2 border-b border-gray-100">
            <span className="text-xs text-gray-400">{filtered.length} clientes</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">Nenhum cliente encontrado.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <li key={c.id} onClick={() => router.push(`/clients/${c.id}`)} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{modal.title}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{modal.clients.length} clientes</span>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {modal.clients.length === 0 ? (
                <li className="px-6 py-8 text-center text-sm text-gray-400">Nenhum cliente nesta categoria.</li>
              ) : modal.clients.map(c => (
                <li key={c.id} onClick={() => { setModal(null); router.push(`/clients/${c.id}`); }} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
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
              ))}
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
                  value={editForm.full_name || profile?.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
                <select
                  value={editForm.role || roles[0]}
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
                  Possui meta mensal
                </label>
                {editForm.hasMeta && (
                  <input
                    type="number"
                    value={editForm.monthly_goal || profile?.monthly_goal || 49}
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
