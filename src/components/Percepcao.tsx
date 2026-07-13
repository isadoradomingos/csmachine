"use client";

// Seletor visual de percepção do CS (opcional): Estável / Atenção / Risco
// Usado nos formulários de registro de contato. value null = nenhuma escolhida.

export type Percepcao = "estavel" | "atencao" | "risco" | null;

const OPCOES: { valor: Exclude<Percepcao, null>; rotulo: string; cor: string }[] = [
  { valor: "estavel", rotulo: "Estável", cor: "#16a34a" },
  { valor: "atencao", rotulo: "Atenção", cor: "#f59e0b" },
  { valor: "risco", rotulo: "Risco", cor: "#dc2626" },
];

export function SeletorPercepcao({
  value,
  onChange,
}: {
  value: Percepcao;
  onChange: (v: Percepcao) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        Percepção do CSM <span className="text-gray-400 font-normal">(opcional)</span>
      </label>
      <p className="text-xs text-gray-400 mb-2 leading-relaxed">
        Registre sua leitura sobre a situação do cliente. Essa percepção soma-se ao Health Score para dar uma
        visão mais real do risco — especialmente nos casos em que a nota não reflete o que você percebe no dia a dia.
      </p>
      <div className="flex gap-2 flex-wrap">
        {OPCOES.map(op => {
          const ativo = value === op.valor;
          return (
            <button
              key={op.valor}
              type="button"
              onClick={() => onChange(ativo ? null : op.valor)}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
              style={ativo
                ? { backgroundColor: op.cor, borderColor: "transparent", color: "white" }
                : { backgroundColor: "white", borderColor: "#e2e8f0", color: "#64748b" }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: ativo ? "white" : op.cor }}
              />
              {op.rotulo}
            </button>
          );
        })}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600"
          >
            limpar
          </button>
        )}
      </div>
    </div>
  );
}

// Etiqueta compacta para exibir a percepção (no perfil do cliente, listas, etc.)
export function EtiquetaPercepcao({ value, data }: { value: Percepcao; data?: string | null }) {
  if (!value) return null;
  const info = OPCOES.find(o => o.valor === value);
  if (!info) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ backgroundColor: info.cor + "1a", color: info.cor }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: info.cor }} />
      {info.rotulo}
      {data ? <span className="text-gray-400 font-normal">· {new Date(data + "T00:00:00").toLocaleDateString("pt-BR")}</span> : null}
    </span>
  );
}
