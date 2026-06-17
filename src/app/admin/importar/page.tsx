"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";

const OPERACOES = ["corridas", "entregas"];
const CLUSTERS = ["high_touch", "mid_touch", "growth_touch", "no_touch"];
const PLANOS = ["start", "growth", "master"];
const REQUIRED_FIELDS = ["bandeira", "marca", "operacao", "csm"];

type ImportRow = {
  bandeira: string;
  marca?: string;
  operacao?: string;
  cluster?: string;
  plano?: string;
  csm?: string;
  status?: "pendente" | "atualizado" | "adicionado" | "ignorado" | "erro";
  message?: string;
};

type AusenteCliente = {
  id: string;
  marca: string;
  bandeira: string | null;
  csm_nome: string;
  last_contact: string | null;
  diasSemContato: number;
};

export default function ImportarPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [fileKey, setFileKey] = useState(0);

  // Etapa de inativação
  const [ausentes, setAusentes] = useState<AusenteCliente[]>([]);
  const [totalAtivos, setTotalAtivos] = useState(0);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [inativando, setInativando] = useState(false);
  const [inativacaoFeita, setInativacaoFeita] = useState(false);
  const [inativadosCount, setInativadosCount] = useState(0);

  function diasSince(date: string | null): number {
    if (!date) return 9999;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: p } = await supabase.from("profiles").select("id, full_name");
    setProfiles(p ?? []);
    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
    const parsed: ImportRow[] = lines.slice(1).map((line: string) => {
      const values = line.split(",").map((v: string) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h: string, i: number) => { obj[h] = values[i] ?? ""; });
      return { ...(obj as unknown as ImportRow), status: "pendente" as const };
    }).filter((r: ImportRow) => r.bandeira);
    setRows(parsed);
    setDone(false);
    setAusentes([]);
    setInativacaoFeita(false);
  }

  async function handleImport() {
    setImporting(true);
    const updated: ImportRow[] = [];
    const bandeirasNaPlanilha: string[] = [];

    for (const row of rows) {
      try {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("bandeira", row.bandeira)
          .maybeSingle();

        const profile = profiles.find((p) => p.full_name.toLowerCase() === (row.csm ?? "").toLowerCase());

        if (existing) {
          bandeirasNaPlanilha.push(row.bandeira);
          const updateObj: Record<string, string> = { status: "ativo" };
          if (row.marca) updateObj.marca = row.marca;
          if (row.operacao && OPERACOES.includes(row.operacao)) updateObj.operacao = row.operacao;
          if (row.cluster && CLUSTERS.includes(row.cluster)) updateObj.cluster = row.cluster;
          if (row.plano && PLANOS.includes(row.plano)) updateObj.plano = row.plano;
          if (profile) updateObj.csm_id = profile.id;
          await supabase.from("clients").update(updateObj).eq("id", existing.id);
          updated.push({ ...row, status: "atualizado" });
        } else {
          const missingFields = REQUIRED_FIELDS.filter((f: string) => !row[f as keyof ImportRow]);
          if (missingFields.length > 0 || !profile) {
            updated.push({ ...row, status: "ignorado", message: "Campos obrigatórios faltando" });
            continue;
          }
          bandeirasNaPlanilha.push(row.bandeira);
          const newClient: Record<string, string> = {
            marca: row.marca ?? "",
            bandeira: row.bandeira,
            operacao: row.operacao ?? "",
            csm_id: profile.id,
            status: "ativo",
          };
          if (row.cluster && CLUSTERS.includes(row.cluster)) newClient.cluster = row.cluster;
          if (row.plano && PLANOS.includes(row.plano)) newClient.plano = row.plano;
          await supabase.from("clients").insert(newClient);
          updated.push({ ...row, status: "adicionado" });
        }
      } catch {
        updated.push({ ...row, status: "erro", message: "Erro ao processar" });
      }
    }

    // Em vez de inativar automaticamente: monta a lista de ausentes para confirmação.
    // Busca em lotes (a API do Supabase limita ~1000 linhas por requisição).
    type AtivoRow = { id: string; marca: string; bandeira: string | null; last_contact: string | null; profiles: { full_name: string } | { full_name: string }[] | null };
    const ativos: AtivoRow[] = [];
    const lote = 1000;
    for (let offset = 0; ; offset += lote) {
      const { data: pagina } = await supabase
        .from("clients")
        .select("id, marca, bandeira, last_contact, csm_id, profiles:csm_id(full_name)")
        .eq("status", "ativo")
        .order("id")
        .range(offset, offset + lote - 1);
      if (!pagina || pagina.length === 0) break;
      ativos.push(...(pagina as AtivoRow[]));
      if (pagina.length < lote) break;
    }

    const setBandeiras = new Set(bandeirasNaPlanilha.map(b => b.trim()));
    const lista: AusenteCliente[] = ativos
      .filter((c) => !c.bandeira || !setBandeiras.has(c.bandeira.trim()))
      .map((c) => {
        const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return {
          id: c.id,
          marca: c.marca,
          bandeira: c.bandeira,
          csm_nome: prof?.full_name ?? "—",
          last_contact: c.last_contact,
          diasSemContato: diasSince(c.last_contact),
        };
      })
      .sort((a, b) => b.diasSemContato - a.diasSemContato);

    setTotalAtivos(ativos.length);
    setAusentes(lista);
    setSelecionados(new Set(lista.map(c => c.id))); // todos marcados por padrão
    setRows(updated);
    setImporting(false);
    setDone(true);
  }

  function toggleSel(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function marcarTodos() { setSelecionados(new Set(ausentes.map(c => c.id))); }
  function desmarcarTodos() { setSelecionados(new Set()); }

  function cancelarPlanilha() {
    setRows([]);
    setDone(false);
    setAusentes([]);
    setInativacaoFeita(false);
    setSelecionados(new Set());
    setFileKey(k => k + 1);
  }

  async function handleInativar() {
    if (selecionados.size === 0) return;
    setInativando(true);
    const ids = [...selecionados];
    // inativa em lotes para não estourar a query
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      await supabase.from("clients").update({ status: "inativo" }).in("id", lote);
    }
    setInativadosCount(ids.length);
    setInativando(false);
    setInativacaoFeita(true);
    setAusentes([]);
  }

  const statusColor: Record<string, string> = {
    pendente: "bg-gray-100 text-gray-600",
    atualizado: "bg-green-100 text-green-700",
    adicionado: "bg-blue-100 text-blue-700",
    ignorado: "bg-yellow-100 text-yellow-700",
    erro: "bg-red-100 text-red-700",
  };

  const summary = {
    atualizados: rows.filter(r => r.status === "atualizado").length,
    adicionados: rows.filter(r => r.status === "adicionado").length,
    ignorados: rows.filter(r => r.status === "ignorado").length,
    erros: rows.filter(r => r.status === "erro").length,
  };

  const pctAusentes = totalAtivos > 0 ? Math.round((ausentes.length / totalAtivos) * 100) : 0;
  const muitos = pctAusentes >= 10;

  return (
    <div className="min-h-screen bg-slate-800">
      <header className="sticky top-0 z-40 bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/machine-logo.png" alt="Machine" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Administração</p>
          <h2 className="text-2xl font-semibold text-white mt-1">Importar carteira</h2>
          <p className="text-gray-400 text-sm mt-1">Adiciona e atualiza clientes. Clientes ausentes da planilha podem ser inativados na etapa de revisão — nada é inativado automaticamente.</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900 text-sm">Modelo de planilha</p>
            <p className="text-xs text-blue-600 mt-0.5">Campos obrigatórios: bandeira, marca, operacao, csm</p>
          </div>
          <a href="/modelo_importacao.csv" download className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">↓ Baixar modelo</a>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="font-medium text-gray-900 mb-4">Selecionar arquivo CSV</h3>
          <input key={fileKey} type="file" accept=".csv" onChange={handleFile} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          <p className="text-xs text-gray-400 mt-2">Colunas: bandeira*, marca*, operacao*, csm*, cluster, plano</p>
        </div>

        {rows.length > 0 && (
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">{rows.length} linhas encontradas</h3>
              {!done && (
                <div className="flex items-center gap-2">
                  <button onClick={cancelarPlanilha} disabled={importing} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 disabled:opacity-50">
                    Cancelar
                  </button>
                  <button onClick={handleImport} disabled={importing} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {importing ? "Importando..." : "Confirmar importação"}
                  </button>
                </div>
              )}
            </div>
            {done && (
              <div className="px-6 py-4 bg-slate-100/70 border-b border-slate-200/70 flex gap-6 text-sm flex-wrap">
                <span className="text-green-700">✓ {summary.atualizados} atualizados</span>
                <span className="text-blue-700">+ {summary.adicionados} adicionados</span>
                <span className="text-yellow-700">⚠ {summary.ignorados} ignorados</span>
                {summary.erros > 0 && <span className="text-red-700">✗ {summary.erros} erros</span>}
              </div>
            )}
            <ul className="divide-y divide-slate-200/60 max-h-96 overflow-y-auto">
              {rows.map((r, i) => (
                <li key={i} className="px-6 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-900">Bandeira {r.bandeira}</span>
                    {r.marca && <span className="text-gray-400 ml-2">· {r.marca}</span>}
                    {r.cluster && <span className="text-gray-400 ml-2">· {r.cluster}</span>}
                    {r.plano && <span className="text-gray-400 ml-2">· {r.plano}</span>}
                    {r.csm && <span className="text-gray-400 ml-2">· {r.csm}</span>}
                    {r.message && <span className="text-gray-400 ml-2">· {r.message}</span>}
                  </div>
                  {r.status && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status]}`}>{r.status}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Etapa de revisão de inativação */}
        {done && !inativacaoFeita && ausentes.length > 0 && (
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/60">
              <h3 className="font-medium text-gray-900">Clientes ativos fora da planilha</h3>
              <p className="text-xs text-gray-500 mt-1">
                {ausentes.length} {ausentes.length === 1 ? "cliente ativo não apareceu" : "clientes ativos não apareceram"} na planilha. Marque quais deseja inativar — nenhum será inativado sem sua confirmação.
              </p>
            </div>

            {muitos && (
              <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
                ⚠️ <strong>Atenção:</strong> isso representa {pctAusentes}% da carteira ativa ({ausentes.length} de {totalAtivos}). Confirme se a planilha está completa antes de inativar.
              </div>
            )}

            <div className="px-6 py-3 border-b border-slate-200/60 flex items-center gap-4 text-xs">
              <button onClick={marcarTodos} className="text-blue-600 hover:text-blue-800 font-medium">Marcar todos</button>
              <button onClick={desmarcarTodos} className="text-gray-500 hover:text-gray-700 font-medium">Desmarcar todos</button>
              <span className="text-gray-400 ml-auto">{selecionados.size} selecionado(s)</span>
            </div>

            <ul className="divide-y divide-slate-200/60 max-h-96 overflow-y-auto">
              {ausentes.map((c) => (
                <li key={c.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selecionados.has(c.id)}
                    onChange={() => toggleSel(c.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900">{c.marca}</span>
                    <span className="text-gray-400 ml-2">Bandeira {c.bandeira ?? "—"}</span>
                    <span className="text-gray-400 ml-2">· {c.csm_nome}</span>
                  </div>
                  <span className={`text-xs shrink-0 ${c.diasSemContato > 60 ? "text-amber-600" : "text-gray-400"}`}>
                    {c.last_contact ? `há ${c.diasSemContato} dias` : "sem contato"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="px-6 py-4 border-t border-slate-200/60 flex items-center justify-end gap-3">
              <button onClick={() => setAusentes([])} className="text-xs text-gray-500 hover:text-gray-700 px-4 py-2">
                Pular (não inativar ninguém)
              </button>
              <button
                onClick={handleInativar}
                disabled={inativando || selecionados.size === 0}
                className="text-xs bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {inativando ? "Inativando..." : `Inativar ${selecionados.size} selecionado(s)`}
              </button>
            </div>
          </div>
        )}

        {inativacaoFeita && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800">
            ✓ {inativadosCount} cliente(s) inativado(s) com sucesso.
          </div>
        )}

        {done && !inativacaoFeita && ausentes.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800">
            ✓ Importação concluída. Nenhum cliente foi inativado.
          </div>
        )}
      </main>
    </div>
  );
}
