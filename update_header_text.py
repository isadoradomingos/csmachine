import os

files = [
    "src/app/dashboard/page.tsx",
    "src/app/clients/[id]/page.tsx",
    "src/app/admin/page.tsx",
    "src/app/admin/csm/[id]/page.tsx",
    "src/app/admin/importar/page.tsx",
]

for filepath in files:
    try:
        with open(filepath, "r") as f:
            content = f.read()
        
        new_content = content.replace(
            '<span className="text-lg font-semibold text-gray-900">CS Machine</span>',
            '<span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>'
        )
        
        if new_content != content:
            with open(filepath, "w") as f:
                f.write(new_content)
            print(f"Atualizado: {filepath}")
        else:
            print(f"Não encontrado: {filepath}")
    except FileNotFoundError:
        print(f"Arquivo não existe: {filepath}")
