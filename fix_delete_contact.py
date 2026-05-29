with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

old = '''  async function handleDelete(contact: Contact) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    await logAudit("excluiu", "Contato", "Data", contact.date, undefined);
    await supabase.from("client_contacts").delete().eq("id", contact.id);
    await loadContacts();
    await loadAudit();
  }'''

new = '''  async function handleDelete(contact: Contact) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    await logAudit("excluiu", "Contato", "Data", contact.date, undefined);
    await supabase.from("client_contacts").delete().eq("id", contact.id);

    // Recalcular last_contact com o contato mais recente restante
    const { data: remaining } = await supabase
      .from("client_contacts")
      .select("date")
      .eq("client_id", id)
      .order("date", { ascending: false })
      .limit(1);

    const newLastContact = remaining && remaining.length > 0 ? remaining[0].date : null;
    await supabase.from("clients").update({ last_contact: newLastContact }).eq("id", id);

    await loadContacts();
    await loadAudit();
  }'''

if old in content:
    content = content.replace(old, new)
    with open('src/app/clients/[id]/page.tsx', 'w') as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Trecho não encontrado!")
