import { describe, expect, it } from 'vitest';
import {
  parseAttendanceCell,
  parseDateHeader,
  sanitizeObservation,
  toSigeducCheckboxes,
} from '../../src/core/attendance';

describe('attendance inverted logic & dates', () => {
  it('converte P/F/1/0/múltiplos horários para checkbox invertida (marcado = FALTA)', () => {
    const p = parseAttendanceCell('P');
    expect(p).toEqual({ ok: true, status: 'present', absenceCount: 0 });
    if (p.ok) expect(toSigeducCheckboxes(p, 2).checkboxes).toEqual([false, false]);

    const f = parseAttendanceCell('F');
    expect(f).toEqual({ ok: true, status: 'absent', absenceCount: 'all' });
    if (f.ok) expect(toSigeducCheckboxes(f, 2).checkboxes).toEqual([true, true]);

    const one = parseAttendanceCell('1');
    expect(one).toEqual({ ok: true, status: 'present', absenceCount: 0 });

    const zero = parseAttendanceCell('0');
    expect(zero).toEqual({ ok: true, status: 'absent', absenceCount: 'all' });

    const twoAbs = parseAttendanceCell('2');
    expect(twoAbs).toEqual({ ok: true, status: 'absent', absenceCount: 2 });
    if (twoAbs.ok) expect(toSigeducCheckboxes(twoAbs, 3).checkboxes).toEqual([true, true, false]);
  });

  it('interpreta cabeçalhos DD/MM/AAAA, YYYY-MM-DD e serial Excel com mês 0-indexed', () => {
    expect(parseDateHeader('05/08/2026')).toEqual({
      day: 5,
      monthZeroBased: 7,
      year: 2026,
      display: '05/08/2026',
    });
    expect(parseDateHeader('2026-11-21')).toEqual({
      day: 21,
      monthZeroBased: 10,
      year: 2026,
      display: '21/11/2026',
    });
    // 46239 no Excel = 05/08/2026
    expect(parseDateHeader('46239')?.display).toBe('05/08/2026');
    expect(parseDateHeader('31/02/2026')).toBeNull();
  });

  it('sanitiza observação removendo quebras de linha e truncando em 500 chars', () => {
    const longObs = 'Atestado\nmédico\r\n' + 'X'.repeat(550);
    const out = sanitizeObservation(longObs);
    expect(out).not.toContain('\n');
    expect(out.length).toBe(500);
  });
});
