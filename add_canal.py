with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

# Adicionar canal no estado do form
old_form = """  const [form, setForm] = useState({ type: \"efetivo\", date: new Date().toISOString().split(\"T\")[0], note: \"\" });"""
new_form = """  const [form, setForm] = useState({ type: \"efetivo\", date: new Date().toISOString().split(\"T\")[0], note: \"\", canal: \"whatsapp\" });"""

content = content.replace(old_form, new_form)

# Adicionar canal no insert
old_insert = """    await supabase.from(\"client_contacts\").insert({
      client_id: id,
      date: form.date,
      type: form.type,
      note: form.note,
    });"""

new_insert = """    await supabase.from(\"client_contacts\").insert({
      client_id: id,
      date: form.date,
      type: form.type,
      note: form.note,
      canal: form.canal,
    });"""

content = content.replace(old_insert, new_insert)

# Adicionar campo canal no modal
old_modal_fields = """              <div>
                <label className=\"block text-xs font-medium text-gray-600 mb-1\">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className=\"w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500\"
                >
                  <option value=\"efetivo\">Contato efetivo</option>
                  <option value=\"tentativa\">Tentativa de contato</option>
                  <option value=\"consultoria_produto\">Consultoria de Produto</option>
                </select>
              </div>"""

new_modal_fields = """              <div>
                <label className=\"block text-xs font-medium text-gray-600 mb-1\">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className=\"w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500\"
                >
                  <option value=\"efetivo\">Contato efetivo</option>
                  <option value=\"tentativa\">Tentativa de contato</option>
                  <option value=\"consultoria_produto\">Consultoria de Produto</option>
                </select>
              </div>

              <div>
                <label className=\"block text-xs font-medium text-gray-600 mb-1\">Canal</label>
                <select
                  value={form.canal}
                  onChange={(e) => setForm({ ...form, canal: e.target.value })}
                  className=\"w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500\"
                >
                  <option value=\"whatsapp\">Mensagem pelo WhatsApp</option>
                  <option value=\"ligacao\">Tentativa de ligação</option>
                  <option value=\"email\">E-mail</option>
                  <option value=\"meet\">Reunião Meet</option>
                </select>
              </div>"""

content = content.replace(old_modal_fields, new_modal_fields)

# Mostrar canal no histórico
old_history = """                    <p className={`text-sm font-medium ${contactTypeTone(c.type)}`}>
                      {contactTypeLabel(c.type)}
                    </p>"""

new_history = """                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${contactTypeTone(c.type)}`}>
                        {contactTypeLabel(c.type)}
                      </p>
                      {c.canal && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {c.canal === "whatsapp" ? "WhatsApp" : c.canal === "ligacao" ? "Ligação" : c.canal === "email" ? "E-mail" : "Meet"}
                        </span>
                      )}
                    </div>"""

content = content.replace(old_history, new_history)

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Atualizado!")
