import * as XLSX from 'xlsx';
import { normalizeName } from './normalize';

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Array<Record<string, string>>;
  rawRowCount: number;
  sourceName: string;
}

export interface ParsedTableBlock {
  id: string;
  label: string;
  titleHint: string;
  headerRowIndex: number;
  headers: string[];
  rows: Array<Record<string, string>>;
  rawRowCount: number;
}

export interface ParsedWorkbookSheet {
  name: string;
  blocks: ParsedTableBlock[];
  combinedBlock: ParsedTableBlock | null;
  error?: string;
}

export interface ParsedWorkbook {
  sourceName: string;
  sheets: ParsedWorkbookSheet[];
}

export interface WorkbookAutoSelection {
  sheetIndex: number;
  blockId: string;
  matchedCount: number;
  autoSelected: boolean;
}

export interface ExportSheetSpec {
  name: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

function normalizeHeaderToken(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
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

interface MatrixEntry {
  lineNumber: number;
  cells: string[];
}

const DIRECT_STUDENT_HEADER_RE =
  /^(NOME(\s+(DO|DA)\s+(ALUNO|ALUNA|ESTUDANTE|DISCENTE))?(\(A\))?|ESTUDANTE(\(A\))?|ALUNO(\(A\))?|ALUNA|DISCENTE|NOME\s+COMPLETO)$/;
const NON_STUDENT_NAME_HEADER_RE =
  /\bNOME\s+(DA|DO|DE)\s+(ESCOLA|TURMA|DISCIPLINA|COMPONENTE|CURSO|PROFESSOR|DOCENTE|UNIDADE|ATIVIDADE)\b/;
const COMPANION_HEADER_RE =
  /^(N|NO|N[ºO]|NUM|NUMERO|ORD|MAT|MATRICULA|TURMA|SERIE|NOTA|AV|AVALIACAO|PROVA|TESTE|ATIVIDADE|PARTICIPACAO|SEMINARIO|TRABALHO|MEDIA|REC|RECUPERACAO|FREQUENCIA|PRESENCA|FALTA|FALTAS|OBS|OBSERVACAO|RESULTADO|STATUS|TOTAL)\b|^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;
const BANNER_TITLE_RE =
  /^(TURMA|SERIE|MODULO|CURSO|COMPONENTE|DISCIPLINA|ANO|ENSINO|TURNO|UNIDADE|DIARIO|RESUMO|LISTA|PLANILHA|ESCOLA|PROFESSOR|DOCENTE)\b/;

function isLikelyStudentHeaderRow(cells: string[]): boolean {
  const nonEmpty = cells.map((c) => normalizeHeaderToken(c)).filter(Boolean);
  if (nonEmpty.length < 2) return false;
  if (nonEmpty.some((c) => c.length > 75)) return false;

  const hasDirectNameCol = nonEmpty.some((c) => c.length <= 45 && DIRECT_STUDENT_HEADER_RE.test(c));
  if (hasDirectNameCol) return true;

  const hasNameWord = nonEmpty.some(
    (c) => c.length <= 45 && /\bNOME\b/.test(c) && !NON_STUDENT_NAME_HEADER_RE.test(c)
  );
  const hasCompanion = nonEmpty.some((c) => COMPANION_HEADER_RE.test(c));
  return hasNameWord && hasCompanion;
}

function extractTitleHintFromCells(cells: string[]): string {
  return cells
    .map((c) => String(c ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' — ');
}

function isBannerTitleRow(cells: string[], allowKeywordBanner: boolean): boolean {
  const nonEmpty = cells.map((c) => String(c ?? '').trim()).filter(Boolean);
  if (nonEmpty.length === 0) return true;
  if (nonEmpty.length === 1) return true;
  if (!allowKeywordBanner || nonEmpty.length > 3) return false;

  const joinedNorm = nonEmpty.map((c) => normalizeHeaderToken(c)).join(' ');
  return BANNER_TITLE_RE.test(joinedNorm) || /\bTURMA\b/.test(joinedNorm);
}

function buildBlockFromEntries(
  entries: MatrixEntry[],
  blockIndex: number,
  titleHint: string,
  idOverride?: string
): ParsedTableBlock {
  const headerEntry = entries[0];
  let maxCol = headerEntry.cells.length;
  for (const entry of entries) {
    for (let c = entry.cells.length - 1; c >= 0; c--) {
      if (String(entry.cells[c] ?? '').trim() !== '') {
        if (c + 1 > maxCol) maxCol = c + 1;
        break;
      }
    }
  }

  const slicedHeader = Array.from({ length: maxCol }, (_, i) => headerEntry.cells[i] ?? '');
  const headers = deduplicateHeaders(slicedHeader);

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < entries.length; i++) {
    const rawRow = entries[i].cells;
    const obj: Record<string, string> = {};
    let hasValue = false;
    for (let c = 0; c < headers.length; c++) {
      const val = String(rawRow[c] ?? '').trim();
      if (val !== '') hasValue = true;
      obj[headers[c]] = val;
    }
    if (hasValue) rows.push(obj);
  }

  const cleanHint = titleHint.trim();
  const label = cleanHint
    ? `${cleanHint.slice(0, 48)}${cleanHint.length > 48 ? '…' : ''} (${rows.length} linhas)`
    : `Bloco ${blockIndex + 1} (linha ${headerEntry.lineNumber} • ${rows.length} linhas)`;

  return {
    id: idOverride ?? `block_${blockIndex}`,
    label,
    titleHint: cleanHint,
    headerRowIndex: headerEntry.lineNumber,
    headers,
    rows,
    rawRowCount: rows.length,
  };
}

function buildCombinedBlock(blocks: ParsedTableBlock[]): ParsedTableBlock | null {
  if (blocks.length <= 1) return null;
  const combinedHeaders: string[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    for (const h of block.headers) {
      if (!seen.has(h)) {
        seen.add(h);
        combinedHeaders.push(h);
      }
    }
  }

  const combinedRows: Array<Record<string, string>> = [];
  for (const block of blocks) {
    for (const row of block.rows) {
      const merged: Record<string, string> = {};
      for (const h of combinedHeaders) {
        merged[h] = row[h] ?? '';
      }
      combinedRows.push(merged);
    }
  }

  return {
    id: '__all__',
    label: `Todos os blocos combinados (${combinedRows.length} linhas)`,
    titleHint: 'Todos os blocos',
    headerRowIndex: blocks[0].headerRowIndex,
    headers: combinedHeaders,
    rows: combinedRows,
    rawRowCount: combinedRows.length,
  };
}

function extractBlocksFromMatrix(matrix: string[][]): ParsedTableBlock[] {
  const entries: MatrixEntry[] = [];
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (row.some((cell) => String(cell ?? '').trim() !== '')) {
      entries.push({ lineNumber: r + 1, cells: row });
    }
  }
  if (entries.length === 0) return [];

  const detectedHeaderIndices: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (isLikelyStudentHeaderRow(entries[i].cells)) {
      detectedHeaderIndices.push(i);
    }
  }

  const headerIndices = detectedHeaderIndices.length > 0 ? detectedHeaderIndices : [0];

  const blocks: ParsedTableBlock[] = [];
  const nextHints: string[] = new Array(headerIndices.length).fill('');

  // Capturar eventual título de turma acima do primeiro cabeçalho (pulando linhas de resumo)
  if (headerIndices[0] > 0) {
    const preCandidates: string[] = [];
    for (let i = Math.max(0, headerIndices[0] - 3); i < headerIndices[0]; i++) {
      const hint = extractTitleHintFromCells(entries[i].cells);
      if (hint) preCandidates.push(hint);
    }
    const turmaMatch = [...preCandidates]
      .reverse()
      .find((h) => /\b(TURMA|SERIE|MODULO|CURSO|COMPONENTE|DISCIPLINA)\b/i.test(normalizeHeaderToken(h)));
    nextHints[0] = turmaMatch ?? preCandidates[preCandidates.length - 1] ?? '';
  }

  // Primeiro passo: definir limites de cada bloco e extrair títulos acima dos cabeçalhos seguintes
  const endIndices = new Array<number>(headerIndices.length);
  for (let b = 0; b < headerIndices.length; b++) {
    const startIdx = headerIndices[b];
    let endIdx = b + 1 < headerIndices.length ? headerIndices[b + 1] - 1 : entries.length - 1;

    if (b + 1 < headerIndices.length) {
      const bannerLines: string[] = [];
      let scan = endIdx;
      let peeled = 0;
      while (scan > startIdx && peeled < 2) {
        if (isBannerTitleRow(entries[scan].cells, true)) {
          bannerLines.unshift(extractTitleHintFromCells(entries[scan].cells));
          scan--;
          peeled++;
        } else {
          break;
        }
      }
      endIdx = scan;
      const turmaMatch = [...bannerLines]
        .reverse()
        .find((h) => /\b(TURMA|SERIE|MODULO|CURSO|COMPONENTE|DISCIPLINA)\b/i.test(normalizeHeaderToken(h)));
      nextHints[b + 1] = turmaMatch ?? bannerLines[bannerLines.length - 1] ?? '';
    }
    endIndices[b] = endIdx;
  }

  for (let b = 0; b < headerIndices.length; b++) {
    const startIdx = headerIndices[b];
    const endIdx = endIndices[b];
    const slice = entries.slice(startIdx, Math.max(startIdx + 1, endIdx + 1));
    blocks.push(buildBlockFromEntries(slice, b, nextHints[b] ?? ''));
  }

  return blocks;
}

function matrixToParsed(matrix: string[][], sourceName: string): ParsedSpreadsheet {
  const blocks = extractBlocksFromMatrix(matrix);
  if (blocks.length === 0) {
    throw new Error('Planilha vazia: nenhuma linha com conteúdo foi encontrada.');
  }
  const first = blocks[0];
  return {
    headers: first.headers,
    rows: first.rows,
    rawRowCount: first.rawRowCount,
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

function parseDelimitedToMatrix(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/);
  const delimiter = detectDelimiter(clean);
  return lines
    .map((line) => parseDelimitedLine(line, delimiter))
    .filter((row) => row.some((c) => c !== ''));
}

function parseDelimitedText(text: string, sourceName: string): ParsedSpreadsheet {
  return matrixToParsed(parseDelimitedToMatrix(text), sourceName);
}

/**
 * Faz o parse completo do arquivo (.xlsx, .xls ou .csv), detectando todas as abas e blocos de turmas.
 */
export function parseWorkbookBuffer(buffer: ArrayBuffer, filename: string): ParsedWorkbook {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('O arquivo selecionado está vazio.');
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const text = decodeCsvText(new Uint8Array(buffer));
    const matrix = parseDelimitedToMatrix(text);
    const blocks = extractBlocksFromMatrix(matrix);
    if (blocks.length === 0) {
      throw new Error('Planilha vazia: nenhuma linha com conteúdo foi encontrada.');
    }
    return {
      sourceName: filename,
      sheets: [
        {
          name: 'Dados',
          blocks,
          combinedBlock: buildCombinedBlock(blocks),
        },
      ],
    };
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  } catch {
    throw new Error(`Não foi possível ler o arquivo "${filename}". Verifique se não está corrompido.`);
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('O arquivo não possui nenhuma aba válida.');
  }

  const sheets: ParsedWorkbookSheet[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws) {
      return { name, blocks: [], combinedBlock: null, error: 'Aba sem dados.' };
    }
    const matrix = sheetToMatrix(ws);
    const blocks = extractBlocksFromMatrix(matrix);
    if (blocks.length === 0) {
      return { name, blocks: [], combinedBlock: null, error: 'Aba vazia.' };
    }
    return {
      name,
      blocks,
      combinedBlock: buildCombinedBlock(blocks),
    };
  });

  if (!sheets.some((s) => s.blocks.length > 0)) {
    throw new Error('Planilha vazia: nenhuma linha com conteúdo foi encontrada.');
  }

  return { sourceName: filename, sheets };
}

/**
 * Faz o parse de texto colado como workbook consolidado (detectando blocos e cabeçalhos internos).
 */
export function parsePastedWorkbook(text: string): ParsedWorkbook {
  if (!text || !text.trim()) {
    throw new Error('Nenhum conteúdo foi colado.');
  }
  const matrix = parseDelimitedToMatrix(text);
  const blocks = extractBlocksFromMatrix(matrix);
  if (blocks.length === 0) {
    throw new Error('Planilha vazia: nenhuma linha com conteúdo foi encontrada.');
  }
  return {
    sourceName: 'colagem',
    sheets: [
      {
        name: 'Colagem',
        blocks,
        combinedBlock: buildCombinedBlock(blocks),
      },
    ],
  };
}

/**
 * Converte uma seleção (aba + bloco) do ParsedWorkbook em ParsedSpreadsheet padrão.
 */
export function toParsedSpreadsheet(
  workbook: ParsedWorkbook,
  sheetIndex: number,
  blockId: string
): ParsedSpreadsheet | null {
  const sheet = workbook.sheets[sheetIndex];
  if (!sheet || sheet.blocks.length === 0) return null;

  const block =
    blockId === '__all__' && sheet.combinedBlock
      ? sheet.combinedBlock
      : sheet.blocks.find((b) => b.id === blockId) ?? sheet.blocks[0];

  if (!block) return null;
  const suffixParts: string[] = [];
  if (workbook.sheets.length > 1) suffixParts.push(sheet.name);
  if (sheet.blocks.length > 1) suffixParts.push(block.titleHint || block.id);
  const labelSuffix = suffixParts.length ? ` [${suffixParts.join(' • ')}]` : '';

  return {
    headers: block.headers,
    rows: block.rows,
    rawRowCount: block.rawRowCount,
    sourceName: `${workbook.sourceName}${labelSuffix}`,
  };
}

function countBlockExactStudentMatches(block: ParsedTableBlock, pageStudentsSet: Set<string>): number {
  if (pageStudentsSet.size === 0 || block.rows.length === 0) return 0;

  const candidateCols = block.headers.filter((h) => {
    const n = normalizeHeaderToken(h);
    return DIRECT_STUDENT_HEADER_RE.test(n) || /\b(NOME|ESTUDANTE|ALUNO|DISCENTE)\b/.test(n);
  });
  const colsToScan = candidateCols.length > 0 ? candidateCols : block.headers;

  const matchedStudents = new Set<string>();
  for (const row of block.rows) {
    for (const col of colsToScan) {
      const norm = normalizeName(row[col] ?? '');
      if (norm && pageStudentsSet.has(norm)) {
        matchedStudents.add(norm);
        break;
      }
    }
  }
  return matchedStudents.size;
}

/**
 * Seleciona automaticamente a aba e o bloco com maior número de alunos exatos da turma aberta.
 * Sem correspondências, retorna a primeira aba/bloco válida (autoSelected: false).
 */
export function selectBestWorkbookTarget(
  workbook: ParsedWorkbook,
  pageStudentNames: string[],
  pageTurmaLabel = '',
  restrictSheetIndex?: number
): WorkbookAutoSelection {
  const pageSet = new Set(pageStudentNames.map((n) => normalizeName(n)).filter(Boolean));
  const turmaTokens = normalizeName(pageTurmaLabel)
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 2 && !['DE', 'DA', 'DO', 'EM', 'PARA', 'TURMA', 'ENSINO', 'MEDIO'].includes(t));

  let fallbackSheetIndex = -1;
  let fallbackBlockId = '';
  let bestSheetIndex = -1;
  let bestBlockId = '';
  let bestMatchedCount = -1;
  let bestTitleBonus = -1;

  for (let sIdx = 0; sIdx < workbook.sheets.length; sIdx++) {
    if (restrictSheetIndex !== undefined && sIdx !== restrictSheetIndex) continue;
    const sheet = workbook.sheets[sIdx];
    if (sheet.blocks.length === 0) continue;

    if (fallbackSheetIndex === -1) {
      fallbackSheetIndex = sIdx;
      fallbackBlockId = sheet.blocks[0].id;
    }

    for (const block of sheet.blocks) {
      const matchedCount = countBlockExactStudentMatches(block, pageSet);
      const hintNorm = normalizeName(`${sheet.name} ${block.titleHint}`);
      const titleBonus = turmaTokens.reduce((acc, tok) => acc + (hintNorm.includes(tok) ? 1 : 0), 0);

      if (
        matchedCount > bestMatchedCount ||
        (matchedCount === bestMatchedCount && titleBonus > bestTitleBonus)
      ) {
        bestMatchedCount = matchedCount;
        bestTitleBonus = titleBonus;
        bestSheetIndex = sIdx;
        bestBlockId = block.id;
      }
    }
  }

  if (bestMatchedCount > 0 && bestSheetIndex >= 0) {
    return {
      sheetIndex: bestSheetIndex,
      blockId: bestBlockId,
      matchedCount: bestMatchedCount,
      autoSelected: true,
    };
  }

  return {
    sheetIndex: fallbackSheetIndex >= 0 ? fallbackSheetIndex : 0,
    blockId: fallbackBlockId,
    matchedCount: 0,
    autoSelected: false,
  };
}

/**
 * Faz o parse de arquivo .xlsx, .xls ou .csv em ArrayBuffer (retorna o primeiro bloco válido).
 */
export function parseSpreadsheetBuffer(buffer: ArrayBuffer, filename: string): ParsedSpreadsheet {
  const wb = parseWorkbookBuffer(buffer, filename);
  const firstSheetIdx = wb.sheets.findIndex((s) => s.blocks.length > 0);
  const parsed = firstSheetIdx >= 0 ? toParsedSpreadsheet(wb, firstSheetIdx, wb.sheets[firstSheetIdx].blocks[0].id) : null;
  if (!parsed) {
    throw new Error('Planilha vazia: nenhuma linha com conteúdo foi encontrada.');
  }
  return {
    ...parsed,
    sourceName: filename,
  };
}

/**
 * Faz o parse de tabela colada diretamente (Excel, Google Sheets, LibreOffice ou CSV).
 */
export function parsePastedTable(text: string): ParsedSpreadsheet {
  const wb = parsePastedWorkbook(text);
  const parsed = toParsedSpreadsheet(wb, 0, wb.sheets[0].blocks[0].id);
  if (!parsed) {
    throw new Error('Planilha vazia: nenhuma linha com conteúdo foi encontrada.');
  }
  return {
    ...parsed,
    sourceName: 'colagem',
  };
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
