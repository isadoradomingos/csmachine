import os

# Dashboard
with open("src/app/dashboard/page.tsx", "r") as f:
    content = f.read()

old = '''            <p className="text-3xl font-bold text-gray-900 mt-1">{contactCount} / {profile?.monthly_goal ?? 49} <span className="text-lg font-medium text-gray-500">consultorias de produto</span></p>'''
new = '''            <p className="text-3xl font-bold text-gray-900 mt-1">{contactCount} / {profile?.monthly_goal ?? 49} <span className="text-sm font-medium text-gray-400">consultorias de produto</span></p>'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/dashboard/page.tsx", "w") as f:
        f.write(content)
    print("Dashboard atualizado!")
else:
    print("Dashboard: trecho não encontrado!")

# Perfil do CSM no admin
with open("src/app/admin/usuario/[id]/page.tsx", "r") as f:
    content = f.read()

old2 = '''              <p className="text-sm font-semibold text-gray-900">{contactCount} / {profile?.monthly_goal} contatos</p>'''
new2 = '''              <p className="text-sm font-semibold text-gray-900">{contactCount} / {profile?.monthly_goal} <span className="text-xs font-medium text-gray-400">consultorias de produto</span></p>'''

if old2 in content:
    content = content.replace(old2, new2)
    with open("src/app/admin/usuario/[id]/page.tsx", "w") as f:
        f.write(content)
    print("Perfil CSM atualizado!")
else:
    print("Perfil CSM: trecho não encontrado!")
    idx = content.find("contactCount")
    print(repr(content[idx:idx+150]))
