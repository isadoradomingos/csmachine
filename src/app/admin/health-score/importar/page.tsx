"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Meses esperados na planilha do Augusto (formato fin_AAAA_MM / canc_AAAA_MM)
// A validação abaixo detecta dinamicamente, mas exigimos ao menos estes campos base.
const CAMPOS_BASE = ["cod_interno", "nome", "status_bandeira", "plano", "operacao", "tipo"];

type CentralParsed = {
  cod_interno: string;
  nome: string;
  rede: string;
  operacao: string;
  plano: string;
  tipo: string;
  status_bandeira: string;
  data_ativa: string | null;
  data_cancelada: string | null;
  mensais: { mes: string; finalizadas: number | null; canceladas: number | null }[];
};

type RedeResumo = { rede: string; centrais: number; operacoes: string; matriz: string };

// Regra de agrupamento de rede (combinada com a usuária):
// - nomes que começam com "UN " => rede "Urbano Norte"
// - senão, o nome-base antes do primeiro hífen
function inferirRede(nome: string): string {
  const n = (nome ?? "").trim();
  if (n.toUpperCase().startsWith("UN ")) return "Urbano Norte";
  for (const sep of [" - ", " – ", "-", "–"]) {
    const i = n.indexOf(sep);
    if (i > 0) return n.slice(0, i).trim();
  }
  return n;
}

// Número no formato BR: "3.231" -> 3231 ; "1.011" -> 1011 ; NULL/-/vazio -> null
function parseNumBR(v: string): number | null {
  const s = (v ?? "").trim();
  if (s === "" || s.toUpperCase() === "NULL" || s === "-") return null;
  const limpo = s.replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

// Data: aceita AAAA-MM-DD; NULL/vazio -> null
function parseData(v: string): string | null {
  const s = (v ?? "").trim();
  if (s === "" || s.toUpperCase() === "NULL") return null;
  return s;
}

// "fin_2025_06" -> "2025-06-01"
function mesColParaData(sufixo: string): string {
  const [ano, mes] = sufixo.split("_");
  return `${ano}-${mes}-01`;
}

export default function ImportarHealthScore() {
  const router = useRouter();
  const [centrais, setCentrais] = useState<CentralParsed[]>([]);
  const [redes, setRedes] = useState<RedeResumo[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [erroArquivo, setErroArquivo] = useState("");
  const [analisado, setAnalisado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [buscaRede, setBuscaRede] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroArquivo("");
    setAnalisado(false);
    setConcluido(false);

    file.text().then(text => {
      // Trata \r\n e \r
      const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
      if (lines.length < 2) {
        setErroArquivo("O arquivo parece vazio ou só tem cabeçalho.");
        setFileKey(k => k + 1);
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim());
      const headersLower = headers.map(h => h.toLowerCase());

      // Valida campos base (aceita variações de acento/caixa nos nomes conhecidos)
      const mapaCabecalho: Record<string, number> = {};
      headersLower.forEach((h, i) => { mapaCabecalho[h] = i; });

      // Localiza colunas base por nome flexível
      function acharCol(possiveis: string[]): number {
        for (const p of possiveis) {
          const i = headersLower.indexOf(p);
          if (i !== -1) return i;
        }
        return -1;
      }
      const idx = {
        cod: acharCol(["cod_interno"]),
        nome: acharCol(["nome"]),
        status: acharCol(["status_bandeira", "status"]),
        dataAtiva: acharCol(["data ativa", "data_ativa"]),
        dataCanc: acharCol(["data cancelada", "data_cancelada"]),
        plano: acharCol(["plano"]),
        operacao: acharCol(["operacao", "operação"]),
        tipo: acharCol(["tipo"]),
      };

      const faltando = CAMPOS_BASE.filter(c => {
        if (c === "cod_interno") return idx.cod === -1;
        if (c === "nome") return idx.nome === -1;
        if (c === "status_bandeira") return idx.status === -1;
        if (c === "plano") return idx.plano === -1;
        if (c === "operacao") return idx.operacao === -1;
        if (c === "tipo") return idx.tipo === -1;
        return false;
      });
      if (faltando.length > 0) {
        setErroArquivo(
          `Este arquivo não parece ser a planilha de dados do Health Score. ` +
          `Faltam as colunas: ${faltando.join(", ")}. Esperado: cod_interno, nome, status_bandeira, Plano, Operacao, Tipo e colunas fin_/canc_ por mês.`
        );
        setCentrais([]);
        setFileKey(k => k + 1);
        return;
      }

      // Detecta as colunas mensais fin_AAAA_MM e canc_AAAA_MM
      const mesesFin: { col: number; mesData: string }[] = [];
      const mesesCanc: Record<string, number> = {};
      headersLower.forEach((h, i) => {
        const mFin = h.match(/^fin_(\d{4}_\d{2})$/);
        const mCanc = h.match(/^canc_(\d{4}_\d{2})$/);
        if (mFin) mesesFin.push({ col: i, mesData: mesColParaData(mFin[1]) });
        if (mCanc) mesesCanc[mesColParaData(mCanc[1])] = i;
      });

      if (mesesFin.length === 0) {
        setErroArquivo("Não encontrei colunas mensais (fin_AAAA_MM). Verifique o formato da planilha.");
        setCentrais([]);
        setFileKey(k => k + 1);
        return;
      }

      const parsed: CentralParsed[] = [];
      for (const line of lines.slice(1)) {
        const vals = line.split(",");
        const cod = (vals[idx.cod] ?? "").trim();
        const nome = (vals[idx.nome] ?? "").trim();
        if (!cod || !nome) continue;

        const mensais = mesesFin.map(({ col, mesData }) => ({
          mes: mesData,
          finalizadas: parseNumBR(vals[col] ?? ""),
          canceladas: parseNumBR(vals[mesesCanc[mesData]] ?? ""),
        }));

        parsed.push({
          cod_interno: cod,
          nome,
          rede: inferirRede(nome),
          operacao: (vals[idx.operacao] ?? "").trim(),
          plano: (vals[idx.plano] ?? "").trim(),
          tipo: (vals[idx.tipo] ?? "").trim(),
          status_bandeira: (vals[idx.status] ?? "").trim().toUpperCase(),
          data_ativa: idx.dataAtiva !== -1 ? parseData(vals[idx.dataAtiva] ?? "") : null,
          data_cancelada: idx.dataCanc !== -1 ? parseData(vals[idx.dataCanc] ?? "") : null,
          mensais,
        });
      }

      if (parsed.length === 0) {
        setErroArquivo("O arquivo foi lido, mas nenhuma central válida foi encontrada.");
        setCentrais([]);
        setFileKey(k => k + 1);
        return;
      }

      // Monta o resumo por rede (para revisão)
      const mapaRede: Record<string, { centrais: number; ops: Set<string>; matriz: string }> = {};
      for (const c of parsed) {
        if (!mapaRede[c.rede]) mapaRede[c.rede] = { centrais: 0, ops: new Set(), matriz: "" };
        mapaRede[c.rede].centrais += 1;
        if (c.operacao) mapaRede[c.rede].ops.add(c.operacao);
        if (c.tipo === "Matriz" && !mapaRede[c.rede].matriz) mapaRede[c.rede].matriz = c.nome;
      }
      const resumo: RedeResumo[] = Object.entries(mapaRede)
        .map(([rede, v]) => ({ rede, centrais: v.centrais, operacoes: [...v.ops].join(", "), matriz: v.matriz || "—" }))
        .sort((a, b) => b.centrais - a.centrais);

      setCentrais(parsed);
      setRedes(resumo);
      setAnalisado(true);
    });
  }

  async function handleConfirmar() {
    setGravando(true);
    setProgresso("Gravando centrais...");

    // 1) Upsert das centrais (em lotes)
    const centraisRows = centrais.map(c => ({
      cod_interno: c.cod_interno,
      nome: c.nome,
      rede: c.rede,
      operacao: c.operacao,
      plano: c.plano || null,
      tipo: c.tipo || null,
      status_bandeira: c.status_bandeira || null,
      data_ativa: c.data_ativa,
      data_cancelada: c.data_cancelada,
    }));

    for (let i = 0; i < centraisRows.length; i += 200) {
      const lote = centraisRows.slice(i, i + 200);
      const { error } = await supabase.from("hs_centrais").upsert(lote, { onConflict: "cod_interno" });
      if (error) { setProgresso(`Erro ao gravar centrais: ${error.message}`); setGravando(false); return; }
      setProgresso(`Gravando centrais... ${Math.min(i + 200, centraisRows.length)}/${centraisRows.length}`);
    }

    // 2) Upsert dos dados mensais (só meses com algum valor; "substituir por mês")
    const mensaisRows: { cod_interno: string; mes: string; finalizadas: number | null; canceladas: number | null }[] = [];
    for (const c of centrais) {
      for (const m of c.mensais) {
        if (m.finalizadas !== null || m.canceladas !== null) {
          mensaisRows.push({ cod_interno: c.cod_interno, mes: m.mes, finalizadas: m.finalizadas, canceladas: m.canceladas });
        }
      }
    }

    for (let i = 0; i < mensaisRows.length; i += 500) {
      const lote = mensaisRows.slice(i, i + 500);
      const { error } = await supabase.from("hs_centrais_mensal").upsert(lote, { onConflict: "cod_interno,mes" });
      if (error) { setProgresso(`Erro ao gravar dados mensais: ${error.message}`); setGravando(false); return; }
      setProgresso(`Gravando dados mensais... ${Math.min(i + 500, mensaisRows.length)}/${mensaisRows.length}`);
    }

    setGravando(false);
    setConcluido(true);
    setProgresso("");
  }

  function cancelar() {
    setCentrais([]);
    setRedes([]);
    setAnalisado(false);
    setConcluido(false);
    setErroArquivo("");
    setFileKey(k => k + 1);
  }

  const totalMensais = centrais.reduce((s, c) => s + c.mensais.filter(m => m.finalizadas !== null || m.canceladas !== null).length, 0);
  const redesFiltradas = redes.filter(r => !buscaRede || r.rede.toLowerCase().includes(buscaRede.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-800">
      <header className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="font-semibold text-gray-900">Importar dados do Health Score</h1>
        <button onClick={() => router.push("/admin")} className="text-sm text-gray-500 hover:text-gray-700">← Voltar ao admin</button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Explicação */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-900 font-medium mb-1">Como funciona</p>
          <p className="text-xs text-blue-800">
            Suba a planilha de dados das centrais (CSV do Augusto, com colunas fin_/canc_ por mês).
            O sistema lê os dados, infere as redes pelo nome e mostra uma prévia para você revisar antes de gravar.
            Nada é salvo até você confirmar. Reimportar atualiza apenas os meses presentes no arquivo.
          </p>
        </div>

        {/* Upload */}
        {!analisado && !concluido && (
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
            <p className="text-sm text-gray-600 mb-4">Selecione o arquivo CSV com os dados das centrais</p>
            <input
              key={fileKey}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="block mx-auto text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
            />
            {erroArquivo && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{erroArquivo}</p>
            )}
          </div>
        )}

        {/* Revisão */}
        {analisado && !concluido && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4">
                <p className="text-xs text-gray-400">Centrais</p>
                <p className="text-2xl font-semibold text-gray-900">{centrais.length}</p>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4">
                <p className="text-xs text-gray-400">Redes formadas</p>
                <p className="text-2xl font-semibold text-gray-900">{redes.length}</p>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4">
                <p className="text-xs text-gray-400">Registros mensais</p>
                <p className="text-2xl font-semibold text-gray-900">{totalMensais}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Revise as redes abaixo.</span> Elas foram agrupadas pelo nome
                (ex: &quot;UN ...&quot; → Urbano Norte; senão, o nome antes do hífen). Se notar duas linhas que deveriam
                ser a mesma rede (ex: grafias diferentes), o ideal é corrigir na planilha e reimportar antes de gravar.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200/60">
                <input
                  value={buscaRede}
                  onChange={e => setBuscaRede(e.target.value)}
                  placeholder="Buscar rede..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr className="text-left text-xs text-gray-500">
                      <th className="px-5 py-2 font-medium">Rede</th>
                      <th className="px-5 py-2 font-medium">Centrais</th>
                      <th className="px-5 py-2 font-medium">Operação</th>
                      <th className="px-5 py-2 font-medium">Matriz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60">
                    {redesFiltradas.map(r => (
                      <tr key={r.rede} className="hover:bg-slate-100/60">
                        <td className="px-5 py-2 font-medium text-gray-900">{r.rede}</td>
                        <td className="px-5 py-2 text-gray-600">{r.centrais}</td>
                        <td className="px-5 py-2 text-gray-600">{r.operacoes}</td>
                        <td className="px-5 py-2 text-gray-500 text-xs">{r.matriz}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button onClick={cancelar} className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-gray-600 hover:bg-slate-100 bg-white">
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={gravando}
                className="text-sm px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {gravando ? (progresso || "Gravando...") : "Confirmar e gravar dados"}
              </button>
            </div>
            {gravando && progresso && <p className="text-xs text-slate-300 text-right">{progresso}</p>}
          </div>
        )}

        {/* Concluído */}
        {concluido && (
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
            <p className="text-lg font-semibold text-gray-900 mb-1">Dados importados com sucesso</p>
            <p className="text-sm text-gray-500 mb-6">
              {centrais.length} centrais e {totalMensais} registros mensais foram gravados.
              O cálculo do Health Score será feito na próxima etapa.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={cancelar} className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-gray-600 hover:bg-slate-100 bg-white">
                Importar outro arquivo
              </button>
              <button onClick={() => router.push("/admin")} className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">
                Voltar ao admin
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
