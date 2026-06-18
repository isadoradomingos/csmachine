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
  // Resultado da análise (prévia, antes de gravar)
  acao?: "adicionar" | "atualizar" | "ignorar";
  motivo?: string;
  // Resultado da gravação
  resultado?: "adicionado" | "atualizado" | "ignorado" | "erro";
  message?: string;
  _existingId?: string | null;
  _csmId?: string | null;
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
  const [fileKey, setFileKey] = useState(0);

  const [analisando, setAnalisando] = useState(false);
  const [analisado, setAnalisado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const [ausentes, setAusentes] = useState<AusenteCliente[]>([]);
  const [totalAtivos, setTotalAtivos] = useState(0);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [inativadosCount, setInativadosCount] = useState(0);
  const [buscaPrevia, setBuscaPrevia] = useState("");
  const [buscaAusentes, setBuscaAusentes] = useState("");
  const [erroArquivo, setErroArquivo] = useState("");

  function diasSince(date: string | null): number {
    if (!date) return 9999;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());

      // Valida o cabeçalho: a planilha de carteira precisa ter as colunas obrigatórias.
      // Isso evita subir o arquivo errado (ex: um export do Pipefy) nesta tela.
      const faltando = REQUIRED_FIELDS.filter(c => !headers.includes(c));
      if (faltando.length > 0) {
        setRows([]);
        setAnalisado(false);
        setConcluido(false);
        setAusentes([]);
        setErroArquivo(
          `Este arquivo não parece ser uma planilha de carteira. Faltam as colunas: ${faltando.join(", ")}. ` +
          `O cabeçalho deve conter: ${REQUIRED_FIELDS.join(", ")} (e opcionalmente cluster, plano).`
        );
        setFileKey(k => k + 1);
        return;
      }

      setErroArquivo("");
      const parsed: ImportRow[] = lines.slice(1).map((line: string) => {
        const values = line.split(",").map((v: string) => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => { obj[h] = values[i] ?? ""; });
        return obj as unknown as ImportRow;
      }).filter((r: ImportRow) => r.bandeira);

      if (parsed.length === 0) {
        setRows([]);
        setErroArquivo("O arquivo foi lido, mas nenhuma linha válida foi encontrada (verifique se há dados além do cabeçalho).");
        setFileKey(k => k + 1);
        return;
      }

      setRows(parsed);
      setAnalisado(false);
      setConcluido(false);
      setAusentes([]);
    });
  }

  // Etapa 1: analisar SEM gravar nada
  async function handleAnalisar() {
    setAnalisando(true);

    const { data: p } = await supabase.from("profiles").select("id, full_name");
    const profs = p ?? [];

    const analisadas: ImportRow[] = [];
    const bandeirasNaPlanilha: string[] = [];

    for (const row of rows) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("bandeira", row.bandeira)
        .maybeSingle();
      const profile = profs.find((pr) => pr.full_name.toLowerCase() === (row.csm ?? "").toLowerCase());

      if (existing) {
        bandeirasNaPlanilha.push(row.bandeira);
        analisadas.push({ ...row, acao: "atualizar", _existingId: existing.id, _csmId: profile?.id ?? null });
      } else {
        const missing = REQUIRED_FIELDS.filter((f: string) => !row[f as keyof ImportRow]);
        if (missing.length > 0 || !profile) {
          analisadas.push({ ...row, acao: "ignorar", motivo: !profile ? "CSM não encontrado" : "Campos obrigatórios faltando" });
          continue;
        }
        bandeirasNaPlanilha.push(row.bandeira);
        analisadas.push({ ...row, acao: "adicionar", _csmId: profile.id });
      }
    }

    // Buscar ativos em lotes (sem join, para não falhar silenciosamente)
    type AtivoRow = { id: string; marca: string; bandeira: string | null; last_contact: string | null; csm_id: string | null };
    const ativos: AtivoRow[] = [];
    const lote = 1000;
    for (let offset = 0; ; offset += lote) {
      const { data: pagina, error } = await supabase
        .from("clients")
        .select("id, marca, bandeira, last_contact, csm_id")
        .eq("status", "ativo")
        .order("id")
        .range(offset, offset + lote - 1);
      if (error) { console.error("Erro ao buscar ativos:", error); break; }
      if (!pagina || pagina.length === 0) break;
      ativos.push(...(pagina as AtivoRow[]));
      if (pagina.length < lote) break;
    }

    const nomePorId: Record<string, string> = {};
    profs.forEach(pr => { nomePorId[pr.id] = pr.full_name; });

    const setBandeiras = new Set(bandeirasNaPlanilha.map(b => b.trim()));
    const lista: AusenteCliente[] = ativos
      .filter((c) => !c.bandeira || !setBandeiras.has(c.bandeira.trim()))
      .map((c) => ({
        id: c.id,
        marca: c.marca,
        bandeira: c.bandeira,
        csm_nome: (c.csm_id && nomePorId[c.csm_id]) ? nomePorId[c.csm_id] : "—",
        last_contact: c.last_contact,
        diasSemContato: diasSince(c.last_contact),
      }))
      .sort((a, b) => b.diasSemContato - a.diasSemContato);

    setTotalAtivos(ativos.length);
    setRows(analisadas);
    setAusentes(lista);
    setSelecionados(new Set(lista.map(c => c.id)));
    setAnalisado(true);
    setAnalisando(false);
  }

  // Etapa 2: gravar tudo (adicionar/atualizar + inativar selecionados)
  async function handleConfirmar() {
    setGravando(true);
    const gravadas: ImportRow[] = [];

    for (const row of rows) {
      try {
        if (row.acao === "atualizar" && row._existingId) {
          const updateObj: Record<string, string> = { status: "ativo" };
          if (row.marca) updateObj.marca = row.marca;
          if (row.operacao && OPERACOES.includes(row.operacao)) updateObj.operacao = row.operacao;
          if (row.cluster && CLUSTERS.includes(row.cluster)) updateObj.cluster = row.cluster;
          if (row.plano && PLANOS.includes(row.plano)) updateObj.plano = row.plano;
          if (row._csmId) updateObj.csm_id = row._csmId;
          await supabase.from("clients").update(updateObj).eq("id", row._existingId);
          gravadas.push({ ...row, resultado: "atualizado" });
        } else if (row.acao === "adicionar" && row._csmId) {
          const newClient: Record<string, string> = {
            marca: row.marca ?? "",
            bandeira: row.bandeira,
            operacao: row.operacao ?? "",
            csm_id: row._csmId,
            status: "ativo",
          };
          if (row.cluster && CLUSTERS.includes(row.cluster)) newClient.cluster = row.cluster;
          if (row.plano && PLANOS.includes(row.plano)) newClient.plano = row.plano;
          await supabase.from("clients").insert(newClient);
          gravadas.push({ ...row, resultado: "adicionado" });
        } else {
          gravadas.push({ ...row, resultado: "ignorado", message: row.motivo });
        }
      } catch {
        gravadas.push({ ...row, resultado: "erro", message: "Erro ao processar" });
      }
    }

    // Inativar os selecionados (em lotes)
    const ids = [...selecionados];
    for (let i = 0; i < ids.length; i += 100) {
      await supabase.from("clients").update({ status: "inativo" }).in("id", ids.slice(i, i + 100));
    }
    setInativadosCount(ids.length);

    setRows(gravadas);
    setGravando(false);
    setConcluido(true);
    setAusentes([]);
  }

  function toggleSel(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function marcarTodos() {
    setSelecionados(prev => {
      const next = new Set(prev);
      ausentesFiltrados.forEach(c => next.add(c.id));
      return next;
    });
  }
  function desmarcarTodos() {
    setSelecionados(prev => {
      const next = new Set(prev);
      ausentesFiltrados.forEach(c => next.delete(c.id));
      return next;
    });
  }

  function cancelar() {
    setRows([]);
    setAnalisado(false);
    setConcluido(false);
    setAusentes([]);
    setSelecionados(new Set());
    setErroArquivo("");
    setFileKey(k => k + 1);
  }

  const acaoColor: Record<string, string> = {
    adicionar: "bg-blue-100 text-blue-700",
    atualizar: "bg-green-100 text-green-700",
    ignorar: "bg-yellow-100 text-yellow-700",
  };
  const resultadoColor: Record<string, string> = {
    adicionado: "bg-blue-100 text-blue-700",
    atualizado: "bg-green-100 text-green-700",
    ignorado: "bg-yellow-100 text-yellow-700",
    erro: "bg-red-100 text-red-700",
  };

  const previa = {
    adicionar: rows.filter(r => r.acao === "adicionar").length,
    atualizar: rows.filter(r => r.acao === "atualizar").length,
    ignorar: rows.filter(r => r.acao === "ignorar").length,
  };
  const resumoFinal = {
    adicionados: rows.filter(r => r.resultado === "adicionado").length,
    atualizados: rows.filter(r => r.resultado === "atualizado").length,
    ignorados: rows.filter(r => r.resultado === "ignorado").length,
    erros: rows.filter(r => r.resultado === "erro").length,
  };

  const pctAusentes = totalAtivos > 0 ? Math.round((ausentes.length / totalAtivos) * 100) : 0;
  const muitos = pctAusentes >= 10;

  const rowsFiltradas = rows.filter(r => {
    if (!buscaPrevia.trim()) return true;
    const q = buscaPrevia.toLowerCase();
    return (r.marca ?? "").toLowerCase().includes(q) || (r.bandeira ?? "").includes(buscaPrevia.trim());
  });
  const ausentesFiltrados = ausentes.filter(c => {
    if (!buscaAusentes.trim()) return true;
    const q = buscaAusentes.toLowerCase();
    return c.marca.toLowerCase().includes(q) || (c.bandeira ?? "").includes(buscaAusentes.trim());
  });

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
          <p className="text-gray-400 text-sm mt-1">Selecione a planilha e clique em Analisar para ver o que será alterado. Nada é gravado até você confirmar.</p>
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
          {erroArquivo && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ⚠️ {erroArquivo}
            </div>
          )}
          {rows.length > 0 && !analisado && !concluido && (
            <div className="mt-4 flex items-center gap-2">
              <button onClick={handleAnalisar} disabled={analisando} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {analisando ? "Analisando..." : `Analisar ${rows.length} linhas`}
              </button>
              <button onClick={cancelar} disabled={analisando} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 disabled:opacity-50">Cancelar</button>
            </div>
          )}
        </div>

        {/* Prévia da análise (antes de gravar) */}
        {analisado && !concluido && (
          <>
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/60">
                <h3 className="font-medium text-gray-900">Prévia — o que será alterado</h3>
                <div className="flex gap-6 text-sm flex-wrap mt-2">
                  <span className="text-blue-700">+ {previa.adicionar} a adicionar</span>
                  <span className="text-green-700">✓ {previa.atualizar} a atualizar</span>
                  <span className="text-yellow-700">⚠ {previa.ignorar} a ignorar</span>
                </div>
              </div>
              <div className="px-6 py-3 border-b border-slate-200/60">
                <input type="text" placeholder="Buscar por marca ou bandeira..." value={buscaPrevia} onChange={e => setBuscaPrevia(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <ul className="divide-y divide-slate-200/60 max-h-72 overflow-y-auto">
                {rowsFiltradas.map((r, i) => (
                  <li key={i} className="px-6 py-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">Bandeira {r.bandeira}</span>
                      {r.marca && <span className="text-gray-400 ml-2">· {r.marca}</span>}
                      {r.csm && <span className="text-gray-400 ml-2">· {r.csm}</span>}
                      {r.motivo && <span className="text-gray-400 ml-2">· {r.motivo}</span>}
                    </div>
                    {r.acao && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acaoColor[r.acao]}`}>{r.acao}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/60">
                <h3 className="font-medium text-gray-900">Clientes ativos fora da planilha</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {ausentes.length === 0
                    ? (totalAtivos === 0 ? "Nenhum cliente ativo encontrado na base." : "Todos os clientes ativos estão na planilha — nenhum a inativar.")
                    : `${ausentes.length} ${ausentes.length === 1 ? "cliente ativo não apareceu" : "clientes ativos não apareceram"} na planilha. Marque quais deseja inativar — só os marcados serão inativados ao confirmar.`}
                </p>
              </div>

              {muitos && ausentes.length > 0 && (
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
                  ⚠️ <strong>Atenção:</strong> isso representa {pctAusentes}% da carteira ativa ({ausentes.length} de {totalAtivos}). Confirme se a planilha está completa antes de inativar.
                </div>
              )}

              {ausentes.length > 0 && (
                <>
                  <div className="px-6 py-3 border-b border-slate-200/60 flex items-center gap-4 text-xs">
                    <button onClick={marcarTodos} className="text-blue-600 hover:text-blue-800 font-medium">Marcar {buscaAusentes ? "filtrados" : "todos"}</button>
                    <button onClick={desmarcarTodos} className="text-gray-500 hover:text-gray-700 font-medium">Desmarcar {buscaAusentes ? "filtrados" : "todos"}</button>
                    <span className="text-gray-400 ml-auto">{selecionados.size} selecionado(s)</span>
                  </div>
                  <div className="px-6 py-3 border-b border-slate-200/60">
                    <input type="text" placeholder="Buscar por marca ou bandeira..." value={buscaAusentes} onChange={e => setBuscaAusentes(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <ul className="divide-y divide-slate-200/60 max-h-72 overflow-y-auto">
                    {ausentesFiltrados.length === 0 ? (
                      <li className="px-6 py-6 text-center text-sm text-gray-400">Nenhum cliente encontrado para &quot;{buscaAusentes}&quot;.</li>
                    ) : ausentesFiltrados.map((c) => (
                      <li key={c.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                        <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => toggleSel(c.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" />
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
                </>
              )}
            </div>

            {/* Barra de confirmação final */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-600">
                Ao confirmar: <strong>{previa.adicionar}</strong> adicionados, <strong>{previa.atualizar}</strong> atualizados
                {selecionados.size > 0 && <> e <strong className="text-red-600">{selecionados.size}</strong> inativados</>}.
              </p>
              <div className="flex items-center gap-2">
                <button onClick={cancelar} disabled={gravando} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 disabled:opacity-50">Cancelar</button>
                <button onClick={handleConfirmar} disabled={gravando} className="text-xs bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {gravando ? "Gravando..." : "Confirmar e aplicar"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Resultado final */}
        {concluido && (
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/60">
              <h3 className="font-medium text-gray-900">Importação concluída</h3>
              <div className="flex gap-6 text-sm flex-wrap mt-2">
                <span className="text-blue-700">+ {resumoFinal.adicionados} adicionados</span>
                <span className="text-green-700">✓ {resumoFinal.atualizados} atualizados</span>
                <span className="text-yellow-700">⚠ {resumoFinal.ignorados} ignorados</span>
                {resumoFinal.erros > 0 && <span className="text-red-700">✗ {resumoFinal.erros} erros</span>}
                <span className="text-red-600">⊘ {inativadosCount} inativados</span>
              </div>
            </div>
            <ul className="divide-y divide-slate-200/60 max-h-72 overflow-y-auto">
              {rows.map((r, i) => (
                <li key={i} className="px-6 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-900">Bandeira {r.bandeira}</span>
                    {r.marca && <span className="text-gray-400 ml-2">· {r.marca}</span>}
                    {r.message && <span className="text-gray-400 ml-2">· {r.message}</span>}
                  </div>
                  {r.resultado && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resultadoColor[r.resultado]}`}>{r.resultado}</span>}
                </li>
              ))}
            </ul>
            <div className="px-6 py-4 border-t border-slate-200/60">
              <button onClick={cancelar} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Nova importação</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
