import { describe, expect, it } from 'vitest';
import { parseGradeValue } from '../../src/core/grades';

describe('grades validation', () => {
  it('aceita vírgula e ponto decimal e formata para 1 casa com ponto', () => {
    expect(parseGradeValue('2,5', 3.0)).toEqual({ ok: true, empty: false, value: 2.5, formatted: '2.5' });
    expect(parseGradeValue('3.0', 3.0)).toEqual({ ok: true, empty: false, value: 3.0, formatted: '3.0' });
    expect(parseGradeValue('', 3.0)).toEqual({ ok: true, empty: true });
  });

  it('rejeita nota acima do máximo, negativa ou texto inválido', () => {
    const over = parseGradeValue('3,5', 3.0);
    expect(over.ok).toBe(false);
    const neg = parseGradeValue('-1', 3.0);
    expect(neg.ok).toBe(false);
    const txt = parseGradeValue('abc', 3.0);
    expect(txt.ok).toBe(false);
  });
});
