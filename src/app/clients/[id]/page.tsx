"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import { Info } from "lucide-react";

type Contact = {
  id: string;
  date: string;
  type: "tentativa" | "efetivo" | "consultoria_produto";
  note: string;
  canal: string;
};

type Feature = {
  id: string;
  nome: string;
  categoria: string | null;
  ordem: number;
  operacao: string | null;
  link: string | null;
};

type ClientDiagnostico = {
  feature_id: string;
  ativo: boolean;
};

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  profiles: { full_name: string };
};

export default function ClientPage() {
  const router = useRouter();
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [csm, setCsm] = useState<any>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [diagnostico, setDiagnostico] = useState<Record<string, boolean>>({});
  const [percepcoes, setPercepcoes] = useState("");
  const [savingPercepcoes, setSavingPercepcoes] = useState(false);
  const [editingPercepcoes, setEditingPercepcoes] = useState(false);
  const [savedPercepcoes, setSavedPercepcoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [savingObservacoes, setSavingObservacoes] = useState(false);
  const [editingObservacoes, setEditingObservacoes] = useState(false);
  const [savedObservacoes, setSavedObservacoes] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<"contatos" | "diagnostico" | "historico">("contatos");
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [auditLimit, setAuditLimit] = useState(10);
  const [form, setForm] = useState({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp" });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showTentativaModal, setShowTentativaModal] = useState(false);
  const [tentativaForm, setTentativaForm] = useState({ date: new Date().toISOString().split("T")[0], canal: "whatsapp", note: "" });
  const [savingTentativa, setSavingTentativa] = useState(false);

  async function loadContacts() {
    const { data } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", id)
      .order("date", { ascending: false });
    setContacts(data ?? []);
  }

  async function loadAudit() {
    const { data } = await supabase
      .from("client_audit")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((d: any) => d.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const profileMap = Object.fromEntries((profilesData ?? []).map((p: any) => [p.id, p]));
      setAudit(data.map((d: any) => ({ ...d, profiles: profileMap[d.user_id] ?? null })));
    } else {
      setAudit([]);
    }
  }

  async function loadDiagnostico() {
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

  async function logAudit(action: string, entity: string, field?: string, oldValue?: string, newValue?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("client_audit").insert({
      client_id: id,
      user_id: user.id,
      action,
      entity,
      field: field ?? null,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    });
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
      feature?.nome ?? "Funcionalidade",
      currentValue ? "Ativo" : "Inativo",
      newValue ? "Ativo" : "Inativo"
    );
    await loadAudit();
  }

  async function handleSavePercepcoes() {
    setSavingPercepcoes(true);
    const { data: clientData } = await supabase
      .from("clients")
      .select("percepcoes_gerais")
      .eq("id", id)
      .single();
    await supabase.from("clients").update({ percepcoes_gerais: percepcoes }).eq("id", id);
    await logAudit("editou", "Diagnóstico", "Percepções gerais", clientData?.percepcoes_gerais ?? "(vazio)", percepcoes);
    await loadAudit();
    setSavedPercepcoes(percepcoes);
    setEditingPercepcoes(false);
    setSavingPercepcoes(false);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUser(user);

      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (!client) { router.push("/dashboard"); return; }
      setClient(client);
      setPercepcoes(client.percepcoes_gerais ?? "");
      setSavedPercepcoes(client.percepcoes_gerais ?? "");
      setObservacoes(client.observacoes ?? "");
      setSavedObservacoes(client.observacoes ?? "");

      if (client.csm_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", client.csm_id)
          .single();
        setCsm(profile);
      }

      await loadContacts();
      await loadAudit();
      await loadDiagnostico();
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSaveTentativa() {
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

  async function handleSaveObservacoes() {
    setSavingObservacoes(true);
    const { data: clientData } = await supabase
      .from("clients")
      .select("observacoes")
      .eq("id", id)
      .single();
    
    await supabase.from("clients").update({ observacoes }).eq("id", id);
    await logAudit("editou", "Observações", "Observações", clientData?.observacoes ?? "(vazio)", observacoes);
    await loadAudit();
    setSavedObservacoes(observacoes);
    setEditingObservacoes(false);
    setSavingObservacoes(false);
  }

  async function handleSaveContact() {
    if (!form.note.trim()) return;
    setSaving(true);

    if (editingContact) {
      const fields: { key: keyof Contact; label: string }[] = [
        { key: "type", label: "Tipo" },
        { key: "date", label: "Data" },
        { key: "note", label: "Anotação" },
        { key: "canal", label: "Canal" },
      ];

      for (const field of fields) {
        const oldVal = String(editingContact[field.key] ?? "");
        const newVal = String(form[field.key as keyof typeof form] ?? "");
        if (oldVal !== newVal) {
          await logAudit("editou", "Contato", field.label, oldVal, newVal);
        }
      }

      await supabase.from("client_contacts").update({
        type: form.type,
        date: form.date,
        note: form.note,
        canal: form.canal,
      }).eq("id", editingContact.id);
    } else {
      await supabase.from("client_contacts").insert({
        client_id: id,
        date: form.date,
        type: form.type,
        note: form.note,
        canal: form.canal,
      });

      const typeLabels: Record<string, string> = {
        efetivo: "Contato",
        tentativa: "Tentativa de contato",
        consultoria_produto: "Consultoria de Produto",
      };

      await logAudit("registrou", "Contato", "Tipo", undefined, typeLabels[form.type]);

      const { data: clientData } = await supabase
        .from("clients")
        .select("last_contact")
        .eq("id", id)
        .single();

      if (!clientData?.last_contact || form.date > clientData.last_contact) {
        await supabase.from("clients").update({ last_contact: form.date }).eq("id", id);
      }
    }

    await loadContacts();
    await loadAudit();
    setForm({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp" });
    setEditingContact(null);
    setShowModal(false);
    setSaving(false);
  }

  async function handleDelete(contact: Contact) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    await logAudit("excluiu", "Contato", "Data", contact.date, undefined);
    await supabase.from("client_contacts").delete().eq("id", contact.id);

    // Recalcular last_contact com o contato mais recente restante
    const { data: remaining } = await supabase
      .from("client_contacts")
      .select("date")
      .eq("client_id", id)
      .order("date", { ascending: false })
      .limit(1);

    const newLastContact = remaining && remaining.length > 0 ? remaining[0].date : null;
    await supabase.from("clients").update({ last_contact: newLastContact }).eq("id", id);

    await loadContacts();
    await loadAudit();
  }

  function openEdit(contact: Contact) {
    setEditingContact(contact);
    setForm({ type: contact.type, date: contact.date, note: contact.note, canal: contact.canal ?? "whatsapp" });
    setShowModal(true);
  }

  const typeLabel: Record<string, string> = {
    tentativa: "Tentativa de contato",
    efetivo: "Contato",
    consultoria_produto: "Consultoria de Produto",
  };

  const typeColor: Record<string, string> = {
    tentativa: "bg-red-100 text-red-700",
    efetivo: "bg-green-100 text-green-700",
    consultoria_produto: "bg-purple-100 text-purple-700",
  };

  const canalLabel: Record<string, string> = {
    whatsapp: "WhatsApp",
    ligacao: "Ligação",
    email: "E-mail",
    meet: "Meet",
  };

  const clusterLabel: Record<string, string> = {
    high_touch: "High Touch",
    mid_touch: "Mid Touch",
    growth_touch: "Growth Touch",
    no_touch: "No Touch",
  };

  const operacaoColor: Record<string, string> = {
    corridas: "bg-blue-100 text-blue-700",
    entregas: "bg-orange-100 text-orange-700",
  };

  const planoColor: Record<string, string> = {
    start: "bg-gray-100 text-gray-600",
    growth: "bg-blue-100 text-blue-700",
    master: "bg-purple-100 text-purple-700",
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  );

  const visibleFeatures = features.filter(
    f => !f.operacao || f.operacao === "ambos" || f.operacao === client.operacao
  );
  const semCategoria = visibleFeatures.filter(f => !f.categoria);
  const categorias = [...new Set(visibleFeatures.filter(f => f.categoria).map(f => f.categoria))];
  const ativas = visibleFeatures.filter(f => diagnostico[f.id]).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/machine-logo.png" alt="Machine" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Header do cliente */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-semibold text-gray-900">{client.marca}</h2>
                {client.operacao && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${operacaoColor[client.operacao]}`}>
                    {client.operacao}
                  </span>
                )}
                {client.plano && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${planoColor[client.plano] ?? "bg-gray-100 text-gray-600"}`}>
                    {client.plano.charAt(0).toUpperCase() + client.plano.slice(1)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">Bandeira {client.bandeira}</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              client.status === "ativo" ? "bg-green-100 text-green-700" :
              client.status === "churned" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {client.status}
            </span>
          </div>
        </div>

        {/* Informações */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-medium text-gray-900 mb-4">Informações</h3>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-gray-400 mb-1">CSM Responsável</dt>
              <dd className="text-sm font-medium text-gray-900">{csm?.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 mb-1">Cluster</dt>
              <dd className="text-sm font-medium text-gray-900">{client.cluster ? clusterLabel[client.cluster] : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 mb-1">Plano</dt>
              <dd className="text-sm font-medium text-gray-900">{client.plano ? client.plano.charAt(0).toUpperCase() + client.plano.slice(1) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 mb-1">Operação</dt>
              <dd className="text-sm font-medium text-gray-900">{client.operacao ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 mb-1">Início do contrato</dt>
              <dd className="text-sm font-medium text-gray-900">
                {client.data_inicio ? new Date(client.data_inicio).toLocaleDateString("pt-BR") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 mb-1">Último contato</dt>
              <dd className="text-sm font-medium text-gray-900">
                {client.last_contact ? new Date(client.last_contact).toLocaleDateString("pt-BR") : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button onClick={() => setActiveTab("contatos")} className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "contatos" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              Registro de Contatos
            </button>
            <button onClick={() => setActiveTab("diagnostico")} className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "diagnostico" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              Diagnóstico
            </button>
            <button onClick={() => setActiveTab("historico")} className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "historico" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              Histórico de Registros
            </button>
          </div>

          <div className="p-6">

            {/* Registro de Contatos */}
            {activeTab === "contatos" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">{contacts.length} registros</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTentativaModal(true)}
                      className="text-xs border border-gray-200 bg-white text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Registrar tentativa de contato
                    </button>
                    <button
                      onClick={() => { setEditingContact(null); setForm({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp" }); setShowModal(true); }}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      + Registrar contato
                    </button>
                  </div>
                </div>
                {contacts.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhum contato registrado ainda.</p>
                ) : (
                  <ol className="space-y-3">
                    {contacts.map((c) => (
                      <li key={c.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[c.type]}`}>
                              {typeLabel[c.type]}
                            </span>
                            {c.canal && (
                              <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                                {canalLabel[c.canal] ?? c.canal}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-gray-400">{new Date(c.date).toLocaleDateString("pt-BR")}</span>
                            <button onClick={() => openEdit(c)} className="text-xs text-blue-500 hover:text-blue-700">editar</button>
                            <button onClick={() => handleDelete(c)} className="text-xs text-red-400 hover:text-red-600">excluir</button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{c.note}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}

            {/* Diagnóstico */}
            {activeTab === "diagnostico" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-gray-500">{ativas} de {visibleFeatures.length} funcionalidades ativas</p>
                  {audit.filter(a => a.entity === "Diagnóstico").length > 0 && (
                    <p className="text-xs text-gray-400">
                      Última alteração de diagnóstico em: {new Date(audit.filter(a => a.entity === "Diagnóstico")[0].created_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>

                {semCategoria.length > 0 && (
                  <ul className="space-y-1">
                    {semCategoria.map(f => (
                      <li key={f.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                        <span className="flex items-center gap-1.5 text-sm text-gray-700">
                          {f.nome}
                          {f.link && (
                            <span className="relative inline-flex">
                              <button
                                onClick={() => setOpenInfoId(openInfoId === f.id ? null : f.id)}
                                className="text-gray-400 hover:text-blue-500 transition-colors"
                                title="Mais informações"
                              >
                                <Info size={14} />
                              </button>
                              {openInfoId === f.id && (
                                <span className="absolute left-0 top-6 z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
                                  <a
                                    href={f.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setOpenInfoId(null)}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Ver artigo de suporte ↗
                                  </a>
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleToggleFeature(f.id, diagnostico[f.id] ?? false)}
                          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${diagnostico[f.id] ? "bg-blue-500" : "bg-gray-200"}`}
                        >
                          <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${diagnostico[f.id] ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {categorias.map(cat => (
                  <div key={cat as string}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{cat}</p>
                    <ul className="space-y-1">
                      {visibleFeatures.filter(f => f.categoria === cat).map(f => (
                        <li key={f.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                          <span className="flex items-center gap-1.5 text-sm text-gray-700">
                            {f.nome}
                            {f.link && (
                              <span className="relative inline-flex">
                                <button
                                  onClick={() => setOpenInfoId(openInfoId === f.id ? null : f.id)}
                                  className="text-gray-400 hover:text-blue-500 transition-colors"
                                  title="Mais informações"
                                >
                                  <Info size={14} />
                                </button>
                                {openInfoId === f.id && (
                                  <span className="absolute left-0 top-6 z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
                                    <a
                                      href={f.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => setOpenInfoId(null)}
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      Ver artigo de suporte ↗
                                    </a>
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => handleToggleFeature(f.id, diagnostico[f.id] ?? false)}
                            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${diagnostico[f.id] ? "bg-blue-500" : "bg-gray-200"}`}
                          >
                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${diagnostico[f.id] ? "translate-x-5" : "translate-x-0"}`} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Percepções gerais</p>
                    {!editingPercepcoes ? (
                      <button
                        onClick={() => setEditingPercepcoes(true)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        {percepcoes ? "Editar" : "Adicionar"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingPercepcoes(false); setPercepcoes(savedPercepcoes); }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSavePercepcoes}
                          disabled={savingPercepcoes}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingPercepcoes ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    )}
                  </div>
                  {editingPercepcoes ? (
                    <textarea
                      value={percepcoes}
                      onChange={(e) => setPercepcoes(e.target.value)}
                      placeholder="Registre percepções sobre o uso da plataforma, pontos de atenção, oportunidades..."
                      rows={4}
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {percepcoes || <span className="text-gray-400">Nenhuma percepção registrada.</span>}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Histórico de Registros */}
            {activeTab === "historico" && (
              <>
                {audit.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma alteração registrada ainda.</p>
                ) : (
                  <>
                    <ul className="space-y-3">
                      {audit.slice(0, auditLimit).map((log) => (
                        <li key={log.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-800">
                              {(log.profiles as any)?.full_name} {log.action}
                              {log.field ? ` — ${log.field}` : ""}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0 ml-2">
                              {new Date(log.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} às {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {(log.old_value || log.new_value) && (
                            <div className="flex items-center gap-2 text-xs mt-1">
                              {log.old_value && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded line-through">{log.old_value}</span>}
                              {log.old_value && log.new_value && <span className="text-gray-400">→</span>}
                              {log.new_value && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded">{log.new_value}</span>}
                            </div>
                          )}
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
                    )}
                  </>
                )}
              </>
            )}

          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Observações</h3>
            {!editingObservacoes ? (
              <button
                onClick={() => setEditingObservacoes(true)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {observacoes ? "Editar" : "Adicionar"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingObservacoes(false); setObservacoes(savedObservacoes); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveObservacoes}
                  disabled={savingObservacoes}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingObservacoes ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </div>
          {editingObservacoes ? (
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Adicione observações sobre este cliente..."
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              autoFocus
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {observacoes || <span className="text-gray-400">Nenhuma observação registrada.</span>}
            </p>
          )}
        </div>

      </main>

      {/* Modal tentativa de contato */}
      {showTentativaModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Registrar tentativa de contato</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Canal</label>
                <select value={tentativaForm.canal} onChange={(e) => setTentativaForm({ ...tentativaForm, canal: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="ligacao">Ligação</option>
                  <option value="email">E-mail</option>
                  <option value="meet">Meet</option>
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
                {savingTentativa ? "Salvando..." : "Registrar tentativa de contato"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar/editar contato */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">{editingContact ? "Editar contato" : "Registrar contato"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="efetivo">Contato</option>
                  <option value="consultoria_produto">Consultoria de Produto</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Canal</label>
                <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="ligacao">Ligação</option>
                  <option value="email">E-mail</option>
                  <option value="meet">Meet</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Anotação</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="O que foi discutido?" rows={4} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); setEditingContact(null); }} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveContact} disabled={saving || !form.note.trim()} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Salvando..." : editingContact ? "Salvar alterações" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
