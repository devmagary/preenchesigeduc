import * as XLSX from 'xlsx';

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Array<Record<string, string>>;
  rawRowCount: number;
  sourceName: string;
}

export interface ExportSheetSpec {
  name: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

function deduplicateHeaders(rawHeaders: string[]): string[] {
  const counts = new Map<string, number>();
  return rawHeaders.map((raw, idx) => {
    const base = String(raw ?? '').replace(/\s+/g, ' ').trim() || `Coluna ${idx + 1}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base} (${seen + 1})`;
  });
}

function formatExcelCell(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (cell.z && XLSX.SSF.is_date(cell.z)) {
      const dc = XLSX.SSF.parse_date_code(cell.v);
      if (dc && dc.y && dc.m && dc.d) {
        return `${String(dc.d).padStart(2, '0')}/${String(dc.m).padStart(2, '0')}/${dc.y}`;
      }
    }
    return String(cell.v);
  }
  if (cell.t === 'd' && cell.v instanceof Date) {
    const d = cell.v;
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }
  if (cell.w !== undefined && cell.t !== 's') {
    return String(cell.w).trim();
  }
  return String(cell.v ?? '').trim();
}

function sheetToMatrix(ws: XLSX.WorkSheet): string[][] {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const matrix: string[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push(formatExcelCell(ws[addr] as XLSX.CellObject | undefined));
    }
    matrix.push(row);
  }
  return matrix;
}

function matrixToParsed(matrix: string[][], sourceName: string): ParsedSpreadsheet {
  const nonEmptyRows = matrix.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmptyRows.length === 0) {
    throw new Error('Planilha vazia: nenhuma linha com conteúdo foi encontrada.');
  }

  const headerRow = nonEmptyRows[0];
  // Remove trailing completely-empty header columns that have no data below
  let maxCol = headerRow.length;
  for (const r of nonEmptyRows) {
    for (let c = r.length - 1; c >= 0; c--) {
      if (String(r[c] ?? '').trim() !== '') {
        if (c + 1 > maxCol) maxCol = c + 1;
        break;
      }
    }
  }
  const slicedHeader = Array.from({ length: maxCol }, (_, i) => headerRow[i] ?? '');
  const headers = deduplicateHeaders(slicedHeader);

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < nonEmptyRows.length; i++) {
    const rawRow = nonEmptyRows[i];
    const obj: Record<string, string> = {};
    let hasValue = false;
    for (let c = 0; c < headers.length; c++) {
      const val = String(rawRow[c] ?? '').trim();
      if (val !== '') hasValue = true;
      obj[headers[c]] = val;
    }
    if (hasValue) rows.push(obj);
  }

  return {
    headers,
    rows,
    rawRowCount: rows.length,
    sourceName,
  };
}

function decodeCsvText(bytes: Uint8Array): string {
  // Strip UTF-8 BOM if present
  let data = bytes;
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    data = data.subarray(3);
    return new TextDecoder('utf-8').decode(data);
  }

  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(data);
  if (utf8.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(data);
  }
  return utf8;
}

function detectDelimiter(text: string): string {
  const sampleLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);
  const candidates = ['\t', ';', ','];
  let best = ';';
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = sampleLines.map((line) => parseDelimitedLine(line, delim).length);
    const minCols = Math.min(...counts);
    const maxCols = Math.max(...counts);
    if (maxCols > 1) {
      const score = minCols * 10 - (maxCols - minCols);
      if (score > bestScore) {
        bestScore = score;
        best = delim;
      }
    }
  }
  return best;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseDelimitedText(text: string, sourceName: string): ParsedSpreadsheet {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/);
  const delimiter = detectDelimiter(clean);
  const matrix = lines
    .map((line) => parseDelimitedLine(line, delimiter))
    .filter((row) => row.some((c) => c !== ''));
  return matrixToParsed(matrix, sourceName);
}

/**
 * Faz o parse de arquivo .xlsx, .xls ou .csv em ArrayBuffer.
 */
export function parseSpreadsheetBuffer(buffer: ArrayBuffer, filename: string): ParsedSpreadsheet {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('O arquivo selecionado está vazio.');
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const text = decodeCsvText(new Uint8Array(buffer));
    return parseDelimitedText(text, filename);
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  } catch {
    throw new Error(`Não foi possível ler o arquivo "${filename}". Verifique se não está corrompido.`);
  }

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('O arquivo não possui nenhuma aba válida.');
  }
  const ws = wb.Sheets[firstSheetName];
  const matrix = sheetToMatrix(ws);
  return matrixToParsed(matrix, filename);
}

/**
 * Faz o parse de tabela colada diretamente (Excel, Google Sheets, LibreOffice ou CSV).
 */
export function parsePastedTable(text: string): ParsedSpreadsheet {
  if (!text || !text.trim()) {
    throw new Error('Nenhum conteúdo foi colado.');
  }
  return parseDelimitedText(text, 'colagem');
}

export function exportToXlsxBuffer(sheets: ExportSheetSpec[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa: Array<Array<string | number>> = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = sheet.headers.map((h, colIdx) => {
      let maxLen = h.length;
      for (const row of sheet.rows) {
        const val = String(row[colIdx] ?? '');
        if (val.length > maxLen) maxLen = val.length;
      }
      return { wch: Math.min(Math.max(maxLen + 3, 12), 48) };
    });
    const safeName = sheet.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Dados';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}

function escapeCsvCell(value: string | number, delimiter = ';'): string {
  const str = String(value ?? '');
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(headers: string[], rows: Array<Array<string | number>>, delimiter = ';'): string {
  const lines = [
    headers.map((h) => escapeCsvCell(h, delimiter)).join(delimiter),
    ...rows.map((r) => headers.map((_, idx) => escapeCsvCell(r[idx] ?? '', delimiter)).join(delimiter)),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export function exportToJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
