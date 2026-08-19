// Rótulos de exibição para valores gravados no banco — o valor em si continua
// igual (ex: "Corridas"), só o texto mostrado na tela muda.
export const OPERACAO_LABEL: Record<string, string> = {
  Corridas: "Mobilidade",
};

export function operacaoLabel(value: string | null | undefined): string {
  if (!value) return "";
  return OPERACAO_LABEL[value] ?? value;
}
