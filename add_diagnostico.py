with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

# Adicionar tipos
old_types = '''type AuditLog = {'''
new_types = '''type Feature = {
  id: string;
  nome: string;
  categoria: string | null;
  ordem: number;
};

type ClientDiagnostico = {
  feature_id: string;
  ativo: boolean;
};

type AuditLog = {'''

content = content.replace(old_types, new_types)

# Adicionar estados
old_states = '''  const [activeTab, setActiveTab] = useState<"contatos" | "historico">("contatos");'''
new_states = '''  const [activeTab, setActiveTab] = useState<"contatos" | "diagnostico" | "historico">("contatos");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [diagnostico, setDiagnostico] = useState<Record<string, boolean>>({});
  const [percepcoes, setPercepcoes] = useState("");
  const [savingPercepcoes, setSavingPercepcoes] = useState(false);'''

content = content.replace(old_states, new_states)

# Adicionar funções de diagnóstico após loadAudit
old_after_audit = '''  async function logAudit'''
new_after_audit = '''  async function loadDiagnostico() {
    const { data: featuresData } = await supabase
      .from("features")
      .select("*")
      .eq("ativo", true)
      .order("ordem");
    setFeatures(featuresData ?? []);

    const { data: diagData } = await supabase
      .from("client_diagnostico")
      .select("feature_id, ativo")
      .eq("client_id", id);

    const map: Record<string, boolean> = {};
    (diagData ?? []).forEach((d: ClientDiagnostico) => { map[d.feature_id] = d.ativo; });
    setDiagnostico(map);
  }

  async function handleToggleFeature(featureId: string, currentValue: boolean) {
    const newValue = !currentValue;
    setDiagnostico(prev => ({ ...prev, [featureId]: newValue }));

    await supabase.from("client_diagnostico").upsert({
      client_id: id,
      feature_id: featureId,
      ativo: newValue,
    }, { onConflict: "client_id,feature_id" });

    const feature = features.find(f => f.id === featureId);
    await logAudit(
      newValue ? "ativou funcionalidade" : "desativou funcionalidade",
      "Diagnóstico",
      "Funcionalidade",
      currentValue ? "Ativo" : "Inativo",
      newValue ? "Ativo" : "Inativo"
    );
    await loadAudit();
  }

  async function handleSavePercepcoes() {
    setSavingPercepcoes(true);
    await supabase.from("clients").update({ percepcoes_gerais: percepcoes }).eq("id", id);
    await logAudit("editou", "Diagnóstico", "Percepções gerais");
    await loadAudit();
    setSavingPercepcoes(false);
  }

  async function logAudit'''

content = content.replace(old_after_audit, new_after_audit)

# Adicionar loadDiagnostico no useEffect
old_load = '''      await loadContacts();
      await loadAudit();
      setLoading(false);'''
new_load = '''      await loadContacts();
      await loadAudit();
      await loadDiagnostico();
      setPercepcoes(client.percepcoes_gerais ?? "");
      setLoading(false);'''

content = content.replace(old_load, new_load)

# Adicionar aba de diagnóstico nos tabs
old_tabs = '''          <button
              onClick={() => setActiveTab("historico")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "historico" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              Histórico de Registros
            </button>'''

new_tabs = '''          <button
              onClick={() => setActiveTab("diagnostico")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "diagnostico" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              Diagnóstico
            </button>
            <button
              onClick={() => setActiveTab("historico")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "historico" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              Histórico de Registros
            </button>'''

content = content.replace(old_tabs, new_tabs)

# Adicionar conteúdo da aba de diagnóstico antes do historico
old_historico_tab = '''            {activeTab === "historico" && ('''
new_historico_tab = '''            {activeTab === "diagnostico" && (
              <div className="space-y-6">
                {/* Funcionalidades agrupadas por categoria */}
                {(() => {
                  const semCategoria = features.filter(f => !f.categoria);
                  const categorias = [...new Set(features.filter(f => f.categoria).map(f => f.categoria))];
                  const ativas = features.filter(f => diagnostico[f.id]).length;

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">{ativas} de {features.length} funcionalidades ativas</p>
                      </div>

                      {semCategoria.length > 0 && (
                        <div>
                          <ul className="space-y-2">
                            {semCategoria.map(f => (
                              <li key={f.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                <span className="text-sm text-gray-700">{f.nome}</span>
                                <button
                                  onClick={() => handleToggleFeature(f.id, diagnostico[f.id] ?? false)}
                                  className={`w-10 h-5 rounded-full transition-colors relative ${diagnostico[f.id] ? "bg-blue-500" : "bg-gray-200"}`}
                                >
                                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${diagnostico[f.id] ? "translate-x-5" : "translate-x-0.5"}`} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {categorias.map(cat => (
                        <div key={cat}>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{cat}</p>
                          <ul className="space-y-2">
                            {features.filter(f => f.categoria === cat).map(f => (
                              <li key={f.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                <span className="text-sm text-gray-700">{f.nome}</span>
                                <button
                                  onClick={() => handleToggleFeature(f.id, diagnostico[f.id] ?? false)}
                                  className={`w-10 h-5 rounded-full transition-colors relative ${diagnostico[f.id] ? "bg-blue-500" : "bg-gray-200"}`}
                                >
                                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${diagnostico[f.id] ? "translate-x-5" : "translate-x-0.5"}`} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}

                      {/* Percepções gerais */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Percepções gerais</p>
                        <textarea
                          value={percepcoes}
                          onChange={(e) => setPercepcoes(e.target.value)}
                          placeholder="Registre percepções sobre o uso da plataforma, pontos de atenção, oportunidades..."
                          rows={4}
                          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <button
                          onClick={handleSavePercepcoes}
                          disabled={savingPercepcoes}
                          className="mt-2 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingPercepcoes ? "Salvando..." : "Salvar percepções"}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {activeTab === "historico" && ('''

content = content.replace(old_historico_tab, new_historico_tab)

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Atualizado!")
