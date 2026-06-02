with open("src/app/admin/usuario/[id]/page.tsx", "r") as f:
    content = f.read()

# Remover botão de remover acesso do header
old_btns = '''            <div className="flex gap-2">
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs border border-gray-200 bg-white text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
              >
                Editar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Removendo..." : "Remover acesso"}
              </button>
            </div>'''

new_btns = '''            <button
              onClick={() => {
                setEditForm({
                  full_name: profile?.full_name ?? "",
                  monthly_goal: profile?.monthly_goal ?? 49,
                  hasMeta: profile?.monthly_goal != null,
                  role: roles.includes("admin") && roles.includes("csm") ? "csm_admin" : roles[0] ?? "csm",
                });
                setShowEdit(true);
              }}
              className="text-xs border border-gray-200 bg-white text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              Editar
            </button>'''

content = content.replace(old_btns, new_btns)

# Substituir handleDelete por handleToggleAtivo
old_delete = '''  async function handleDelete() {
    if (!confirm(`Tem certeza que deseja remover o acesso de ${profile?.full_name}? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);

    const res = await fetch("/api/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setDeleting(false);
    }
  }'''

new_delete = '''  async function handleToggleAtivo(desativar: boolean) {
    const msg = desativar
      ? `Desativar ${profile?.full_name}? O acesso será bloqueado e os clientes ficarão sem CSM.`
      : `Reativar ${profile?.full_name}? O acesso será restaurado mas a carteira estará vazia.`;
    if (!confirm(msg)) return;

    await supabase.from("profiles").update({ ativo: !desativar }).eq("id", id);

    if (desativar) {
      // Remover csm_id dos clientes
      await supabase.from("clients").update({ csm_id: null }).eq("csm_id", id);
    }

    await load();
  }'''

content = content.replace(old_delete, new_delete)

# Remover estado de deleting
old_deleting = '''  const [deleting, setDeleting] = useState(false);'''
content = content.replace(old_deleting, '')

# Atualizar formulário de edição para incluir todos os campos e botão desativar
old_edit_form = '''      {/* Modal editar usuário */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Editar usuário</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={editForm.full_name || profile?.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
                <select
                  value={editForm.role || roles[0]}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="csm">CSM</option>
                  <option value="admin">Admin</option>
                  <option value="csm_admin">CSM + Admin</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.hasMeta}
                    onChange={e => setEditForm({ ...editForm, hasMeta: e.target.checked })}
                    className="rounded"
                  />
                  Possui meta mensal
                </label>
                {editForm.hasMeta && (
                  <input
                    type="number"
                    value={editForm.monthly_goal || profile?.monthly_goal || 49}
                    onChange={e => setEditForm({ ...editForm, monthly_goal: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}'''

new_edit_form = '''      {/* Modal editar usuário */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Editar usuário</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="csm">CSM</option>
                  <option value="admin">Admin</option>
                  <option value="csm_admin">CSM + Admin</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.hasMeta}
                    onChange={e => setEditForm({ ...editForm, hasMeta: e.target.checked })}
                    className="rounded"
                  />
                  Possui meta mensal de contatos
                </label>
                {editForm.hasMeta && (
                  <input
                    type="number"
                    value={editForm.monthly_goal}
                    onChange={e => setEditForm({ ...editForm, monthly_goal: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>

              {/* Botão desativar/reativar */}
              <div className="pt-2 border-t border-gray-100">
                {profile?.ativo !== false ? (
                  <button
                    type="button"
                    onClick={() => { setShowEdit(false); handleToggleAtivo(true); }}
                    className="w-full rounded-lg border border-red-200 text-red-500 px-4 py-2 text-sm hover:bg-red-50 transition-colors"
                  >
                    Desativar usuário
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setShowEdit(false); handleToggleAtivo(false); }}
                    className="w-full rounded-lg border border-green-200 text-green-600 px-4 py-2 text-sm hover:bg-green-50 transition-colors"
                  >
                    Reativar usuário
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}'''

content = content.replace(old_edit_form, new_edit_form)

# Adicionar indicador visual de inativo no header do usuário
old_name = '''                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold text-gray-900">{profile?.full_name}</h2>
                  {roles.map(r => (
                    <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>
                      {roleLabel(r)}
                    </span>
                  ))}
                </div>'''

new_name = '''                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold text-gray-900">{profile?.full_name}</h2>
                  {roles.map(r => (
                    <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>
                      {roleLabel(r)}
                    </span>
                  ))}
                  {profile?.ativo === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">
                      Inativo
                    </span>
                  )}
                </div>'''

content = content.replace(old_name, new_name)

# Atualizar handleSaveEdit para suportar csm_admin
old_save = '''  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await supabase.from("profiles").update({
      full_name: editForm.full_name,
      monthly_goal: editForm.hasMeta ? editForm.monthly_goal : null,
    }).eq("id", id);

    // Atualizar roles
    await supabase.from("user_roles").delete().eq("user_id", id);
    await supabase.from("user_roles").insert({ user_id: id, role: editForm.role });
    if (editForm.role === "csm" && roles.includes("admin")) {
      await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
    }

    setSaving(false);
    setShowEdit(false);
    await load();
  }'''

new_save = '''  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await supabase.from("profiles").update({
      full_name: editForm.full_name,
      monthly_goal: editForm.hasMeta ? editForm.monthly_goal : null,
    }).eq("id", id);

    // Atualizar roles
    await supabase.from("user_roles").delete().eq("user_id", id);
    if (editForm.role === "csm_admin") {
      await supabase.from("user_roles").insert([
        { user_id: id, role: "csm" },
        { user_id: id, role: "admin" },
      ]);
    } else {
      await supabase.from("user_roles").insert({ user_id: id, role: editForm.role });
    }

    setSaving(false);
    setShowEdit(false);
    await load();
  }'''

content = content.replace(old_save, new_save)

with open("src/app/admin/usuario/[id]/page.tsx", "w") as f:
    f.write(content)
print("Perfil do usuário atualizado!")
