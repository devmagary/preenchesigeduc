import { matchStudentsExact, type SheetRowRef, type StudentMatchResult } from '../core/normalize';
import { parseGradeValue } from '../core/grades';
import { detectSigeducScreen } from './detector';
import { scrapeLancarNotas, type ScrapedAtividadeNota, type ScrapedNotasScreen } from './scraper';

export interface ColumnGradeMapping {
  sheetColumn: string;
  atividadeId: string;
}

export interface GradeFillPreviewItem {
  studentName: string;
  sheetRowIndex: number;
  pageStudentIndex: number;
  atividadeId: string;
  atividadeNome: string;
  inputId: string;
  valueFormatted: string;
  status: 'ready' | 'disabled' | 'rec_conflict' | 'invalid';
  reason?: string;
}

export interface GradeFillPreview {
  match: StudentMatchResult;
  items: GradeFillPreviewItem[];
  readyCount: number;
  disabledCount: number;
  recConflictCount: number;
  invalidCount: number;
}

export interface GradeFillReport {
  startedAt: string;
  finishedAt: string;
  cancelled: boolean;
  sessionExpired: boolean;
  autoSaved: boolean;
  totalAttempted: number;
  filledCount: number;
  ajaxCompletedCount: number;
  skippedDisabledCount: number;
  recConflictCount: number;
  invalidCount: number;
  invalidDetails: Array<{ studentName: string; atividadeNome: string; rawValue: string; reason: string }>;
  disabledDetails: Array<{ studentName: string; atividadeNome: string; reason: string }>;
  recConflictDetails: Array<{ studentName: string; atividadeNome: string; reason: string }>;
  notFoundInPage: string[];
  notInSheet: string[];
  duplicates: string[];
  errors: string[];
}

export function buildGradeFillPreview(
  sheetRows: Array<Record<string, string>>,
  nameColumn: string,
  matriculaColumn: string | null,
  mappings: ColumnGradeMapping[],
  screenData: ScrapedNotasScreen
): GradeFillPreview {
  const sheetRefs: SheetRowRef[] = sheetRows.map((row, idx) => ({
    rowIndex: idx,
    rawName: row[nameColumn] ?? '',
    rawMatricula: matriculaColumn ? row[matriculaColumn] ?? '' : undefined,
  }));

  const pageRefs = screenData.alunos.map((st) => ({
    index: st.index,
    rawName: st.nome,
  }));

  const match = matchStudentsExact(sheetRefs, pageRefs);
  const atividadeById = new Map<string, ScrapedAtividadeNota>(
    screenData.atividades.map((a) => [a.idAvaliacao, a])
  );
  const studentByIndex = new Map(screenData.alunos.map((st) => [st.index, st]));

  const items: GradeFillPreviewItem[] = [];
  let readyCount = 0;
  let disabledCount = 0;
  let recConflictCount = 0;
  let invalidCount = 0;

  for (const pair of match.matched) {
    const sheetRow = sheetRows[pair.sheetRow.rowIndex];
    const pageStudent = studentByIndex.get(pair.pageStudent.index);
    if (!pageStudent) continue;

    for (const map of mappings) {
      const atividade = atividadeById.get(map.atividadeId);
      if (!atividade) continue;

      const rawCell = sheetRow[map.sheetColumn];
      const parsed = parseGradeValue(rawCell, atividade.valorMax);
      const inputId = pageStudent.inputIds[atividade.idAvaliacao] ?? '';
      const isDisabled = pageStudent.disabledMap[atividade.idAvaliacao] ?? atividade.disabled;

      if (!parsed.ok) {
        invalidCount++;
        items.push({
          studentName: pageStudent.nome,
          sheetRowIndex: pair.sheetRow.rowIndex,
          pageStudentIndex: pageStudent.index,
          atividadeId: atividade.idAvaliacao,
          atividadeNome: atividade.nome,
          inputId,
          valueFormatted: String(rawCell ?? ''),
          status: 'invalid',
          reason: parsed.reason,
        });
        continue;
      }

      if (parsed.empty) continue;

      if (isDisabled || !inputId) {
        disabledCount++;
        items.push({
          studentName: pageStudent.nome,
          sheetRowIndex: pair.sheetRow.rowIndex,
          pageStudentIndex: pageStudent.index,
          atividadeId: atividade.idAvaliacao,
          atividadeNome: atividade.nome,
          inputId,
          valueFormatted: parsed.formatted,
          status: 'disabled',
          reason: 'Unidade/campo bloqueado pelo calendário escolar (disabled).',
        });
        continue;
      }

      if (pageStudent.recUnidade.trim() !== '') {
        recConflictCount++;
        items.push({
          studentName: pageStudent.nome,
          sheetRowIndex: pair.sheetRow.rowIndex,
          pageStudentIndex: pageStudent.index,
          atividadeId: atividade.idAvaliacao,
          atividadeNome: atividade.nome,
          inputId,
          valueFormatted: parsed.formatted,
          status: 'rec_conflict',
          reason: 'Estudante possui Recuperação da Unidade preenchida; limpe a recuperação antes de alterar atividades.',
        });
        continue;
      }

      readyCount++;
      items.push({
        studentName: pageStudent.nome,
        sheetRowIndex: pair.sheetRow.rowIndex,
        pageStudentIndex: pageStudent.index,
        atividadeId: atividade.idAvaliacao,
        atividadeNome: atividade.nome,
        inputId,
        valueFormatted: parsed.formatted,
        status: 'ready',
      });
    }
  }

  return {
    match,
    items,
    readyCount,
    disabledCount,
    recConflictCount,
    invalidCount,
  };
}

function waitForNextXhrOrTimeout(
  hasOnBlurAjax: boolean,
  triggerFn: () => void,
  timeoutMs = 5000
): Promise<{ received: boolean; status: number }> {
  if (!hasOnBlurAjax) {
    triggerFn();
    return new Promise((resolve) => setTimeout(() => resolve({ received: true, status: 200 }), 10));
  }
  return new Promise((resolve) => {
    let settled = false;
    let targetXhrId: number | null = null;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('preenche-sigeduc:xhr-start', onStart);
      window.removeEventListener('preenche-sigeduc:xhr-end', onEnd);
      resolve({ received: false, status: 0 });
    }, timeoutMs);

    function onStart(ev: Event): void {
      if (targetXhrId !== null) return;
      const custom = ev as CustomEvent<{ id?: number }>;
      if (typeof custom.detail?.id === 'number') {
        targetXhrId = custom.detail.id;
      }
    }

    function onEnd(ev: Event): void {
      if (settled) return;
      const custom = ev as CustomEvent<{ id?: number; status?: number }>;
      if (targetXhrId !== null && custom.detail?.id !== targetXhrId) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('preenche-sigeduc:xhr-start', onStart);
      window.removeEventListener('preenche-sigeduc:xhr-end', onEnd);
      resolve({ received: true, status: custom.detail?.status ?? 200 });
    }

    window.addEventListener('preenche-sigeduc:xhr-start', onStart);
    window.addEventListener('preenche-sigeduc:xhr-end', onEnd);
    triggerFn();

    // Se o handler onblur não disparou nenhum XHR sincronamente, resolve após microtask
    setTimeout(() => {
      if (!settled && targetXhrId === null) {
        settled = true;
        clearTimeout(timer);
        window.removeEventListener('preenche-sigeduc:xhr-start', onStart);
        window.removeEventListener('preenche-sigeduc:xhr-end', onEnd);
        resolve({ received: true, status: 200 });
      }
    }, 50);
  });
}

export interface RunGradeFillOptions {
  doc: Document;
  preview: GradeFillPreview;
  autoSavePassword: string | null; // Somente em RAM! Nunca persistido.
  signal: AbortSignal;
  onProgress: (done: number, total: number, currentStudent: string) => void;
}

export async function executeGradeFill(options: RunGradeFillOptions): Promise<GradeFillReport> {
  const { doc, preview, autoSavePassword, signal, onProgress } = options;
  const startedAt = new Date().toISOString();
  const readyItems = preview.items.filter((it) => it.status === 'ready');

  if (doc.activeElement instanceof HTMLElement) {
    doc.activeElement.blur();
  }

  let filledCount = 0;
  let ajaxCompletedCount = 0;
  let cancelled = false;
  let sessionExpired = false;
  let autoSaved = false;
  const errors: string[] = [];

  for (let i = 0; i < readyItems.length; i++) {
    if (signal.aborted) {
      cancelled = true;
      break;
    }

    const detection = detectSigeducScreen(doc, window.location.href);
    if (detection.sessionExpired) {
      sessionExpired = true;
      errors.push('Sessão do SIGEduc expirada durante o preenchimento.');
      break;
    }

    const item = readyItems[i];
    const input = doc.getElementById(item.inputId) as HTMLInputElement | null;
    if (!input || input.disabled) {
      errors.push(`Campo indisponível para ${item.studentName} (${item.atividadeNome}).`);
      continue;
    }

    const onBlurAttr = input.getAttribute('onblur') ?? '';
    const hasAjax = onBlurAttr.includes('A4J.AJAX.Submit') || typeof input.onblur === 'function';

    const xhrRes = await waitForNextXhrOrTimeout(
      hasAjax,
      () => {
        input.value = item.valueFormatted;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      },
      5000
    );
    filledCount++;
    if (xhrRes.received) {
      ajaxCompletedCount++;
      if (xhrRes.status >= 400) {
        errors.push(`Erro HTTP ${xhrRes.status} ao salvar AJAX de ${item.studentName}.`);
      }
    } else {
      errors.push(`Timeout aguardando AJAX de ${item.studentName} (${item.atividadeNome}).`);
    }

    onProgress(i + 1, readyItems.length, item.studentName);
  }

  // Re-leitura opcional pós-preenchimento para confirmar consistência
  void scrapeLancarNotas(doc);

  if (!cancelled && !sessionExpired && autoSavePassword !== null && autoSavePassword.length > 0 && filledCount > 0) {
    try {
      const btnOpen = doc.getElementById('formulario:btnAbrirConfirmacaoSenha') as HTMLElement | null;
      if (btnOpen) btnOpen.click();
      await new Promise((r) => setTimeout(r, 150));

      const pwdInput = doc.getElementById('formulario:senha') as HTMLInputElement | null;
      const btnConfirm = doc.getElementById('formulario:confirmarGravacaoNotas') as HTMLElement | null;
      if (pwdInput && btnConfirm) {
        pwdInput.value = autoSavePassword;
        pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
        btnConfirm.click();
        autoSaved = true;
      } else {
        errors.push('Modal de confirmação de senha não encontrado na tela.');
      }
    } catch (err) {
      errors.push(`Falha na auto-gravação: ${(err as Error).message}`);
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    cancelled,
    sessionExpired,
    autoSaved,
    totalAttempted: readyItems.length,
    filledCount,
    ajaxCompletedCount,
    skippedDisabledCount: preview.disabledCount,
    recConflictCount: preview.recConflictCount,
    invalidCount: preview.invalidCount,
    invalidDetails: preview.items
      .filter((it) => it.status === 'invalid')
      .map((it) => ({
        studentName: it.studentName,
        atividadeNome: it.atividadeNome,
        rawValue: it.valueFormatted,
        reason: it.reason ?? 'Valor inválido',
      })),
    disabledDetails: preview.items
      .filter((it) => it.status === 'disabled')
      .map((it) => ({
        studentName: it.studentName,
        atividadeNome: it.atividadeNome,
        reason: it.reason ?? 'Campo bloqueado',
      })),
    recConflictDetails: preview.items
      .filter((it) => it.status === 'rec_conflict')
      .map((it) => ({
        studentName: it.studentName,
        atividadeNome: it.atividadeNome,
        reason: it.reason ?? 'Conflito com recuperação',
      })),
    notFoundInPage: preview.match.notFoundInPage.map((x) => x.sheetRow.rawName),
    notInSheet: preview.match.notInSheet.map((x) => x.pageStudent.rawName),
    duplicates: preview.match.duplicates.map((d) => `${d.normalizedName} (${d.reason})`),
    errors,
  };
}
