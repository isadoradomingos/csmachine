with open("src/app/admin/usuario/[id]/page.tsx", "r") as f:
    content = f.read()

old = '''              <p className="text-sm font-semibold text-gray-900">{contactCount} / {profile?.monthly_goal} <span className="text-xs font-medium text-gray-400">consultorias de produto</span></p>'''
new = '''              <p className="text-sm font-semibold text-gray-900">{contactCount} / {profile?.monthly_goal} <span className="text-xs font-medium text-gray-900">consultorias de produto</span></p>'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/admin/usuario/[id]/page.tsx", "w") as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
