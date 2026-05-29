
with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

# Remover botão do header
old_header = '''            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTentativaModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 17.657a9 9 0 010-12.728m2.829 9.9a5 5 0 010-7.072" />
                </svg>
                Registrar tentativa
              </button>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                client.status === "ativo" ? "bg-green-100 text-green-700" :
                client.status === "churned" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {client.status}
              </span>
            </div>'''

new_header = '''            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              client.status === "ativo" ? "bg-green-100 text-green-700" :
              client.status === "churned" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {client.status}
            </span>'''

if old_header in content:
    content = content.replace(old_header, new_header)
    print("Botão removido do header!")
else:
    print("Header não encontrado")

# Adicionar botão na aba de contatos ao lado do "+ Registrar contato"
old_tab_btn = '''                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">{contacts.length} registros</p>
                  <button
                    onClick={() => { setEditingContact(null); setForm({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp" }); setShowModal(true); }}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    + Registrar contato
                  </button>
                </div>'''

new_tab_btn = '''                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">{contacts.length} registros</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTentativaModal(true)}
                      className="text-xs border border-gray-200 bg-white text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Registrar tentativa
                    </button>
                    <button
                      onClick={() => { setEditingContact(null); setForm({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp" }); setShowModal(true); }}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      + Registrar contato
                    </button>
                  </div>
                </div>'''

if old_tab_btn in content:
    content = content.replace(old_tab_btn, new_tab_btn)
    print("Botão adicionado na aba!")
else:
    print("Aba não encontrada")

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Concluído!")
