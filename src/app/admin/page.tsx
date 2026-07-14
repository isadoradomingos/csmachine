"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { UserRole } from "@/lib/types";
import { useRouter } from "next/navigation";
import AdminAnalytics from "@/components/AdminAnalytics";
import DistribuicaoCarteira from "@/components/DistribuicaoCarteira";
import RankingCsm from "@/components/RankingCsm";
import SaudeCarteira from "@/components/SaudeCarteira";
import BuscaClientes from "@/components/BuscaClientes";

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
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ full_name: "", email: "", role: "csm", monthly_goal: 49 });
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", monthly_goal: 49, hasMeta: true, role: "csm" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<"idle" | "success" | "error">("idle");
  const [inviteError, setInviteError] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"clientes" | "equipe">("clientes");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    const isAdmin = (roles ?? []).some((r: UserRole) => r.user_id === user.id && r.role === "admin");
    if (!isAdmin) { router.push("/dashboard"); return; }

    const allUserIds = [...new Set((roles ?? []).map((r: UserRole) => r.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", allUserIds);

    const rolesMap: Record<string, string[]> = {};
    (roles ?? []).forEach((r: UserRole) => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });

    setUsers((profiles ?? []).map((p: { id: string; full_name: string; monthly_goal: number | null; ativo?: boolean }) => ({
      ...p,
      roles: rolesMap[p.id] ?? [],
      ativo: p.ativo !== false,
    })));

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // load() é async; setState ocorre após await, não é síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function abrirEdicao(u: User) {
    // Busca o email atual via função segura
    const { data: emailData } = await supabase.rpc("get_user_email", { user_id_input: u.id });
    const roleCombo = u.roles.includes("admin") && u.roles.includes("csm")
      ? "csm_admin"
      : u.roles.includes("admin") ? "admin" : "csm";
    setEditForm({
      full_name: u.full_name ?? "",
      email: emailData ?? "",
      monthly_goal: u.monthly_goal ?? 49,
      hasMeta: (u.monthly_goal ?? 0) > 0,
      role: roleCombo,
    });
    setEditUser(u);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSavingEdit(true);
    const id = editUser.id;

    await supabase.from("profiles").update({
      full_name: editForm.full_name,
      monthly_goal: editForm.hasMeta ? editForm.monthly_goal : null,
    }).eq("id", id);

    // Atualiza email se mudou
    const { data: emailAtual } = await supabase.rpc("get_user_email", { user_id_input: id });
    if (editForm.email && editForm.email !== emailAtual) {
      await fetch("/api/update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id, email: editForm.email }),
      });
    }

    // Atualiza roles
    await supabase.from("user_roles").delete().eq("user_id", id);
    if (editForm.role === "csm_admin") {
      await supabase.from("user_roles").insert([
        { user_id: id, role: "csm" },
        { user_id: id, role: "admin" },
      ]);
    } else {
      await supabase.from("user_roles").insert({ user_id: id, role: editForm.role });
    }

    setSavingEdit(false);
    setEditUser(null);
    await load();
  }

  async function handleToggleAtivo(desativar: boolean) {
    if (!editUser) return;
    const id = editUser.id;
    const msg = desativar
      ? `Desativar ${editUser.full_name}? O acesso será bloqueado e os clientes ficarão sem CSM.`
      : `Reativar ${editUser.full_name}? O acesso será restaurado mas a carteira estará vazia.`;
    if (!confirm(msg)) return;

    await supabase.from("profiles").update({ ativo: !desativar }).eq("id", id);
    if (desativar) {
      await supabase.from("clients").update({ csm_id: null }).eq("csm_id", id);
    }
    setEditUser(null);
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
          <Image src="/machine-logo.png" alt="Machine" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="text-sm text-red-500 hover:text-red-700">Sair</button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Título */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Administração</p>
          <h2 className="text-2xl font-semibold text-white mt-1">Painel de Gestão</h2>
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-6 border-b border-slate-700">
          {([
            { id: "clientes", label: "Clientes" },
            { id: "equipe", label: "Equipe" },
          ] as const).map(aba => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                abaAtiva === aba.id ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {aba.label}
            </button>
          ))}
        </div>

        {/* ===== ABA CLIENTES ===== */}
        {abaAtiva === "clientes" && (
          <div className="space-y-6">
            {/* Ações em destaque */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => router.push("/admin/importar")}
                className="text-sm px-4 py-2.5 rounded-lg transition-colors font-medium"
                style={{ background: "#16a34a", color: "white" }}
                onMouseOver={e => (e.currentTarget.style.background = "#15803d")}
                onMouseOut={e => (e.currentTarget.style.background = "#16a34a")}
              >
                ↑ Atualizar carteira de clientes
              </button>
              <button
                onClick={() => router.push("/admin/health-score")}
                className="text-sm px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                ♥ Atualizar health score
              </button>
            </div>

            {/* Busca de cliente */}
            <BuscaClientes />

            {/* Distribuição da carteira (cluster + operação lado a lado) */}
            <DistribuicaoCarteira />

            {/* Health Score */}
            <SaudeCarteira />
          </div>
        )}

        {/* ===== ABA EQUIPE ===== */}
        {abaAtiva === "equipe" && (
          <div className="space-y-6">
            {/* Contatos ao longo do tempo (com filtros próprios) */}
            <AdminAnalytics />

            {/* Ranking de CSMs (com filtro próprio) */}
            <RankingCsm />

            {/* Gestão de usuários */}
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
                    className={`px-6 py-4 flex items-center justify-between transition-colors ${u.ativo === false ? "bg-slate-100 opacity-60" : "hover:bg-slate-100"}`}
                  >
                    <div
                      onClick={() => router.push(`/dashboard?csm=${u.id}`)}
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    >
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${u.ativo === false ? "bg-gray-200 text-gray-500" : "bg-blue-100 text-blue-700"}`}>
                        {u.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className={`font-medium ${u.ativo === false ? "text-gray-400" : "text-gray-900"}`}>{u.full_name}</p>
                        <div className="flex gap-1.5 mt-0.5">
                          {u.roles.map(r => (
                            <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>{roleLabel(r)}</span>
                          ))}
                          {u.ativo === false && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">Inativo</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirEdicao(u); }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-gray-500 hover:bg-slate-100 hover:text-gray-700 bg-white transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard?csm=${u.id}`)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                        title="Ver carteira"
                      >
                        Ver carteira →
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

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
                    <input type="checkbox" checked={inviteForm.monthly_goal > 0} onChange={e => setInviteForm({ ...inviteForm, monthly_goal: e.target.checked ? 49 : 0 })} className="rounded" />
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

      {/* Modal editar usuário */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Editar usuário</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
                <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
                <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="csm">CSM</option>
                  <option value="admin">Admin</option>
                  <option value="csm_admin">CSM + Admin</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.hasMeta} onChange={e => setEditForm({ ...editForm, hasMeta: e.target.checked })} className="rounded" />
                  Possui meta mensal de contatos
                </label>
                {editForm.hasMeta && (
                  <input type="number" value={editForm.monthly_goal} onChange={e => setEditForm({ ...editForm, monthly_goal: parseInt(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditUser(null)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={savingEdit} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {savingEdit ? "Salvando..." : "Salvar"}
                </button>
              </div>
              <div className="pt-2 border-t border-gray-100">
                {editUser.ativo !== false ? (
                  <button type="button" onClick={() => handleToggleAtivo(true)} className="w-full rounded-lg border border-red-200 text-red-500 px-4 py-2 text-sm hover:bg-red-50 transition-colors">
                    Desativar usuário
                  </button>
                ) : (
                  <button type="button" onClick={() => handleToggleAtivo(false)} className="w-full rounded-lg border border-green-200 text-green-600 px-4 py-2 text-sm hover:bg-green-50 transition-colors">
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
