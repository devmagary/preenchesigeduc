export type GradeParseResult =
  | { ok: true; empty: true }
  | { ok: true; empty: false; value: number; formatted: string }
  | { ok: false; reason: string };

export function formatGradeForSigeduc(num: number): string {
  return num.toFixed(1);
}

export function parseGradeValue(raw: string | number | null | undefined, maxValue: number): GradeParseResult {
  if (raw === null || raw === undefined) {
    return { ok: true, empty: true };
  }
  const text = String(raw).trim();
  if (text === '' || text === '-') {
    return { ok: true, empty: true };
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
    value: num,
    formatted: formatGradeForSigeduc(num),
  };
}
