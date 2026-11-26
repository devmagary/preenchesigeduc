export type CetepModalidade = 'Ensino Médio' | 'Técnico' | 'Outro';

export interface TurmaIdentity {
  codigo: string;
  curso: string;
  modalidade: CetepModalidade;
  modalidadeDetalhe: string;
  serie: string;
  turno: string;
  componente: string;
  displayLabel: string;
  sheetTabBase: string;
}

export interface CetepActivityCol {
  idAvaliacao: string;
  nome: string;
  valorMax: number;
  colType?: 'grade' | 'integer' | 'percent' | 'text';
}

export interface CetepStudentRow {
  numero: number;
  nome: string;
  matricula: string;
  notas: Record<string, number | null>;
  textValues?: Record<string, string>;
  notaUnidadeFallback?: number | null;
  observacoes?: string;
}

export interface CetepTurmaData {
  idTurmaComponente: string;
  escola: string;
  docente: string;
  ano: string;
  unidade: string;
  isResultadoFinal?: boolean;
  identity: TurmaIdentity;
  atividades: CetepActivityCol[];
  alunos: CetepStudentRow[];
}

export interface CetepExportOptions {
  mode: 'multi_sheet' | 'single_sheet';
  minPassingGrade: number;
  title?: string;
  generatedAt?: Date;
}

export interface CetepTurmaStats {
  turmaLabel: string;
  totalAlunos: number;
  mediaGeral: number | null;
  aprovados: number;
  recuperacao: number;
  semNota: number;
  pctAprovacao: number;
}

function normalizeUpperNoAccents(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const LOWER_WORDS = new Set(['em', 'de', 'da', 'do', 'das', 'dos', 'e', 'para', 'com', 'no', 'na']);

function toSmartTitleCase(raw: string): string {
  const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .toLowerCase()
    .split(' ')
    .map((word, idx) => {
      if (idx > 0 && LOWER_WORDS.has(word)) return word;
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function detectTurno(fullHeader: string, codigo: string): string {
  const fullNorm = normalizeUpperNoAccents(fullHeader);
  if (fullNorm.includes('MATUTINO')) return 'Matutino';
  if (fullNorm.includes('VESPERTINO')) return 'Vespertino';
  if (fullNorm.includes('NOTURNO')) return 'Noturno';
  if (fullNorm.includes('INTEGRAL')) return 'Integral';
  if (fullNorm.includes('DIURNO')) return 'Diurno';

  const codeNorm = normalizeUpperNoAccents(codigo);
  if (/(MAT|\bM\d)/.test(codeNorm) || codeNorm.includes('MAT')) return 'Matutino';
  if (codeNorm.includes('VES')) return 'Vespertino';
  if (codeNorm.includes('NOT')) return 'Noturno';
  if (codeNorm.includes('INT')) return 'Integral';
  return 'Não informado';
}

function detectModalidade(ofertaRaw: string, serieRaw: string): { modalidade: CetepModalidade; detalhe: string } {
  const norm = normalizeUpperNoAccents(`${ofertaRaw} ${serieRaw}`);
  if (norm.includes('ENSINO MEDIO') || norm.includes('INTEGRADO')) {
    return {
      modalidade: 'Ensino Médio',
      detalhe: norm.includes('INTEGRADO') ? 'Ensino Médio Integrado' : 'Ensino Médio',
    };
  }
  if (
    norm.includes('SUBSEQUENTE') ||
    norm.includes('TECNICO') ||
    norm.includes('PROSUB') ||
    norm.includes('CONCOMITANTE') ||
    norm.includes('MODULO')
  ) {
    return {
      modalidade: 'Técnico',
      detalhe: norm.includes('SUBSEQUENTE') ? 'Técnico Subsequente' : 'Técnico',
    };
  }
  return { modalidade: 'Outro', detalhe: ofertaRaw.trim() || 'Regular' };
}

function extractCurso(ofertaRaw: string): string {
  if (!ofertaRaw.trim()) return '';
  const stripped = ofertaRaw
    .replace(/-\s*ENSINO\s+M[ÉE]DIO\s*(INTEGRADO)?/gi, '')
    .replace(/-\s*SUBSEQUENTE/gi, '')
    .replace(/-\s*PROSUB/gi, '')
    .replace(/-\s*CONCOMITANTE/gi, '')
    .replace(/-\s*PROEJA/gi, '')
    .trim();
  return toSmartTitleCase(stripped || ofertaRaw);
}

/**
 * Analisa cabeçalhos de turma do SIGEduc (Portal Docente e Lançar Resultados)
 * extraindo Curso, Modalidade (Ensino Médio ou Técnico), Série/Módulo, Código e Turno.
 */
export function parseTurmaIdentity(input: {
  turma?: string;
  ofertaEnsino?: string;
  serie?: string;
  componente?: string;
  fullTurmaHeader?: string;
}): TurmaIdentity {
  const full = String(input.fullTurmaHeader ?? '').trim();
  let oferta = String(input.ofertaEnsino ?? '').trim();
  let serie = String(input.serie ?? '').trim();
  let codigo = String(input.turma ?? '').trim();

  if (full) {
    const slashParts = full.split('/').map((p) => p.trim());
    const mainPart = slashParts[0] ?? full;
    const segments = mainPart.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean);
    if (!oferta && segments.length >= 1) oferta = segments[0];
    if (!serie && segments.length >= 2) serie = segments[1];
    if (!codigo && segments.length >= 3) codigo = segments[segments.length - 1];
    else if (!codigo && segments.length === 1) codigo = segments[0];
  }

  const curso = extractCurso(oferta) || toSmartTitleCase(codigo) || 'Turma';
  const { modalidade, detalhe } = detectModalidade(oferta || full, serie);
  const turno = detectTurno(full, codigo);
  const serieLabel = serie ? toSmartTitleCase(serie) : '';
  const compLabel = input.componente ? toSmartTitleCase(input.componente) : '';

  const parts = [curso, modalidade];
  if (serieLabel) parts.push(serieLabel);
  if (codigo && codigo !== curso) parts.push(codigo);
  if (turno !== 'Não informado') parts.push(turno);

  const displayLabel = parts.join(' • ');
  const rawTabBase = [codigo || curso.slice(0, 14), turno !== 'Não informado' ? turno.slice(0, 3) : '']
    .filter(Boolean)
    .join(' ');

  return {
    codigo: codigo || 'TURMA',
    curso,
    modalidade,
    modalidadeDetalhe: detalhe,
    serie: serieLabel,
    turno,
    componente: compLabel,
    displayLabel,
    sheetTabBase: sanitizeSheetBaseName(rawTabBase || 'Turma'),
  };
}

function sanitizeSheetBaseName(name: string): string {
  return (
    name
      .replace(/[\\/?*[\]:']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Turma'
  );
}

function makeUniqueSheetName(base: string, usedNames: Set<string>): string {
  const cleanBase = sanitizeSheetBaseName(base);
  if (!usedNames.has(cleanBase.toLowerCase())) {
    usedNames.add(cleanBase.toLowerCase());
    return cleanBase;
  }
  for (let i = 2; i < 100; i++) {
    const suffix = ` (${i})`;
    const candidate = `${cleanBase.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    if (!usedNames.has(candidate.toLowerCase())) {
      usedNames.add(candidate.toLowerCase());
      return candidate;
    }
  }
  const fallback = `Turma_${usedNames.size + 1}`;
  usedNames.add(fallback.toLowerCase());
  return fallback;
}

function isResultadoFinalData(
  atividades: CetepActivityCol[],
  isResultadoFinal?: boolean
): boolean {
  return (
    Boolean(isResultadoFinal) ||
    atividades.some((a) => a.idAvaliacao === 'rf_media_final' || a.idAvaliacao === 'rf_media_anual')
  );
}

export function computeStudentNotaGeral(
  student: CetepStudentRow,
  atividades: CetepActivityCol[],
  isResultadoFinal = false
): number | null {
  if (isResultadoFinalData(atividades, isResultadoFinal)) {
    const mf = student.notas['rf_media_final'];
    if (typeof mf === 'number' && Number.isFinite(mf)) return Math.round(mf * 100) / 100;
    const ma = student.notas['rf_media_anual'];
    if (typeof ma === 'number' && Number.isFinite(ma)) return Math.round(ma * 100) / 100;
    if (typeof student.notaUnidadeFallback === 'number' && Number.isFinite(student.notaUnidadeFallback)) {
      return Math.round(student.notaUnidadeFallback * 100) / 100;
    }
    return null;
  }

  let hasAny = false;
  let sum = 0;
  for (const av of atividades) {
    const val = student.notas[av.idAvaliacao];
    if (typeof val === 'number' && Number.isFinite(val)) {
      hasAny = true;
      sum += val;
    }
  }
  if (hasAny) return Math.round(sum * 100) / 100;
  if (atividades.length === 0 && typeof student.notaUnidadeFallback === 'number' && Number.isFinite(student.notaUnidadeFallback)) {
    return Math.round(student.notaUnidadeFallback * 100) / 100;
  }
  return null;
}

export function computeCetepTurmaStats(turma: CetepTurmaData, minPassingGrade = 5.0): CetepTurmaStats {
  let aprovados = 0;
  let recuperacao = 0;
  let semNota = 0;
  let sumNotas = 0;
  let countNotas = 0;

  for (const st of turma.alunos) {
    const nota = computeStudentNotaGeral(st, turma.atividades, turma.isResultadoFinal);
    if (nota === null) {
      semNota++;
    } else {
      countNotas++;
      sumNotas += nota;
      if (nota >= minPassingGrade - 1e-6) aprovados++;
      else recuperacao++;
    }
  }

  const totalAlunos = turma.alunos.length;
  return {
    turmaLabel: turma.identity.displayLabel,
    totalAlunos,
    mediaGeral: countNotas > 0 ? Math.round((sumNotas / countNotas) * 100) / 100 : null,
    aprovados,
    recuperacao,
    semNota,
    pctAprovacao: totalAlunos > 0 ? aprovados / totalAlunos : 0,
  };
}

// --- OOXML (XLSX) WRITER COM FÓRMULAS REAIS E ESTILIZAÇÃO CETEP ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZipStore(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // method: STORE
    lv.setUint16(10, 0x0000, true); // mod time
    lv.setUint16(12, 0x5a21, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0x0000, true);
    cv.setUint16(14, 0x5a21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    centralChunks.push(cd);

    offset += localHeader.length + data.length;
  }

  let cdSize = 0;
  for (const c of centralChunks) cdSize += c.length;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + cdSize + eocd.length;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const chunk of localChunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  for (const chunk of centralChunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  out.set(eocd, pos);
  return out;
}

function xmlEscape(raw: string): string {
  return String(raw ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colToLetter(colIdxZeroBased: number): string {
  let n = colIdxZeroBased + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetRef(sheetName: string, range: string): string {
  return `'${sheetName.replace(/'/g, "''")}'!${range}`;
}

/**
 * Índices de estilo (cellXfs) definidos em buildStylesXml():
 *  0: Default
 *  1: Banner título principal (#1E3A5F fundo, branco negrito 13pt, centro)
 *  2: Subtítulo (#E8EEF5 fundo, azul escuro itálico 10pt, esquerda)
 *  3: Faixa seção / turma (#2B4C7E fundo, branco negrito 11pt, esquerda)
 *  4: Cabeçalho de tabela (#334155 fundo, branco negrito 10pt, centro/wrap)
 *  5: Texto normal esquerda (borda fina)
 *  6: Texto zebra esquerda (#F8FAFC, borda fina)
 *  7: Texto normal centro (borda fina)
 *  8: Texto zebra centro (#F8FAFC, borda fina)
 *  9: Número 0.0 normal (borda fina, centro)
 * 10: Número 0.0 zebra (#F8FAFC, borda fina, centro)
 * 11: Percentual 0.0% normal (borda fina, centro)
 * 12: Percentual 0.0% zebra (#F8FAFC, borda fina, centro)
 * 13: Status Aprovado (#DCFCE7 fundo, #166534 negrito, centro)
 * 14: Status Recuperação (#FEE2E2 fundo, #991B1B negrito, centro)
 * 15: Status Sem Nota (#F1F5F9 fundo, #475569 negrito, centro)
 * 16: Linha Resumo texto (#DBEAFE fundo, #1E3A5F negrito, esquerda)
 * 17: Linha Resumo número 0.0 (#DBEAFE fundo, #1E3A5F negrito, centro)
 * 18: Linha Resumo inteiro 0 (#DBEAFE fundo, #1E3A5F negrito, centro)
 * 19: Linha Resumo percentual 0.0% (#DBEAFE fundo, #1E3A5F negrito, centro)
 * 20: Inteiro 0 normal (borda fina, centro)
 * 21: Inteiro 0 zebra (#F8FAFC, borda fina, centro)
 */
function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="0.0"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
    <numFmt numFmtId="166" formatCode="0"/>
  </numFmts>
  <fonts count="11">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><i/><sz val="10"/><color rgb="FF1E3A5F"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF166534"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF991B1B"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1E3A5F"/><name val="Calibri"/></font>
    <font><u/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Calibri"/></font>
    <font><b/><u/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Calibri"/></font>
    <font><b/><u/><sz val="10"/><color rgb="FFE0F2FE"/><name val="Calibri"/></font>
  </fonts>
  <fills count="11">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2B4C7E"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF334155"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="medium"><color rgb="FF1E3A5F"/></top>
      <bottom style="medium"><color rgb="FF1E3A5F"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="26">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="10" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="7" fillId="10" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="166" fontId="7" fillId="10" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="165" fontId="7" fillId="10" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="166" fontId="0" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <dxfs count="3">
    <dxf><font><b/><color rgb="FF166534"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFDCFCE7"/></patternFill></fill></dxf>
    <dxf><font><b/><color rgb="FF991B1B"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFEE2E2"/></patternFill></fill></dxf>
    <dxf><font><color rgb="FF475569"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFF1F5F9"/></patternFill></fill></dxf>
  </dxfs>
</styleSheet>`;
}

interface CellSpec {
  col: number; // 0-based
  style: number;
  kind: 'empty' | 'str' | 'num' | 'formula_num' | 'formula_str';
  val?: string | number | null;
  formula?: string;
}

interface RowSpec {
  rowNum: number; // 1-based
  height?: number;
  cells: CellSpec[];
}

interface HyperlinkSpec {
  ref: string;
  location: string;
  display?: string;
  tooltip?: string;
}

class SheetBuilder {
  private rows: RowSpec[] = [];
  private merges: string[] = [];
  private colWidths = new Map<number, number>();
  private condFormats: string[] = [];
  private hyperlinks: HyperlinkSpec[] = [];
  private freezeAtRow: number | null = null;

  public setColWidth(col: number, width: number): void {
    const prev = this.colWidths.get(col) ?? 0;
    if (width > prev) this.colWidths.set(col, width);
  }

  public addMerge(r1: number, c1: number, r2: number, c2: number): void {
    this.merges.push(`${colToLetter(c1)}${r1}:${colToLetter(c2)}${r2}`);
  }

  public setFreezeRow(rowNumBelow: number): void {
    this.freezeAtRow = rowNumBelow;
  }

  public addHyperlink(ref: string, location: string, display?: string, tooltip?: string): void {
    this.hyperlinks.push({ ref, location, display, tooltip });
  }

  public addStatusConditionalFormat(sqref: string): void {
    this.condFormats.push(
      `<conditionalFormatting sqref="${sqref}">` +
        `<cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>"Aprovado"</formula></cfRule>` +
        `<cfRule type="cellIs" dxfId="1" priority="2" operator="equal"><formula>"Recuperação"</formula></cfRule>` +
        `<cfRule type="cellIs" dxfId="2" priority="3" operator="equal"><formula>"Sem Nota"</formula></cfRule>` +
      `</conditionalFormatting>`
    );
  }

  public addRow(rowNum: number, cells: CellSpec[], height?: number): void {
    this.rows.push({ rowNum, cells, height });
  }

  public toXml(): string {
    const colsXml = this.colWidths.size
      ? `<cols>${Array.from(this.colWidths.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([c, w]) => `<col min="${c + 1}" max="${c + 1}" width="${w.toFixed(1)}" customWidth="1"/>`)
          .join('')}</cols>`
      : '';

    const viewsXml = this.freezeAtRow
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${this.freezeAtRow - 1}" topLeftCell="A${this.freezeAtRow}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;

    const rowsXml = this.rows
      .map((row) => {
        const ht = row.height ? ` ht="${row.height}" customHeight="1"` : '';
        const cellsXml = row.cells
          .sort((a, b) => a.col - b.col)
          .map((cell) => {
            const ref = `${colToLetter(cell.col)}${row.rowNum}`;
            if (cell.kind === 'empty') {
              return `<c r="${ref}" s="${cell.style}"/>`;
            }
            if (cell.kind === 'str') {
              const sVal = String(cell.val ?? '');
              const preserve = /^\s|\s$/.test(sVal) ? ' xml:space="preserve"' : '';
              return `<c r="${ref}" s="${cell.style}" t="inlineStr"><is><t${preserve}>${xmlEscape(sVal)}</t></is></c>`;
            }
            if (cell.kind === 'num') {
              return typeof cell.val === 'number' && Number.isFinite(cell.val)
                ? `<c r="${ref}" s="${cell.style}"><v>${cell.val}</v></c>`
                : `<c r="${ref}" s="${cell.style}"/>`;
            }
            if (cell.kind === 'formula_num') {
              const fXml = `<f>${xmlEscape(cell.formula ?? '')}</f>`;
              if (typeof cell.val === 'number' && Number.isFinite(cell.val)) {
                return `<c r="${ref}" s="${cell.style}">${fXml}<v>${cell.val}</v></c>`;
              }
              return `<c r="${ref}" s="${cell.style}" t="str">${fXml}<v></v></c>`;
            }
            // formula_str
            return `<c r="${ref}" s="${cell.style}" t="str"><f>${xmlEscape(cell.formula ?? '')}</f><v>${xmlEscape(String(cell.val ?? ''))}</v></c>`;
          })
          .join('');
        return `<row r="${row.rowNum}"${ht}>${cellsXml}</row>`;
      })
      .join('');

    const mergesXml = this.merges.length
      ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';

    const hyperlinksXml = this.hyperlinks.length
      ? `<hyperlinks>${this.hyperlinks
          .map((h) => {
            const disp = h.display ? ` display="${xmlEscape(h.display)}"` : '';
            const tip = h.tooltip ? ` tooltip="${xmlEscape(h.tooltip)}"` : '';
            return `<hyperlink ref="${h.ref}" location="${xmlEscape(h.location)}"${disp}${tip}/>`;
          })
          .join('')}</hyperlinks>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${viewsXml}
  <sheetFormatPr defaultRowHeight="19"/>
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
  ${mergesXml}
  ${this.condFormats.join('')}
  ${hyperlinksXml}
</worksheet>`;
  }
}

interface TurmaRangeRef {
  sheetName: string;
  anchorRow: number;
  firstStudentRow: number;
  lastStudentRow: number;
  nameColLetter: string;
  notaGeralColLetter: string;
  situacaoColLetter: string;
  turma: CetepTurmaData;
}

function appendTurmaBlockToBuilder(
  sb: SheetBuilder,
  startRow: number,
  turma: CetepTurmaData,
  minGradeStr: string,
  minPassingGrade: number,
  sheetName: string,
  showBannerHeader: boolean
): { nextRow: number; rangeRef: TurmaRangeRef } {
  const isRF = isResultadoFinalData(turma.atividades, turma.isResultadoFinal);
  const atividades =
    turma.atividades.length > 0
      ? turma.atividades
      : [{ idAvaliacao: '__placeholder__', nome: 'Avaliação 1', valorMax: 10 }];
  const avCount = atividades.length;

  const colNum = 0; // Nº
  const colNome = 1; // Nome do Aluno
  const colMat = 2; // Matrícula
  const firstAvCol = 3;
  const lastAvCol = firstAvCol + avCount - 1;
  const colNotaGeral = lastAvCol + 1;
  const colSituacao = lastAvCol + 2;
  const colObs = lastAvCol + 3;

  sb.setColWidth(colNum, 6);
  sb.setColWidth(colNome, 36);
  sb.setColWidth(colMat, 16);
  for (let i = 0; i < avCount; i++) {
    const widthHint = isRF ? atividades[i].nome.length + 3 : atividades[i].nome.length + 7;
    sb.setColWidth(firstAvCol + i, Math.min(26, Math.max(isRF ? 13 : 15, widthHint)));
  }
  sb.setColWidth(colNotaGeral, 14);
  sb.setColWidth(colSituacao, 16);
  sb.setColWidth(colObs, 28);

  let r = startRow;

  if (showBannerHeader) {
    const bannerCells: CellSpec[] = [
      { col: 0, style: 3, kind: 'str', val: `${turma.identity.displayLabel} — ${turma.identity.componente} (${turma.unidade})` },
    ];
    for (let c = 1; c < colObs; c++) bannerCells.push({ col: c, style: 3, kind: 'empty' });
    bannerCells.push({ col: colObs, style: 25, kind: 'str', val: '↑ Voltar ao Painel' });
    sb.addRow(r, bannerCells, 24);
    if (colObs - 1 >= 1) sb.addMerge(r, 0, r, colObs - 1);
    sb.addHyperlink(
      `${colToLetter(colObs)}${r}`,
      sheetRef(sheetName, 'A4'),
      '↑ Voltar ao Painel',
      'Voltar ao Painel Consolidado no topo da planilha'
    );
    r++;
  }

  const headerCells: CellSpec[] = [
    { col: colNum, style: 4, kind: 'str', val: 'Nº' },
    { col: colNome, style: 4, kind: 'str', val: 'Nome do Aluno' },
    { col: colMat, style: 4, kind: 'str', val: 'Matrícula' },
    ...atividades.map((av, idx) => ({
      col: firstAvCol + idx,
      style: 4,
      kind: 'str' as const,
      val: isRF ? av.nome : `${av.nome} (${av.valorMax.toFixed(1)})`,
    })),
    { col: colNotaGeral, style: 4, kind: 'str', val: 'Nota Geral' },
    { col: colSituacao, style: 4, kind: 'str', val: 'Situação' },
    { col: colObs, style: 4, kind: 'str', val: 'Observações' },
  ];
  sb.addRow(r, headerCells, 26);
  r++;

  const firstStudentRow = r;
  const firstAvLetter = colToLetter(firstAvCol);
  const lastAvLetter = colToLetter(lastAvCol);
  const notaGeralLetter = colToLetter(colNotaGeral);
  const rfMediaFinalIdx = isRF ? atividades.findIndex((a) => a.idAvaliacao === 'rf_media_final') : -1;
  const rfMediaAnualIdx = isRF ? atividades.findIndex((a) => a.idAvaliacao === 'rf_media_anual') : -1;

  const avSums = new Array<number>(avCount).fill(0);
  const avCounts = new Array<number>(avCount).fill(0);
  let totalNotaSum = 0;
  let totalNotaCount = 0;

  const alunos = turma.alunos;
  for (let i = 0; i < alunos.length; i++) {
    const st = alunos[i];
    const zebra = i % 2 === 1;
    const textLeftStyle = zebra ? 6 : 5;
    const textCenterStyle = zebra ? 8 : 7;
    const numCenterStyle = zebra ? 21 : 20;
    const gradeStyle = zebra ? 10 : 9;

    const notaGeral = computeStudentNotaGeral(st, turma.atividades, isRF);
    const situacao =
      notaGeral === null
        ? 'Sem Nota'
        : notaGeral >= minPassingGrade - 1e-6
          ? 'Aprovado'
          : 'Recuperação';
    const situacaoStyle = notaGeral === null ? 15 : notaGeral >= minPassingGrade - 1e-6 ? 13 : 14;

    if (notaGeral !== null) {
      totalNotaSum += notaGeral;
      totalNotaCount++;
    }

    const rowCells: CellSpec[] = [
      { col: colNum, style: numCenterStyle, kind: 'num', val: st.numero || i + 1 },
      { col: colNome, style: textLeftStyle, kind: 'str', val: st.nome },
      { col: colMat, style: textCenterStyle, kind: 'str', val: st.matricula || '' },
    ];

    for (let aIdx = 0; aIdx < avCount; aIdx++) {
      const av = atividades[aIdx];
      if (av.colType === 'text') {
        const txt = st.textValues?.[av.idAvaliacao] ?? '';
        rowCells.push({ col: firstAvCol + aIdx, style: textCenterStyle, kind: 'str', val: txt });
        continue;
      }
      const rawVal = av.idAvaliacao === '__placeholder__' ? null : st.notas[av.idAvaliacao];
      if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
        avSums[aIdx] += rawVal;
        avCounts[aIdx]++;
        const cellStyle = av.colType === 'integer' ? numCenterStyle : gradeStyle;
        const cellVal = av.colType === 'integer' ? Math.round(rawVal) : rawVal;
        rowCells.push({ col: firstAvCol + aIdx, style: cellStyle, kind: 'num', val: cellVal });
      } else {
        const cellStyle = av.colType === 'integer' ? numCenterStyle : gradeStyle;
        rowCells.push({ col: firstAvCol + aIdx, style: cellStyle, kind: 'empty' });
      }
    }

    if (isRF) {
      if (rfMediaFinalIdx >= 0 && rfMediaAnualIdx >= 0) {
        const mfRef = `${colToLetter(firstAvCol + rfMediaFinalIdx)}${r}`;
        const maRef = `${colToLetter(firstAvCol + rfMediaAnualIdx)}${r}`;
        rowCells.push({
          col: colNotaGeral,
          style: gradeStyle,
          kind: 'formula_num',
          formula: `IF(${mfRef}<>"",${mfRef},IF(${maRef}<>"",${maRef},""))`,
          val: notaGeral,
        });
      } else if (rfMediaFinalIdx >= 0) {
        const mfRef = `${colToLetter(firstAvCol + rfMediaFinalIdx)}${r}`;
        rowCells.push({
          col: colNotaGeral,
          style: gradeStyle,
          kind: 'formula_num',
          formula: `IF(${mfRef}<>"",${mfRef},"")`,
          val: notaGeral,
        });
      } else if (rfMediaAnualIdx >= 0) {
        const maRef = `${colToLetter(firstAvCol + rfMediaAnualIdx)}${r}`;
        rowCells.push({
          col: colNotaGeral,
          style: gradeStyle,
          kind: 'formula_num',
          formula: `IF(${maRef}<>"",${maRef},"")`,
          val: notaGeral,
        });
      } else if (notaGeral !== null) {
        rowCells.push({ col: colNotaGeral, style: gradeStyle, kind: 'num', val: notaGeral });
      } else {
        rowCells.push({ col: colNotaGeral, style: gradeStyle, kind: 'empty' });
      }
    } else if (turma.atividades.length > 0) {
      rowCells.push({
        col: colNotaGeral,
        style: gradeStyle,
        kind: 'formula_num',
        formula: `IF(COUNT(${firstAvLetter}${r}:${lastAvLetter}${r})=0,"",SUM(${firstAvLetter}${r}:${lastAvLetter}${r}))`,
        val: notaGeral,
      });
    } else if (notaGeral !== null) {
      rowCells.push({ col: colNotaGeral, style: gradeStyle, kind: 'num', val: notaGeral });
    } else {
      rowCells.push({ col: colNotaGeral, style: gradeStyle, kind: 'empty' });
    }

    rowCells.push({
      col: colSituacao,
      style: situacaoStyle,
      kind: 'formula_str',
      formula: `IF(${notaGeralLetter}${r}="","Sem Nota",IF(${notaGeralLetter}${r}>=${minGradeStr},"Aprovado","Recuperação"))`,
      val: situacao,
    });

    rowCells.push({ col: colObs, style: textLeftStyle, kind: 'str', val: st.observacoes ?? '' });
    sb.addRow(r, rowCells, 20);
    r++;
  }

  const lastStudentRow = Math.max(firstStudentRow, r - 1);
  if (alunos.length > 0) {
    const sitColLetter = colToLetter(colSituacao);
    sb.addStatusConditionalFormat(`${sitColLetter}${firstStudentRow}:${sitColLetter}${lastStudentRow}`);

    // Linha MÉDIA DA TURMA
    const avgCells: CellSpec[] = [
      { col: colNum, style: 16, kind: 'empty' },
      { col: colNome, style: 16, kind: 'str', val: 'MÉDIA DA TURMA' },
      { col: colMat, style: 16, kind: 'empty' },
    ];
    for (let aIdx = 0; aIdx < avCount; aIdx++) {
      if (atividades[aIdx].colType === 'text') {
        avgCells.push({ col: firstAvCol + aIdx, style: 16, kind: 'empty' });
        continue;
      }
      const colL = colToLetter(firstAvCol + aIdx);
      const cached = avCounts[aIdx] > 0 ? Math.round((avSums[aIdx] / avCounts[aIdx]) * 100) / 100 : null;
      avgCells.push({
        col: firstAvCol + aIdx,
        style: 17,
        kind: 'formula_num',
        formula: `IFERROR(AVERAGE(${colL}${firstStudentRow}:${colL}${lastStudentRow}),"")`,
        val: cached,
      });
    }
    const cachedTotalAvg = totalNotaCount > 0 ? Math.round((totalNotaSum / totalNotaCount) * 100) / 100 : null;
    avgCells.push({
      col: colNotaGeral,
      style: 17,
      kind: 'formula_num',
      formula: `IFERROR(AVERAGE(${notaGeralLetter}${firstStudentRow}:${notaGeralLetter}${lastStudentRow}),"")`,
      val: cachedTotalAvg,
    });
    avgCells.push({ col: colSituacao, style: 16, kind: 'empty' });
    avgCells.push({ col: colObs, style: 16, kind: 'empty' });
    sb.addRow(r, avgCells, 22);
    r++;
  }

  return {
    nextRow: r,
    rangeRef: {
      sheetName,
      anchorRow: showBannerHeader ? startRow : 1,
      firstStudentRow,
      lastStudentRow,
      nameColLetter: colToLetter(colNome),
      notaGeralColLetter: notaGeralLetter,
      situacaoColLetter: colToLetter(colSituacao),
      turma,
    },
  };
}

function shortUnitTag(unidade: string): string {
  if (/res\.?\s*final|resultado\s*final/i.test(String(unidade ?? ''))) return 'RF';
  const m = String(unidade ?? '').match(/(\d+)/);
  if (m?.[1]) return `${m[1]}U`;
  return '';
}

function groupTurmasByModalidade(turmas: CetepTurmaData[]): {
  orderedTurmas: CetepTurmaData[];
  groups: Array<{ modalidade: CetepModalidade; count: number }>;
} {
  const order: CetepModalidade[] = ['Ensino Médio', 'Técnico', 'Outro'];
  const orderedTurmas: CetepTurmaData[] = [];
  const groups: Array<{ modalidade: CetepModalidade; count: number }> = [];

  for (const mod of order) {
    const items = turmas.filter((t) => t.identity.modalidade === mod);
    if (items.length > 0) {
      orderedTurmas.push(...items);
      groups.push({ modalidade: mod, count: items.length });
    }
  }
  return { orderedTurmas, groups };
}

function appendPainelConsolidado(
  sb: SheetBuilder,
  startRow: number,
  turmaRanges: TurmaRangeRef[],
  minPassingGrade: number,
  crossSheet: boolean
): number {
  const minDisplay = minPassingGrade.toFixed(1).replace('.', ',');

  sb.setColWidth(0, 42); // Turma
  sb.setColWidth(1, 15); // Modalidade
  sb.setColWidth(2, 13); // Unidade
  sb.setColWidth(3, 15); // Total de Alunos
  sb.setColWidth(4, 13); // Média Geral
  sb.setColWidth(5, 18); // Aprovados
  sb.setColWidth(6, 18); // Recuperação
  sb.setColWidth(7, 12); // Sem Nota
  sb.setColWidth(8, 14); // % Aprovação

  let r = startRow;

  // Faixa Painel Consolidado (A..I = cols 0..8)
  sb.addRow(
    r,
    [
      { col: 0, style: 3, kind: 'str', val: 'PAINEL CONSOLIDADO DE DESEMPENHO POR TURMA' },
      ...Array.from({ length: 8 }, (_, idx) => ({ col: idx + 1, style: 3, kind: 'empty' as const })),
    ],
    24
  );
  sb.addMerge(r, 0, r, 8);
  r++;

  sb.addRow(
    r,
    [
      { col: 0, style: 4, kind: 'str', val: 'Turma (Curso • Série • Código • Turno)' },
      { col: 1, style: 4, kind: 'str', val: 'Modalidade' },
      { col: 2, style: 4, kind: 'str', val: 'Unidade' },
      { col: 3, style: 4, kind: 'str', val: 'Total de Alunos' },
      { col: 4, style: 4, kind: 'str', val: 'Média Geral' },
      { col: 5, style: 4, kind: 'str', val: `Aprovados (>= ${minDisplay})` },
      { col: 6, style: 4, kind: 'str', val: `Recuperação (< ${minDisplay})` },
      { col: 7, style: 4, kind: 'str', val: 'Sem Nota' },
      { col: 8, style: 4, kind: 'str', val: '% Aprovação' },
    ],
    26
  );
  r++;

  // Agrupar por modalidade mantendo ordem
  const groups: Array<{ modalidade: CetepModalidade; refs: TurmaRangeRef[] }> = [];
  for (const ref of turmaRanges) {
    const existing = groups.find((g) => g.modalidade === ref.turma.identity.modalidade);
    if (existing) existing.refs.push(ref);
    else groups.push({ modalidade: ref.turma.identity.modalidade, refs: [ref] });
  }
  const hasMultipleGroups = groups.length > 1;

  const dataRanges: Array<{ start: number; end: number }> = [];
  let totalAlunosAll = 0;
  let totalAprovAll = 0;
  let totalRecAll = 0;
  let totalSemNotaAll = 0;
  let turmaMediaSumAll = 0;
  let turmaMediaCountAll = 0;
  let rowZebraIdx = 0;

  for (const group of groups) {
    const groupStart = r;
    let gAlunos = 0;
    let gAprov = 0;
    let gRec = 0;
    let gSemNota = 0;
    let gMediaSum = 0;
    let gMediaCount = 0;

    for (const ref of group.refs) {
      const stats = computeCetepTurmaStats(ref.turma, minPassingGrade);
      const zebra = rowZebraIdx % 2 === 1;
      rowZebraIdx++;
      const hasStudents = ref.turma.alunos.length > 0;

      gAlunos += stats.totalAlunos;
      gAprov += stats.aprovados;
      gRec += stats.recuperacao;
      gSemNota += stats.semNota;
      if (stats.mediaGeral !== null) {
        gMediaSum += stats.mediaGeral;
        gMediaCount++;
      }

      totalAlunosAll += stats.totalAlunos;
      totalAprovAll += stats.aprovados;
      totalRecAll += stats.recuperacao;
      totalSemNotaAll += stats.semNota;
      if (stats.mediaGeral !== null) {
        turmaMediaSumAll += stats.mediaGeral;
        turmaMediaCountAll++;
      }

      const rRange = (colL: string) =>
        crossSheet
          ? sheetRef(ref.sheetName, `${colL}${ref.firstStudentRow}:${colL}${ref.lastStudentRow}`)
          : `${colL}${ref.firstStudentRow}:${colL}${ref.lastStudentRow}`;

      const labelWithComp = ref.turma.identity.componente
        ? `${ref.turma.identity.displayLabel} — ${ref.turma.identity.componente}`
        : ref.turma.identity.displayLabel;

      sb.addRow(
        r,
        [
          { col: 0, style: zebra ? 23 : 22, kind: 'str', val: labelWithComp },
          { col: 1, style: zebra ? 8 : 7, kind: 'str', val: ref.turma.identity.modalidade },
          { col: 2, style: zebra ? 8 : 7, kind: 'str', val: ref.turma.unidade },
          {
            col: 3,
            style: zebra ? 21 : 20,
            kind: hasStudents ? 'formula_num' : 'num',
            formula: hasStudents ? `COUNTA(${rRange(ref.nameColLetter)})` : undefined,
            val: stats.totalAlunos,
          },
          {
            col: 4,
            style: zebra ? 10 : 9,
            kind: hasStudents ? 'formula_num' : 'empty',
            formula: hasStudents ? `IFERROR(AVERAGE(${rRange(ref.notaGeralColLetter)}),"")` : undefined,
            val: stats.mediaGeral,
          },
          {
            col: 5,
            style: zebra ? 21 : 20,
            kind: hasStudents ? 'formula_num' : 'num',
            formula: hasStudents ? `COUNTIF(${rRange(ref.situacaoColLetter)},"Aprovado")` : undefined,
            val: stats.aprovados,
          },
          {
            col: 6,
            style: zebra ? 21 : 20,
            kind: hasStudents ? 'formula_num' : 'num',
            formula: hasStudents ? `COUNTIF(${rRange(ref.situacaoColLetter)},"Recuperação")` : undefined,
            val: stats.recuperacao,
          },
          {
            col: 7,
            style: zebra ? 21 : 20,
            kind: hasStudents ? 'formula_num' : 'num',
            formula: hasStudents ? `COUNTIF(${rRange(ref.situacaoColLetter)},"Sem Nota")` : undefined,
            val: stats.semNota,
          },
          {
            col: 8,
            style: zebra ? 12 : 11,
            kind: 'formula_num',
            formula: `IF(D${r}=0,0,F${r}/D${r})`,
            val: Math.round(stats.pctAprovacao * 10000) / 10000,
          },
        ],
        20
      );
      const targetLocation = sheetRef(ref.sheetName, `A${ref.anchorRow}`);
      sb.addHyperlink(
        `A${r}`,
        targetLocation,
        labelWithComp,
        crossSheet ? `Abrir aba ${ref.sheetName}` : `Ir para bloco ${labelWithComp}`
      );
      r++;
    }

    const groupEnd = Math.max(groupStart, r - 1);
    dataRanges.push({ start: groupStart, end: groupEnd });

    if (hasMultipleGroups) {
      const gAvg = gMediaCount > 0 ? Math.round((gMediaSum / gMediaCount) * 100) / 100 : null;
      const gPct = gAlunos > 0 ? Math.round((gAprov / gAlunos) * 10000) / 10000 : 0;
      const unitSet = new Set(group.refs.map((x) => x.turma.unidade));
      const unitSummary = unitSet.size === 1 ? Array.from(unitSet)[0] : 'Mista';

      sb.addRow(
        r,
        [
          { col: 0, style: 16, kind: 'str', val: `SUBTOTAL — ${group.modalidade.toUpperCase()}` },
          { col: 1, style: 16, kind: 'str', val: group.modalidade },
          { col: 2, style: 16, kind: 'str', val: unitSummary },
          { col: 3, style: 18, kind: 'formula_num', formula: `SUM(D${groupStart}:D${groupEnd})`, val: gAlunos },
          { col: 4, style: 17, kind: 'formula_num', formula: `IFERROR(AVERAGE(E${groupStart}:E${groupEnd}),"")`, val: gAvg },
          { col: 5, style: 18, kind: 'formula_num', formula: `SUM(F${groupStart}:F${groupEnd})`, val: gAprov },
          { col: 6, style: 18, kind: 'formula_num', formula: `SUM(G${groupStart}:G${groupEnd})`, val: gRec },
          { col: 7, style: 18, kind: 'formula_num', formula: `SUM(H${groupStart}:H${groupEnd})`, val: gSemNota },
          { col: 8, style: 19, kind: 'formula_num', formula: `IF(D${r}=0,0,F${r}/D${r})`, val: gPct },
        ],
        21
      );
      r++;
    }
  }

  const joinColRanges = (colL: string) =>
    dataRanges.map((g) => (g.start === g.end ? `${colL}${g.start}` : `${colL}${g.start}:${colL}${g.end}`)).join(',');

  const overallAvg = turmaMediaCountAll > 0 ? Math.round((turmaMediaSumAll / turmaMediaCountAll) * 100) / 100 : null;
  const overallPct = totalAlunosAll > 0 ? Math.round((totalAprovAll / totalAlunosAll) * 10000) / 10000 : 0;

  sb.addRow(
    r,
    [
      { col: 0, style: 16, kind: 'str', val: 'TOTAL GERAL' },
      { col: 1, style: 16, kind: 'str', val: hasMultipleGroups ? 'Todas' : groups[0]?.modalidade ?? '' },
      { col: 2, style: 16, kind: 'str', val: '—' },
      { col: 3, style: 18, kind: 'formula_num', formula: `SUM(${joinColRanges('D')})`, val: totalAlunosAll },
      { col: 4, style: 17, kind: 'formula_num', formula: `IFERROR(AVERAGE(${joinColRanges('E')}),"")`, val: overallAvg },
      { col: 5, style: 18, kind: 'formula_num', formula: `SUM(${joinColRanges('F')})`, val: totalAprovAll },
      { col: 6, style: 18, kind: 'formula_num', formula: `SUM(${joinColRanges('G')})`, val: totalRecAll },
      { col: 7, style: 18, kind: 'formula_num', formula: `SUM(${joinColRanges('H')})`, val: totalSemNotaAll },
      { col: 8, style: 19, kind: 'formula_num', formula: `IF(D${r}=0,0,F${r}/D${r})`, val: overallPct },
    ],
    22
  );

  return r + 1;
}

/**
 * Gera arquivo .xlsx estilizado no Padrão CETEP com Painel Consolidado,
 * fórmulas reais do Excel, bordas, zebra, formatação condicional e suporte multi-aba ou aba única.
 */
export function exportCetepXlsxBuffer(turmas: CetepTurmaData[], options: CetepExportOptions): Uint8Array {
  if (!turmas || turmas.length === 0) {
    throw new Error('Nenhuma turma informada para exportar no modelo CETEP.');
  }

  const { orderedTurmas, groups } = groupTurmasByModalidade(turmas);
  const minPassingGrade = Number.isFinite(options.minPassingGrade) && options.minPassingGrade >= 0 ? options.minPassingGrade : 5.0;
  const minGradeStr = minPassingGrade.toFixed(1).replace(',', '.');
  const minDisplay = minPassingGrade.toFixed(1).replace('.', ',');
  const genDate = (options.generatedAt ?? new Date()).toLocaleString('pt-BR');
  const escola = orderedTurmas.find((t) => t.escola)?.escola || 'ESCOLA ESTADUAL';
  const docente = orderedTurmas.find((t) => t.docente)?.docente || 'DOCENTE';
  const ano = orderedTurmas.find((t) => t.ano)?.ano || String(new Date().getFullYear());
  const titleText = options.title ?? `CONSOLIDADO DE NOTAS — PADRÃO CETEP (${ano})`;
  const subtitleText = `Instituição: ${escola} • Docente: ${docente} • Critério de aprovação: Nota >= ${minDisplay} • Gerado em ${genDate}`;

  const sheetsOut: Array<{ name: string; xml: string }> = [];

  if (options.mode === 'multi_sheet') {
    const usedNames = new Set<string>(['painel consolidado']);
    const turmaRanges: TurmaRangeRef[] = [];

    for (const turma of orderedTurmas) {
      const uTag = shortUnitTag(turma.unidade);
      const baseWithUnit = uTag ? `${turma.identity.sheetTabBase} ${uTag}` : turma.identity.sheetTabBase;
      const sheetName = makeUniqueSheetName(baseWithUnit, usedNames);
      const sb = new SheetBuilder();
      const maxCols = Math.max(7, 6 + Math.max(1, turma.atividades.length));

      // Linha 1: Título da Turma
      const row1Cells: CellSpec[] = [{ col: 0, style: 1, kind: 'str', val: `${turma.identity.displayLabel} — ${turma.identity.componente} (${turma.unidade})` }];
      for (let c = 1; c < maxCols; c++) row1Cells.push({ col: c, style: 1, kind: 'empty' });
      sb.addRow(1, row1Cells, 28);
      sb.addMerge(1, 0, 1, maxCols - 1);

      // Linha 2: Subtítulo metadados
      const metaSub = `${turma.escola || escola} • ${turma.identity.modalidadeDetalhe} • ${turma.unidade} • Critério: >= ${minDisplay} • ${turma.alunos.length} estudante(s)`;
      const row2Cells: CellSpec[] = [{ col: 0, style: 2, kind: 'str', val: metaSub }];
      for (let c = 1; c < maxCols; c++) row2Cells.push({ col: c, style: 2, kind: 'empty' });
      sb.addRow(2, row2Cells, 20);
      sb.addMerge(2, 0, 2, maxCols - 1);

      // Linha 3: Barra de navegação de volta ao Painel Consolidado
      const row3Cells: CellSpec[] = [{ col: 0, style: 24, kind: 'str', val: '← Voltar ao Painel' }];
      for (let c = 1; c < maxCols; c++) row3Cells.push({ col: c, style: 24, kind: 'empty' });
      sb.addRow(3, row3Cells, 20);
      sb.addMerge(3, 0, 3, maxCols - 1);
      sb.addHyperlink('A3', sheetRef('Painel Consolidado', 'A1'), '← Voltar ao Painel', 'Voltar para a aba Painel Consolidado');

      const { rangeRef } = appendTurmaBlockToBuilder(sb, 4, turma, minGradeStr, minPassingGrade, sheetName, false);
      sb.setFreezeRow(5);
      turmaRanges.push(rangeRef);
      sheetsOut.push({ name: sheetName, xml: sb.toXml() });
    }

    const panelSb = new SheetBuilder();
    panelSb.addRow(
      1,
      [{ col: 0, style: 1, kind: 'str', val: titleText }, ...Array.from({ length: 8 }, (_, i) => ({ col: i + 1, style: 1, kind: 'empty' as const }))],
      30
    );
    panelSb.addMerge(1, 0, 1, 8);

    panelSb.addRow(
      2,
      [{ col: 0, style: 2, kind: 'str', val: subtitleText }, ...Array.from({ length: 8 }, (_, i) => ({ col: i + 1, style: 2, kind: 'empty' as const }))],
      22
    );
    panelSb.addMerge(2, 0, 2, 8);

    appendPainelConsolidado(panelSb, 4, turmaRanges, minPassingGrade, true);
    panelSb.setFreezeRow(6);

    sheetsOut.unshift({ name: 'Painel Consolidado', xml: panelSb.toXml() });
  } else {
    // single_sheet: Painel Consolidado no topo (linhas 4..) + blocos de turmas empilhados na mesma aba
    const singleName = 'Consolidado CETEP';
    const maxColsAcrossAll = Math.max(
      9,
      ...orderedTurmas.map((t) => 6 + Math.max(1, t.atividades.length))
    );

    const addBannerPair = (target: SheetBuilder) => {
      target.addRow(
        1,
        [{ col: 0, style: 1, kind: 'str', val: titleText }, ...Array.from({ length: maxColsAcrossAll - 1 }, (_, i) => ({ col: i + 1, style: 1, kind: 'empty' as const }))],
        30
      );
      target.addMerge(1, 0, 1, maxColsAcrossAll - 1);
      target.addRow(
        2,
        [{ col: 0, style: 2, kind: 'str', val: subtitleText }, ...Array.from({ length: maxColsAcrossAll - 1 }, (_, i) => ({ col: i + 1, style: 2, kind: 'empty' as const }))],
        22
      );
      target.addMerge(2, 0, 2, maxColsAcrossAll - 1);
    };

    // Passo 1: calcular ranges exatos de cada bloco na aba única (considerando subtotais por modalidade)
    const painelHeaderRows = 2;
    const subtotalRowsCount = groups.length > 1 ? groups.length : 0;
    const painelEndRow = 4 + painelHeaderRows + orderedTurmas.length + subtotalRowsCount + 1; // inclui TOTAL GERAL
    let cursorRow = painelEndRow + 1;

    const drySb = new SheetBuilder();
    const turmaRanges: TurmaRangeRef[] = [];
    for (const turma of orderedTurmas) {
      const { nextRow, rangeRef } = appendTurmaBlockToBuilder(
        drySb,
        cursorRow,
        turma,
        minGradeStr,
        minPassingGrade,
        singleName,
        true
      );
      turmaRanges.push(rangeRef);
      cursorRow = nextRow + 1;
    }

    // Passo 2: montar a aba única definitiva com o Painel no topo seguido dos blocos
    const finalSb = new SheetBuilder();
    addBannerPair(finalSb);
    const afterPanelRow = appendPainelConsolidado(finalSb, 4, turmaRanges, minPassingGrade, false);
    let writeRow = afterPanelRow + 1;
    for (const turma of orderedTurmas) {
      const res = appendTurmaBlockToBuilder(
        finalSb,
        writeRow,
        turma,
        minGradeStr,
        minPassingGrade,
        singleName,
        true
      );
      writeRow = res.nextRow + 1;
    }

    sheetsOut.push({ name: singleName, xml: finalSb.toXml() });
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetsOut
    .map((_, idx) => `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('')}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <sheets>
    ${sheetsOut
      .map((s, idx) => `<sheet name="${xmlEscape(s.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`)
      .join('')}
  </sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;

  const wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetsOut
    .map((_, idx) => `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`)
    .join('')}
  <Relationship Id="rId${sheetsOut.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const enc = new TextEncoder();
  const zipEntries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml) },
    { name: '_rels/.rels', data: enc.encode(rootRelsXml) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRelsXml) },
    { name: 'xl/styles.xml', data: enc.encode(buildStylesXml()) },
    ...sheetsOut.map((s, idx) => ({
      name: `xl/worksheets/sheet${idx + 1}.xml`,
      data: enc.encode(s.xml),
    })),
  ];

  return buildZipStore(zipEntries);
}
