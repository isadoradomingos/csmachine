import os

# 1. Mover botão importar no admin
with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

old_title = '''        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Administração</p>
          <h2 className="text-2xl font-semibold text-gray-900 mt-1">Visão geral do time</h2>
        </div>'''

new_title = '''        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Administração</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-1">Visão geral do time</h2>
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
        </div>'''

if old_title in content:
    content = content.replace(old_title, new_title)
    print("Título admin atualizado!")
else:
    print("Título não encontrado")

# Remover botão importar do header
old_header_btn = '''          <button onClick={() => router.push("/admin/importar")} className="text-sm border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">↑ Importar planilha</button>'''
new_header_btn = ''''''

content = content.replace(old_header_btn, new_header_btn)

with open("src/app/admin/page.tsx", "w") as f:
    f.write(content)
print("Admin page atualizada!")

# 2. Adicionar modais nos cards do perfil do usuário
with open("src/app/admin/usuario/[id]/page.tsx", "r") as f:
    content = f.read()

# Adicionar estado do modal
old_state = '''  const [showEdit, setShowEdit] = useState(false);'''
new_state = '''  const [showEdit, setShowEdit] = useState(false);
  const [modal, setModal] = useState<{ title: string; clients: any[] } | null>(null);'''

content = content.replace(old_state, new_state)

# Tornar cards clicáveis
old_cards = '''        {/* Cards indicadores */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
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

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
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
        </div>'''

new_cards = '''        {/* Cards indicadores */}
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
            onClick={() => {
              const semRetorno = clients.filter(c => {
                const contatos = (c as any)._contatos ?? [];
                return contatos.length >= 3;
              });
              setModal({ title: "Tentativas sem retorno", clients: semRetorno });
            }}
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
        </div>'''

content = content.replace(old_cards, new_cards)

# Adicionar estado de semRetornoClients
old_semretorno_state = '''  const [semRetornoCount, setSemRetornoCount] = useState(0);'''
new_semretorno_state = '''  const [semRetornoCount, setSemRetornoCount] = useState(0);
  const [semRetornoClients, setSemRetornoClients] = useState<any[]>([]);'''

content = content.replace(old_semretorno_state, new_semretorno_state)

# Salvar semRetornoClients no load
old_semretorno_set = '''    setSemRetornoCount(semRetorno);

    setLoading(false);'''

new_semretorno_set = '''    setSemRetornoCount(semRetorno);

    const semRetornoList = (clients ?? []).filter((client: any) => {
      const contatos = clientContactsMap[client.id] ?? [];
      const ultimoEfetivo = contatos.find((c: any) => c.type === "efetivo" || c.type === "consultoria_produto");
      const tentativasApos = ultimoEfetivo
        ? contatos.filter((c: any) => c.type === "tentativa" && c.date > ultimoEfetivo.date)
        : contatos.filter((c: any) => c.type === "tentativa");
      return tentativasApos.length >= 3;
    });
    setSemRetornoClients(semRetornoList);

    setLoading(false);'''

content = content.replace(old_semretorno_set, new_semretorno_set)

# Corrigir o onClick do card de tentativas para usar semRetornoClients
old_tentativas_click = '''            onClick={() => {
              const semRetorno = clients.filter(c => {
                const contatos = (c as any)._contatos ?? [];
                return contatos.length >= 3;
              });
              setModal({ title: "Tentativas sem retorno", clients: semRetorno });
            }}'''

new_tentativas_click = '''            onClick={() => setModal({ title: "Tentativas sem retorno", clients: semRetornoClients })}'''

content = content.replace(old_tentativas_click, new_tentativas_click)

# Adicionar modal antes do fechamento do componente
old_end = '''      {/* Modal editar usuário */}'''
new_end = '''      {/* Modal de clientes */}
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

      {/* Modal editar usuário */}'''

content = content.replace(old_end, new_end)

with open("src/app/admin/usuario/[id]/page.tsx", "w") as f:
    f.write(content)
print("Perfil do usuário atualizado!")
