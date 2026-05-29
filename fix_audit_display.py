with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

# 1. Corrigir log de funcionalidade — incluir nome da feature
old_toggle = '''    const feature = features.find(f => f.id === featureId);
    await logAudit(
      newValue ? "ativou funcionalidade" : "desativou funcionalidade",
      "Diagnóstico",
      "Funcionalidade",
      currentValue ? "Ativo" : "Inativo",
      newValue ? "Ativo" : "Inativo"
    );'''

new_toggle = '''    const feature = features.find(f => f.id === featureId);
    await logAudit(
      newValue ? "ativou funcionalidade" : "desativou funcionalidade",
      "Diagnóstico",
      feature?.nome ?? "Funcionalidade",
      currentValue ? "Inativo" : "Ativo",
      newValue ? "Ativo" : "Inativo"
    );'''

if old_toggle in content:
    content = content.replace(old_toggle, new_toggle)
    print("Log de funcionalidade corrigido!")
else:
    print("Trecho do toggle não encontrado")

# 2. Adicionar estado de paginação
old_states = '''  const [savingPercepcoes, setSavingPercepcoes] = useState(false);'''
new_states = '''  const [savingPercepcoes, setSavingPercepcoes] = useState(false);
  const [auditLimit, setAuditLimit] = useState(10);'''

content = content.replace(old_states, new_states)

# 3. Corrigir exibição do horário e paginação no histórico
old_audit_display = '''                  <ul className="space-y-3">
                    {audit.map((log) => (
                      <li key={log.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-800">
                            {(log.profiles as any)?.full_name} {log.action} {log.entity}
                            {log.field ? ` — ${log.field}` : ""}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        {log.old_value || log.new_value ? (
                          <div className="flex items-center gap-2 text-xs mt-1">
                            {log.old_value && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded line-through">{log.old_value}</span>}
                            {log.old_value && log.new_value && <span className="text-gray-400">→</span>}
                            {log.new_value && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded">{log.new_value}</span>}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>'''

new_audit_display = '''                  <ul className="space-y-3">
                    {audit.slice(0, auditLimit).map((log) => (
                      <li key={log.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-800">
                            {(log.profiles as any)?.full_name} {log.action}
                            {log.field ? ` — ${log.field}` : ""}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} às {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {log.old_value || log.new_value ? (
                          <div className="flex items-center gap-2 text-xs mt-1">
                            {log.old_value && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded line-through">{log.old_value}</span>}
                            {log.old_value && log.new_value && <span className="text-gray-400">→</span>}
                            {log.new_value && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded">{log.new_value}</span>}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {audit.length > auditLimit && (
                    <button
                      onClick={() => setAuditLimit(prev => prev + 10)}
                      className="mt-4 w-full text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
                    >
                      Ver mais ({audit.length - auditLimit} restantes)
                    </button>
                  )}'''

if old_audit_display in content:
    content = content.replace(old_audit_display, new_audit_display)
    print("Paginação e horário corrigidos!")
else:
    print("Trecho do audit display não encontrado")

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Concluído!")
