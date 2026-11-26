import { parseTurmaIdentity, type CetepStudentRow, type CetepTurmaData } from '../core/cetep';
import { cleanDisplayName, normalizeName } from '../core/normalize';
import { scrapeLancarFrequencia, type ScrapedNotasScreen, type ScrapedTurma } from './scraper';

export const BATCH_EXTRACT_STORAGE_KEY = 'preenche_sigeduc_batch_extract_v1';

export type BatchUnitChoice = 'active' | '1' | '2' | '3' | 'final';
export type BatchPhase =
  | 'going_notas'
  | 'collecting_notas'
  | 'going_freq'
  | 'collecting_freq'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface BatchExtractOptions {
  unitMedio: BatchUnitChoice;
  unitTecnico: BatchUnitChoice;
  turmaUnitOverrides: Record<string, BatchUnitChoice>;
  includeMatricula: boolean;
  mode: 'multi_sheet' | 'single_sheet';
  minPassingGrade: number;
}

export function resolveTurmaUnitChoice(
  turma: ScrapedTurma,
  turmaKey: string,
  options: BatchExtractOptions
): BatchUnitChoice {
  const override = options.turmaUnitOverrides?.[turmaKey];
  if (override) return override;

  const idInfo = parseTurmaIdentity({
    turma: turma.turma,
    ofertaEnsino: turma.ofertaEnsino,
    serie: turma.serie,
    componente: turma.componente,
  });
  if (idInfo.modalidade === 'Técnico' || /semestr/i.test(turma.periodicidade ?? '')) {
    return options.unitTecnico;
  }
  return options.unitMedio;
}

export interface BatchExtractState {
  queue: ScrapedTurma[];
  currentIndex: number;
  phase: BatchPhase;
  options: BatchExtractOptions;
  results: CetepTurmaData[];
  warnings: string[];
  errors: string[];
  autoDownloaded: boolean;
  startedAt: number;
  docente: string;
}

export function saveBatchExtractState(state: BatchExtractState | null): void {
  try {
    if (!state) {
      window.sessionStorage.removeItem(BATCH_EXTRACT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(BATCH_EXTRACT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage indisponível
  }
}

export function loadBatchExtractState(): BatchExtractState | null {
  try {
    const raw = window.sessionStorage.getItem(BATCH_EXTRACT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BatchExtractState;
    if (!parsed || !Array.isArray(parsed.queue) || parsed.queue.length === 0) return null;
    // Expirar máquina de estado após 60 minutos
    if (Date.now() - (parsed.startedAt ?? 0) > 60 * 60 * 1000) {
      window.sessionStorage.removeItem(BATCH_EXTRACT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBatchExtractState(): void {
  try {
    window.sessionStorage.removeItem(BATCH_EXTRACT_STORAGE_KEY);
  } catch {
    // noop
  }
}

function parseNumericGrade(raw: string | undefined): number | null {
  const txt = String(raw ?? '').replace(/%/g, '').trim();
  if (!txt) return null;
  const num = Number(txt.replace(',', '.'));
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

export function scrapedNotasToCetepTurma(
  scr: ScrapedNotasScreen,
  portalMeta?: Partial<ScrapedTurma>,
  docente = ''
): CetepTurmaData {
  const identity = parseTurmaIdentity({
    turma: portalMeta?.turma,
    ofertaEnsino: portalMeta?.ofertaEnsino,
    serie: portalMeta?.serie,
    componente: portalMeta?.componente || scr.componente,
    fullTurmaHeader: scr.turma,
  });

  const alunos: CetepStudentRow[] = scr.alunos.map((st, idx) => {
    const notas: Record<string, number | null> = {};
    const textValues: Record<string, string> = {};
    for (const av of scr.atividades) {
      const rawCell = st.notasAtividades[av.idAvaliacao];
      if (av.colType === 'text') {
        textValues[av.idAvaliacao] = String(rawCell ?? '').trim();
      } else {
        notas[av.idAvaliacao] = parseNumericGrade(rawCell);
      }
    }
    return {
      numero: idx + 1,
      nome: cleanDisplayName(st.nome),
      matricula: '',
      notas,
      ...(Object.keys(textValues).length > 0 ? { textValues } : {}),
      notaUnidadeFallback: parseNumericGrade(st.notaUnidade),
      observacoes: scr.isResultadoFinal
        ? ''
        : st.recUnidade.trim()
          ? `Rec. Unidade: ${st.recUnidade.trim()}`
          : '',
    };
  });

  return {
    idTurmaComponente: portalMeta?.idTurmaComponente ?? '',
    escola: scr.escola || portalMeta?.escola || '',
    docente,
    ano: portalMeta?.ano || String(new Date().getFullYear()),
    unidade: scr.unidadeAtiva || '1ª Unidade',
    ...(scr.isResultadoFinal ? { isResultadoFinal: true } : {}),
    identity,
    atividades: scr.atividades.map((a) => ({
      idAvaliacao: a.idAvaliacao,
      nome: a.nome,
      valorMax: a.valorMax,
      ...(a.colType ? { colType: a.colType } : {}),
    })),
    alunos,
  };
}

/**
 * Localiza na tabela do Portal Docente o link JSF de Lançar Resultados ou Lançar Frequência
 * correspondente à turma informada.
 */
export function findPortalActionLink(
  doc: Document,
  turma: ScrapedTurma,
  action: 'notas' | 'frequencia'
): HTMLAnchorElement | null {
  const table = doc.querySelector('table[id$="turmasProfessorTable"]');
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll('tbody tr.linhaPar, tbody tr.linhaImpar'));
  let targetRow: Element | null = null;

  if (turma.idTurmaComponente) {
    targetRow =
      rows.find((row) =>
        Boolean(row.querySelector(`a[onclick*="'idTurmaComponente':'${turma.idTurmaComponente}'"]`))
      ) ?? null;
  }

  if (!targetRow) {
    const targetCod = normalizeName(turma.turma);
    const targetComp = normalizeName(turma.componente);
    targetRow =
      rows.find((row) => {
        const tds = Array.from(row.querySelectorAll('td'));
        if (tds.length < 7) return false;
        return normalizeName(tds[0].textContent ?? '') === targetCod && normalizeName(tds[6].textContent ?? '') === targetComp;
      }) ?? null;
  }

  if (!targetRow) return null;

  const links = Array.from(targetRow.querySelectorAll('a')) as HTMLAnchorElement[];
  if (action === 'notas') {
    return (
      links.find(
        (a) =>
          (a.getAttribute('href') ?? '').includes('lancar_notas') ||
          /resultados|notas/i.test(a.title || a.querySelector('img')?.getAttribute('alt') || a.querySelector('img')?.getAttribute('title') || '') ||
          (a.querySelector('img')?.getAttribute('src') ?? '').includes('notas_lancar')
      ) ??
      links[0] ??
      null
    );
  }

  return (
    links.find(
      (a) =>
        (a.getAttribute('href') ?? '').includes('frequencia_aluno') ||
        /frequ[êe]ncia/i.test(a.title || a.querySelector('img')?.getAttribute('alt') || a.querySelector('img')?.getAttribute('title') || '') ||
        (a.querySelector('img')?.getAttribute('src') ?? '').includes('frequencia_lancar')
    ) ??
    links[1] ??
    null
  );
}

/**
 * Navega de volta ao Portal do Docente a partir de Lançar Notas ou Frequência.
 */
export function navigateBackToPortal(doc: Document): void {
  const portalLink = doc.querySelector(
    'a[href*="verPortalDocente.do"], a[href*="/portais/docente/docente.jsf"]'
  ) as HTMLAnchorElement | null;
  if (portalLink) {
    portalLink.click();
    return;
  }
  window.location.href = '/sigeduc/verPortalDocente.do';
}

/**
 * Lê as matrículas dos estudantes na tela de Frequência; caso nenhum dia esteja aberto ainda,
 * clica na primeira data letiva do calendário e aguarda a tabela carregar via AJAX.
 */
export async function collectMatriculasFromFrequencia(doc: Document, timeoutMs = 8000): Promise<Map<string, string>> {
  let scr = scrapeLancarFrequencia(doc);
  if (scr.alunos.length === 0 && scr.datasDisponiveis.length > 0) {
    const firstDate = scr.datasDisponiveis[0];
    const link = doc.getElementById(firstDate.linkId) as HTMLElement | null;
    if (link) {
      link.click();
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 150));
        scr = scrapeLancarFrequencia(doc);
        if (scr.alunos.length > 0) break;
      }
    }
  }

  const map = new Map<string, string>();
  for (const st of scr.alunos) {
    const norm = normalizeName(st.nome);
    if (norm && st.matricula) {
      map.set(norm, st.matricula.trim());
    }
  }
  return map;
}
