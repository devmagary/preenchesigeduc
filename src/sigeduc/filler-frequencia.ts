import {
  parseAttendanceCell,
  parseDateHeader,
  sanitizeObservation,
  toSigeducCheckboxes,
  type ParsedDateInfo,
} from '../core/attendance';
import { matchStudentsExact, type SheetRowRef, type StudentMatchResult } from '../core/normalize';
import { detectSigeducScreen } from './detector';
import { scrapeLancarFrequencia, type ScrapedFrequenciaScreen } from './scraper';

export interface AttendanceDateResult {
  dateDisplay: string;
  status: 'filled' | 'date_unavailable' | 'session_expired' | 'cancelled' | 'error';
  matchedCount: number;
  absentStudentsCount: number;
  presentStudentsCount: number;
  invalidCount: number;
  invalidDetails: Array<{ studentName: string; dateDisplay: string; rawValue: string; reason: string }>;
  autoSaved: boolean;
  warnings: string[];
  errors: string[];
  notFoundInPage: string[];
  notInSheet: string[];
  duplicates: string[];
}

export interface AttendanceFillReport {
  startedAt: string;
  finishedAt: string;
  cancelled: boolean;
  datesProcessed: AttendanceDateResult[];
}

export interface AttendanceFillPreview {
  dateColumns: Array<{ sheetColumn: string; parsedDate: ParsedDateInfo | null; availableInCalendar: boolean }>;
  match: StudentMatchResult;
}

export function buildAttendancePreview(
  sheetRows: Array<Record<string, string>>,
  nameColumn: string,
  matriculaColumn: string | null,
  selectedDateColumns: string[],
  screenData: ScrapedFrequenciaScreen
): AttendanceFillPreview {
  const sheetRefs: SheetRowRef[] = sheetRows.map((r, idx) => ({
    rowIndex: idx,
    rawName: r[nameColumn] ?? '',
    rawMatricula: matriculaColumn ? r[matriculaColumn] ?? '' : undefined,
  }));
  const pageRefs = screenData.alunos.map((st) => ({
    index: st.index,
    rawName: st.nome,
    rawMatricula: st.matricula,
  }));

  const match = matchStudentsExact(sheetRefs, pageRefs);
  const availSet = new Set(screenData.datasDisponiveis.map((d) => d.display));
  if (screenData.dataAberta) availSet.add(screenData.dataAberta);

  const dateColumns = selectedDateColumns.map((col) => {
    const parsedDate = parseDateHeader(col);
    return {
      sheetColumn: col,
      parsedDate,
      availableInCalendar: parsedDate ? availSet.has(parsedDate.display) : false,
    };
  });

  return { dateColumns, match };
}

function waitForCalendarDateLoad(
  doc: Document,
  expectedDisplay: string,
  timeoutMs = 6000
): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    let xhrDone = false;

    const onXhrEnd = () => {
      xhrDone = true;
    };
    window.addEventListener('preenche-sigeduc:xhr-end', onXhrEnd);

    const check = () => {
      const current = scrapeLancarFrequencia(doc);
      if (current.dataAberta === expectedDisplay && (xhrDone || Date.now() - start > 50)) {
        window.removeEventListener('preenche-sigeduc:xhr-end', onXhrEnd);
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        window.removeEventListener('preenche-sigeduc:xhr-end', onXhrEnd);
        resolve(current.dataAberta === expectedDisplay);
        return;
      }
      setTimeout(check, 40);
    };
    setTimeout(check, 30);
  });
}

export async function fillSingleLoadedDate(options: {
  doc: Document;
  sheetRows: Array<Record<string, string>>;
  nameColumn: string;
  matriculaColumn: string | null;
  observationColumn: string | null;
  dateColumn: string;
  emptyMeansPresent: boolean;
  autoSavePassword: string | null; // Somente RAM!
}): Promise<AttendanceDateResult> {
  const {
    doc,
    sheetRows,
    nameColumn,
    matriculaColumn,
    observationColumn,
    dateColumn,
    emptyMeansPresent,
    autoSavePassword,
  } = options;

  const screenData = scrapeLancarFrequencia(doc);
  const dateDisplay = screenData.dataAberta ?? dateColumn;

  const sheetRefs: SheetRowRef[] = sheetRows.map((r, idx) => ({
    rowIndex: idx,
    rawName: r[nameColumn] ?? '',
    rawMatricula: matriculaColumn ? r[matriculaColumn] ?? '' : undefined,
  }));
  const pageRefs = screenData.alunos.map((st) => ({
    index: st.index,
    rawName: st.nome,
    rawMatricula: st.matricula,
  }));
  const match = matchStudentsExact(sheetRefs, pageRefs);
  const pageByIdx = new Map(screenData.alunos.map((a) => [a.index, a]));

  const warnings: string[] = [];
  const errors: string[] = [];
  const invalidDetails: Array<{ studentName: string; dateDisplay: string; rawValue: string; reason: string }> = [];
  let absentStudentsCount = 0;
  let presentStudentsCount = 0;

  for (const pair of match.matched) {
    const row = sheetRows[pair.sheetRow.rowIndex];
    const pageStudent = pageByIdx.get(pair.pageStudent.index);
    if (!pageStudent) continue;

    const rawVal = row[dateColumn];
    const parsed = parseAttendanceCell(rawVal, { emptyMeansPresent });
    if (!parsed.ok) {
      warnings.push(`${pageStudent.nome}: ${parsed.reason}`);
      invalidDetails.push({
        studentName: pageStudent.nome,
        dateDisplay,
        rawValue: String(rawVal ?? ''),
        reason: parsed.reason,
      });
      continue;
    }
    if (parsed.status === 'skip') continue;

    const slotCount = Math.max(1, pageStudent.checkboxIds.length);
    const { checkboxes, warning } = toSigeducCheckboxes(parsed, slotCount);
    if (warning) warnings.push(`${pageStudent.nome}: ${warning}`);

    let hasAbsence = false;
    checkboxes.forEach((shouldCheck, slotIdx) => {
      const cbId = pageStudent.checkboxIds[slotIdx];
      if (!cbId) return;
      const cb = doc.getElementById(cbId) as HTMLInputElement | null;
      if (!cb) return;
      if (cb.checked !== shouldCheck) {
        cb.checked = shouldCheck;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (shouldCheck) hasAbsence = true;
    });

    if (hasAbsence) absentStudentsCount++;
    else presentStudentsCount++;

    if (observationColumn && pageStudent.observacaoInputId) {
      const obsRaw = row[observationColumn] ?? '';
      const obsClean = sanitizeObservation(obsRaw);
      const ta = doc.getElementById(pageStudent.observacaoInputId) as HTMLTextAreaElement | null;
      if (ta && obsClean) {
        ta.value = obsClean;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  let autoSaved = false;
  if (autoSavePassword !== null && autoSavePassword.length > 0) {
    const pwdInput = doc.getElementById('formFrequencia:senha') as HTMLInputElement | null;
    const btnGravar = doc.getElementById('formFrequencia:botaoGravarFreq') as HTMLElement | null;
    if (pwdInput && btnGravar) {
      pwdInput.value = autoSavePassword;
      pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(new CustomEvent('preenche-sigeduc:arm-confirm', { detail: { ttlMs: 4000 } }));
      btnGravar.click();
      await new Promise((r) => setTimeout(r, 150));
      window.dispatchEvent(new CustomEvent('preenche-sigeduc:disarm-confirm'));
      autoSaved = true;
    } else {
      warnings.push('Botão Gravar Frequências ou campo de senha não encontrado.');
    }
  }

  return {
    dateDisplay,
    status: 'filled',
    matchedCount: match.matched.length,
    absentStudentsCount,
    presentStudentsCount,
    invalidCount: invalidDetails.length,
    invalidDetails,
    autoSaved,
    warnings,
    errors,
    notFoundInPage: match.notFoundInPage.map((x) => x.sheetRow.rawName),
    notInSheet: match.notInSheet.map((x) => x.pageStudent.rawName),
    duplicates: match.duplicates.map((d) => `${d.normalizedName} (${d.reason})`),
  };
}

export interface RunMultiDateAttendanceOptions {
  doc: Document;
  sheetRows: Array<Record<string, string>>;
  nameColumn: string;
  matriculaColumn: string | null;
  observationColumn: string | null;
  dateColumns: string[];
  emptyMeansPresent: boolean;
  assistedStepByStep: boolean;
  autoSavePassword: string | null;
  signal: AbortSignal;
  waitForNextStep?: (completedDate: AttendanceDateResult, nextDateLabel: string) => Promise<'continue' | 'cancel'>;
  onProgress: (done: number, total: number, currentDate: string) => void;
}

export async function executeMultiDateAttendance(
  options: RunMultiDateAttendanceOptions
): Promise<AttendanceFillReport> {
  const {
    doc,
    sheetRows,
    nameColumn,
    matriculaColumn,
    observationColumn,
    dateColumns,
    emptyMeansPresent,
    assistedStepByStep,
    autoSavePassword,
    signal,
    waitForNextStep,
    onProgress,
  } = options;

  const startedAt = new Date().toISOString();
  const datesProcessed: AttendanceDateResult[] = [];
  let cancelled = false;

  for (let i = 0; i < dateColumns.length; i++) {
    if (signal.aborted) {
      cancelled = true;
      break;
    }

    const det = detectSigeducScreen(doc, window.location.href);
    if (det.sessionExpired) {
      datesProcessed.push({
        dateDisplay: dateColumns[i],
        status: 'session_expired',
        matchedCount: 0,
        absentStudentsCount: 0,
        presentStudentsCount: 0,
        invalidCount: 0,
        invalidDetails: [],
        autoSaved: false,
        warnings: [],
        errors: ['Sessão expirada. Faça login novamente.'],
        notFoundInPage: [],
        notInSheet: [],
        duplicates: [],
      });
      break;
    }

    const col = dateColumns[i];
    const parsedDate = parseDateHeader(col);
    const screenBefore = scrapeLancarFrequencia(doc);

    if (parsedDate && screenBefore.dataAberta !== parsedDate.display) {
      const calEntry = screenBefore.datasDisponiveis.find((d) => d.display === parsedDate.display);
      if (!calEntry) {
        datesProcessed.push({
          dateDisplay: parsedDate.display,
          status: 'date_unavailable',
          matchedCount: 0,
          absentStudentsCount: 0,
          presentStudentsCount: 0,
          invalidCount: 0,
          invalidDetails: [],
          autoSaved: false,
          warnings: [`Data ${parsedDate.display} indisponível ou sem aula no calendário da turma.`],
          errors: [],
          notFoundInPage: [],
          notInSheet: [],
          duplicates: [],
        });
        onProgress(i + 1, dateColumns.length, parsedDate.display);
        continue;
      }

      const link = doc.getElementById(calEntry.linkId) as HTMLElement | null;
      if (!link) {
        datesProcessed.push({
          dateDisplay: parsedDate.display,
          status: 'date_unavailable',
          matchedCount: 0,
          absentStudentsCount: 0,
          presentStudentsCount: 0,
          invalidCount: 0,
          invalidDetails: [],
          autoSaved: false,
          warnings: [`Link do calendário não encontrado para ${parsedDate.display}.`],
          errors: [],
          notFoundInPage: [],
          notInSheet: [],
          duplicates: [],
        });
        continue;
      }

      link.click();
      const loaded = await waitForCalendarDateLoad(doc, parsedDate.display, 6000);
      if (!loaded) {
        datesProcessed.push({
          dateDisplay: parsedDate.display,
          status: 'error',
          matchedCount: 0,
          absentStudentsCount: 0,
          presentStudentsCount: 0,
          invalidCount: 0,
          invalidDetails: [],
          autoSaved: false,
          warnings: [],
          errors: [`Timeout ao carregar a lista de frequência de ${parsedDate.display}.`],
          notFoundInPage: [],
          notInSheet: [],
          duplicates: [],
        });
        continue;
      }
    }

    const res = await fillSingleLoadedDate({
      doc,
      sheetRows,
      nameColumn,
      matriculaColumn,
      observationColumn,
      dateColumn: col,
      emptyMeansPresent,
      autoSavePassword: assistedStepByStep ? null : autoSavePassword,
    });
    datesProcessed.push(res);
    onProgress(i + 1, dateColumns.length, res.dateDisplay);

    if (assistedStepByStep && i < dateColumns.length - 1 && waitForNextStep) {
      const nextParsed = parseDateHeader(dateColumns[i + 1]);
      const action = await waitForNextStep(res, nextParsed?.display ?? dateColumns[i + 1]);
      if (action === 'cancel') {
        cancelled = true;
        break;
      }
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    cancelled,
    datesProcessed,
  };
}
