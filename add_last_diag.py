with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

old = '''                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{ativas} de {features.length} funcionalidades ativas</p>
                </div>'''

new = '''                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-gray-500">{ativas} de {features.length} funcionalidades ativas</p>
                  {audit.filter(a => a.entity === "Diagnóstico").length > 0 && (
                    <p className="text-xs text-gray-400">
                      Última alteração de diagnóstico em: {new Date(audit.filter(a => a.entity === "Diagnóstico")[0].created_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>'''

if old in content:
    content = content.replace(old, new)
    with open('src/app/clients/[id]/page.tsx', 'w') as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
