with open('src/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Remover a barra duplicada antiga
old_bar = """        {/* Barra de progresso mensal */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-6">
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-gray-700 shrink-0">Progresso mensal</p>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round((contactCount / (profile?.monthly_goal ?? 49)) * 100))}%`,
                  background: `linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)`,
                }}
              />
            </div>
            <p className="text-sm font-semibold text-gray-900 shrink-0">{contactCount} / {profile?.monthly_goal ?? 49}</p>
          </div>
        </div>"""

if old_bar in content:
    content = content.replace(old_bar, "")
    print("Barra duplicada removida!")
else:
    print("Barra duplicada não encontrada")

# Ajustar o Olá para ficar mais visível
old_ola = """          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Olá, {profile?.full_name?.split(" ")[0]}</p>
            <p className="text-sm text-gray-400 mt-0.5">{clients.length} clientes na sua carteira</p>
          </div>"""

new_ola = """          <div>
            <h2 className="text-2xl font-bold text-gray-900">Olá, {profile?.full_name?.split(" ")[0]} 👋</h2>
            <p className="text-sm text-gray-400 mt-0.5">{clients.length} clientes na sua carteira</p>
          </div>"""

if old_ola in content:
    content = content.replace(old_ola, new_ola)
    print("Header atualizado!")
else:
    print("Header não encontrado")

with open('src/app/dashboard/page.tsx', 'w') as f:
    f.write(content)
