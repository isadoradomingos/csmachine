with open('src/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

# Adicionar estado de consultorias
old_state = '''  const [tentativasMap, setTentativasMap] = useState<Record<string, number>>({});
  const [semHistoricoSet, setSemHistoricoSet] = useState<Set<string>>(new Set());'''

new_state = '''  const [tentativasMap, setTentativasMap] = useState<Record<string, number>>({});
  const [consultoriasSet, setConsultoriasSet] = useState<Set<string>>(new Set());
  const [semHistoricoSet, setSemHistoricoSet] = useState<Set<string>>(new Set());'''

content = content.replace(old_state, new_state)

# Buscar consultorias nos últimos 30 dias
old_sem_historico = '''      // Buscar clientes sem nenhum contato no histórico'''

new_sem_historico = '''      // Buscar consultorias de produto nos últimos 30 dias
      const { data: consultorias } = await supabase
        .from("client_contacts")
        .select("client_id")
        .eq("type", "consultoria_produto")
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

      const consultSet = new Set((consultorias ?? []).map((c: any) => c.client_id));
      setConsultoriasSet(consultSet);

      // Buscar clientes sem nenhum contato no histórico'''

content = content.replace(old_sem_historico, new_sem_historico)

# Atualizar as etiquetas com regra de prioridade
old_labels = '''                      <div className="flex flex-wrap gap-1.5 mt-1.5">
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

new_labels = '''                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {semHistoricoSet.has(c.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Nenhuma tentativa de contato no histórico
                          </span>
                        )}
                        {consultoriasSet.has(c.id) ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            Consultoria de Produto realizada nos últimos 30 dias
                          </span>
                        ) : tentativasMap[c.id] > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                            {tentativasMap[c.id]} tentativa{tentativasMap[c.id] > 1 ? "s" : ""} de contato nos últimos 30 dias
                          </span>
                        ) : null}
                      </div>'''

if old_labels in content:
    content = content.replace(old_labels, new_labels)
    print("Etiquetas atualizadas!")
else:
    print("Trecho não encontrado!")

with open('src/app/dashboard/page.tsx', 'w') as f:
    f.write(content)
print("Concluído!")
