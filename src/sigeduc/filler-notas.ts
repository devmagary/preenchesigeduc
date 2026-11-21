import { matchStudentsExact, normalizeName, type SheetRowRef, type StudentMatchResult } from '../core/normalize';
import { isNotRealizedToken, parseGradeValue } from '../core/grades';
import { detectSigeducScreen } from './detector';
import {
  scrapeAvaliacoesNaoRealizadas,
  scrapeLancarNotas,
  type ScrapedAtividadeNota,
  type ScrapedNaoRealizadasScreen,
  type ScrapedNotasScreen,
} from './scraper';

export const PENDING_NR_STORAGE_KEY = 'preenche_sigeduc_pending_nr';

export interface PendingNotRealizedItem {
  studentName: string;
  normalizedName: string;
  atividadeId: string;
  atividadeNome: string;
}

export interface PendingNotRealizedQueue {
  createdAt: number;
  unidadeAtiva: string;
  items: PendingNotRealizedItem[];
}

export interface ColumnGradeMapping {
  sheetColumn: string;
  atividadeId: string;
}

export interface GradeFillPreviewItem {
  studentName: string;
  normalizedName: string;
  sheetRowIndex: number;
  pageStudentIndex: number;
  atividadeId: string;
  atividadeNome: string;
  inputId: string;
  valueFormatted: string;
  status: 'ready' | 'not_realized' | 'disabled' | 'rec_conflict' | 'invalid';
  reason?: string;
}

export interface GradeFillPreview {
  match: StudentMatchResult;
  items: GradeFillPreviewItem[];
  readyCount: number;
  notRealizedCount: number;
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
  clearedCount: number;
  notRealizedCount: number;
  ajaxCompletedCount: number;
  skippedDisabledCount: number;
  recConflictCount: number;
  invalidCount: number;
  notRealizedDetails: PendingNotRealizedItem[];
  invalidDetails: Array<{ studentName: string; atividadeNome: string; rawValue: string; reason: string }>;
  disabledDetails: Array<{ studentName: string; atividadeNome: string; reason: string }>;
  recConflictDetails: Array<{ studentName: string; atividadeNome: string; reason: string }>;
  notFoundInPage: string[];
  notInSheet: string[];
  duplicates: string[];
  errors: string[];
}

export interface NotRealizedApplyReport {
  appliedCount: number;
  alreadyMarkedCount: number;
  unavailableCount: number;
  notFoundCount: number;
  autoSaved: boolean;
  details: Array<{ studentName: string; atividadeNome: string; status: 'marked' | 'already_marked' | 'unavailable' | 'not_found' }>;
  errors: string[];
}

export function savePendingNotRealizedQueue(queue: PendingNotRealizedQueue | null): void {
  try {
    if (!queue || queue.items.length === 0) {
      window.sessionStorage.removeItem(PENDING_NR_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(PENDING_NR_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // sessionStorage indisponível
  }
}

export function loadPendingNotRealizedQueue(): PendingNotRealizedQueue | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_NR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingNotRealizedQueue;
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    // Expirar fila após 30 minutos
    if (Date.now() - (parsed.createdAt ?? 0) > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(PENDING_NR_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingNotRealizedQueue(): void {
  try {
    window.sessionStorage.removeItem(PENDING_NR_STORAGE_KEY);
  } catch {
    // noop
  }
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
  let notRealizedCount = 0;
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
          normalizedName: pair.normalizedName,
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

      if (isDisabled || !inputId) {
        if (!parsed.empty) {
          disabledCount++;
          items.push({
            studentName: pageStudent.nome,
            normalizedName: pair.normalizedName,
            sheetRowIndex: pair.sheetRow.rowIndex,
            pageStudentIndex: pageStudent.index,
            atividadeId: atividade.idAvaliacao,
            atividadeNome: atividade.nome,
            inputId,
            valueFormatted: parsed.formatted,
            status: 'disabled',
            reason: 'Unidade/campo bloqueado pelo calendário escolar (disabled).',
          });
        }
        continue;
      }

      if (pageStudent.recUnidade.trim() !== '' && !parsed.empty) {
        recConflictCount++;
        items.push({
          studentName: pageStudent.nome,
          normalizedName: pair.normalizedName,
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

      if (parsed.empty && parsed.notRealized) {
        notRealizedCount++;
        items.push({
          studentName: pageStudent.nome,
          normalizedName: pair.normalizedName,
          sheetRowIndex: pair.sheetRow.rowIndex,
          pageStudentIndex: pageStudent.index,
          atividadeId: atividade.idAvaliacao,
          atividadeNome: atividade.nome,
          inputId,
          valueFormatted: '',
          status: 'not_realized',
          reason: parsed.rawToken
            ? `Marcada como Não Realizada (${parsed.rawToken}).`
            : 'Célula em branco — marcada como Não Realizada.',
        });
        continue;
      }

      if (!parsed.empty) {
        readyCount++;
        items.push({
          studentName: pageStudent.nome,
          normalizedName: pair.normalizedName,
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
  }

  return {
    match,
    items,
    readyCount,
    notRealizedCount,
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

let activeConfirmObserver: MutationObserver | null = null;
let activeConfirmInterval: ReturnType<typeof setInterval> | null = null;

function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  const wrapper = (el.closest('.ui-dialog') as HTMLElement | null) ?? el;
  const style = window.getComputedStyle(wrapper);
  return style.display !== 'none' && style.visibility !== 'hidden' && wrapper.offsetParent !== null;
}

/**
 * Monitora o modal #formulario:confirmationDialog e clica automaticamente em "Sim"
 * tanto no Modo Assistido (quando o professor confirma manualmente a senha) quanto no Modo Auto-gravação.
 */
export function armConfirmationDialogAutoAccept(doc: Document): () => void {
  if (activeConfirmObserver) {
    activeConfirmObserver.disconnect();
    activeConfirmObserver = null;
  }
  if (activeConfirmInterval) {
    clearInterval(activeConfirmInterval);
    activeConfirmInterval = null;
  }

  let clicked = false;

  const tryAccept = () => {
    if (clicked) return;
    const pending = loadPendingNotRealizedQueue();
    if (!pending || pending.items.length === 0) return;

    const dialog = doc.getElementById('formulario:confirmationDialog');
    if (!dialog || !isElementVisible(dialog)) return;

    const buttons = Array.from(dialog.querySelectorAll('button, input[type="submit"], input[type="button"]')) as HTMLElement[];
    const simBtn =
      buttons.find((b) => /\bsim\b/i.test(b.textContent ?? (b as HTMLInputElement).value ?? '')) ??
      (dialog.querySelector('button.ui-button-success') as HTMLElement | null);

    if (simBtn) {
      clicked = true;
      cleanup();
      simBtn.click();
    }
  };

  const cleanup = () => {
    if (activeConfirmObserver) {
      activeConfirmObserver.disconnect();
      activeConfirmObserver = null;
    }
    if (activeConfirmInterval) {
      clearInterval(activeConfirmInterval);
      activeConfirmInterval = null;
    }
  };

  activeConfirmObserver = new MutationObserver(() => tryAccept());
  activeConfirmObserver.observe(doc.body ?? doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });
  activeConfirmInterval = setInterval(tryAccept, 200);
  tryAccept();

  return cleanup;
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
  const nrItems = preview.items.filter((it) => it.status === 'not_realized');

  if (doc.activeElement instanceof HTMLElement) {
    doc.activeElement.blur();
  }

  let filledCount = 0;
  let clearedCount = 0;
  let ajaxCompletedCount = 0;
  let cancelled = false;
  let sessionExpired = false;
  let autoSaved = false;
  const errors: string[] = [];

  const toProcess = [
    ...readyItems.map((it) => ({ item: it, clearOnly: false })),
    ...nrItems.filter((it) => {
      const inp = doc.getElementById(it.inputId) as HTMLInputElement | null;
      return Boolean(inp && !inp.disabled && inp.value.trim() !== '');
    }).map((it) => ({ item: it, clearOnly: true })),
  ];

  for (let i = 0; i < toProcess.length; i++) {
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

    const { item, clearOnly } = toProcess[i];
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
        input.value = clearOnly ? '' : item.valueFormatted;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      },
      5000
    );

    if (clearOnly) clearedCount++;
    else filledCount++;

    if (xhrRes.received) {
      ajaxCompletedCount++;
      if (xhrRes.status >= 400) {
        errors.push(`Erro HTTP ${xhrRes.status} ao salvar AJAX de ${item.studentName}.`);
      }
    } else {
      errors.push(`Timeout aguardando AJAX de ${item.studentName} (${item.atividadeNome}).`);
    }

    onProgress(i + 1, toProcess.length, item.studentName);
  }

  const scrapedNow = scrapeLancarNotas(doc);
  const nrPending: PendingNotRealizedItem[] = !cancelled && !sessionExpired
    ? nrItems.map((it) => ({
        studentName: it.studentName,
        normalizedName: it.normalizedName,
        atividadeId: it.atividadeId,
        atividadeNome: it.atividadeNome,
      }))
    : [];

  if (nrPending.length > 0) {
    savePendingNotRealizedQueue({
      createdAt: Date.now(),
      unidadeAtiva: scrapedNow.unidadeAtiva,
      items: nrPending,
    });
    // Arma observador para clicar em "Sim" no #formulario:confirmationDialog (tanto assistido quanto auto-save)
    armConfirmationDialogAutoAccept(doc);
  } else {
    clearPendingNotRealizedQueue();
  }

  if (
    !cancelled &&
    !sessionExpired &&
    autoSavePassword !== null &&
    autoSavePassword.length > 0 &&
    (filledCount > 0 || clearedCount > 0 || nrPending.length > 0)
  ) {
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
    clearedCount,
    notRealizedCount: nrPending.length,
    ajaxCompletedCount,
    skippedDisabledCount: preview.disabledCount,
    recConflictCount: preview.recConflictCount,
    invalidCount: preview.invalidCount,
    notRealizedDetails: nrPending,
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

export function extractNotRealizedFromSheet(
  sheetRows: Array<Record<string, string>>,
  nameColumn: string,
  matriculaColumn: string | null,
  mappings: ColumnGradeMapping[],
  screenData: ScrapedNaoRealizadasScreen
): PendingNotRealizedItem[] {
  const sheetRefs: SheetRowRef[] = sheetRows.map((row, idx) => ({
    rowIndex: idx,
    rawName: row[nameColumn] ?? '',
    rawMatricula: matriculaColumn ? row[matriculaColumn] ?? '' : undefined,
  }));
  const pageRefs = screenData.alunos.map((st) => ({ index: st.index, rawName: st.nome }));
  const match = matchStudentsExact(sheetRefs, pageRefs);
  const studentByIndex = new Map(screenData.alunos.map((st) => [st.index, st]));
  const atividadeById = new Map(screenData.atividades.map((a) => [a.idAvaliacao, a]));

  const items: PendingNotRealizedItem[] = [];
  for (const pair of match.matched) {
    const sheetRow = sheetRows[pair.sheetRow.rowIndex];
    const pageStudent = studentByIndex.get(pair.pageStudent.index);
    if (!pageStudent) continue;

    for (const map of mappings) {
      const av = atividadeById.get(map.atividadeId);
      if (!av) continue;
      if (isNotRealizedToken(sheetRow[map.sheetColumn])) {
        items.push({
          studentName: pageStudent.nome,
          normalizedName: pair.normalizedName,
          atividadeId: av.idAvaliacao,
          atividadeNome: av.nome,
        });
      }
    }
  }
  return items;
}

export function executeNotRealizedFill(
  doc: Document,
  items: PendingNotRealizedItem[],
  autoSavePassword: string | null
): NotRealizedApplyReport {
  const scraped = scrapeAvaliacoesNaoRealizadas(doc);
  const byNormName = new Map(scraped.alunos.map((a) => [normalizeName(a.nome), a]));
  const avIdByNormName = new Map(
    scraped.atividades.map((a) => [normalizeName(a.nome), a.idAvaliacao])
  );

  let appliedCount = 0;
  let alreadyMarkedCount = 0;
  let unavailableCount = 0;
  let notFoundCount = 0;
  const details: NotRealizedApplyReport['details'] = [];
  const errors: string[] = [];

  for (const item of items) {
    const student = byNormName.get(item.normalizedName || normalizeName(item.studentName));
    if (!student) {
      notFoundCount++;
      details.push({ studentName: item.studentName, atividadeNome: item.atividadeNome, status: 'not_found' });
      continue;
    }

    const targetAvId =
      student.checkboxIds[item.atividadeId]
        ? item.atividadeId
        : avIdByNormName.get(normalizeName(item.atividadeNome)) ?? item.atividadeId;

    const cbId = student.checkboxIds[targetAvId];
    if (!cbId) {
      unavailableCount++;
      details.push({ studentName: student.nome, atividadeNome: item.atividadeNome, status: 'unavailable' });
      continue;
    }

    const cb = doc.getElementById(cbId) as HTMLInputElement | null;
    if (!cb) {
      unavailableCount++;
      details.push({ studentName: student.nome, atividadeNome: item.atividadeNome, status: 'unavailable' });
      continue;
    }

    if (cb.checked) {
      alreadyMarkedCount++;
      details.push({ studentName: student.nome, atividadeNome: item.atividadeNome, status: 'already_marked' });
      continue;
    }

    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    appliedCount++;
    details.push({ studentName: student.nome, atividadeNome: item.atividadeNome, status: 'marked' });
  }

  let autoSaved = false;
  if (autoSavePassword && autoSavePassword.length > 0 && appliedCount > 0) {
    const btnOpen = doc.getElementById('formulario:btnAbrirConfirmacaoSenhaFv') as HTMLElement | null;
    if (btnOpen) btnOpen.click();
    const pwdInput = doc.getElementById('formulario:senha') as HTMLInputElement | null;
    const btnConfirm = doc.getElementById('formulario:confirmarGravacaoFvTurmaRegular') as HTMLElement | null;
    if (pwdInput && btnConfirm) {
      pwdInput.value = autoSavePassword;
      pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
      btnConfirm.click();
      autoSaved = true;
    } else {
      errors.push('Botão de confirmação de senha de Não Realizadas não encontrado.');
    }
  }

  return {
    appliedCount,
    alreadyMarkedCount,
    unavailableCount,
    notFoundCount,
    autoSaved,
    details,
    errors,
  };
}
