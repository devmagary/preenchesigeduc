import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  exportToCsv,
  exportToXlsxBuffer,
  parsePastedTable,
  parsePastedWorkbook,
  parseSpreadsheetBuffer,
  parseWorkbookBuffer,
  selectBestWorkbookTarget,
  toParsedSpreadsheet,
} from '../../src/core/spreadsheet';

describe('spreadsheet parser & exporter', () => {
  it('lê CSV brasileiro com separador ; e BOM UTF-8 além de deduplicar cabeçalhos', () => {
    const csv = '\uFEFF\n\nNome;Prova;Prova\nANA CLARA;3,5;2,0\nBRUNO;4,0;1,5\n';
    const buf = new TextEncoder().encode(csv).buffer;
    const parsed = parseSpreadsheetBuffer(buf, 'notas.csv');
    expect(parsed.headers).toEqual(['Nome', 'Prova', 'Prova (2)']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]['Prova']).toBe('3,5');
    expect(parsed.rows[0]['Prova (2)']).toBe('2,0');
  });

  it('lê CSV em encoding ISO-8859-1/Windows-1252 preservando acentos', () => {
    // "João;Observação\n" em latin1
    const bytes = new Uint8Array([
      0x4e, 0x6f, 0x6d, 0x65, 0x3b, 0x4f, 0x62, 0x73, 0x65, 0x72, 0x76, 0x61, 0xe7, 0xe3, 0x6f, 0x0a,
      0x4a, 0x6f, 0xe3, 0x6f, 0x3b, 0x41, 0x74, 0x65, 0x73, 0x74, 0x61, 0x64, 0x6f, 0x0a,
    ]);
    const parsed = parseSpreadsheetBuffer(bytes.buffer, 'freq.csv');
    expect(parsed.headers).toEqual(['Nome', 'Observação']);
    expect(parsed.rows[0]['Nome']).toBe('João');
  });

  it('faz parse de texto colado (TAB do Excel/Sheets)', () => {
    const pasted = 'Nome\t05/08/2026\t12/08/2026\nANA CLARA FERREIRA\tP\tF\nBRUNO SOUZA\tF\tP';
    const parsed = parsePastedTable(pasted);
    expect(parsed.headers).toEqual(['Nome', '05/08/2026', '12/08/2026']);
    expect(parsed.rows[0]['12/08/2026']).toBe('F');
  });

  it('exporta XLSX válido e re-lê preservando dados e datas', () => {
    const buf = exportToXlsxBuffer([
      {
        name: 'Modelo Notas',
        headers: ['Nome', 'Participação', 'Prova'],
        rows: [['ANA CLARA', 2.0, 3.0]],
      },
    ]);
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Modelo Notas']);
    const parsed = parseSpreadsheetBuffer(buf.slice().buffer, 'modelo.xlsx');
    expect(parsed.rows[0]['Nome']).toBe('ANA CLARA');
    expect(parsed.rows[0]['Participação']).toBe('2');

    const csvOut = exportToCsv(['Nome', 'Nota'], [['ANA CLARA', '3.5']]);
    expect(csvOut.startsWith('\uFEFFNome;Nota')).toBe(true);
  });

  it('rejeita planilha vazia ou corrompida com erro claro', () => {
    expect(() => parseSpreadsheetBuffer(new ArrayBuffer(0), 'vazio.xlsx')).toThrow();
    expect(() => parsePastedTable('   \n  ')).toThrow();
  });

  it('lê arquivo multi-aba e seleciona automaticamente a aba com maior número de alunos exatos', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Painel Resumo Escolar'],
        ['Escola', 'Média Geral'],
        ['Escola Modelo', '8,1'],
      ]),
      'Resumo'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Nº', 'Nome do Aluno', 'Participação', 'Prova'],
        ['1', 'OUTRO ALUNO 1', '2,0', '3,0'],
        ['2', 'OUTRO ALUNO 2', '1,5', '2,5'],
      ]),
      'TURMA-1A'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Nº', 'Nome do Aluno', 'Participação', 'Prova'],
        ['1', 'ANA CLARA FERREIRA', '2,0', '3,0'],
        ['2', 'BRUNO HENRIQUE SOUZA', '1,5', '2,5'],
        ['3', 'CARLA MENDES OLIVEIRA', '1,8', '2,8'],
      ]),
      'TURMA-1B'
    );

    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsedWb = parseWorkbookBuffer(out, 'multi_abas.xlsx');
    expect(parsedWb.sheets).toHaveLength(3);
    expect(parsedWb.sheets[0].name).toBe('Resumo');

    const sel = selectBestWorkbookTarget(
      parsedWb,
      ['ANA CLARA FERREIRA', 'BRUNO HENRIQUE SOUZA', 'CARLA MENDES OLIVEIRA'],
      'TURMA-1B'
    );
    expect(sel.autoSelected).toBe(true);
    expect(sel.sheetIndex).toBe(2);
    expect(sel.matchedCount).toBe(3);

    const sheet = toParsedSpreadsheet(parsedWb, sel.sheetIndex, sel.blockId);
    expect(sheet?.rows).toHaveLength(3);
    expect(sheet?.rows[0]['Nome do Aluno']).toBe('ANA CLARA FERREIRA');
  });

  it('detecta planilha consolidada com resumo no topo e múltiplos blocos de turmas na mesma aba', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['CONSOLIDADO DE NOTAS — 2026'],
        ['Nome da Escola', 'Média Geral'],
        ['ESCOLA MODELO ESTADUAL', '7,8'],
        [],
        ['TURMA 1A MATUTINO'],
        ['Nº', 'Nome do Aluno', 'Participação', 'Prova'],
        ['1', 'ALUNO TURMA A1', '2,0', '3,0'],
        ['2', 'ALUNO TURMA A2', '1,5', '2,0'],
        [],
        ['TURMA 1B VESPERTINO'],
        ['Nº', 'Nome do Aluno', 'Participação', 'Prova'],
        ['1', 'ANA CLARA FERREIRA', '2,0', '3,0'],
        ['2', 'BRUNO HENRIQUE SOUZA', '1,5', '2,8'],
      ]),
      'Consolidado'
    );

    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsedWb = parseWorkbookBuffer(out, 'consolidado.xlsx');
    expect(parsedWb.sheets).toHaveLength(1);
    const blocks = parsedWb.sheets[0].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].titleHint).toContain('TURMA 1A');
    expect(blocks[0].rows).toHaveLength(2);
    expect(blocks[1].titleHint).toContain('TURMA 1B');
    expect(blocks[1].rows).toHaveLength(2);
    expect(parsedWb.sheets[0].combinedBlock?.id).toBe('__all__');
    expect(parsedWb.sheets[0].combinedBlock?.rows).toHaveLength(4);

    const sel = selectBestWorkbookTarget(parsedWb, ['ANA CLARA FERREIRA', 'BRUNO HENRIQUE SOUZA']);
    expect(sel.autoSelected).toBe(true);
    expect(sel.blockId).toBe(blocks[1].id);
    expect(sel.matchedCount).toBe(2);

    const combined = toParsedSpreadsheet(parsedWb, 0, '__all__');
    expect(combined?.rows).toHaveLength(4);
  });

  it('detecta múltiplos blocos também em texto colado com cabeçalho de resumo no topo', () => {
    const pasted = [
      'PLANILHA CONSOLIDADA DO BIMESTRE',
      '',
      'TURMA A',
      'Nome\t05/08/2026',
      'JOSE SILVA\tP',
      '',
      'TURMA B',
      'Nome\t05/08/2026',
      'ANA CLARA FERREIRA\tF',
      'BRUNO HENRIQUE SOUZA\tP',
    ].join('\n');

    const wb = parsePastedWorkbook(pasted);
    expect(wb.sheets[0].blocks).toHaveLength(2);
    expect(wb.sheets[0].blocks[0].titleHint).toBe('TURMA A');
    expect(wb.sheets[0].blocks[1].titleHint).toBe('TURMA B');
    const sel = selectBestWorkbookTarget(wb, ['ANA CLARA FERREIRA', 'BRUNO HENRIQUE SOUZA']);
    expect(sel.blockId).toBe(wb.sheets[0].blocks[1].id);
  });
});
