// Utilitário de exportação de clientes no formato da ferramenta de envio de mensagens.
// Formato exigido: CSV com colunas phone,name,email

export type ClienteExport = {
  id?: string;
  marca?: string;
  telefone?: string | null;
  representante_legal?: string | null;
  email?: string | null;
};

// Escapa um campo CSV (aspas, vírgula, quebra de linha)
function csvCampo(v: string): string {
  const s = (v ?? "").trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Gera o conteúdo CSV no formato phone,name,email.
// Só inclui clientes com telefone (a ferramenta envia por telefone).
// Retorna { csv, incluidos, semTelefone, listaSemTelefone }.
export function gerarCsvEnvio(clientes: ClienteExport[]): {
  csv: string; incluidos: number; semTelefone: number;
  listaSemTelefone: { id?: string; marca?: string }[];
} {
  const linhas: string[] = ["phone,name,email"];
  let incluidos = 0;
  const listaSemTelefone: { id?: string; marca?: string }[] = [];

  for (const c of clientes) {
    const phone = (c.telefone ?? "").trim();
    if (!phone) { listaSemTelefone.push({ id: c.id, marca: c.marca }); continue; }
    const name = (c.representante_legal ?? "").trim();
    const email = (c.email ?? "").trim();
    linhas.push(`${csvCampo(phone)},${csvCampo(name)},${csvCampo(email)}`);
    incluidos++;
  }

  return { csv: linhas.join("\n"), incluidos, semTelefone: listaSemTelefone.length, listaSemTelefone };
}

// Dispara o download do CSV no navegador.
export function baixarCsv(csv: string, nomeArquivo: string) {
  // BOM para o Excel abrir acentos corretamente
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
