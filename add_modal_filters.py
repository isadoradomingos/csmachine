with open("src/app/admin/usuario/[id]/page.tsx", "r") as f:
    content = f.read()

# Adicionar estados dos filtros do modal
old_state = '''  const [modal, setModal] = useState<{ title: string; clients: any[] } | null>(null);'''
new_state = '''  const [modal, setModal] = useState<{ title: string; clients: any[] } | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalOrder, setModalOrder] = useState<"asc" | "desc">("desc");
  const [modalFilterType, setModalFilterType] = useState<"mais" | "menos" | "entre">("mais");
  const [modalFilterDays, setModalFilterDays] = useState("");
  const [modalFilterDays2, setModalFilterDays2] = useState("");'''

content = content.replace(old_state, new_state)

# Substituir o modal por versão com filtros
old_modal = '''      {/* Modal de clientes */}
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
      )}'''

new_modal = '''      {/* Modal de clientes */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{modal.title}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>

            {/* Filtros — só para follow-up */}
            {modal.title === "Oportunidades de follow-up" && (
              <div className="px-6 py-3 border-b border-gray-100 space-y-2">
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
              <div className="px-6 py-3 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Buscar por nome ou bandeira..."
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="px-6 py-2 border-b border-gray-100">
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

            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1">
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
                ));
              })()}
            </ul>
          </div>
        </div>
      )}'''

if old_modal in content:
    content = content.replace(old_modal, new_modal)
    with open("src/app/admin/usuario/[id]/page.tsx", "w") as f:
        f.write(content)
    print("Modal atualizado!")
else:
    print("Modal não encontrado!")
