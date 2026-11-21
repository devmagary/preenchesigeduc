export interface SheetRowRef {
  rowIndex: number;
  rawName: string;
  rawMatricula?: string;
}

export interface PageStudentRef {
  index: number;
  rawName: string;
  rawMatricula?: string;
}

export interface MatchedStudentPair {
  sheetRow: SheetRowRef;
  pageStudent: PageStudentRef;
  normalizedName: string;
  matchedBy: 'name' | 'matricula';
}

export interface DuplicateStudentIssue {
  normalizedName: string;
  reason: 'duplicate_in_sheet' | 'duplicate_in_page';
  sheetRows: SheetRowRef[];
  pageStudents: PageStudentRef[];
}

export interface StudentMatchResult {
  matched: MatchedStudentPair[];
  notFoundInPage: Array<{ sheetRow: SheetRowRef; normalizedName: string }>;
  notInSheet: Array<{ pageStudent: PageStudentRef; normalizedName: string }>;
  duplicates: DuplicateStudentIssue[];
}

/**
 * Remove caracteres de ícones de fonte (PUA), controles e espaços excessivos.
 */
export function cleanDisplayName(raw: string): string {
  return String(raw ?? '')
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/[\u{F0000}-\u{10FFFF}]/gu, ' ')
    .replace(/[\u200B-\u200F\uFEFF]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalização estrita de nome: sem acentos (NFD), caixa alta e espaços colapsados.
 */
export function normalizeName(raw: string): string {
  return cleanDisplayName(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Normaliza número de matrícula removendo pontuação e espaços.
 */
export function normalizeMatricula(raw: string | undefined): string {
  return String(raw ?? '')
    .replace(/[^0-9A-Za-z]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Pareamento estritamente exato (sem fuzzy matching), com bloqueio obrigatório de homônimos.
 */
export function matchStudentsExact(
  sheetRows: SheetRowRef[],
  pageStudents: PageStudentRef[]
): StudentMatchResult {
  const sheetByName = new Map<string, SheetRowRef[]>();
  const pageByName = new Map<string, PageStudentRef[]>();

  for (const row of sheetRows) {
    const norm = normalizeName(row.rawName);
    if (!norm) continue;
    const list = sheetByName.get(norm) ?? [];
    list.push(row);
    sheetByName.set(norm, list);
  }

  for (const st of pageStudents) {
    const norm = normalizeName(st.rawName);
    if (!norm) continue;
    const list = pageByName.get(norm) ?? [];
    list.push(st);
    pageByName.set(norm, list);
  }

  const pageByMat = new Map<string, PageStudentRef[]>();
  for (const st of pageStudents) {
    const mat = normalizeMatricula(st.rawMatricula);
    if (!mat) continue;
    const list = pageByMat.get(mat) ?? [];
    list.push(st);
    pageByMat.set(mat, list);
  }

  const matched: MatchedStudentPair[] = [];
  const notFoundInPage: Array<{ sheetRow: SheetRowRef; normalizedName: string }> = [];
  const duplicates: DuplicateStudentIssue[] = [];
  const matchedPageIndices = new Set<number>();
  const recordedDuplicateNames = new Set<string>();

  for (const row of sheetRows) {
    const norm = normalizeName(row.rawName);
    if (!norm) {
      notFoundInPage.push({ sheetRow: row, normalizedName: '' });
      continue;
    }

    const sGroup = sheetByName.get(norm) ?? [];
    const pGroup = pageByName.get(norm) ?? [];

    // Bloqueia homônimos na planilha ou na página (salvo se matrícula única desambiguar explicitamente)
    if (sGroup.length > 1 || pGroup.length > 1) {
      const mat = normalizeMatricula(row.rawMatricula);
      const matMatches = mat ? pageByMat.get(mat) ?? [] : [];
      if (
        mat &&
        matMatches.length === 1 &&
        normalizeName(matMatches[0].rawName) === norm &&
        !matchedPageIndices.has(matMatches[0].index)
      ) {
        matched.push({
          sheetRow: row,
          pageStudent: matMatches[0],
          normalizedName: norm,
          matchedBy: 'matricula',
        });
        matchedPageIndices.add(matMatches[0].index);
        continue;
      }

      if (!recordedDuplicateNames.has(norm)) {
        recordedDuplicateNames.add(norm);
        duplicates.push({
          normalizedName: norm,
          reason: sGroup.length > 1 ? 'duplicate_in_sheet' : 'duplicate_in_page',
          sheetRows: sGroup,
          pageStudents: pGroup,
        });
      }
      continue;
    }

    if (pGroup.length === 1) {
      const target = pGroup[0];
      if (!matchedPageIndices.has(target.index)) {
        matched.push({
          sheetRow: row,
          pageStudent: target,
          normalizedName: norm,
          matchedBy: 'name',
        });
        matchedPageIndices.add(target.index);
      }
      continue;
    }

    // Fallback opcional por matrícula exata se o nome na página divergir?
    // Regra do SPEC: correspondência estritamente exata após normalização de nome;
    // matrícula só desambigua homônimos quando o nome normalizado coincide,
    // ou nunca substitui nome divergente.
    notFoundInPage.push({ sheetRow: row, normalizedName: norm });
  }

  const notInSheet: Array<{ pageStudent: PageStudentRef; normalizedName: string }> = [];
  for (const st of pageStudents) {
    if (!matchedPageIndices.has(st.index)) {
      notInSheet.push({
        pageStudent: st,
        normalizedName: normalizeName(st.rawName),
      });
    }
  }

  return { matched, notFoundInPage, notInSheet, duplicates };
}
