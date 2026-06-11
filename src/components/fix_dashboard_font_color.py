with open("src/app/dashboard/page.tsx", "r") as f:
    content = f.read()

old = '''            <p className="text-3xl font-bold text-gray-900 mt-1">{contactCount} / {profile?.monthly_goal ?? 49} <span className="text-sm font-medium text-gray-400">consultorias de produto</span></p>'''
new = '''            <p className="text-3xl font-bold text-gray-900 mt-1">{contactCount} / {profile?.monthly_goal ?? 49} <span className="text-sm font-medium text-gray-900">consultorias de produto</span></p>'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/dashboard/page.tsx", "w") as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
