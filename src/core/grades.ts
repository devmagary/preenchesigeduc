export type GradeParseResult =
  | { ok: true; empty: true; notRealized: true; rawToken: string }
  | { ok: true; empty: false; notRealized: false; value: number; formatted: string }
  | { ok: false; reason: string };

const NOT_REALIZED_TOKENS = new Set(['', '-', 'NF', 'NAO FEZ', 'FV', 'NR', 'N/R']);

export function formatGradeForSigeduc(num: number): string {
  return num.toFixed(1);
}

export function isNotRealizedToken(raw: string | number | null | undefined): boolean {
  if (raw === null || raw === undefined) return true;
  const normalized = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return NOT_REALIZED_TOKENS.has(normalized);
}

export function parseGradeValue(raw: string | number | null | undefined, maxValue: number): GradeParseResult {
  if (raw === null || raw === undefined) {
    return { ok: true, empty: true, notRealized: true, rawToken: '' };
  }
  const text = String(raw).trim();
  if (isNotRealizedToken(text)) {
    return { ok: true, empty: true, notRealized: true, rawToken: text };
  }

  const normalized = text.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, reason: `Valor inválido "${text}"` };
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) {
    return { ok: false, reason: `Número inválido "${text}"` };
  }
  if (num < 0) {
    return { ok: false, reason: `Nota negativa (${text}) não permitida` };
  }
  if (num > maxValue + 1e-6) {
    return { ok: false, reason: `Nota ${text} excede o máximo da atividade (${maxValue.toFixed(1)})` };
  }

  return {
    ok: true,
    empty: false,
    notRealized: false,
    value: num,
    formatted: formatGradeForSigeduc(num),
  };
}
