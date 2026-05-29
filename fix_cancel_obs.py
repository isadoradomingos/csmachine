with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

old = '''                <button
                  onClick={() => { setEditingObservacoes(false); setObservacoes(client.observacoes ?? ""); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>'''

new = '''                <button
                  onClick={() => { setEditingObservacoes(false); setObservacoes(observacoes); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>'''

# Na verdade o problema é diferente - precisamos guardar o valor salvo separadamente
# Vamos usar uma abordagem com savedObservacoes

old2 = '''  const [editingObservacoes, setEditingObservacoes] = useState(false);'''
new2 = '''  const [editingObservacoes, setEditingObservacoes] = useState(false);
  const [savedObservacoes, setSavedObservacoes] = useState("");'''

content = content.replace(old2, new2)

# Inicializar savedObservacoes junto com observacoes
old_load = '''      setObservacoes(client.observacoes ?? "");'''
new_load = '''      setObservacoes(client.observacoes ?? "");
      setSavedObservacoes(client.observacoes ?? "");'''

content = content.replace(old_load, new_load)

# Atualizar savedObservacoes ao salvar
old_save = '''    await supabase.from("clients").update({ observacoes }).eq("id", id);
    await logAudit("editou", "Observações", "Observações", clientData?.observacoes ?? "(vazio)", observacoes);
    await loadAudit();
    setEditingObservacoes(false);
    setSavingObservacoes(false);'''

new_save = '''    await supabase.from("clients").update({ observacoes }).eq("id", id);
    await logAudit("editou", "Observações", "Observações", clientData?.observacoes ?? "(vazio)", observacoes);
    await loadAudit();
    setSavedObservacoes(observacoes);
    setEditingObservacoes(false);
    setSavingObservacoes(false);'''

content = content.replace(old_save, new_save)

# Corrigir cancelar para usar savedObservacoes
old_cancel = '''                  onClick={() => { setEditingObservacoes(false); setObservacoes(client.observacoes ?? ""); }}'''
new_cancel = '''                  onClick={() => { setEditingObservacoes(false); setObservacoes(savedObservacoes); }}'''

content = content.replace(old_cancel, new_cancel)

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Corrigido!")
