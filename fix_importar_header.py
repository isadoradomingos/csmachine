with open("src/app/admin/importar/page.tsx", "r") as f:
    content = f.read()

old = '''        <h1 className="text-lg font-semibold text-gray-900">CS Machine</h1>'''
new = '''        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/admin/importar/page.tsx", "w") as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
