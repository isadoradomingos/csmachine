"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

// ---------- helpers de parsing ----------
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  // Se já é número (Excel entrega nativo), usa direto
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === "" || s === "—" || s === "-" || s.toLowerCase() === "nan") return null;
  // Número puro (com ponto decimal) — ex: "93.6"
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  // Formato BR com vírgula decimal — ex: "1.234,5" ou "93,6"
  const br = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(br) ? br : null;
}
function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "—" || s.toLowerCase() === "nan" ? null : s;
}

type LinhaHS = Record<string, unknown>;

// Encontra a linha do cabeçalho procurando uma célula-âncora
function acharHeader(matriz: unknown[][], ancora: string): number {
  for (let i = 0; i < Math.min(8, matriz.length); i++) {
    const linha = matriz[i].map(c => String(c ?? "").trim().toLowerCase());
    if (linha.some(c => c === ancora.toLowerCase())) return i;
  }
  return -1;
}

// Converte uma aba (matriz de células) em array de objetos, dado o índice do header
function abaParaObjetos(matriz: unknown[][], headerIdx: number): LinhaHS[] {
  const headers = matriz[headerIdx].map(c => String(c ?? "").trim());
  const out: LinhaHS[] = [];
  for (let i = headerIdx + 1; i < matriz.length; i++) {
    const linha = matriz[i];
    if (!linha || linha.every(c => c === null || c === undefined || String(c).trim() === "")) continue;
    const obj: LinhaHS = {};
    headers.forEach((h, j) => { if (h) obj[h] = linha[j]; });
    out.push(obj);
  }
  return out;
}

export default function ImportarHealthScore({ onConcluido }: { onConcluido?: (redes: number, centrais: number) => void }) {
  const [arquivo, setArquivo] = useState<string>("");
  const [redes, setRedes] = useState<LinhaHS[]>([]);
  const [centrais, setCentrais] = useState<LinhaHS[]>([]);
  const [naoAvaliadas, setNaoAvaliadas] = useState<LinhaHS[]>([]);
  const [erro, setErro] = useState<string>("");
  const [gravando, setGravando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [concluido, setConcluido] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(""); setConcluido(false); setRedes([]); setCentrais([]); setNaoAvaliadas([]);
    setArquivo(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // localiza as abas por nome (tolerante a variações)
      const nomeRede = wb.SheetNames.find(n => /rede/i.test(n));
      const nomeCentral = wb.SheetNames.find(n => /central|centrais/i.test(n));

      if (!nomeRede || !nomeCentral) {
        setErro(`Não encontrei as abas esperadas. O arquivo tem: ${wb.SheetNames.join(", ")}. Precisa de uma aba de "Rede" e uma de "Central".`);
        return;
      }

      // aba Rede
      const mRede = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeRede], { header: 1, defval: null });
      const hRede = acharHeader(mRede, "Banda");
      if (hRede < 0) { setErro("Não achei o cabeçalho (coluna 'Banda') na aba de redes."); return; }
      const objRede = abaParaObjetos(mRede, hRede).filter(r => txt(r["Rede"]) !== null);

      // aba Central
      const mCen = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeCentral], { header: 1, defval: null });
      const hCen = acharHeader(mCen, "Banda");
      if (hCen < 0) { setErro("Não achei o cabeçalho (coluna 'Banda') na aba de centrais."); return; }
      const objCen = abaParaObjetos(mCen, hCen).filter(r => txt(r["Cód."]) !== null);

      setRedes(objRede);
      setCentrais(objCen);

      // aba "Não avaliadas" (opcional) — centrais sem dados na janela
      const nomeNA = wb.SheetNames.find(n => /avaliad/i.test(n));
      if (nomeNA) {
        const mNA = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeNA], { header: 1, defval: null });
        const hNA = acharHeader(mNA, "Cód.");
        if (hNA >= 0) {
          const objNA = abaParaObjetos(mNA, hNA).filter(r => txt(r["Cód."]) !== null);
          setNaoAvaliadas(objNA);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErro(`Não consegui ler o arquivo: ${msg}`);
    }
  }

  async function gravar() {
    setGravando(true); setErro(""); setProgresso("Preparando...");

    // Monta as linhas no formato do banco
    const linhasRede = redes.map(r => ({
      tipo: "rede",
      codigo_matriz: txt(r["Cód. matriz"]),
      nome: txt(r["Matriz"]),
      rede: txt(r["Rede"]),
      operacao: txt(r["Operacao"]) ?? txt(r["Operação"]),
      plano: txt(r["Plano"]),
      banda: txt(r["Banda"]),
      score: num(r["Score final"]),
      painel: num(r["Painel rede"]),
      nps: num(r["NPS"]),
      suporte: num(r["Suporte"]),
      saude_filiais: num(r["Saúde filiais"]),
      n_centrais: num(r["Nº centrais"]),
      n_filiais: num(r["Nº filiais"]),
      parcial: false,
    }));

    const linhasCen = centrais.map(r => ({
      tipo: "central",
      codigo: txt(r["Cód."]),
      nome: txt(r["Nome"]),
      rede: txt(r["Rede"]),
      operacao: txt(r["Operação"]) ?? txt(r["Operacao"]),
      plano: txt(r["Plano"]),
      banda: txt(r["Banda"]),
      score: num(r["Painel"]),
      sub_volume: num(r["Volume"]),
      sub_queda: num(r["Queda"]),
      sub_perdidas: num(r["Perdidas"]),
      sub_equilibrio: num(r["Equilíbrio"]),
      sub_competitivo: num(r["Competitivo"]),
      sub_financeiro: num(r["Financeiro"]),
      sub_funcionalidades: num(r["Funcion."]),
      sub_uso: num(r["Uso"]),
      painel: num(r["Painel"]),
      tipo_central: txt(r["Tipo"]),
      status: txt(r["Status"]),
      estagio: txt(r["Estágio"]),
      volume_medio: num(r["Vol. méd. 3m"]),
      suspensoes: num(r["Suspensões"]),
      parcial: false,
    }));

    // Não-avaliadas: entram como central, banda N/A, sem sub-notas
    const linhasNA = naoAvaliadas.map(r => ({
      tipo: "central",
      codigo: txt(r["Cód."]),
      nome: txt(r["Nome"]),
      rede: txt(r["Rede"]),
      operacao: txt(r["Operação"]) ?? txt(r["Operacao"]),
      plano: txt(r["Plano"]),
      banda: "N/A",
      score: null,
      tipo_central: txt(r["Tipo"]),
      status: txt(r["Status"]),
      parcial: false,
    }));

    try {
      // 1) limpa a base antiga
      setProgresso("Limpando base anterior...");
      const { error: delErr } = await supabase.from("hs_scores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;

      // 2) grava em lotes
      const todas = [...linhasRede, ...linhasCen, ...linhasNA];
      const LOTE = 500;
      for (let i = 0; i < todas.length; i += LOTE) {
        const lote = todas.slice(i, i + LOTE);
        setProgresso(`Gravando ${Math.min(i + LOTE, todas.length)} de ${todas.length}...`);
        const { error } = await supabase.from("hs_scores").insert(lote);
        if (error) throw error;
      }

      setProgresso("");

      // Salva um snapshot mensal da distribuição por banda (histórico de evolução).
      // Conta as REDES por banda (mesma base do gráfico de Saúde da carteira).
      const cont = { Verde: 0, Amarelo: 0, Vermelho: 0, "N/A": 0 };
      let somaScore = 0, nScore = 0;
      for (const r of linhasRede) {
        const b = (r.banda ?? "N/A") as keyof typeof cont;
        if (b in cont) cont[b]++; else cont["N/A"]++;
        if (typeof r.score === "number") { somaScore += r.score; nScore++; }
      }
      const notaMediaGeral = nScore > 0 ? Math.round((somaScore / nScore) * 10) / 10 : null;
      // Data do snapshot = dia 1 do mês corrente (um snapshot representa o mês).
      const agora = new Date();
      const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
      // upsert por data: reimportar no mesmo dia substitui o snapshot do dia.
      const { error: snapErr } = await supabase
        .from("hs_historico")
        .upsert({
          data_snapshot: hoje,
          verde: cont.Verde,
          amarelo: cont.Amarelo,
          vermelho: cont.Vermelho,
          sem_nota: cont["N/A"],
          total: linhasRede.length,
          nota_media: notaMediaGeral,
        }, { onConflict: "data_snapshot" });
      // Se o histórico falhar, não bloqueia a importação (os scores já foram gravados).
      if (snapErr) console.warn("Não foi possível salvar o snapshot do histórico:", snapErr.message);

      // Snapshot POR CSM: casa cada rede (codigo_matriz) com o cliente/CSM dono.
      try {
        const csmPorCodigo: Record<string, string> = {};
        let cf = 0;
        for (;;) {
          const { data, error } = await supabase
            .from("clients").select("bandeira, csm_id").eq("status", "ativo").range(cf, cf + 999);
          if (error || !data || data.length === 0) break;
          for (const c of data as { bandeira: string | null; csm_id: string | null }[]) {
            const b = (c.bandeira ?? "").trim();
            if (b && c.csm_id) csmPorCodigo[b] = c.csm_id;
          }
          if (data.length < 1000) break;
          cf += 1000;
        }

        const porCsm: Record<string, { Verde: number; Amarelo: number; Vermelho: number; total: number; soma: number; n: number }> = {};
        for (const r of linhasRede) {
          const cod = (r.codigo_matriz ?? "").toString().trim();
          const csmId = cod ? csmPorCodigo[cod] : undefined;
          if (!csmId) continue;
          const banda = (r.banda ?? "") as "Verde" | "Amarelo" | "Vermelho";
          if (!porCsm[csmId]) porCsm[csmId] = { Verde: 0, Amarelo: 0, Vermelho: 0, total: 0, soma: 0, n: 0 };
          if (banda === "Verde" || banda === "Amarelo" || banda === "Vermelho") {
            porCsm[csmId][banda]++;
            porCsm[csmId].total++;
          }
          if (typeof r.score === "number") { porCsm[csmId].soma += r.score; porCsm[csmId].n++; }
        }

        const linhasCsm = Object.entries(porCsm).map(([csm_id, c]) => ({
          data_snapshot: hoje, csm_id, verde: c.Verde, amarelo: c.Amarelo, vermelho: c.Vermelho, total: c.total,
          nota_media: c.n > 0 ? Math.round((c.soma / c.n) * 10) / 10 : null,
        }));
        if (linhasCsm.length > 0) {
          const { error: csmErr } = await supabase
            .from("hs_historico_csm")
            .upsert(linhasCsm, { onConflict: "data_snapshot,csm_id" });
          if (csmErr) console.warn("Não foi possível salvar o snapshot por CSM:", csmErr.message);
        }
      } catch (e) {
        console.warn("Falha no snapshot por CSM:", e);
      }

      // Snapshot POR OPERAÇÃO: agrupa as redes por operação (da própria planilha).
      try {
        const porOp: Record<string, { Verde: number; Amarelo: number; Vermelho: number; total: number; soma: number; n: number }> = {};
        for (const r of linhasRede) {
          const op = (r.operacao ?? "").toString().trim();
          if (!op) continue;
          const banda = (r.banda ?? "") as "Verde" | "Amarelo" | "Vermelho";
          if (!porOp[op]) porOp[op] = { Verde: 0, Amarelo: 0, Vermelho: 0, total: 0, soma: 0, n: 0 };
          if (banda === "Verde" || banda === "Amarelo" || banda === "Vermelho") {
            porOp[op][banda]++;
            porOp[op].total++;
          }
          if (typeof r.score === "number") { porOp[op].soma += r.score; porOp[op].n++; }
        }
        const linhasOp = Object.entries(porOp).map(([operacao, c]) => ({
          data_snapshot: hoje, operacao, verde: c.Verde, amarelo: c.Amarelo, vermelho: c.Vermelho, total: c.total,
          nota_media: c.n > 0 ? Math.round((c.soma / c.n) * 10) / 10 : null,
        }));
        if (linhasOp.length > 0) {
          const { error: opErr } = await supabase
            .from("hs_historico_operacao")
            .upsert(linhasOp, { onConflict: "data_snapshot,operacao" });
          if (opErr) console.warn("Não foi possível salvar o snapshot por operação:", opErr.message);
        }
      } catch (e) {
        console.warn("Falha no snapshot por operação:", e);
      }

      setConcluido(true);
      setGravando(false);
      if (onConcluido) onConcluido(linhasRede.length, linhasCen.length);
    } catch (err) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      const msg = e?.message || e?.details || e?.hint || (typeof err === "string" ? err : JSON.stringify(err));
      setErro(`Erro ao gravar: ${msg}${e?.code ? ` (código ${e.code})` : ""}`);
      setGravando(false);
      setProgresso("");
    }
  }

  function cancelar() {
    setArquivo(""); setRedes([]); setCentrais([]); setNaoAvaliadas([]); setErro(""); setConcluido(false);
  }

  // ---------- render ----------
  if (concluido) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex h-12 w-12 rounded-full bg-green-100 text-green-600 items-center justify-center mb-3">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-900">Dados importados com sucesso!</p>
        <p className="text-xs text-gray-500 mt-1">{redes.length} redes e {centrais.length + naoAvaliadas.length} centrais gravadas{naoAvaliadas.length > 0 ? ` (${naoAvaliadas.length} sem nota)` : ""}.</p>
        <button onClick={cancelar} className="mt-4 text-sm px-4 py-2 rounded-lg border border-slate-300 text-gray-600 hover:bg-slate-100 bg-white">
          Importar outro arquivo
        </button>
      </div>
    );
  }

  return (
    <div>
      {redes.length === 0 && centrais.length === 0 ? (
        <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
          <svg className="h-8 w-8 text-gray-400 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm font-medium text-gray-700">Clique para selecionar a planilha</p>
          <p className="text-xs text-gray-400 mt-1">Excel (.xlsx) ou CSV — com as abas de Rede e Central</p>
        </label>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{arquivo}</p>
              <p className="text-xs text-gray-500">{redes.length} redes · {centrais.length} centrais{naoAvaliadas.length > 0 ? ` · ${naoAvaliadas.length} sem nota` : ""}</p>
            </div>
            <button onClick={cancelar} className="text-xs text-gray-400 hover:text-gray-600">trocar arquivo</button>
          </div>

          {/* prévia */}
          <div className="rounded-lg border border-slate-200 overflow-hidden mb-3 max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Rede</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Cód.</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Banda</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">Score</th>
                </tr>
              </thead>
              <tbody>
                {redes.slice(0, 30).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-gray-700">{txt(r["Rede"])}</td>
                    <td className="px-3 py-1.5 text-gray-500">{txt(r["Cód. matriz"])}</td>
                    <td className="px-3 py-1.5 text-gray-500">{txt(r["Banda"])}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{txt(r["Score final"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {erro && <p className="text-xs text-red-500 mb-3">{erro}</p>}

          <button onClick={gravar} disabled={gravando} className="w-full rounded-lg bg-blue-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {gravando ? (progresso || "Gravando...") : `Importar ${redes.length + centrais.length + naoAvaliadas.length} registros`}
          </button>
        </div>
      )}

      {erro && redes.length === 0 && <p className="text-xs text-red-500 mt-3">{erro}</p>}
    </div>
  );
}
