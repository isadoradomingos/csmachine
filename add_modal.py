with open('src/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Adicionar estado do modal
old_state = """  const [contactCount, setContactCount] = useState(0);"""
new_state = """  const [contactCount, setContactCount] = useState(0);
  const [modal, setModal] = useState<{ title: string; clients: any[] } | null>(null);"""

content = content.replace(old_state, new_state)

# Tornar os cards clicáveis
old_cards = """        {/* Cards de indicadores */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Sem contato recente</p>
              <span className="text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{semContato}</p>
            <p className="text-xs text-gray-400 mt-1">clientes sem contato há mais de 30 dias</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Oportunidades de follow-up</p>
              <span className="text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{followUp}</p>
            <p className="text-xs text-gray-400 mt-1">clientes entre 15 e 30 dias sem contato</p>
          </div>
        </div>"""

new_cards = """        {/* Cards de indicadores */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div
            onClick={() => setModal({ title: "Sem contato recente", clients: clients.filter(c => daysSince(c.last_contact) > 30) })}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Sem contato recente</p>
              <span className="text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{semContato}</p>
            <p className="text-xs text-gray-400 mt-1">clientes sem contato há mais de 30 dias</p>
          </div>

          <div
            onClick={() => setModal({ title: "Oportunidades de follow-up", clients: clients.filter(c => daysSince(c.last_contact) > 15 && daysSince(c.last_contact) <= 30) })}
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
            <p className="text-3xl font-semibold text-gray-900">{followUp}</p>
            <p className="text-xs text-gray-400 mt-1">clientes entre 15 e 30 dias sem contato</p>
          </div>
        </div>"""

content = content.replace(old_cards, new_cards)

# Adicionar modal antes do fechamento do return
old_end = """    </div>
  );
}"""

new_end = """      {/* Modal de clientes */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{modal.title}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{modal.clients.length} clientes</span>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto max-h-[60vh]">
              {modal.clients.length === 0 ? (
                <li className="px-6 py-8 text-center text-sm text-gray-400">Nenhum cliente nesta categoria.</li>
              ) : (
                modal.clients.map(c => (
                  <li
                    key={c.id}
                    onClick={() => { setModal(null); router.push(`/clients/${c.id}`); }}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{c.marca}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Bandeira {c.bandeira} · {c.last_contact ? `último contato há ${daysSince(c.last_contact)} dias` : "sem contato registrado"}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">→</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}"""

content = content.replace(old_end, new_end)

with open('src/app/dashboard/page.tsx', 'w') as f:
    f.write(content)
print("Atualizado!")
