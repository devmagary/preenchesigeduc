import { describe, expect, it } from 'vitest';
import { isNotRealizedToken, parseGradeValue } from '../../src/core/grades';

describe('grades validation', () => {
  it('aceita vírgula e ponto decimal e formata para 1 casa com ponto', () => {
    expect(parseGradeValue('2,5', 3.0)).toEqual({
      ok: true,
      empty: false,
      notRealized: false,
      value: 2.5,
      formatted: '2.5',
    });
    expect(parseGradeValue('3.0', 3.0)).toEqual({
      ok: true,
      empty: false,
      notRealized: false,
      value: 3.0,
      formatted: '3.0',
    });
    expect(parseGradeValue('0', 3.0)).toEqual({
      ok: true,
      empty: false,
      notRealized: false,
      value: 0,
      formatted: '0.0',
    });
    expect(parseGradeValue('0,0', 3.0)).toEqual({
      ok: true,
      empty: false,
      notRealized: false,
      value: 0,
      formatted: '0.0',
    });
  });

  it('reconhece células vazias e tokens NF / Não Fez / FV como Não Realizada sem confundir com 0', () => {
    expect(parseGradeValue('', 3.0)).toEqual({ ok: true, empty: true, notRealized: true, rawToken: '' });
    expect(parseGradeValue(null, 3.0)).toEqual({ ok: true, empty: true, notRealized: true, rawToken: '' });
    expect(parseGradeValue('NF', 3.0)).toEqual({ ok: true, empty: true, notRealized: true, rawToken: 'NF' });
    expect(parseGradeValue('Não Fez', 3.0)).toEqual({
      ok: true,
      empty: true,
      notRealized: true,
      rawToken: 'Não Fez',
    });
    expect(parseGradeValue('nao fez', 3.0)).toEqual({
      ok: true,
      empty: true,
      notRealized: true,
      rawToken: 'nao fez',
    });
    expect(parseGradeValue('FV', 3.0)).toEqual({ ok: true, empty: true, notRealized: true, rawToken: 'FV' });
    expect(parseGradeValue('-', 3.0)).toEqual({ ok: true, empty: true, notRealized: true, rawToken: '-' });
    expect(isNotRealizedToken('0')).toBe(false);
    expect(isNotRealizedToken('0,0')).toBe(false);
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
