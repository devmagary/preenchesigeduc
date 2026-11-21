export interface AttendanceParseOptions {
  emptyMeansPresent?: boolean;
}

export type ParsedAttendance =
  | { ok: true; status: 'present'; absenceCount: 0 }
  | { ok: true; status: 'absent'; absenceCount: 'all' | number }
  | { ok: true; status: 'skip' }
  | { ok: false; reason: string };

export interface ParsedDateInfo {
  day: number;
  monthZeroBased: number; // 0 = Janeiro, 11 = Dezembro (padrão JSF/SIGEduc)
  year: number;
  display: string; // DD/MM/AAAA
}

const PRESENT_TOKENS = new Set(['P', 'PRESENTE', 'C', '1', 'OK', 'SIM', 'S', 'TRUE']);
const ABSENT_ALL_TOKENS = new Set(['F', 'FALTA', 'FALTAS', 'A', 'AUSENTE', '0', 'N', 'NAO', 'NÃO', 'FALSE']);

/**
 * Converte valores de célula de frequência em presença ou falta.
 * Nota: números inteiros >= 2 (ex: "2") representam quantidade de horários faltados no dia.
 */
export function parseAttendanceCell(
  raw: string | number | null | undefined,
  options: AttendanceParseOptions = {}
): ParsedAttendance {
  const { emptyMeansPresent = true } = options;
  const text = String(raw ?? '').trim();

  if (text === '') {
    return emptyMeansPresent
      ? { ok: true, status: 'present', absenceCount: 0 }
      : { ok: true, status: 'skip' };
  }

  const upper = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (PRESENT_TOKENS.has(upper)) {
    return { ok: true, status: 'present', absenceCount: 0 };
  }

  if (ABSENT_ALL_TOKENS.has(upper)) {
    return { ok: true, status: 'absent', absenceCount: 'all' };
  }

  // Suporta formatos como "2F" ou "2" indicando número de horários faltados
  const multiMatch = upper.match(/^(\d+)\s*F?$/);
  if (multiMatch) {
    const count = Number(multiMatch[1]);
    if (count === 0) {
      return { ok: true, status: 'absent', absenceCount: 'all' };
    }
    if (count >= 2 && count <= 10) {
      return { ok: true, status: 'absent', absenceCount: count };
    }
  }

  return { ok: false, reason: `Valor de frequência não reconhecido: "${text}"` };
}

/**
 * Aplica a lógica invertida do SIGEduc:
 * checkbox marcado (true) = estudante FALTOU;
 * checkbox desmarcado (false) = estudante PRESENTE.
 */
export function toSigeducCheckboxes(
  parsed: Extract<ParsedAttendance, { ok: true }>,
  slotCount: number
): { checkboxes: boolean[]; warning?: string } {
  const slots = Math.max(1, slotCount);
  if (parsed.status === 'present' || parsed.status === 'skip') {
    return { checkboxes: Array(slots).fill(false) };
  }
  if (parsed.absenceCount === 'all') {
    return { checkboxes: Array(slots).fill(true) };
  }

  const count = Math.min(parsed.absenceCount, slots);
  const checkboxes = Array.from({ length: slots }, (_, idx) => idx < count);
  const warning =
    parsed.absenceCount > slots
      ? `Planilha indicou ${parsed.absenceCount} faltas, mas o dia possui ${slots} horário(s); marcados ${slots}.`
      : undefined;
  return { checkboxes, warning };
}

function isValidCalendarDate(day: number, month1Based: number, year: number): boolean {
  if (month1Based < 1 || month1Based > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return false;
  }
  const d = new Date(Date.UTC(year, month1Based - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month1Based - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Interpreta cabeçalhos ou strings de data para o formato esperado pelo calendário SIGEduc (mês 0-indexed).
 */
export function parseDateHeader(raw: string | number): ParsedDateInfo | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  // Serial Excel (ex: 46239)
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial > 30000 && serial < 70000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      const day = utc.getUTCDate();
      const month1 = utc.getUTCMonth() + 1;
      const year = utc.getUTCFullYear();
      if (isValidCalendarDate(day, month1, year)) {
        return {
          day,
          monthZeroBased: month1 - 1,
          year,
          display: `${String(day).padStart(2, '0')}/${String(month1).padStart(2, '0')}/${year}`,
        };
      }
    }
  }

  // DD/MM/AAAA ou DD-MM-AAAA ou DD/MM/AA
  const brMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month1 = Number(brMatch[2]);
    let year = Number(brMatch[3]);
    if (year < 100) year += 2000;
    if (isValidCalendarDate(day, month1, year)) {
      return {
        day,
        monthZeroBased: month1 - 1,
        year,
        display: `${String(day).padStart(2, '0')}/${String(month1).padStart(2, '0')}/${year}`,
      };
    }
  }

  // YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month1 = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (isValidCalendarDate(day, month1, year)) {
      return {
        day,
        monthZeroBased: month1 - 1,
        year,
        display: `${String(day).padStart(2, '0')}/${String(month1).padStart(2, '0')}/${year}`,
      };
    }
  }

  return null;
}

/**
 * Sanitiza observação de frequência: remove quebras de linha (bloqueadas pelo SIGEduc) e limita a 500 caracteres.
 */
export function sanitizeObservation(text: string): string {
  return String(text ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
