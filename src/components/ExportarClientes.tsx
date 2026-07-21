"use client";

import { useState, useMemo } from "react";
import { gerarCsvEnvio, baixarCsv } from "@/lib/exportacao";

type ClienteExp = {
  id: string;
  marca: string;
  telefone?: string | null;
  email?: string | null;
  representante_legal?: string | null;
};

type Grupo = "criticos" | "carteira" | "Verde" | "Amarelo" | "Vermelho";

export default function ExportarClientes({
  clientes,
  bandaPorCliente,
  percepcaoPorCliente,
}: {
  clientes: ClienteExp[];
  bandaPorCliente: Record<string, string>;
  percepcaoPorCliente: Record<string, string>;
}) {
  const [grupo, setGrupo] = useState<Grupo>("criticos");
  const [confirmouSemTel, setConfirmouSemTel] = useState(false);

  // Filtra os clientes conforme o grupo escolhido
  const selecionados = useMemo(() => {
    return clientes.filter(c => {
      const banda = bandaPorCliente[c.id] ?? "N/A";
      const percepcao = percepcaoPorCliente[c.id];
      switch (grupo) {
        case "criticos": return banda === "Vermelho" || percepcao === "risco";
        case "carteira": return true;
        case "Verde":
        case "Amarelo":
        case "Vermelho": return banda === grupo;
      }
    });
  }, [clientes, bandaPorCliente, percepcaoPorCliente, grupo]);

  // Prévia: quantos entram (com telefone) e quantos ficam de fora
  const previa = useMemo(() => gerarCsvEnvio(selecionados), [selecionados]);

  function exportar() {
    const { csv } = gerarCsvEnvio(selecionados);
    const data = new Date().toISOString().split("T")[0];
    baixarCsv(csv, `exportacao_clientes_${data}.csv`);
  }

  const opcoes: { id: Grupo; label: string; desc: string }[] = [
    { id: "criticos", label: "Críticos", desc: "Banda vermelha ou percepção de risco" },
    { id: "carteira", label: "Toda a carteira", desc: "Todos os clientes ativos" },
    { id: "Vermelho", label: "Health Score: Vermelho", desc: "Clientes em estado crítico" },
    { id: "Amarelo", label: "Health Score: Amarelo", desc: "Clientes em atenção" },
    { id: "Verde", label: "Health Score: Verde", desc: "Clientes saudáveis" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h3 className="font-medium text-gray-900 mb-1">Exportar para envio de mensagens</h3>
        <p className="text-xs text-gray-400 mb-5">
          Gera uma planilha (CSV) no formato da ferramenta de envio, com os clientes da sua carteira.
          Escolha o grupo que deseja contatar.
        </p>

        {/* Seleção de grupo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {opcoes.map(op => (
            <button
              key={op.id}
              onClick={() => { setGrupo(op.id); setConfirmouSemTel(false); }}
              className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                grupo === op.id
                  ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-200"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <p className="text-sm font-medium text-gray-800">{op.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{op.desc}</p>
            </button>
          ))}
        </div>

        {/* Prévia */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-100 border border-slate-200/70 p-4 mb-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-2xl font-semibold text-gray-900">{previa.incluidos}</p>
              <p className="text-xs text-gray-400">clientes na planilha</p>
            </div>
            {previa.semTelefone > 0 && (
              <div>
                <p className="text-2xl font-semibold text-amber-600">{previa.semTelefone}</p>
                <p className="text-xs text-gray-400">sem telefone (fora)</p>
              </div>
            )}
          </div>
          {previa.semTelefone > 0 && (
            <div className="mt-3">
              <p className="text-xs text-amber-700">
                {previa.semTelefone} {previa.semTelefone === 1 ? "cliente não tem" : "clientes não têm"} telefone cadastrado
                e {previa.semTelefone === 1 ? "será excluído" : "serão excluídos"} da lista de envios, pois a ferramenta envia por telefone.
              </p>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmouSemTel}
                  onChange={e => setConfirmouSemTel(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700">
                  Seguir mesmo assim, exportando apenas os {previa.incluidos} {previa.incluidos === 1 ? "cliente" : "clientes"} com telefone.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Formato */}
        <p className="text-xs text-gray-400 mb-4">
          Formato do arquivo: <span className="font-mono bg-slate-100 dark:bg-slate-200 px-1.5 py-0.5 rounded">phone, name, email</span>
          {" "}(telefone, representante legal, e-mail).
        </p>

        <button
          onClick={exportar}
          disabled={previa.incluidos === 0 || (previa.semTelefone > 0 && !confirmouSemTel)}
          className="w-full sm:w-auto rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {previa.incluidos === 0
            ? "Nenhum cliente para exportar"
            : previa.semTelefone > 0 && !confirmouSemTel
              ? "Confirme acima para exportar"
              : `Exportar ${previa.incluidos} ${previa.incluidos === 1 ? "cliente" : "clientes"} (CSV)`}
        </button>
      </div>
    </div>
  );
}
