with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

old = '''      {/* Modal Contatos no mês */}
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
      )}'''

new = '''      {/* Modal Contatos no mês */}
      {activeModal === "contatos" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
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
            <div className="px-6 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-400">
                {contatosList.filter((c: any) => !contatoFilterCSM || c.clients?.csm_id === contatoFilterCSM).length} consultorias realizadas
              </span>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {contatosList
                .filter((c: any) => !contatoFilterCSM || c.clients?.csm_id === contatoFilterCSM)
                .map((c: any) => {
                  const client = allClients.find(cl => cl.id === c.client_id);
                  const csm = users.find(u => u.id === c.clients?.csm_id);
                  return (
                    <li key={c.id} onClick={() => { setActiveModal(null); router.push(`/clients/${c.client_id}`); }} className="px-6 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
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
      )}'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/admin/page.tsx", "w") as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
