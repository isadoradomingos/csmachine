content = '''"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

type Contact = {
  id: string;
  date: string;
  type: "tentativa" | "efetivo" | "consultoria_produto";
  note: string;
  canal: string;
};

type ContactHistory = {
  id: string;
  edited_at: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  profiles: { full_name: string };
};

export default function ClientPage() {
  const router = useRouter();
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [csm, setCsm] = useState<any>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [historyContact, setHistoryContact] = useState<{ contact: Contact; history: ContactHistory[] } | null>(null);
  const [form, setForm] = useState({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp" });
  const [currentUser, setCurrentUser] = useState<any>(null);

  async function loadContacts() {
    const { data } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", id)
      .order("date", { ascending: false });
    setContacts(data ?? []);
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

      if (client.csm_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", client.csm_id)
          .single();
        setCsm(profile);
      }

      await loadContacts();
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSaveContact() {
    if (!form.note.trim()) return;
    setSaving(true);

    if (editingContact) {
      // Registrar histórico de alterações
      const fields = [
        { key: "type", label: "Tipo" },
        { key: "date", label: "Data" },
        { key: "note", label: "Anotação" },
        { key: "canal", label: "Canal" },
      ];

      for (const field of fields) {
        const oldVal = editingContact[field.key as keyof Contact];
        const newVal = form[field.key as keyof typeof form];
        if (oldVal !== newVal) {
          await supabase.from("contact_history").insert({
            contact_id: editingContact.id,
            edited_by: currentUser.id,
            field_changed: field.label,
            old_value: String(oldVal),
            new_value: String(newVal),
          });
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
    setForm({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp" });
    setEditingContact(null);
    setShowModal(false);
    setSaving(false);
  }

  async function handleDelete(contact: Contact) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    await supabase.from("client_contacts").delete().eq("id", contact.id);
    await loadContacts();
  }

  async function handleShowHistory(contact: Contact) {
    const { data } = await supabase
      .from("contact_history")
      .select("*, profiles:edited_by(full_name)")
      .eq("contact_id", contact.id)
      .order("edited_at", { ascending: false });
    setHistoryContact({ contact, history: data ?? [] });
  }

  function openEdit(contact: Contact) {
    setEditingContact(contact);
    setForm({ type: contact.type, date: contact.date, note: contact.note, canal: contact.canal ?? "whatsapp" });
    setShowModal(true);
  }

  const typeLabel: Record<string, string> = {
    tentativa: "Tentativa de contato",
    efetivo: "Contato efetivo",
    consultoria_produto: "Consultoria de Produto",
  };

  const typeColor: Record<string, string> = {
    tentativa: "bg-yellow-100 text-yellow-700",
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">CS Machine</h1>
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

        {/* Histórico de contatos */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Histórico de contatos</h3>
            <button
              onClick={() => { setEditingContact(null); setForm({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp" }); setShowModal(true); }}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Registrar contato
            </button>
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
                      <span className="text-xs text-gray-400">
                        {new Date(c.date).toLocaleDateString("pt-BR")}
                      </span>
                      <button onClick={() => handleShowHistory(c)} className="text-xs text-gray-400 hover:text-gray-600">histórico</button>
                      <button onClick={() => openEdit(c)} className="text-xs text-blue-500 hover:text-blue-700">editar</button>
                      <button onClick={() => handleDelete(c)} className="text-xs text-red-400 hover:text-red-600">excluir</button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{c.note}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-medium text-gray-900 mb-4">Observações</h3>
          <textarea
            placeholder="Adicione observações sobre este cliente..."
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={4}
          />
        </div>

      </main>

      {/* Modal registrar/editar contato */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">{editingContact ? "Editar contato" : "Registrar contato"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="efetivo">Contato efetivo</option>
                  <option value="tentativa">Tentativa de contato</option>
                  <option value="consultoria_produto">Consultoria de Produto</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Canal</label>
                <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="whatsapp">Mensagem pelo WhatsApp</option>
                  <option value="ligacao">Tentativa de ligação</option>
                  <option value="email">E-mail</option>
                  <option value="meet">Reunião Meet</option>
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

      {/* Modal histórico de alterações */}
      {historyContact && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setHistoryContact(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Histórico de alterações</h3>
              <button onClick={() => setHistoryContact(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            {historyContact.history.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma alteração registrada.</p>
            ) : (
              <ul className="space-y-3">
                {historyContact.history.map((h) => (
                  <li key={h.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-700">{h.field_changed}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(h.edited_at).toLocaleDateString("pt-BR")} por {(h.profiles as any)?.full_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="bg-red-50 text-red-600 px-2 py-1 rounded line-through">{h.old_value}</span>
                      <span className="text-gray-400">→</span>
                      <span className="bg-green-50 text-green-600 px-2 py-1 rounded">{h.new_value}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
'''

with open("src/app/clients/[id]/page.tsx", "w") as f:
    f.write(content)
print("Criado!")
