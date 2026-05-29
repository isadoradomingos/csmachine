with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

# Adicionar estados de edição de percepções
old_state = '''  const [savingPercepcoes, setSavingPercepcoes] = useState(false);'''
new_state = '''  const [savingPercepcoes, setSavingPercepcoes] = useState(false);
  const [editingPercepcoes, setEditingPercepcoes] = useState(false);
  const [savedPercepcoes, setSavedPercepcoes] = useState("");'''

content = content.replace(old_state, new_state)

# Inicializar savedPercepcoes no load
old_load = '''      setPercepcoes(client.percepcoes_gerais ?? "");'''
new_load = '''      setPercepcoes(client.percepcoes_gerais ?? "");
      setSavedPercepcoes(client.percepcoes_gerais ?? "");'''

content = content.replace(old_load, new_load)

# Atualizar savedPercepcoes ao salvar
old_save = '''    await loadAudit();
    setSavingPercepcoes(false);
  }'''

new_save = '''    await loadAudit();
    setSavedPercepcoes(percepcoes);
    setEditingPercepcoes(false);
    setSavingPercepcoes(false);
  }'''

# Só substituir a primeira ocorrência (handleSavePercepcoes)
content = content.replace(old_save, new_save, 1)

# Substituir a seção de percepções gerais no JSX
old_percepcoes_section = '''                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Percepções gerais</p>
                  <textarea
                    value={percepcoes}
                    onChange={(e) => setPercepcoes(e.target.value)}
                    placeholder="Registre percepções sobre o uso da plataforma, pontos de atenção, oportunidades..."
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={handleSavePercepcoes}
                    disabled={savingPercepcoes}
                    className="mt-2 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingPercepcoes ? "Salvando..." : "Salvar percepções"}
                  </button>
                </div>'''

new_percepcoes_section = '''                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Percepções gerais</p>
                    {!editingPercepcoes ? (
                      <button
                        onClick={() => setEditingPercepcoes(true)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        {percepcoes ? "Editar" : "Adicionar"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingPercepcoes(false); setPercepcoes(savedPercepcoes); }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSavePercepcoes}
                          disabled={savingPercepcoes}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingPercepcoes ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    )}
                  </div>
                  {editingPercepcoes ? (
                    <textarea
                      value={percepcoes}
                      onChange={(e) => setPercepcoes(e.target.value)}
                      placeholder="Registre percepções sobre o uso da plataforma, pontos de atenção, oportunidades..."
                      rows={4}
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {percepcoes || <span className="text-gray-400">Nenhuma percepção registrada.</span>}
                    </p>
                  )}
                </div>'''

if old_percepcoes_section in content:
    content = content.replace(old_percepcoes_section, new_percepcoes_section)
    print("Percepções atualizado!")
else:
    print("Seção de percepções não encontrada!")

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Concluído!")
