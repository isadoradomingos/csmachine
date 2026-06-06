with open("src/app/dashboard/page.tsx", "r") as f:
    content = f.read()

old = '''            <p className="text-3xl font-bold text-gray-900 mt-1">{contactCount} / {profile?.monthly_goal ?? 49} <span className="text-lg font-medium text-gray-500">contatos</span></p>'''
new = '''            <p className="text-3xl font-bold text-gray-900 mt-1">{contactCount} / {profile?.monthly_goal ?? 49} <span className="text-lg font-medium text-gray-500">consultorias de produto</span></p>'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/dashboard/page.tsx", "w") as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
    idx = content.find("contatos")
    print(repr(content[idx-100:idx+50]))
