with open('src/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

old = """        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Olá, {profile?.full_name?.split(" ")[0]} 👋</h2>
          <p className="text-gray-500 text-sm mt-1">{clients.length} clientes na sua carteira</p>
        </div>"""

new = """        {/* Header com barra de progresso */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Olá, {profile?.full_name?.split(" ")[0]}</p>
            <p className="text-sm text-gray-400 mt-0.5">{clients.length} clientes na sua carteira</p>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Progresso mensal</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{contactCount} / {profile?.monthly_goal ?? 49} <span className="text-lg font-medium text-gray-500">contatos</span></p>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((contactCount / (profile?.monthly_goal ?? 49)) * 100))}%`,
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
              }}
            />
          </div>
        </div>"""

if old in content:
    content = content.replace(old, new)
    with open('src/app/dashboard/page.tsx', 'w') as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado — verificando arquivo...")
    # Mostrar linhas ao redor do full_name para debug
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'full_name' in line or 'mb-8' in line:
            print(f"{i}: {line}")
