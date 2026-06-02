with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

# Atualizar a lista de usuários para mostrar inativos e sem meta
old_users_list = '''          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li
                key={u.id}
                onClick={() => router.push(`/admin/usuario/${u.id}`)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {u.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{u.full_name}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      {u.roles.map(r => (
                        <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>
                          {roleLabel(r)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400">→</span>
              </li>
            ))}
          </ul>'''

new_users_list = '''          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li
                key={u.id}
                onClick={() => router.push(`/admin/usuario/${u.id}`)}
                className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${u.ativo === false ? "bg-gray-50 opacity-60" : "hover:bg-gray-50"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${u.ativo === false ? "bg-gray-200 text-gray-500" : "bg-blue-100 text-blue-700"}`}>
                    {u.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <p className={`font-medium ${u.ativo === false ? "text-gray-400" : "text-gray-900"}`}>{u.full_name}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      {u.roles.map(r => (
                        <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>
                          {roleLabel(r)}
                        </span>
                      ))}
                      {u.ativo === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400">→</span>
              </li>
            ))}
          </ul>'''

if old_users_list in content:
    content = content.replace(old_users_list, new_users_list)
    print("Lista de usuários atualizada!")
else:
    print("Lista não encontrada")

# Atualizar tipo User para incluir ativo
old_type = '''type User = {
  id: string;
  full_name: string;
  monthly_goal: number | null;
  roles: string[];
};'''

new_type = '''type User = {
  id: string;
  full_name: string;
  monthly_goal: number | null;
  roles: string[];
  ativo: boolean;
};'''

content = content.replace(old_type, new_type)

# Atualizar mapeamento para incluir ativo
old_map = '''    setUsers((profiles ?? []).map((p: any) => ({
      ...p,
      roles: rolesMap[p.id] ?? [],
    })));'''

new_map = '''    setUsers((profiles ?? []).map((p: any) => ({
      ...p,
      roles: rolesMap[p.id] ?? [],
      ativo: p.ativo !== false,
    })));'''

content = content.replace(old_map, new_map)

# Atualizar formulário de convite para incluir opção sem meta
old_invite_meta = '''                {inviteForm.role === "csm" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Meta mensal de contatos</label>
                    <input type="number" value={inviteForm.monthly_goal} onChange={e => setInviteForm({ ...inviteForm, monthly_goal: parseInt(e.target.value) })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}'''

new_invite_meta = '''                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteForm.monthly_goal > 0}
                      onChange={e => setInviteForm({ ...inviteForm, monthly_goal: e.target.checked ? 49 : 0 })}
                      className="rounded"
                    />
                    Possui meta mensal de contatos
                  </label>
                  {inviteForm.monthly_goal > 0 && (
                    <input type="number" value={inviteForm.monthly_goal} onChange={e => setInviteForm({ ...inviteForm, monthly_goal: parseInt(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>'''

content = content.replace(old_invite_meta, new_invite_meta)

with open("src/app/admin/page.tsx", "w") as f:
    f.write(content)
print("Admin page atualizada!")
