with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

# Adicionar estado de observações
old_state = '''  const [savingPercepcoes, setSavingPercepcoes] = useState(false);'''
new_state = '''  const [savingPercepcoes, setSavingPercepcoes] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [savingObservacoes, setSavingObservacoes] = useState(false);
  const [editingObservacoes, setEditingObservacoes] = useState(false);'''

content = content.replace(old_state, new_state)

# Inicializar observações no load
old_load = '''      setPercepcoes(client.percepcoes_gerais ?? "");'''
new_load = '''      setPercepcoes(client.percepcoes_gerais ?? "");
      setObservacoes(client.observacoes ?? "");'''

content = content.replace(old_load, new_load)

# Adicionar função de salvar observações
old_func = '''  async function handleSaveContact() {'''
new_func = '''  async function handleSaveObservacoes() {
    setSavingObservacoes(true);
    const { data: clientData } = await supabase
      .from("clients")
      .select("observacoes")
      .eq("id", id)
      .single();
    
    await supabase.from("clients").update({ observacoes }).eq("id", id);
    await logAudit("editou", "Observações", "Observações", clientData?.observacoes ?? "(vazio)", observacoes);
    await loadAudit();
    setEditingObservacoes(false);
    setSavingObservacoes(false);
  }

  async function handleSaveContact() {'''

content = content.replace(old_func, new_func)

# Substituir seção de observações
old_obs = '''        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-medium text-gray-900 mb-4">Observações</h3>
          <textarea
            placeholder="Adicione observações sobre este cliente..."
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={4}
          />
        </div>'''

new_obs = '''        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Observações</h3>
            {!editingObservacoes ? (
              <button
                onClick={() => setEditingObservacoes(true)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {observacoes ? "Editar" : "Adicionar"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingObservacoes(false); setObservacoes(client.observacoes ?? ""); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveObservacoes}
                  disabled={savingObservacoes}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingObservacoes ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </div>
          {editingObservacoes ? (
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Adicione observações sobre este cliente..."
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              autoFocus
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {observacoes || <span className="text-gray-400">Nenhuma observação registrada.</span>}
            </p>
          )}
        </div>'''

if old_obs in content:
    content = content.replace(old_obs, new_obs)
    print("Observações atualizado!")
else:
    print("Seção de observações não encontrada")

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Concluído!")
