"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";

const REQUIRED_FIELDS = ["bandeira", "marca", "csm"];

type ImportRow = {
  bandeira: string;
  marca?: string;
  operacao?: string;
  cluster?: string;
  plano?: string;
  csm?: string;
  status?: string;
  // campos novos
  rede?: string;
  cidade?: string;
  carteira?: string;         // Carteirizado | Reativo
  tipo_central?: string;
  iniciou_operacao?: string;
  alcancou_marco?: string;
  representante_legal?: string;
  telefone?: string;
  email?: string;
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
  const [progresso, setProgresso] = useState("");

  function diasSince(date: string | null): number {
    if (!date) return 9999;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  }

  function mapCarteira(v: string): string | undefined {
    const s = (v ?? "").trim().toUpperCase();
    if (s === "SIM") return "Carteirizado";
    if (s === "REATIVO") return "Reativo";
    return undefined;
  }

  // Localiza a linha do cabeçalho procurando "Código"
  function acharHeader(matriz: unknown[][]): number {
    for (let i = 0; i < Math.min(8, matriz.length); i++) {
      const linha = matriz[i].map(c => String(c ?? "").trim().toLowerCase());
      if (linha.some(c => c === "código" || c === "codigo")) return i;
    }
    return -1;
  }

  function txt(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = String(v).trim();
    return s === "nan" || s === "#ERROR!" ? "" : s;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // Procura a aba "DIVISÃO" (a base de clientes); senão usa a primeira com "Código"
      const nomeAba = wb.SheetNames.find(n => /divis/i.test(n)) ?? wb.SheetNames[0];
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: null });

      const h = acharHeader(matriz);
      if (h < 0) {
        setRows([]); setAnalisado(false); setConcluido(false); setAusentes([]);
        setErroArquivo(`Não encontrei a coluna "Código" na planilha. Confira se é a base de clientes (aba DIVISÃO).`);
        setFileKey(k => k + 1);
        return;
      }

      const headers = matriz[h].map(c => String(c ?? "").trim());
      const col = (nome: string) => headers.findIndex(x => x.toLowerCase() === nome.toLowerCase());
      const idx = {
        codigo: col("Código"), central: col("Central"), responsavel: col("Responsável"),
        servico: col("Serviço"), plano: col("Plano"), status: col("Status"), abcd: col("ABCD"),
        rede: col("Rede"), cidade: col("Cidade registrada"), carteira: col("Carteira?"),
        tipo: col("Tipo de central"), iniciou: col("Iniciou a operação?"), marco: col("Alcançou o marco?"),
        rep: col("Nome Representante Legal"), tel: col("Telefone"), email: col("E-mail"),
      };

      const parsed: ImportRow[] = [];
      for (let i = h + 1; i < matriz.length; i++) {
        const linha = matriz[i];
        if (!linha || linha.every(c => c === null || String(c).trim() === "")) continue;
        const bandeira = txt(linha[idx.codigo]);
        if (!bandeira) continue;
        parsed.push({
          bandeira,
          marca: txt(linha[idx.central]),
          csm: txt(linha[idx.responsavel]),
          operacao: txt(linha[idx.servico]),
          plano: txt(linha[idx.plano]),
          status: txt(linha[idx.status]),
          cluster: txt(linha[idx.abcd]),
          rede: txt(linha[idx.rede]),
          cidade: txt(linha[idx.cidade]),
          carteira: mapCarteira(txt(linha[idx.carteira])),
          tipo_central: txt(linha[idx.tipo]),
          iniciou_operacao: txt(linha[idx.iniciou]),
          alcancou_marco: txt(linha[idx.marco]),
          representante_legal: txt(linha[idx.rep]),
          telefone: txt(linha[idx.tel]),
          email: txt(linha[idx.email]),
        });
      }

      if (parsed.length === 0) {
        setRows([]);
        setErroArquivo("O arquivo foi lido, mas nenhuma linha válida foi encontrada (verifique se há dados além do cabeçalho).");
        setFileKey(k => k + 1);
        return;
      }

      setErroArquivo("");
      setRows(parsed);
      setAnalisado(false);
      setConcluido(false);
      setAusentes([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRows([]); setErroArquivo(`Não consegui ler o arquivo: ${msg}`);
      setFileKey(k => k + 1);
    }
  }

  // Etapa 1: analisar SEM gravar nada
  async function handleAnalisar() {
    setAnalisando(true);

    const { data: p } = await supabase.from("profiles").select("id, full_name");
    const profs = p ?? [];

    // Casamento tolerante de CSM (planilha -> profile):
    // 1) match exato normalizado (ignora acento/caixa/espaço)
    // 2) se não achar, match por PRIMEIRO NOME, mas só quando único (sem ambiguidade)
    // Resolve casos como "Augusto Silveira" (planilha) vs "Augusto Silva" (banco).
    const normNome = (s: string) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
    function acharCsm(nomePlanilha: string): { id: string; full_name: string } | undefined {
      const alvo = normNome(nomePlanilha);
      if (!alvo) return undefined;
      // 1) exato
      const exato = profs.find(pr => normNome(pr.full_name) === alvo);
      if (exato) return exato;
      // 2) primeiro nome único
      const primeiroAlvo = alvo.split(" ")[0];
      const candidatos = profs.filter(pr => normNome(pr.full_name).split(" ")[0] === primeiroAlvo);
      return candidatos.length === 1 ? candidatos[0] : undefined;
    }

    const analisadas: ImportRow[] = [];
    const bandeirasNaPlanilha: string[] = [];

    // Busca TODOS os clientes de uma vez (paginado) e casa em memória.
    // Evita 1 query por linha da planilha (que travava com mais de mil clientes).
    const existentesPorBandeira: Record<string, string> = {};
    let ef = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, bandeira")
        .range(ef, ef + 999);
      if (error || !data || data.length === 0) break;
      for (const c of data as { id: string; bandeira: string | null }[]) {
        const b = (c.bandeira ?? "").trim();
        if (b && !existentesPorBandeira[b]) existentesPorBandeira[b] = c.id;
      }
      if (data.length < 1000) break;
      ef += 1000;
    }

    for (const row of rows) {
      const existingId = existentesPorBandeira[(row.bandeira ?? "").trim()];
      const profile = acharCsm(row.csm ?? "");

      if (existingId) {
        bandeirasNaPlanilha.push(row.bandeira);
        analisadas.push({ ...row, acao: "atualizar", _existingId: existingId, _csmId: profile?.id ?? null });
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

    // Monta os objetos de update/insert (sem ir ao banco ainda)
    const paraAtualizar: { row: ImportRow; obj: Record<string, string> }[] = [];
    const paraAdicionar: { row: ImportRow; obj: Record<string, string> }[] = [];

    for (const row of rows) {
      if (row.acao === "atualizar" && row._existingId) {
        const o: Record<string, string> = { status: "ativo" };
        if (row.marca) o.marca = row.marca;
        if (row.operacao) o.operacao = row.operacao;
        if (row.cluster) o.cluster = row.cluster;
        if (row.plano) o.plano = row.plano;
        if (row._csmId) o.csm_id = row._csmId;
        if (row.rede) o.rede = row.rede;
        if (row.cidade) o.cidade = row.cidade;
        if (row.carteira) o.carteira = row.carteira;
        if (row.tipo_central) o.tipo_central = row.tipo_central;
        if (row.iniciou_operacao) o.iniciou_operacao = row.iniciou_operacao;
        if (row.alcancou_marco) o.alcancou_marco = row.alcancou_marco;
        if (row.representante_legal) o.representante_legal = row.representante_legal;
        if (row.telefone) o.telefone = row.telefone;
        if (row.email) o.email = row.email;
        paraAtualizar.push({ row, obj: o });
      } else if (row.acao === "adicionar" && row._csmId) {
        const o: Record<string, string> = {
          marca: row.marca ?? "", bandeira: row.bandeira, operacao: row.operacao ?? "",
          csm_id: row._csmId, status: "ativo",
        };
        if (row.cluster) o.cluster = row.cluster;
        if (row.plano) o.plano = row.plano;
        if (row.rede) o.rede = row.rede;
        if (row.cidade) o.cidade = row.cidade;
        if (row.carteira) o.carteira = row.carteira;
        if (row.tipo_central) o.tipo_central = row.tipo_central;
        if (row.iniciou_operacao) o.iniciou_operacao = row.iniciou_operacao;
        if (row.alcancou_marco) o.alcancou_marco = row.alcancou_marco;
        if (row.representante_legal) o.representante_legal = row.representante_legal;
        if (row.telefone) o.telefone = row.telefone;
        if (row.email) o.email = row.email;
        paraAdicionar.push({ row, obj: o });
      } else {
        gravadas.push({ ...row, resultado: "ignorado", message: row.motivo });
      }
    }

    // Adicionar: inserts em lote (um insert de vários registros por vez)
    const LOTE = 200;
    for (let i = 0; i < paraAdicionar.length; i += LOTE) {
      const grupo = paraAdicionar.slice(i, i + LOTE);
      setProgresso(`Adicionando ${Math.min(i + LOTE, paraAdicionar.length)} de ${paraAdicionar.length}...`);
      const { error } = await supabase.from("clients").insert(grupo.map(g => g.obj));
      grupo.forEach(g => gravadas.push({ ...g.row, resultado: error ? "erro" : "adicionado", message: error?.message }));
    }

    // Atualizar: em paralelo, em lotes (cada update é individual, mas rodam juntos)
    for (let i = 0; i < paraAtualizar.length; i += LOTE) {
      const grupo = paraAtualizar.slice(i, i + LOTE);
      setProgresso(`Atualizando ${Math.min(i + LOTE, paraAtualizar.length)} de ${paraAtualizar.length}...`);
      const resultados = await Promise.all(
        grupo.map(g => supabase.from("clients").update(g.obj).eq("id", g.row._existingId!).then(r => r.error))
      );
      grupo.forEach((g, j) => gravadas.push({ ...g.row, resultado: resultados[j] ? "erro" : "atualizado", message: resultados[j]?.message }));
    }

    // Inativar os selecionados (em lotes)
    const ids = [...selecionados];
    for (let i = 0; i < ids.length; i += 100) {
      setProgresso(`Inativando ausentes...`);
      await supabase.from("clients").update({ status: "inativo" }).in("id", ids.slice(i, i + 100));
    }
    setInativadosCount(ids.length);

    setProgresso("");
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/machine-logo.png" alt="Machine" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-gray-900">Machine <span className="font-normal text-gray-400">· Customer Success</span></span>
        </div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">Administração</p>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">Importar carteira</h2>
          <p className="text-gray-400 text-sm mt-1">Selecione a planilha e clique em Analisar para ver o que será alterado. Nada é gravado até você confirmar.</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <p className="font-medium text-blue-900 text-sm">Formato esperado</p>
          <p className="text-xs text-blue-700 mt-1">
            Planilha de distribuição (.xlsx) com a aba <span className="font-medium">DIVISÃO</span>, contendo as colunas:
            Código, Central, Responsável, Serviço, Plano, Status, ABCD, Rede, Tipo de central,
            Cidade registrada, Carteira?, e os dados de contato (Nome Representante Legal, Telefone, E-mail).
            O casamento é feito pelo <span className="font-medium">Código</span> (= bandeira do cliente).
          </p>
        </div>

        <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="font-medium text-gray-900 mb-4">Selecionar arquivo CSV</h3>
          <input key={fileKey} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
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
            <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/60">
                <h3 className="font-medium text-gray-900">Prévia — o que será alterado</h3>
                <div className="flex gap-6 text-sm flex-wrap mt-2">
                  <span className="text-blue-700">+ {previa.adicionar} a adicionar</span>
                  <span className="text-green-700">✓ {previa.atualizar} a atualizar</span>
                  <span className="text-yellow-700">⚠ {previa.ignorar} a ignorar</span>
                </div>
              </div>
              <div className="px-6 py-3 border-b border-slate-200/60">
                <input type="text" placeholder="Buscar por marca ou bandeira..." value={buscaPrevia} onChange={e => setBuscaPrevia(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white dark:bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

            <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
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
                    <input type="text" placeholder="Buscar por marca ou bandeira..." value={buscaAusentes} onChange={e => setBuscaAusentes(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white dark:bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-600">
                Ao confirmar: <strong>{previa.adicionar}</strong> adicionados, <strong>{previa.atualizar}</strong> atualizados
                {selecionados.size > 0 && <> e <strong className="text-red-600">{selecionados.size}</strong> inativados</>}.
              </p>
              <div className="flex items-center gap-2">
                <button onClick={cancelar} disabled={gravando} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 disabled:opacity-50">Cancelar</button>
                <button onClick={handleConfirmar} disabled={gravando} className="text-xs bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {gravando ? (progresso || "Gravando...") : "Confirmar e aplicar"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Resultado final */}
        {concluido && (
          <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
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
