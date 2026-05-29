with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

old = '''  async function handleSavePercepcoes() {
    setSavingPercepcoes(true);
    await supabase.from("clients").update({ percepcoes_gerais: percepcoes }).eq("id", id);
    await logAudit("editou", "Diagnóstico", "Percepções gerais");
    await loadAudit();
    setSavingPercepcoes(false);
  }'''

new = '''  async function handleSavePercepcoes() {
    setSavingPercepcoes(true);
    const { data: clientData } = await supabase
      .from("clients")
      .select("percepcoes_gerais")
      .eq("id", id)
      .single();
    await supabase.from("clients").update({ percepcoes_gerais: percepcoes }).eq("id", id);
    await logAudit("editou", "Diagnóstico", "Percepções gerais", clientData?.percepcoes_gerais ?? "(vazio)", percepcoes);
    await loadAudit();
    setSavingPercepcoes(false);
  }'''

if old in content:
    content = content.replace(old, new)
    with open('src/app/clients/[id]/page.tsx', 'w') as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Trecho não encontrado!")
