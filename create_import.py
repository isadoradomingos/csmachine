import os

os.makedirs("src/app/admin/importar", exist_ok=True)

content = '''"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

export default function ImportarPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: p } = await supabase.from("profiles").select("id, full_name");
    setProfiles(p ?? []);
    const text = await file.text();
    const lines = text.trim().split("\\n");
    const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
    const parsed: ImportRow[] = lines.slice(1).map((line: string) => {
      const values = line.split(",").map((v: string) => v.trim());
      const obj: any = {};
      headers.forEach((h: string, i: number) => { obj[h] = values[i] ?? ""; });
      return { ...obj, status: "pendente" };
    }).filter((r: any) => r.bandeira);
    setRows(parsed);
    setDone(false);
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

        const profile = profiles.find((p: any) => p.full_name.toLowerCase() === (row.csm ?? "").toLowerCase());

        if (existing) {
          bandeirasNaPlanilha.push(row.bandeira);
          const updateObj: any = { status: "ativo" };
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
          const newClient: any = {
            marca: row.marca,
            bandeira: row.bandeira,
            operacao: row.operacao,
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

    if (bandeirasNaPlanilha.length > 0) {
      await supabase
        .from("clients")
        .update({ status: "inativo" })
        .not("bandeira", "in", `(${bandeirasNaPlanilha.map((b: string) => `'${b}'`).join(",")})`);
    }

    setRows(updated);
    setImporting(false);
    setDone(true);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">CS Machine</h1>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Administração</p>
          <h2 className="text-2xl font-semibold text-gray-900 mt-1">Importar planilha</h2>
          <p className="text-gray-500 text-sm mt-1">A planilha representa a carteira atual. Clientes ausentes serão marcados como inativos.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          ⚠️ <strong>Atenção:</strong> ao confirmar, todos os clientes fora da planilha serão marcados como <strong>inativos</strong>.
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900 text-sm">Modelo de planilha</p>
            <p className="text-xs text-blue-600 mt-0.5">Campos obrigatórios: bandeira, marca, operacao, csm</p>
          </div>
          <a href="/modelo_importacao.csv" download className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">↓ Baixar modelo</a>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-medium text-gray-900 mb-4">Selecionar arquivo CSV</h3>
          <input type="file" accept=".csv" onChange={handleFile} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          <p className="text-xs text-gray-400 mt-2">Colunas: bandeira*, marca*, operacao*, csm*, cluster, plano</p>
        </div>

        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">{rows.length} linhas encontradas</h3>
              {!done && (
                <button onClick={handleImport} disabled={importing} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {importing ? "Importando..." : "Confirmar importação"}
                </button>
              )}
            </div>
            {done && (
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex gap-6 text-sm flex-wrap">
                <span className="text-green-700">✓ {summary.atualizados} atualizados</span>
                <span className="text-blue-700">+ {summary.adicionados} adicionados</span>
                <span className="text-yellow-700">⚠ {summary.ignorados} ignorados</span>
                {summary.erros > 0 && <span className="text-red-700">✗ {summary.erros} erros</span>}
              </div>
            )}
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
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
      </main>
    </div>
  );
}
'''

with open("src/app/admin/importar/page.tsx", "w") as f:
    f.write(content)
print("Criado!")
