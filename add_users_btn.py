with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

old = '''        <div className="flex justify-end mb-4">
          <button
            onClick={() => router.push("/admin/importar")}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ↑ Importar planilha
          </button>
        </div>'''

new = '''        <div className="flex justify-end gap-3 mb-4">
          <button
            onClick={() => router.push("/admin/usuarios")}
            className="text-sm border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            👥 Gerenciar usuários
          </button>
          <button
            onClick={() => router.push("/admin/importar")}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ↑ Importar planilha
          </button>
        </div>'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/admin/page.tsx", "w") as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
