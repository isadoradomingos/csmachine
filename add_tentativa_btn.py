with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

# Adicionar estado do modal de tentativa
old_state = '''  const [currentUser, setCurrentUser] = useState<any>(null);'''
new_state = '''  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showTentativaModal, setShowTentativaModal] = useState(false);
  const [tentativaForm, setTentativaForm] = useState({ date: new Date().toISOString().split("T")[0], canal: "whatsapp", note: "" });
  const [savingTentativa, setSavingTentativa] = useState(false);'''

content = content.replace(old_state, new_state)

# Adicionar função de salvar tentativa
old_func = '''  async function handleSaveContact() {'''
new_func = '''  async function handleSaveTentativa() {
    setSavingTentativa(true);
    await supabase.from("client_contacts").insert({
      client_id: id,
      date: tentativaForm.date,
      type: "tentativa",
      note: tentativaForm.note || "Tentativa de contato",
      canal: tentativaForm.canal,
    });
    await logAudit("registrou", "Contato", "Tipo", undefined, "Tentativa de contato");
    await loadContacts();
    await loadAudit();
    setTentativaForm({ date: new Date().toISOString().split("T")[0], canal: "whatsapp", note: "" });
    setShowTentativaModal(false);
    setSavingTentativa(false);
  }

  async function handleSaveContact() {'''

content = content.replace(old_func, new_func)

# Adicionar botão no header do cliente
old_header = '''            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              client.status === "ativo" ? "bg-green-100 text-green-700" :
              client.status === "churned" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {client.status}
            </span>'''

new_header = '''            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTentativaModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 17.657a9 9 0 010-12.728m2.829 9.9a5 5 0 010-7.072" />
                </svg>
                Registrar tentativa
              </button>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                client.status === "ativo" ? "bg-green-100 text-green-700" :
                client.status === "churned" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {client.status}
              </span>
            </div>'''

if old_header in content:
    content = content.replace(old_header, new_header)
    print("Header atualizado!")
else:
    print("Header não encontrado")

# Adicionar modal de tentativa antes do fechamento
old_end = '''      {/* Modal registrar/editar contato */}'''
new_end = '''      {/* Modal tentativa de contato */}
      {showTentativaModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Registrar tentativa de contato</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Canal</label>
                <select value={tentativaForm.canal} onChange={(e) => setTentativaForm({ ...tentativaForm, canal: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="whatsapp">Mensagem pelo WhatsApp</option>
                  <option value="ligacao">Tentativa de ligação</option>
                  <option value="email">E-mail</option>
                  <option value="meet">Reunião Meet</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input type="date" value={tentativaForm.date} onChange={(e) => setTentativaForm({ ...tentativaForm, date: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observação (opcional)</label>
                <textarea value={tentativaForm.note} onChange={(e) => setTentativaForm({ ...tentativaForm, note: e.target.value })} placeholder="Ex: Não atendeu, deixei recado..." rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTentativaModal(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveTentativa} disabled={savingTentativa} className="flex-1 rounded-lg bg-gray-800 text-white px-4 py-2 text-sm font-medium hover:bg-gray-900 disabled:opacity-50">
                {savingTentativa ? "Salvando..." : "Registrar tentativa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar/editar contato */}'''

content = content.replace(old_end, new_end)

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Concluído!")
