import { describe, expect, it } from 'vitest';
import { cleanDisplayName, matchStudentsExact, normalizeName } from '../../src/core/normalize';

describe('normalize & matchStudentsExact', () => {
  it('remove acentos, espaços extras e ícones PCD (PUA)', () => {
    expect(cleanDisplayName('  GABRIELA  ROCHA  \uF193 ')).toBe('GABRIELA ROCHA');
    expect(normalizeName('  João   Pédro  Gômes \uF193 ')).toBe('JOAO PEDRO GOMES');
  });

  it('faz pareamento estritamente exato após normalização e rejeita nomes parecidos (sem fuzzy)', () => {
    const sheet = [
      { rowIndex: 0, rawName: 'joao pedro gomes' },
      { rowIndex: 1, rawName: 'JOAO PEDRO GOMEZ' }, // 1 letra diferente -> deve ir para notFoundInPage
      { rowIndex: 2, rawName: 'GABRIELA NASCIMENTO ROCHA' },
    ];
    const page = [
      { index: 0, rawName: 'JOÃO PEDRO GOMES' },
      { index: 1, rawName: 'GABRIELA NASCIMENTO ROCHA \uF193' },
      { index: 2, rawName: 'CARLA MENDES' },
    ];

    const res = matchStudentsExact(sheet, page);
    expect(res.matched).toHaveLength(2);
    expect(res.matched.map((m) => m.pageStudent.index)).toEqual([0, 1]);
    expect(res.notFoundInPage).toHaveLength(1);
    expect(res.notFoundInPage[0].sheetRow.rawName).toBe('JOAO PEDRO GOMEZ');
    expect(res.notInSheet).toHaveLength(1);
    expect(res.notInSheet[0].pageStudent.rawName).toBe('CARLA MENDES');
  });

  it('bloqueia homônimos na planilha ou na turma quando não há matrícula única para desambiguar', () => {
    const sheet = [
      { rowIndex: 0, rawName: 'MARIA SILVA' },
      { rowIndex: 1, rawName: 'MARIA SILVA' },
    ];
    const page = [
      { index: 0, rawName: 'MARIA SILVA' },
      { index: 1, rawName: 'BRUNO SOUZA' },
    ];

    const res = matchStudentsExact(sheet, page);
    expect(res.matched).toHaveLength(0);
    expect(res.duplicates).toHaveLength(1);
    expect(res.duplicates[0].reason).toBe('duplicate_in_sheet');
  });

  it('permite desambiguar homônimos apenas quando matrícula única coincide exatamente', () => {
    const sheet = [
      { rowIndex: 0, rawName: 'MARIA SILVA', rawMatricula: '2026001' },
      { rowIndex: 1, rawName: 'MARIA SILVA', rawMatricula: '2026002' },
    ];
    const page = [
      { index: 0, rawName: 'MARIA SILVA', rawMatricula: '2026001' },
      { index: 1, rawName: 'MARIA SILVA', rawMatricula: '2026002' },
    ];

    const res = matchStudentsExact(sheet, page);
    expect(res.matched).toHaveLength(2);
    expect(res.duplicates).toHaveLength(0);
  });
});
