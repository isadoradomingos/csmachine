"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  full_name: string;
  monthly_goal: number | null;
  roles: string[];
  ativo: boolean;
};

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [activeModal, setActiveModal] = useState<"csms" | "clientes" | "contatos" | "meta" | null>(null);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [contatoFilterCSM, setContatoFilterCSM] = useState("");
  const [contatosList, setContatosList] = useState<any[]>([]);
  const [contatosCSMMap, setContatosCSMMap] = useState<Record<string, number>>({});
  const [inviteForm, setInviteForm] = useState({ full_name: "", email: "", role: "csm", monthly_goal: 49 });
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<"idle" | "success" | "error">("idle");
  const [inviteError, setInviteError] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const isAdmin = (roles ?? []).some((r: any) => r.user_id === user.id && r.role === "admin");
    if (!isAdmin) { router.push("/dashboard"); return; }

    const allUserIds = [...new Set((roles ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", allUserIds);

    const rolesMap: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });

    setUsers((profiles ?? []).map((p: any) => ({
      ...p,
      roles: rolesMap[p.id] ?? [],
      ativo: p.ativo !== false,
    })));

    // Stats gerais
    const csmIds = (roles ?? []).filter((r: any) => r.role === "csm").map((r: any) => r.user_id);
    const { count: totalClients } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo");

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { count: totalContacts } = await supabase
      .from("client_contacts")
      .select("*", { count: "exact", head: true })
      .eq("type", "consultoria_produto")
      .gte("date", startOfMonth.toISOString().split("T")[0]);

    const { data: profilesForGoal } = await supabase
      .from("profiles")
      .select("monthly_goal")
      .in("id", csmIds);

    const totalGoal = (profilesForGoal ?? []).reduce((acc: number, p: any) => acc + (p.monthly_goal ?? 49), 0);
    const metaPercent = totalGoal > 0 ? Math.round(((totalContacts ?? 0) / totalGoal) * 100) : 0;

    setStats({
      csmCount: csmIds.length,
      totalClients: totalClients ?? 0,
      totalContacts: totalContacts ?? 0,
      metaPercent,
    });

    // Buscar todos os clientes ativos
    // Buscar todos os clientes em batches de 1000
    let allClientsData: any[] = [];
    let from = 0;
    while (true) {
      const { data: batch } = await supabase
        .from("clients")
        .select("id, marca, bandeira, operacao, csm_id")
        .eq("status", "ativo")
        .order("marca")
        .range(from, from + 999);
      if (!batch || batch.length === 0) break;
      allClientsData = [...allClientsData, ...batch];
      if (batch.length < 1000) break;
      from += 1000;
    }
    setAllClients(allClientsData);

    // Buscar contatos do mês por CSM
    const { data: contatosMes } = await supabase
      .from("client_contacts")
      .select("id, date, type, client_id, clients!inner(csm_id)")
      .eq("type", "consultoria_produto")
      .gte("date", startOfMonth.toISOString().split("T")[0]);

    setContatosList(contatosMes ?? []);

    const csmContactMap: Record<string, number> = {};
    (contatosMes ?? []).forEach((c: any) => {
      const csmId = c.clients?.csm_id;
      if (csmId) csmContactMap[csmId] = (csmContactMap[csmId] ?? 0) + 1;
    });
    setContatosCSMMap(csmContactMap);

    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteStatus("idle");
    setInviteError("");

    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });

    const data = await res.json();

    if (!res.ok) {
      setInviteStatus("error");
      setInviteError(data.error ?? "Erro ao convidar usuário");
      setInviting(false);
      return;
    }

    setInviteStatus("success");
    setInviting(false);
    setInviteForm({ full_name: "", email: "", role: "csm", monthly_goal: 49 });
    await load();
  }

  const roleLabel = (role: string) => role === "admin" ? "Admin" : "CSM";
  const roleColor = (role: string) => role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700";

  if (loading) return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Carregando...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-800">
      <header className="sticky top-0 z-40 bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <div className="flex items-center gap-4">

          <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="text-sm text-red-500 hover:text-red-700">Sair</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Administração</p>
            <h2 className="text-2xl font-semibold text-white mt-1">Visão geral do time</h2>
          </div>
          <button
            onClick={() => router.push("/admin/importar")}
            className="text-sm px-4 py-2 rounded-lg transition-colors font-medium"
            style={{ background: "#16a34a", color: "white" }}
            onMouseOver={e => (e.currentTarget.style.background = "#15803d")}
            onMouseOut={e => (e.currentTarget.style.background = "#16a34a")}
          >
            ↑ Importar planilha
          </button>
        </div>

        {/* Cards gerais */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          <div onClick={() => setActiveModal("csms")} className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-400 mb-2">CSMs ativos</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.csmCount}</p>
          </div>
          <div onClick={() => { setClientSearch(""); setActiveModal("clientes"); }} className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-400 mb-2">Clientes na carteira</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.totalClients}</p>
          </div>
          <div onClick={() => { setContatoFilterCSM(""); setActiveModal("contatos"); }} className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-400 mb-2">Consultorias de Produto no mês</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.totalContacts}</p>
          </div>
          <div onClick={() => setActiveModal("meta")} className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-400 mb-2">Meta coletiva</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.metaPercent}%</p>
          </div>
        </div>

        {/* Lista de usuários */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Usuários</h3>
            <button
              onClick={() => { setShowInvite(true); setInviteStatus("idle"); }}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Adicionar usuário
            </button>
          </div>
          <ul className="divide-y divide-slate-200/60">
            {users.map((u) => (
              <li
                key={u.id}
                onClick={() => router.push(`/admin/usuario/${u.id}`)}
                className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${u.ativo === false ? "bg-slate-100 opacity-60" : "hover:bg-slate-100"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${u.ativo === false ? "bg-gray-200 text-gray-500" : "bg-blue-100 text-blue-700"}`}>
                    {u.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <p className={`font-medium ${u.ativo === false ? "text-gray-400" : "text-gray-900"}`}>{u.full_name}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      {u.roles.map(r => (
                        <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>
                          {roleLabel(r)}
                        </span>
                      ))}
                      {u.ativo === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400">→</span>
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* Modal CSMs ativos */}
      {activeModal === "csms" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">CSMs ativos</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <ul className="divide-y divide-slate-200/60 overflow-y-auto flex-1">
              {users.filter(u => u.roles.includes("csm")).map(u => (
                <li key={u.id} onClick={() => { setActiveModal(null); router.push(`/admin/usuario/${u.id}`); }} className="px-6 py-4 flex items-center gap-3 hover:bg-slate-100 cursor-pointer transition-colors">
                  <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {u.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </div>
                  <p className="font-medium text-gray-900 text-sm">{u.full_name}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal Clientes na carteira */}
      {activeModal === "clientes" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Clientes na carteira</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-6 py-3 border-b border-slate-200/60">
              <input
                type="text"
                placeholder="Buscar por nome ou bandeira..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="px-6 py-2 border-b border-slate-200/60">
              <span className="text-xs text-gray-400">
                {allClients.filter(c => c.marca.toLowerCase().includes(clientSearch.toLowerCase()) || c.bandeira?.includes(clientSearch)).length} clientes
              </span>
            </div>
            <ul className="divide-y divide-slate-200/60 overflow-y-auto flex-1">
              {allClients
                .filter(c => c.marca.toLowerCase().includes(clientSearch.toLowerCase()) || c.bandeira?.includes(clientSearch))
                .map(c => (
                  <li key={c.id} onClick={() => { setActiveModal(null); router.push(`/clients/${c.id}`); }} className="px-6 py-3 hover:bg-slate-100 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.marca}</p>
                        <p className="text-xs text-gray-400">Bandeira {c.bandeira} · {c.operacao}</p>
                      </div>
                      <span className="text-xs text-gray-400">→</span>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal Contatos no mês */}
      {activeModal === "contatos" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Consultorias de Produto no mês</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-6 py-3 border-b border-slate-200/60">
              <select
                value={contatoFilterCSM}
                onChange={e => setContatoFilterCSM(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os CSMs</option>
                {users.filter(u => u.roles.includes("csm")).map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div className="px-6 py-2 border-b border-slate-200/60">
              <span className="text-xs text-gray-400">
                {contatosList.filter((c: any) => !contatoFilterCSM || c.clients?.csm_id === contatoFilterCSM).length} consultorias de produto realizadas
              </span>
            </div>
            <ul className="divide-y divide-slate-200/60 overflow-y-auto flex-1">
              {contatosList
                .filter((c: any) => !contatoFilterCSM || c.clients?.csm_id === contatoFilterCSM)
                .map((c: any) => {
                  const client = allClients.find(cl => cl.id === c.client_id);
                  const csm = users.find(u => u.id === c.clients?.csm_id);
                  return (
                    <li key={c.id} onClick={() => { setActiveModal(null); router.push(`/clients/${c.client_id}`); }} className="px-6 py-3 hover:bg-slate-100 cursor-pointer transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{client?.marca ?? "—"}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {csm?.full_name ?? "—"} · {new Date(c.date).toLocaleDateString("pt-BR")}
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

      {/* Modal Meta coletiva */}
      {activeModal === "meta" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Meta coletiva</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <ul className="divide-y divide-slate-200/60 overflow-y-auto flex-1">
              {users.filter(u => u.roles.includes("csm") && u.monthly_goal).map(u => {
                const contacts = contatosCSMMap[u.id] ?? 0;
                const goal = u.monthly_goal ?? 49;
                const percent = Math.min(100, Math.round((contacts / goal) * 100));
                return (
                  <li key={u.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 text-sm">{u.full_name}</p>
                      <p className="text-sm font-semibold text-gray-700">{contacts}/{goal} · {percent}%</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${percent}%`, background: "linear-gradient(90deg, #2563eb, #facc15, #ef4444)" }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Modal convidar */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Adicionar usuário</h3>

            {inviteStatus === "success" ? (
              <div className="text-center py-4">
                <p className="text-green-600 font-medium mb-2">✓ Convite enviado!</p>
                <p className="text-sm text-gray-500 mb-4">O usuário receberá um e-mail com as instruções de acesso.</p>
                <button onClick={() => { setShowInvite(false); setInviteStatus("idle"); }} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Fechar</button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
                  <input type="text" value={inviteForm.full_name} onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Ana Julia Pereira" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                  <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="usuario@gaudium.com.br" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
                  <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="csm">CSM</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteForm.monthly_goal > 0}
                      onChange={e => setInviteForm({ ...inviteForm, monthly_goal: e.target.checked ? 49 : 0 })}
                      className="rounded"
                    />
                    Possui meta mensal de contatos
                  </label>
                  {inviteForm.monthly_goal > 0 && (
                    <input type="number" value={inviteForm.monthly_goal} onChange={e => setInviteForm({ ...inviteForm, monthly_goal: parseInt(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>

                {inviteStatus === "error" && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inviteError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowInvite(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={inviting} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {inviting ? "Enviando..." : "Enviar convite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
