with open('src/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Adicionar estado de tentativas
old_state = '''  const [contactCount, setContactCount] = useState(0);'''
new_state = '''  const [contactCount, setContactCount] = useState(0);
  const [tentativasMap, setTentativasMap] = useState<Record<string, number>>({});
  const [semHistoricoSet, setSemHistoricoSet] = useState<Set<string>>(new Set());'''

content = content.replace(old_state, new_state)

# Buscar tentativas junto com clientes
old_load_end = '''      setContactCount(count ?? 0);
      setLoading(false);'''

new_load_end = '''      setContactCount(count ?? 0);

      // Buscar tentativas dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: tentativas } = await supabase
        .from("client_contacts")
        .select("client_id")
        .eq("type", "tentativa")
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

      const tentMap: Record<string, number> = {};
      (tentativas ?? []).forEach((t: any) => {
        tentMap[t.client_id] = (tentMap[t.client_id] ?? 0) + 1;
      });
      setTentativasMap(tentMap);

      // Buscar clientes sem nenhum contato no histórico
      const { data: todosContatos } = await supabase
        .from("client_contacts")
        .select("client_id");

      const comHistorico = new Set((todosContatos ?? []).map((c: any) => c.client_id));
      const semHistorico = new Set((clients ?? []).map((c: any) => c.id).filter(id => !comHistorico.has(id)));
      setSemHistoricoSet(semHistorico);

      setLoading(false);'''

content = content.replace(old_load_end, new_load_end)

# Adicionar etiquetas na lista de clientes
old_client_item = '''                      <p className="text-xs text-gray-400 mt-0.5">
                        Bandeira {c.bandeira}
                        {c.cluster ? ` · ${clusterLabel[c.cluster]}` : ""}
                        {c.plano ? ` · ${c.plano.charAt(0).toUpperCase() + c.plano.slice(1)}` : ""}
                        {c.last_contact ? ` · último contato há ${daysSince(c.last_contact)} dias` : " · sem contato registrado"}
                      </p>'''

new_client_item = '''                      <p className="text-xs text-gray-400 mt-0.5">
                        Bandeira {c.bandeira}
                        {c.cluster ? ` · ${clusterLabel[c.cluster]}` : ""}
                        {c.plano ? ` · ${c.plano.charAt(0).toUpperCase() + c.plano.slice(1)}` : ""}
                        {c.last_contact ? ` · último contato há ${daysSince(c.last_contact)} dias` : " · sem contato registrado"}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {semHistoricoSet.has(c.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Nenhuma tentativa de contato no histórico
                          </span>
                        )}
                        {tentativasMap[c.id] > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                            {tentativasMap[c.id]} tentativa{tentativasMap[c.id] > 1 ? "s" : ""} de contato nos últimos 30 dias
                          </span>
                        )}
                      </div>'''

if old_client_item in content:
    content = content.replace(old_client_item, new_client_item)
    print("Etiquetas adicionadas!")
else:
    print("Trecho não encontrado!")

with open('src/app/dashboard/page.tsx', 'w') as f:
    f.write(content)
print("Concluído!")
