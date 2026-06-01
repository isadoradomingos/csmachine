import os

# Atualizar o header do dashboard
with open("src/app/dashboard/page.tsx", "r") as f:
    dash = f.read()

old_dash_header = '''        <h1 className="text-lg font-semibold text-gray-900">CS Machine</h1>'''
new_dash_header = '''        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">CS Machine</span>
        </div>'''

if old_dash_header in dash:
    dash = dash.replace(old_dash_header, new_dash_header)
    with open("src/app/dashboard/page.tsx", "w") as f:
        f.write(dash)
    print("Dashboard atualizado!")
else:
    print("Header do dashboard não encontrado")

# Atualizar o header da página do cliente
with open("src/app/clients/[id]/page.tsx", "r") as f:
    client = f.read()

old_client_header = '''        <h1 className="text-lg font-semibold text-gray-900">CS Machine</h1>'''
new_client_header = '''        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">CS Machine</span>
        </div>'''

if old_client_header in client:
    client = client.replace(old_client_header, new_client_header)
    with open("src/app/clients/[id]/page.tsx", "w") as f:
        f.write(client)
    print("Página do cliente atualizada!")
else:
    print("Header do cliente não encontrado")

# Atualizar o header do admin
with open("src/app/admin/page.tsx", "r") as f:
    admin = f.read()

old_admin_header = '''        <h1 className="text-lg font-semibold text-gray-900">CS Machine</h1>'''
new_admin_header = '''        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">CS Machine</span>
        </div>'''

if old_admin_header in admin:
    admin = admin.replace(old_admin_header, new_admin_header)
    with open("src/app/admin/page.tsx", "w") as f:
        f.write(admin)
    print("Admin atualizado!")
else:
    print("Header do admin não encontrado")

# Atualizar o header do perfil do CSM no admin
with open("src/app/admin/csm/[id]/page.tsx", "r") as f:
    csm = f.read()

old_csm_header = '''        <h1 className="text-lg font-semibold text-gray-900">CS Machine</h1>'''
new_csm_header = '''        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">CS Machine</span>
        </div>'''

if old_csm_header in csm:
    csm = csm.replace(old_csm_header, new_csm_header)
    with open("src/app/admin/csm/[id]/page.tsx", "w") as f:
        f.write(csm)
    print("Perfil CSM atualizado!")
else:
    print("Header do perfil CSM não encontrado")
