"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const [csms, setCsms] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      console.log("roles:", roles);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      console.log("isAdmin:", isAdmin);
      if (!isAdmin) { router.push("/dashboard"); return; }

      // Buscar todos os user_ids com role csm
      const { data: csmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "csm");

      const csmIds = (csmRoles ?? []).map(r => r.user_id);

      // Buscar profiles apenas dos CSMs
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", csmIds);

      // Buscar clientes ativos
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativo");

      const totalClientCount = clientCount ?? 0;

      // Buscar contagem por CSM separadamente
      const csmCountMap: Record<string, number> = {};
      for (const csmId of csmIds) {
        const { count } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("csm_id", csmId)
          .eq("status", "ativo");
        csmCountMap[csmId] = count ?? 0;
      }

      // Buscar contatos do mês
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const { data: contacts } = await supabase
        .from("client_contacts")
        .select("id, client_id, clients!inner(csm_id)")
        .gte("date", startOfMonth.toISOString().split("T")[0]);

      // Agregar por CSM
      const csmData = (profiles ?? []).map(p => {
        const myContacts = (contacts ?? []).filter((c: any) => c.clients?.csm_id === p.id);
        return {
          ...p,
          clientCount: csmCountMap[p.id] ?? 0,
          contactCount: myContacts.length,
        };
      });

      setCsms(csmData);

      const totalClients = totalClientCount;
      const totalContacts = (contacts ?? []).length;
      const totalGoal = (profiles ?? []).reduce((acc, p) => acc + (p.monthly_goal ?? 49), 0);
      const metaPercent = totalGoal > 0 ? Math.round((totalContacts / totalGoal) * 100) : 0;

      setStats({ totalClients, totalContacts, totalGoal, metaPercent, csmCount: csmIds.length });
      setLoading(false);
    }
    load();
  }, []);

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
          <button onClick={() => router.push("/dashboard")} className="text-sm text-gray-500 hover:text-gray-700">Minha carteira</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="text-sm text-red-500 hover:text-red-700">Sair</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Administração</p>
          <h2 className="text-2xl font-semibold text-gray-900 mt-1">Visão geral do time</h2>
          <p className="text-gray-500 text-sm mt-1">Acompanhe sua equipe de CSMs e a carteira geral.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs text-gray-400 mb-2">CSMs ativos</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.csmCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs text-gray-400 mb-2">Clientes na carteira</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.totalClients}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs text-gray-400 mb-2">Contatos no mês</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.totalContacts}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs text-gray-400 mb-2">Meta coletiva</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.metaPercent}%</p>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <button
            onClick={() => router.push("/admin/importar")}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ↑ Importar planilha
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900">CSMs</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {csms.map((csm) => {
              const percent = csm.monthly_goal > 0 ? Math.min(100, Math.round((csm.contactCount / csm.monthly_goal) * 100)) : 0;
              return (
                <li key={csm.id} className="px-6 py-5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => router.push(`/admin/csm/${csm.id}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                        {csm.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{csm.full_name}</p>
                        <p className="text-xs text-gray-400">{csm.clientCount} clientes na carteira</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-700">{csm.contactCount}/{csm.monthly_goal}</p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
