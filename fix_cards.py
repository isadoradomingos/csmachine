with open('src/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

old = """        {/* Cards indicadores */}
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

new = """        {/* Cards indicadores */}
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

if old in content:
    content = content.replace(old, new)
    with open('src/app/dashboard/page.tsx', 'w') as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
