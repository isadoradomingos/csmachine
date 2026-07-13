// =====================================================================
// Motor de cálculo do Health Score (bloco Uso & engajamento — versão parcial)
// Porta fiel da lógica validada em Python contra os dados reais.
// Score PARCIAL: usa Volume relativo + Perfil de queda + Taxa de perdidas.
// Faltam (pendentes de dados): Equilíbrio, Competitivo, Financeiro,
// Funcionalidades, NPS, Suporte, Saúde das filiais.
// =====================================================================

export type CentralRaw = {
  cod_interno: string;
  nome: string;
  rede: string;
  operacao: string;   // "Corridas" | "Entregas"
  plano: string | null;
  tipo: string | null;
  status_bandeira: string | null;
  mensais: { mes: string; finalizadas: number | null; canceladas: number | null }[];
};

export type ScoreCentral = {
  cod_interno: string;
  nome: string;
  rede: string;
  operacao: string;
  score: number | null;
  banda: Banda;
  sub_volume: number | null;
  sub_queda: number | null;
  sub_perdidas: number | null;
  volume_janela: number;   // soma de finalizadas na janela (peso p/ agregação)
};

export type ScoreRede = {
  rede: string;
  operacao: string;
  score: number | null;
  banda: Banda;
  n_centrais: number;
  volume_total: number;
};

export type Banda = "Verde" | "Amarelo" | "Vermelho" | "N/A";

function banda(score: number | null): Banda {
  if (score === null || Number.isNaN(score)) return "N/A";
  return score >= 75 ? "Verde" : score >= 40 ? "Amarelo" : "Vermelho";
}

// Ordena os meses (YYYY-MM-DD) do mais recente ao mais antigo e pega os 3 primeiros COM finalizadas>0
function ultimos3(central: CentralRaw): { fins: number[]; cancs: number[] } {
  const ordenados = [...central.mensais].sort((a, b) => b.mes.localeCompare(a.mes)); // recente -> antigo
  const fins: number[] = [];
  const cancs: number[] = [];
  for (const m of ordenados) {
    const f = m.finalizadas;
    if (f !== null && f > 0) {
      fins.push(f);
      cancs.push(m.canceladas ?? 0);
    }
    if (fins.length === 3) break;
  }
  return { fins, cancs }; // fins[0] = mais recente ... fins[último] = mais antigo
}

// Média mensal de finalizadas (meses com fin>0) — usada para a mediana do plano
function mediaMensalFin(central: CentralRaw): number | null {
  const vals = central.mensais.map(m => m.finalizadas).filter((v): v is number => v !== null && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function mediana(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---- Sub-notas (0/50/100) ----
function subVolume(central: CentralRaw, medianas: Map<string, number>): number | null {
  const { fins } = ultimos3(central);
  if (fins.length === 0) return null;
  const med = medianas.get(`${central.operacao}|${central.plano}`);
  if (med === undefined || med === 0) return null;
  const mediaFins = fins.reduce((a, b) => a + b, 0) / fins.length;
  const idx = mediaFins / med;
  return idx > 0.50 ? 100 : idx >= 0.25 ? 50 : 0;
}

function subQueda(central: CentralRaw): number | null {
  const { fins } = ultimos3(central);
  if (fins.length < 3) return null;
  const recente = fins[0];
  const antigo = fins[fins.length - 1];
  if (antigo === 0) return null;
  const q = (antigo - recente) / antigo;
  return q < 0.10 ? 100 : q <= 0.30 ? 50 : 0;
}

function subPerdidas(central: CentralRaw): number | null {
  const { fins, cancs } = ultimos3(central);
  if (fins.length === 0) return null;
  const sfin = fins.reduce((a, b) => a + b, 0);
  const scanc = cancs.reduce((a, b) => a + b, 0);
  if (sfin + scanc < 30) return 100; // <30 solicitações = neutro
  const taxa = scanc / (sfin + scanc);
  if (central.operacao === "Corridas") {
    return taxa < 0.188 ? 100 : taxa <= 0.40 ? 50 : 0;
  }
  return taxa < 0.10 ? 100 : taxa <= 0.20 ? 50 : 0; // Entregas
}

// Painel do bloco Uso (parcial). Entregas renormaliza sem "Clientes".
function usoScore(central: CentralRaw, v: number | null, q: number | null, p: number | null): number | null {
  if (v === null || q === null || p === null) return null;
  if (central.operacao === "Corridas") {
    return 0.40 * v + 0.30 * q + 0.30 * p;
  }
  // Entregas sem "Clientes" (0,30): renormaliza 0,30+0,15+0,25 = 0,70
  return (0.30 * v + 0.15 * q + 0.25 * p) / 0.70;
}

export function calcularHealthScore(centrais: CentralRaw[]): { porCentral: ScoreCentral[]; porRede: ScoreRede[] } {
  // 1) Mediana do plano = mediana da média mensal de finalizadas das ATIVAS, por (operação, plano)
  const gruposAtivas = new Map<string, number[]>();
  for (const c of centrais) {
    if (c.status_bandeira !== "ATIVA") continue;
    const mm = mediaMensalFin(c);
    if (mm === null) continue;
    const key = `${c.operacao}|${c.plano}`;
    if (!gruposAtivas.has(key)) gruposAtivas.set(key, []);
    gruposAtivas.get(key)!.push(mm);
  }
  const medianas = new Map<string, number>();
  for (const [key, vals] of gruposAtivas) {
    const m = mediana(vals);
    if (m !== null) medianas.set(key, m);
  }

  // 2) Score por central
  const porCentral: ScoreCentral[] = centrais.map(c => {
    const v = subVolume(c, medianas);
    const q = subQueda(c);
    const p = subPerdidas(c);
    const score = usoScore(c, v, q, p);
    const { fins } = ultimos3(c);
    const volumeJanela = fins.reduce((a, b) => a + b, 0);
    return {
      cod_interno: c.cod_interno,
      nome: c.nome,
      rede: c.rede,
      operacao: c.operacao,
      score: score === null ? null : Math.round(score * 10) / 10,
      banda: banda(score),
      sub_volume: v,
      sub_queda: q,
      sub_perdidas: p,
      volume_janela: volumeJanela,
    };
  });

  // 3) Agregação por rede: média dos painéis ponderada pelo volume de finalizadas
  //    (só entram centrais com score não-nulo). Rede tem a operação da(s) sua(s) central(is).
  const gruposRede = new Map<string, ScoreCentral[]>();
  for (const sc of porCentral) {
    const key = `${sc.rede}|${sc.operacao}`;
    if (!gruposRede.has(key)) gruposRede.set(key, []);
    gruposRede.get(key)!.push(sc);
  }

  const porRede: ScoreRede[] = [];
  for (const [key, membros] of gruposRede) {
    const [rede, operacao] = key.split("|");
    const avaliaveis = membros.filter(m => m.score !== null && m.volume_janela > 0);
    const volumeTotal = avaliaveis.reduce((a, m) => a + m.volume_janela, 0);
    let score: number | null = null;
    if (avaliaveis.length > 0 && volumeTotal > 0) {
      score = avaliaveis.reduce((a, m) => a + (m.score as number) * m.volume_janela, 0) / volumeTotal;
      score = Math.round(score * 10) / 10;
    }
    porRede.push({
      rede,
      operacao,
      score,
      banda: banda(score),
      n_centrais: membros.length,
      volume_total: volumeTotal,
    });
  }

  return { porCentral, porRede };
}
