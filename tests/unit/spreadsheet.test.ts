import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  exportToCsv,
  exportToXlsxBuffer,
  parsePastedTable,
  parseSpreadsheetBuffer,
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
});
