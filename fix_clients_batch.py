with open('src/app/admin/page.tsx', 'r') as f:
    content = f.read()

old = """    const { data: allClientsData } = await supabase
      .from("clients")
      .select("id, marca, bandeira, operacao, csm_id")
      .eq("status", "ativo")
      .order("marca")
      .limit(10000);
    setAllClients(allClientsData ?? []);"""

new = """    // Buscar todos os clientes em batches de 1000
    let allClientsData: any[] = [];
    let from = 0;
    while (true) {
      const { data: batch } = await supabase
        .from("clients")
        .select("id, marca, bandeira, operacao, csm_id")
        .eq("status", "ativo")
        .order("marca")
        .range(from, from + 999);
      if (!batch || batch.length === 0) break;
      allClientsData = [...allClientsData, ...batch];
      if (batch.length < 1000) break;
      from += 1000;
    }
    setAllClients(allClientsData);"""

if old in content:
    content = content.replace(old, new)
    with open('src/app/admin/page.tsx', 'w') as f:
        f.write(content)
    print('Corrigido!')
else:
    print('Trecho não encontrado!')
    # Debug
    idx = content.find('allClientsData')
    print(repr(content[idx-50:idx+200]))
