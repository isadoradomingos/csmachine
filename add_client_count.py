with open('src/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

old = """              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Olá, {profile?.full_name?.split(" ")[0]}</p>"""

new = """              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Olá, {profile?.full_name?.split(" ")[0]}</p>
              <p className="text-sm text-gray-400 mt-0.5">{clients.length} clientes na sua carteira</p>"""

if old in content:
    content = content.replace(old, new)
    with open('src/app/dashboard/page.tsx', 'w') as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
