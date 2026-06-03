with open("src/app/admin/usuario/[id]/page.tsx", "r") as f:
    content = f.read()

# Adicionar estado do email
old_state = '''  const [editForm, setEditForm] = useState({ full_name: "", monthly_goal: 49, hasMeta: true, role: "csm" });'''
new_state = '''  const [editForm, setEditForm] = useState({ full_name: "", email: "", monthly_goal: 49, hasMeta: true, role: "csm" });
  const [userEmail, setUserEmail] = useState("");'''

content = content.replace(old_state, new_state)

# Buscar email do usuario no load
old_load_profile = '''    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    setProfile(profile);'''

new_load_profile = '''    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    setProfile(profile);

    // Buscar email via função segura
    const { data: emailData } = await supabase
      .rpc("get_user_email", { user_id_input: id as string });
    setUserEmail(emailData ?? "");'''

content = content.replace(old_load_profile, new_load_profile)

# Adicionar email no editForm quando abre modal
old_open_edit = '''              onClick={() => {
                setEditForm({
                  full_name: profile?.full_name ?? "",
                  monthly_goal: profile?.monthly_goal ?? 49,
                  hasMeta: profile?.monthly_goal != null,
                  role: roles.includes("admin") && roles.includes("csm") ? "csm_admin" : roles[0] ?? "csm",
                });
                setShowEdit(true);
              }}'''

new_open_edit = '''              onClick={() => {
                setEditForm({
                  full_name: profile?.full_name ?? "",
                  email: userEmail,
                  monthly_goal: profile?.monthly_goal ?? 49,
                  hasMeta: profile?.monthly_goal != null,
                  role: roles.includes("admin") && roles.includes("csm") ? "csm_admin" : roles[0] ?? "csm",
                });
                setShowEdit(true);
              }}'''

content = content.replace(old_open_edit, new_open_edit)

# Adicionar campo de email no formulário de edição
old_email_field = '''              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>'''

new_email_field = '''              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>'''

content = content.replace(old_email_field, new_email_field)

# Atualizar handleSaveEdit para incluir email
old_save_edit = '''    await supabase.from("profiles").update({
      full_name: editForm.full_name,
      monthly_goal: editForm.hasMeta ? editForm.monthly_goal : null,
    }).eq("id", id);'''

new_save_edit = '''    await supabase.from("profiles").update({
      full_name: editForm.full_name,
      monthly_goal: editForm.hasMeta ? editForm.monthly_goal : null,
    }).eq("id", id);

    // Atualizar email se mudou
    if (editForm.email && editForm.email !== userEmail) {
      await fetch("/api/update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id, email: editForm.email }),
      });
      setUserEmail(editForm.email);
    }'''

content = content.replace(old_save_edit, new_save_edit)

with open("src/app/admin/usuario/[id]/page.tsx", "w") as f:
    f.write(content)
print("Atualizado!")
