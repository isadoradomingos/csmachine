with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

# Adicionar estados dos modais
old_state = '''  const [showInvite, setShowInvite] = useState(false);'''
new_state = '''  const [showInvite, setShowInvite] = useState(false);
  const [activeModal, setActiveModal] = useState<"csms" | "clientes" | "contatos" | "meta" | null>(null);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [contatoFilterCSM, setContatoFilterCSM] = useState("");
  const [contatosList, setContatosList] = useState<any[]>([]);
  const [contatosCSMMap, setContatosCSMMap] = useState<Record<string, number>>({});'''

content = content.replace(old_state, new_state)

# Buscar dados adicionais no load
old_load_end = '''    setLoading(false);
  }, [router]);'''

new_load_end = '''    // Buscar todos os clientes ativos
    const { data: allClientsData } = await supabase
      .from("clients")
      .select("id, marca, bandeira, operacao, csm_id")
      .eq("status", "ativo")
      .order("marca")
      .limit(10000);
    setAllClients(allClientsData ?? []);

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
  }, [router]);'''

content = content.replace(old_load_end, new_load_end)

# Tornar os cards clicáveis
old_cards = '''        {/* Cards gerais */}
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
        </div>'''

new_cards = '''        {/* Cards gerais */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          <div onClick={() => setActiveModal("csms")} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-400 mb-2">CSMs ativos</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.csmCount}</p>
          </div>
          <div onClick={() => { setClientSearch(""); setActiveModal("clientes"); }} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-400 mb-2">Clientes na carteira</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.totalClients}</p>
          </div>
          <div onClick={() => { setContatoFilterCSM(""); setActiveModal("contatos"); }} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-400 mb-2">Contatos no mês</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.totalContacts}</p>
          </div>
          <div onClick={() => setActiveModal("meta")} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-400 mb-2">Meta coletiva</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.metaPercent}%</p>
          </div>
        </div>'''

content = content.replace(old_cards, new_cards)

# Adicionar modais antes do modal de convidar
old_invite_modal = '''      {/* Modal convidar */}'''
new_invite_modal = '''      {/* Modal CSMs ativos */}
      {activeModal === "csms" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">CSMs ativos</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {users.filter(u => u.roles.includes("csm")).map(u => (
                <li key={u.id} onClick={() => { setActiveModal(null); router.push(`/admin/usuario/${u.id}`); }} className="px-6 py-4 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors">
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
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Clientes na carteira</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100">
              <input
                type="text"
                placeholder="Buscar por nome ou bandeira..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="px-6 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-400">
                {allClients.filter(c => c.marca.toLowerCase().includes(clientSearch.toLowerCase()) || c.bandeira?.includes(clientSearch)).length} clientes
              </span>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {allClients
                .filter(c => c.marca.toLowerCase().includes(clientSearch.toLowerCase()) || c.bandeira?.includes(clientSearch))
                .map(c => (
                  <li key={c.id} onClick={() => { setActiveModal(null); router.push(`/clients/${c.id}`); }} className="px-6 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Contatos no mês</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100">
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
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {users
                .filter(u => u.roles.includes("csm") && (!contatoFilterCSM || u.id === contatoFilterCSM))
                .map(u => (
                  <li key={u.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900 text-sm">{u.full_name}</p>
                      <p className="text-sm font-semibold text-gray-700">{contatosCSMMap[u.id] ?? 0} contatos</p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal Meta coletiva */}
      {activeModal === "meta" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Meta coletiva</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
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
                        style={{ width: `${percent}%`, background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)" }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Modal convidar */}'''

content = content.replace(old_invite_modal, new_invite_modal)

with open("src/app/admin/page.tsx", "w") as f:
    f.write(content)
print("Atualizado!")
