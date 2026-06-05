
import os

# Atualizar admin page
with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

content = content.replace(
    '<p className="text-xs text-gray-400 mb-2">Contatos no mês</p>',
    '<p className="text-xs text-gray-400 mb-2">Consultorias de Produto no mês</p>'
)
content = content.replace(
    '<h3 className="font-semibold text-gray-900">Contatos no mês</h3>',
    '<h3 className="font-semibold text-gray-900">Consultorias de Produto no mês</h3>'
)
content = content.replace(
    'consultorias realizadas',
    'consultorias de produto realizadas'
)

with open("src/app/admin/page.tsx", "w") as f:
    f.write(content)
print("Admin page atualizada!")

# Atualizar perfil do usuário admin
with open("src/app/admin/usuario/[id]/page.tsx", "r") as f:
    content = f.read()

content = content.replace(
    '<p className="text-xs text-gray-400 mb-0.5">Meta mensal: {user.monthly_goal} contatos</p>',
    '<p className="text-xs text-gray-400 mb-0.5">Meta mensal: {user.monthly_goal} consultorias de produto</p>'
)

with open("src/app/admin/usuario/[id]/page.tsx", "w") as f:
    f.write(content)
print("Perfil do usuário atualizado!")

# Atualizar perfil CSM no admin
with open("src/app/admin/csm/[id]/page.tsx", "r") as f:
    content = f.read()

content = content.replace('contatos</p>', 'consultorias de produto</p>')
content = content.replace('/{csm.monthly_goal}', '/{csm.monthly_goal}')

with open("src/app/admin/csm/[id]/page.tsx", "w") as f:
    f.write(content)
print("CSM page atualizada!")
