with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

# Corrigir nomenclaturas das abas
content = content.replace(
    '"Histórico de contatos"',
    '"Registro de Contatos"'
)
content = content.replace(
    '"Histórico de alterações"',
    '"Histórico de Registros"'
)
content = content.replace(
    'Histórico de contatos',
    'Registro de Contatos'
)
content = content.replace(
    'Histórico de alterações',
    'Histórico de Registros'
)

# Corrigir bug do audit — usar user direto em vez de currentUser (que pode não estar disponível)
old_audit = '''  async function logAudit(action: string, entity: string, field?: string, oldValue?: string, newValue?: string) {
    await supabase.from("client_audit").insert({
      client_id: id,
      user_id: currentUser.id,
      action,
      entity,
      field: field ?? null,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    });
  }'''

new_audit = '''  async function logAudit(action: string, entity: string, field?: string, oldValue?: string, newValue?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("client_audit").insert({
      client_id: id,
      user_id: user.id,
      action,
      entity,
      field: field ?? null,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    });
  }'''

if old_audit in content:
    content = content.replace(old_audit, new_audit)
    print("Bug do audit corrigido!")
else:
    print("Trecho do audit não encontrado")

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Nomenclaturas atualizadas!")
