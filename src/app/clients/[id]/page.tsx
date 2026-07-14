"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Client } from "@/lib/types";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { SeletorPercepcao, EtiquetaPercepcao, type Percepcao } from "@/components/Percepcao";
import MenuLateral from "@/components/MenuLateral";

type Contact = {
  id: string;
  date: string;
  type: "tentativa" | "efetivo" | "consultoria_produto";
  note: string;
  canal: string;
  percepcao?: string | null;
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

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isHtmlNote(note: string) {
  return /<[a-z][\s\S]*>/i.test(note);
}

function noteIsEmpty(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim() === "";
}

function sanitizeNote(html: string): string {
  if (typeof window === "undefined") return "";
  const allowed = new Set(["B", "STRONG", "U", "I", "EM", "UL", "OL", "LI", "BR", "P", "DIV", "SPAN"]);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const children = Array.from(el.childNodes).map(clean).join("");
    if (!allowed.has(el.tagName)) return children;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") return "<br>";
    return `<${tag}>${children}</${tag}>`;
  };
  return Array.from(doc.body.childNodes).map(clean).join("");
}

function RichTextEditor({ initialValue, onChange, placeholder }: { initialValue: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = isHtmlNote(initialValue)
        ? sanitizeNote(initialValue)
        : escapeHtml(initialValue).replace(/\n/g, "<br>");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function exec(command: string) {
    ref.current?.focus();
    document.execCommand(command);
    emit();
  }

  function closestLi(node: Node | null): HTMLElement | null {
    let cur: Node | null = node;
    while (cur && cur !== ref.current) {
      if (cur.nodeType === Node.ELEMENT_NODE && (cur as Element).tagName === "LI") return cur as HTMLElement;
      cur = cur.parentNode;
    }
    return null;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const li = closestLi(sel.anchorNode);

    // Tab dentro de um tópico → subtópico | Shift+Tab → volta um nível
    if (e.key === "Tab") {
      if (li) {
        e.preventDefault();
        document.execCommand(e.shiftKey ? "outdent" : "indent");
        emit();
      }
      return;
    }

    // Backspace em tópico vazio → remove a bolinha e vira linha normal
    if (e.key === "Backspace") {
      if (li && sel.isCollapsed && (li.textContent ?? "").trim() === "") {
        e.preventDefault();
        document.execCommand("outdent");
        emit();
      }
      return;
    }

    // "-" + espaço no início da linha → vira tópico automaticamente
    if (e.key === " " && !li && sel.isCollapsed) {
      const node = sel.anchorNode;
      if (
        node &&
        node.nodeType === Node.TEXT_NODE &&
        sel.anchorOffset === 1 &&
        (node.textContent ?? "").startsWith("-") &&
        !node.previousSibling
      ) {
        e.preventDefault();
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, 1);
        range.deleteContents();
        document.execCommand("insertUnorderedList");
        emit();
      }
    }
  }

  const btn = "px-2.5 py-1 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors";

  return (
    <div>
      <div className="flex gap-1.5 mb-1.5">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} className={`${btn} font-bold`} title="Negrito (Ctrl+B)">B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} className={`${btn} italic`} title="Itálico (Ctrl+I)">I</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} className={`${btn} underline`} title="Sublinhado (Ctrl+U)">U</button>
        <span className="text-[11px] text-gray-400 self-center ml-1">dica: &quot;-&quot; + espaço cria tópicos</span>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={emit}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="w-full min-h-24 max-h-60 overflow-y-auto rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
      />
    </div>
  );
}

function ContactNote({ note }: { note: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [note]);

  return (
    <div className="mt-2">
      {isHtmlNote(note) ? (
        <div
          ref={ref}
          dangerouslySetInnerHTML={{ __html: sanitizeNote(note) }}
          className={`text-sm text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5 ${expanded ? "" : "line-clamp-5"}`}
        />
      ) : (
        <div
          ref={ref}
          className={`text-sm text-gray-700 whitespace-pre-wrap ${expanded ? "" : "line-clamp-5"}`}
        >
          {note}
        </div>
      )}
      {(clamped || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-500 hover:text-blue-700 mt-1 font-medium"
        >
          {expanded ? "ver menos" : "ver mais"}
        </button>
      )}
    </div>
  );
}

export default function ClientPage() {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();
  const contatoAlvo = searchParams.get("contato");
  const [destacado, setDestacado] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [csm, setCsm] = useState<{ full_name: string } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [savingObservacoes, setSavingObservacoes] = useState(false);
  const [editingObservacoes, setEditingObservacoes] = useState(false);
  const [savedObservacoes, setSavedObservacoes] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<"contatos" | "health" | "historico">("contatos");
  const [healthScore, setHealthScore] = useState<{ score: number | null; banda: string; sub_volume: number | null; sub_queda: number | null; sub_perdidas: number | null; operacao: string; rede: string; parcial: boolean } | null>(null);
  const [healthCarregando, setHealthCarregando] = useState(true);
  const [auditLimit, setAuditLimit] = useState(10);
  const [form, setForm] = useState<{ type: string; date: string; note: string; canal: string; percepcao: Percepcao }>({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp", percepcao: null });
  const [showTentativaModal, setShowTentativaModal] = useState(false);
  const [tentativaForm, setTentativaForm] = useState<{ date: string; canal: string; note: string; percepcao: Percepcao }>({ date: new Date().toISOString().split("T")[0], canal: "whatsapp", note: "", percepcao: null });
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
      const userIds = [...new Set(data.map((d: { user_id: string }) => d.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const profileMap = Object.fromEntries((profilesData ?? []).map((p: { id: string; full_name: string }) => [p.id, p]));
      setAudit(data.map((d: { user_id: string }) => ({ ...d, profiles: profileMap[d.user_id] ?? { full_name: "—" } })) as unknown as AuditLog[]);
    } else {
      setAudit([]);
    }
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

  // Normaliza nome para casamento aproximado (ignora acento, maiúscula, espaço e pontuação)
  function normalizar(s: string): string {
    return (s ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""); // remove espaços, hífens, pontuação
  }

  async function carregarHealthScore(marca: string) {
    setHealthCarregando(true);
    const alvo = normalizar(marca);
    if (!alvo) { setHealthScore(null); setHealthCarregando(false); return; }

    type RedeScore = { rede: string; operacao: string; score: number | null; banda: string; sub_volume: number | null; sub_queda: number | null; sub_perdidas: number | null; parcial: boolean };

    // 1) Tenta casamento exato no banco (cobre a maioria, ex: "Up City Brasil")
    const { data: exato } = await supabase
      .from("hs_scores")
      .select("rede, operacao, score, banda, sub_volume, sub_queda, sub_perdidas, parcial")
      .eq("tipo", "rede")
      .eq("rede", marca)
      .limit(1);

    if (exato && exato.length > 0) {
      setHealthScore(exato[0] as RedeScore);
      setHealthCarregando(false);
      return;
    }

    // 2) Fallback: busca ampla COM paginação (cobre divergências de acento/espaço/caixa)
    const todas: RedeScore[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("hs_scores")
        .select("rede, operacao, score, banda, sub_volume, sub_queda, sub_perdidas, parcial")
        .eq("tipo", "rede")
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      todas.push(...(data as RedeScore[]));
      if (data.length < 1000) break;
      from += 1000;
    }

    const match = todas.find(r => normalizar(r.rede) === alvo);
    setHealthScore(match ?? null);
    setHealthCarregando(false);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (!client) { router.push("/dashboard"); return; }
      setClient(client);
      setObservacoes(client.observacoes ?? "");
      setSavedObservacoes(client.observacoes ?? "");

      // Health Score: casa a marca do cliente com a rede (nome normalizado, aproximado)
      void carregarHealthScore(client.marca);

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
      setLoading(false);
    }
    load();
    // Carrega uma vez ao montar; as funções de load são estáveis neste contexto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Se veio de um link com ?contato=ID, abre a aba contatos, rola até o registro e o destaca
  useEffect(() => {
    if (!contatoAlvo || contacts.length === 0) return;
    if (!contacts.some(c => c.id === contatoAlvo)) return;
    const t = setTimeout(() => {
      setActiveTab("contatos");
      const el = document.getElementById(`contato-${contatoAlvo}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setDestacado(contatoAlvo);
        setTimeout(() => setDestacado(null), 2600);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contatoAlvo, contacts]);

  async function handleSaveTentativa() {
    setSavingTentativa(true);
    await supabase.from("client_contacts").insert({
      client_id: id,
      date: tentativaForm.date,
      type: "tentativa",
      note: tentativaForm.note || "Tentativa de contato",
      canal: tentativaForm.canal,
      percepcao: tentativaForm.percepcao,
    });
    await logAudit("registrou", "Contato", "Tipo", undefined, "Tentativa de contato");
    await loadContacts();
    await loadAudit();
    setTentativaForm({ date: new Date().toISOString().split("T")[0], canal: "whatsapp", note: "", percepcao: null });
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
    if (noteIsEmpty(form.note)) return;
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
        percepcao: form.percepcao,
      }).eq("id", editingContact.id);
    } else {
      await supabase.from("client_contacts").insert({
        client_id: id,
        date: form.date,
        type: form.type,
        note: form.note,
        canal: form.canal,
        percepcao: form.percepcao,
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
    setForm({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp", percepcao: null });
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
    setForm({ type: contact.type, date: contact.date, note: contact.note, canal: contact.canal ?? "whatsapp", percepcao: (contact.percepcao as Percepcao) ?? null });
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
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Carregando...</p>
    </div>
  );

  if (!client) return null;

  // Percepção atual = a do contato mais recente que tenha percepção preenchida
  const percepcaoAtual = contacts.find(c => c.percepcao) ?? null;

  return (
    <div className="min-h-screen bg-slate-800">
      <header className="sticky top-0 z-40 bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MenuLateral />
          <Image src="/machine-logo.png" alt="Machine" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Header do cliente */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
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
                {percepcaoAtual && (
                  <EtiquetaPercepcao value={percepcaoAtual.percepcao as Percepcao} data={percepcaoAtual.date} />
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
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
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
              <dt className="text-xs text-gray-400 mb-1">Health Score</dt>
              <dd className="text-sm font-medium">
                {healthScore && healthScore.score !== null ? (
                  <span style={{ color: healthScore.banda === "Verde" ? "#16a34a" : healthScore.banda === "Amarelo" ? "#f59e0b" : healthScore.banda === "Vermelho" ? "#dc2626" : "#64748b" }}>
                    {Math.round(healthScore.score)}
                    <span className="text-gray-400 font-normal"> · {healthScore.banda === "Verde" ? "Saudável" : healthScore.banda === "Amarelo" ? "Em risco" : healthScore.banda === "Vermelho" ? "Crítico" : healthScore.banda}</span>
                  </span>
                ) : (
                  <span className="text-gray-900">—</span>
                )}
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
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200/60">
            <button onClick={() => setActiveTab("contatos")} className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "contatos" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              Registro de Contatos
            </button>
            <button onClick={() => setActiveTab("health")} className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "health" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              Health Score
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
                      className="text-xs border border-gray-200 bg-white text-gray-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                        <line x1="22" y1="2" x2="2" y2="22" />
                      </svg>
                      Registrar tentativa de contato
                    </button>
                    <button
                      onClick={() => { setEditingContact(null); setForm({ type: "efetivo", date: new Date().toISOString().split("T")[0], note: "", canal: "whatsapp", percepcao: null }); setShowModal(true); }}
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
                      <li
                        key={c.id}
                        id={`contato-${c.id}`}
                        className={`rounded-xl border p-4 transition-colors duration-500 ${
                          destacado === c.id
                            ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200"
                            : "border-slate-200/70 bg-white"
                        }`}
                      >
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
                            {c.percepcao && <EtiquetaPercepcao value={c.percepcao as Percepcao} />}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-gray-400">{new Date(c.date).toLocaleDateString("pt-BR")}</span>
                            <button onClick={() => openEdit(c)} className="text-xs text-blue-500 hover:text-blue-700">editar</button>
                            <button onClick={() => handleDelete(c)} className="text-xs text-red-400 hover:text-red-600">excluir</button>
                          </div>
                        </div>
                        <ContactNote note={c.note} />
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}

            {/* Health Score */}
            {activeTab === "health" && (
              <div className="space-y-6">
                {healthCarregando ? (
                  <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
                ) : !healthScore ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
                    <p className="text-sm font-medium text-gray-500">Sem health score para este cliente</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                      Não encontramos uma rede correspondente a <span className="font-medium">{client.marca}</span> nos
                      dados do Health Score. Isso pode acontecer se o nome não casou com os dados importados ou se ainda
                      não há dados para esta central.
                    </p>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const banda = healthScore.banda;
                      const cor = banda === "Verde" ? "#16a34a" : banda === "Amarelo" ? "#f59e0b" : banda === "Vermelho" ? "#dc2626" : "#94a3b8";
                      const fundo = banda === "Verde" ? "#f0fdf4" : banda === "Amarelo" ? "#fffbeb" : banda === "Vermelho" ? "#fef2f2" : "#f8fafc";
                      const rotuloBanda = banda === "Verde" ? "Saudável" : banda === "Amarelo" ? "Em risco" : banda === "Vermelho" ? "Crítico" : "Não avaliado";
                      return (
                        <div className="rounded-2xl border p-6" style={{ borderColor: cor + "55", background: fundo }}>
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Health Score da rede</p>
                              <p className="text-sm text-gray-500 mt-0.5">{healthScore.rede} · {healthScore.operacao}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-4xl font-bold" style={{ color: cor }}>
                                  {healthScore.score !== null ? Math.round(healthScore.score) : "—"}
                                </p>
                                <p className="text-xs text-gray-400">de 100</p>
                              </div>
                              <span className="px-3 py-1.5 rounded-full text-sm font-semibold text-white" style={{ background: cor }}>
                                {rotuloBanda}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sub-notas do bloco Uso */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Fatores avaliados (bloco Uso)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {([
                          { rotulo: "Volume relativo", valor: healthScore.sub_volume, ajuda: "Volume de operação frente à mediana do plano" },
                          { rotulo: "Perfil de queda", valor: healthScore.sub_queda, ajuda: "Velocidade de queda nos últimos meses" },
                          { rotulo: "Taxa de perdidas", valor: healthScore.sub_perdidas, ajuda: "Proporção de solicitações canceladas" },
                        ] as const).map(sub => {
                          const v = sub.valor;
                          const corSub = v === null ? "#94a3b8" : v >= 100 ? "#16a34a" : v >= 50 ? "#f59e0b" : "#dc2626";
                          const rotuloSub = v === null ? "N/A" : v >= 100 ? "Bom" : v >= 50 ? "Atenção" : "Crítico";
                          return (
                            <div key={sub.rotulo} className="rounded-xl border border-slate-200/70 bg-white p-4">
                              <p className="text-sm font-medium text-gray-700">{sub.rotulo}</p>
                              <p className="text-xs text-gray-400 mt-0.5 mb-2">{sub.ajuda}</p>
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: corSub }}>
                                {rotuloSub}{v !== null ? ` · ${v}` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {healthScore.parcial && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <p className="text-xs text-amber-900">
                          <span className="font-semibold">Score parcial.</span> Esta nota considera apenas o bloco de Uso
                          &amp; engajamento (Volume, Queda e Taxa de perdidas). Os demais critérios do modelo
                          (Equilíbrio, Financeiro, Funcionalidades, NPS, Suporte e Filiais) serão incorporados conforme
                          os dados forem importados.
                        </p>
                      </div>
                    )}
                  </>
                )}
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
                        <li key={log.id} className="rounded-xl border border-slate-200/70 bg-white p-4 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-800">
                              {log.profiles?.full_name} {log.action}
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
                        className="mt-4 w-full text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg py-2 hover:bg-slate-100 transition-colors"
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
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
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
              <SeletorPercepcao value={tentativaForm.percepcao} onChange={(v) => setTentativaForm({ ...tentativaForm, percepcao: v })} />
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
              <SeletorPercepcao value={form.percepcao} onChange={(v) => setForm({ ...form, percepcao: v })} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Anotação</label>
                <RichTextEditor
                  initialValue={editingContact ? editingContact.note : ""}
                  onChange={(html) => setForm(prev => ({ ...prev, note: html }))}
                  placeholder="O que foi discutido?"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); setEditingContact(null); }} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveContact} disabled={saving || noteIsEmpty(form.note)} className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Salvando..." : editingContact ? "Salvar alterações" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
