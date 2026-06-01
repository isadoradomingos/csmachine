"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

export default function AdminCsmPage() {
  const router = useRouter();
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGoal, setEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      setProfile(profile);
      setNewGoal(profile?.monthly_goal ?? 49);

      const { data: clients } = await supabase
        .from("clients")
        .select("id, marca, bandeira, operacao, plano, cluster, status, last_contact")
        .eq("csm_id", id)
        .eq("status", "ativo")
        .order("marca")
        .limit(10000);

      setClients(clients ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSaveGoal() {
    setSavingGoal(true);
    await supabase
      .from("profiles")
      .update({ monthly_goal: parseInt(newGoal) })
      .eq("id", id);
    setProfile({ ...profile, monthly_goal: parseInt(newGoal) });
    setEditingGoal(false);
    setSavingGoal(false);
  }

  function daysSince(date: string | null): number {
    if (!date) return 999;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  }

  const filtered = clients.filter(c =>
    c.marca.toLowerCase().includes(search.toLowerCase()) ||
    c.bandeira?.includes(search)
  );

  const clusterLabel: Record<string, string> = {
    high_touch: "High Touch",
    mid_touch: "Mid Touch",
    growth_touch: "Growth Touch",
  };

  const operacaoColor: Record<string, string> = {
    corridas: "bg-blue-100 text-blue-700",
    entregas: "bg-orange-100 text-orange-700",
  };

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
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header do CSM */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">
                {profile?.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{profile?.full_name}</h2>
                <p className="text-sm text-gray-400">{clients.length} clientes na carteira</p>
              </div>
            </div>

            {/* Meta mensal */}
            <div className="flex items-center gap-3">
              {editingGoal ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSaveGoal}
                    disabled={savingGoal}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingGoal ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={() => setEditingGoal(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Meta mensal</p>
                    <p className="text-lg font-semibold text-gray-900">{profile?.monthly_goal} contatos</p>
                  </div>
                  <button
                    onClick={() => setEditingGoal(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg"
                  >
                    Editar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lista de clientes */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Carteira</h3>
            <span className="text-xs text-gray-400">{filtered.length} clientes</span>
          </div>
          <div className="px-6 py-3 border-b border-gray-100">
            <input
              type="text"
              placeholder="Buscar por nome ou bandeira..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">Nenhum cliente encontrado.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
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
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
