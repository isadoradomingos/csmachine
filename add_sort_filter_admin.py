with open("src/app/admin/usuario/[id]/page.tsx", "r") as f:
    content = f.read()

# Adicionar estado de ordenação
old_state = '''  const [filterCluster, setFilterCluster] = useState("");'''
new_state = '''  const [filterCluster, setFilterCluster] = useState("");
  const [sortOrder, setSortOrder] = useState<"" | "recente" | "antigo">("");'''

content = content.replace(old_state, new_state)

# Atualizar a lógica de filtro para incluir ordenação
old_filtered = '''  const filtered = clients.filter(c => {
    const matchSearch = c.marca.toLowerCase().includes(search.toLowerCase()) || c.bandeira?.includes(search);
    const matchOperacao = filterOperacao ? c.operacao === filterOperacao : true;
    const matchCluster = filterCluster ? c.cluster === filterCluster : true;
    return matchSearch && matchOperacao && matchCluster;
  });'''

new_filtered = '''  const filtered = clients
    .filter(c => {
      const matchSearch = c.marca.toLowerCase().includes(search.toLowerCase()) || c.bandeira?.includes(search);
      const matchOperacao = filterOperacao ? c.operacao === filterOperacao : true;
      const matchCluster = filterCluster ? c.cluster === filterCluster : true;
      return matchSearch && matchOperacao && matchCluster;
    })
    .sort((a, b) => {
      if (sortOrder === "recente") return daysSince(a.last_contact) - daysSince(b.last_contact);
      if (sortOrder === "antigo") return daysSince(b.last_contact) - daysSince(a.last_contact);
      return 0;
    });'''

content = content.replace(old_filtered, new_filtered)

# Adicionar select de ordenação nos filtros
old_filters = '''            <select value={filterCluster} onChange={e => setFilterCluster(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">Todos os clusters</option>
              <option value="high_touch">High Touch</option>
              <option value="mid_touch">Mid Touch</option>
              <option value="growth_touch">Growth Touch</option>
              <option value="no_touch">No Touch</option>
            </select>'''

new_filters = '''            <select value={filterCluster} onChange={e => setFilterCluster(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">Todos os clusters</option>
              <option value="high_touch">High Touch</option>
              <option value="mid_touch">Mid Touch</option>
              <option value="growth_touch">Growth Touch</option>
              <option value="no_touch">No Touch</option>
            </select>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">Ordenar por nome</option>
              <option value="recente">Contato mais recente</option>
              <option value="antigo">Contato mais antigo</option>
            </select>'''

if old_filters in content:
    content = content.replace(old_filters, new_filters)
    with open("src/app/admin/usuario/[id]/page.tsx", "w") as f:
        f.write(content)
    print("Perfil CSM atualizado!")
else:
    print("Trecho não encontrado!")
