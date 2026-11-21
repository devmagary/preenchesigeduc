import { parseDateHeader } from '../core/attendance';
import {
  exportToCsv,
  exportToJson,
  exportToXlsxBuffer,
  parsePastedTable,
  parseSpreadsheetBuffer,
  type ParsedSpreadsheet,
} from '../core/spreadsheet';
import { detectSigeducScreen, type ScreenDetection } from '../sigeduc/detector';
import {
  buildAttendancePreview,
  executeMultiDateAttendance,
  type AttendanceDateResult,
  type AttendanceFillReport,
} from '../sigeduc/filler-frequencia';
import {
  armConfirmationDialogAutoAccept,
  buildGradeFillPreview,
  clearPendingNotRealizedQueue,
  executeGradeFill,
  executeNotRealizedFill,
  extractNotRealizedFromSheet,
  loadPendingNotRealizedQueue,
  type ColumnGradeMapping,
  type GradeFillPreview,
  type GradeFillReport,
  type NotRealizedApplyReport,
} from '../sigeduc/filler-notas';
import {
  buildExportBundle,
  scrapeAvaliacoesNaoRealizadas,
  scrapeGerenciarAvaliacoes,
  scrapeLancarFrequencia,
  scrapeLancarNotas,
  scrapePortalDocente,
  type ScrapedFrequenciaScreen,
  type ScrapedNaoRealizadasScreen,
  type ScrapedNotasScreen,
  type ScrapedScreenData,
} from '../sigeduc/scraper';
import { SHADOW_STYLES } from './styles';

type TabKey = 'notas' | 'frequencia' | 'extrair';
type FontScale = '100' | '112' | '125';
type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'preenche_sigeduc_theme';
const FONT_SCALE_STORAGE_KEY = 'preenche_sigeduc_font_scale';

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 500);
}

function guessNameColumn(headers: string[]): string {
  const exact = headers.find((h) => /^(nome|estudante|aluno|nome do aluno|nome completo)$/i.test(h.trim()));
  if (exact) return exact;
  const partial = headers.find((h) => /nome|estudante|aluno/i.test(h));
  return partial ?? headers[0] ?? '';
}

function guessMatriculaColumn(headers: string[]): string | null {
  return headers.find((h) => /matr[ií]cula|ra|c[oó]digo/i.test(h)) ?? null;
}

function guessObservationColumn(headers: string[]): string | null {
  return headers.find((h) => /^obs|observa[cç][aã]o/i.test(h.trim())) ?? null;
}

export class PreenchePanelController {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private isOpen = false;
  private activeTab: TabKey = 'notas';
  private prevHtmlOverflow = '';
  private prevBodyOverflow = '';

  private theme: ThemeMode = 'light';
  private fontScale: FontScale = '100';

  private detection: ScreenDetection;
  private scraped: ScrapedScreenData | null = null;

  // Estado da planilha em RAM
  private notasSheet: ParsedSpreadsheet | null = null;
  private notasNameCol = '';
  private notasMatCol = '';
  private notasActivityMap: Record<string, string> = {}; // atividadeId -> sheetColumn
  private notasImportOpen = false;
  private notasMappingOpen = true;
  private notasAutoSave = false;
  private notasRamPassword = '';
  private notasAbort: AbortController | null = null;
  private lastNotasReport: GradeFillReport | null = null;
  private lastNrReport: NotRealizedApplyReport | null = null;

  private freqSheet: ParsedSpreadsheet | null = null;
  private freqNameCol = '';
  private freqMatCol = '';
  private freqObsCol = '';
  private freqImportOpen = false;
  private freqMappingOpen = true;
  private freqSelectedDates: Set<string> = new Set();
  private freqEmptyMeansPresent = true;
  private freqAutoSave = false;
  private freqRamPassword = '';
  private freqAbort: AbortController | null = null;
  private lastFreqReport: AttendanceFillReport | null = null;
  private pendingNextDateResolver: ((action: 'continue' | 'cancel') => void) | null = null;

  constructor(private doc: Document) {
    this.host = doc.createElement('div');
    this.host.id = 'preenche-sigeduc-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Isolamento crítico: impedir que SIGEduc bloqueie Ctrl+V / paste / keydown dentro do Shadow DOM
    const stopEvents = ['paste', 'copy', 'cut', 'keydown', 'keyup', 'keypress'];
    for (const evtName of stopEvents) {
      this.host.addEventListener(evtName, (ev) => {
        ev.stopPropagation();
      });
    }

    this.loadDisplayPreferences();
    this.detection = detectSigeducScreen(this.doc, window.location.href);
    this.syncDefaultTab();
    this.checkPendingNotRealizedOnLoad();
    this.render();
    (this.doc.body ?? this.doc.documentElement).appendChild(this.host);
  }

  private loadDisplayPreferences(): void {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        this.theme = savedTheme;
      } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        this.theme = 'dark';
      }
      const savedScale = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
      if (savedScale === '100' || savedScale === '112' || savedScale === '125') {
        this.fontScale = savedScale;
      }
    } catch {
      // localStorage indisponível
    }
  }

  private checkPendingNotRealizedOnLoad(): void {
    const pending = loadPendingNotRealizedQueue();
    if (!pending) return;

    if (this.detection.screen === 'avaliacoes_nao_realizadas') {
      this.scraped = scrapeAvaliacoesNaoRealizadas(this.doc);
      this.lastNrReport = executeNotRealizedFill(this.doc, pending.items, null);
      clearPendingNotRealizedQueue();
      this.activeTab = 'notas';
      this.isOpen = true;
    } else if (this.detection.screen === 'lancar_notas') {
      armConfirmationDialogAutoAccept(this.doc);
    }
  }

  public getDetection(): ScreenDetection {
    this.detection = detectSigeducScreen(this.doc, window.location.href);
    return this.detection;
  }

  public open(): number {
    const t0 = performance.now();
    this.isOpen = true;
    this.prevHtmlOverflow = this.doc.documentElement.style.overflow;
    this.prevBodyOverflow = this.doc.body?.style.overflow ?? '';
    if (window.innerWidth <= 640) {
      this.doc.documentElement.style.overflow = 'hidden';
      if (this.doc.body) this.doc.body.style.overflow = 'hidden';
    }
    this.refreshContext();
    this.render();
    return performance.now() - t0;
  }

  public close(): void {
    this.isOpen = false;
    this.doc.documentElement.style.overflow = this.prevHtmlOverflow;
    if (this.doc.body) this.doc.body.style.overflow = this.prevBodyOverflow;
    // Zerar senhas da RAM ao fechar o painel
    this.notasRamPassword = '';
    this.freqRamPassword = '';
    this.render();
  }

  public toggle(): boolean {
    if (this.isOpen) this.close();
    else this.open();
    return this.isOpen;
  }

  private syncDefaultTab(): void {
    if (this.detection.screen === 'lancar_notas' || this.detection.screen === 'avaliacoes_nao_realizadas') {
      this.activeTab = 'notas';
    } else if (this.detection.screen === 'lancar_frequencia') {
      this.activeTab = 'frequencia';
    } else {
      this.activeTab = 'extrair';
    }
  }

  public refreshContext(): void {
    this.detection = detectSigeducScreen(this.doc, window.location.href);
    if (this.detection.screen === 'portal_docente') {
      this.scraped = scrapePortalDocente(this.doc);
    } else if (this.detection.screen === 'lancar_notas') {
      this.scraped = scrapeLancarNotas(this.doc);
      if (this.notasSheet) this.autoMapNotasColumns();
    } else if (this.detection.screen === 'avaliacoes_nao_realizadas') {
      this.scraped = scrapeAvaliacoesNaoRealizadas(this.doc);
      if (this.notasSheet) this.autoMapNotasColumns();
    } else if (this.detection.screen === 'lancar_frequencia') {
      this.scraped = scrapeLancarFrequencia(this.doc);
      if (this.freqSheet) this.autoMapFreqColumns();
    } else if (this.detection.screen === 'gerenciar_avaliacoes') {
      this.scraped = scrapeGerenciarAvaliacoes(this.doc);
    } else {
      this.scraped = null;
    }
  }

  private autoMapNotasColumns(): void {
    if (!this.notasSheet) return;
    const headers = this.notasSheet.headers;
    if (!this.notasNameCol || !headers.includes(this.notasNameCol)) {
      this.notasNameCol = guessNameColumn(headers);
    }
    if (!this.notasMatCol || !headers.includes(this.notasMatCol)) {
      this.notasMatCol = guessMatriculaColumn(headers) ?? '';
    }
    if (this.scraped?.kind === 'lancar_notas' || this.scraped?.kind === 'avaliacoes_nao_realizadas') {
      const nextMap: Record<string, string> = {};
      for (const av of this.scraped.atividades) {
        if (this.notasActivityMap[av.idAvaliacao] && headers.includes(this.notasActivityMap[av.idAvaliacao])) {
          nextMap[av.idAvaliacao] = this.notasActivityMap[av.idAvaliacao];
          continue;
        }
        const avClean = av.nome.toLowerCase().trim();
        const found = headers.find((h) => {
          const hc = h.toLowerCase().replace(/\(valor.*\)/i, '').trim();
          return hc === avClean || hc.includes(avClean) || avClean.includes(hc);
        });
        if (found) nextMap[av.idAvaliacao] = found;
      }
      this.notasActivityMap = nextMap;
    }
  }

  private autoMapFreqColumns(): void {
    if (!this.freqSheet) return;
    const headers = this.freqSheet.headers;
    if (!this.freqNameCol || !headers.includes(this.freqNameCol)) {
      this.freqNameCol = guessNameColumn(headers);
    }
    if (!this.freqMatCol || !headers.includes(this.freqMatCol)) {
      this.freqMatCol = guessMatriculaColumn(headers) ?? '';
    }
    if (!this.freqObsCol || !headers.includes(this.freqObsCol)) {
      this.freqObsCol = guessObservationColumn(headers) ?? '';
    }
    const dateCols = headers.filter((h) => parseDateHeader(h) !== null);
    if (this.freqSelectedDates.size === 0 && dateCols.length > 0) {
      if (this.scraped?.kind === 'lancar_frequencia') {
        const availSet = new Set(this.scraped.datasDisponiveis.map((d) => d.display));
        if (this.scraped.dataAberta) availSet.add(this.scraped.dataAberta);
        const availableCols = dateCols.filter((h) => {
          const parsed = parseDateHeader(h);
          return parsed ? availSet.has(parsed.display) : false;
        });
        this.freqSelectedDates = new Set(availableCols.length > 0 ? availableCols : dateCols);
      } else {
        this.freqSelectedDates = new Set(dateCols);
      }
    }
  }

  private buildNotasPreview(): GradeFillPreview | null {
    if (!this.notasSheet || this.scraped?.kind !== 'lancar_notas') return null;
    const mappings: ColumnGradeMapping[] = Object.entries(this.notasActivityMap)
      .filter(([, col]) => Boolean(col))
      .map(([atividadeId, sheetColumn]) => ({ atividadeId, sheetColumn }));
    return buildGradeFillPreview(
      this.notasSheet.rows,
      this.notasNameCol,
      this.notasMatCol || null,
      mappings,
      this.scraped
    );
  }

  private render(): void {
    const det = this.detection;
    const openCls = this.isOpen ? 'open' : '';
    const themeCls = this.theme === 'dark' ? 'ps-dark' : '';
    const scaleCls = `ps-scale-${this.fontScale}`;

    this.shadow.innerHTML = `
      <style>${SHADOW_STYLES}</style>
      <button class="ps-fab" id="ps-fab-btn" type="button" aria-label="Abrir painel Preenche SIGEduc">
        <span>Preenche SIGEduc</span>
        <span class="ps-fab-badge">${escapeHtml(det.badge)}</span>
      </button>
      <div class="ps-backdrop ${openCls}" id="ps-backdrop"></div>
      <aside class="ps-drawer ${openCls} ${themeCls} ${scaleCls}" id="ps-drawer" role="dialog" aria-label="Painel Preenche SIGEduc">
        <header class="ps-header">
          <div class="ps-header-title">
            <strong>Preenche SIGEduc</strong>
            <span class="ps-header-sub">${escapeHtml(det.label)}</span>
          </div>
          <div class="ps-header-actions">
            <button class="ps-icon-btn" id="ps-font-btn" type="button" title="Alterar tamanho do texto" aria-label="Alterar tamanho do texto">A ${this.fontScale}%</button>
            <button class="ps-icon-btn" id="ps-theme-btn" type="button" title="Alternar tema claro/escuro" aria-label="Alternar tema claro/escuro">${this.theme === 'dark' ? '☀️' : '🌙'}</button>
            <button class="ps-icon-btn close-glyph" id="ps-close-btn" type="button" aria-label="Fechar painel">&times;</button>
          </div>
        </header>
        <nav class="ps-tabs" role="tablist">
          <button class="ps-tab ${this.activeTab === 'notas' ? 'active' : ''}" data-tab="notas" role="tab" type="button">Notas</button>
          <button class="ps-tab ${this.activeTab === 'frequencia' ? 'active' : ''}" data-tab="frequencia" role="tab" type="button">Frequência</button>
          <button class="ps-tab ${this.activeTab === 'extrair' ? 'active' : ''}" data-tab="extrair" role="tab" type="button">Extrair</button>
        </nav>
        <main class="ps-body" id="ps-body">
          ${this.renderTabBody()}
        </main>
      </aside>
    `;

    this.bindEvents();
  }

  private renderTabBody(): string {
    if (this.detection.sessionExpired) {
      return `
        <div class="ps-banner error">
          <strong>Sessão não iniciada ou expirada.</strong><br/>
          Faça login no SIGEduc e abra uma turma (Notas, Frequência ou Portal Docente) para utilizar o preenchimento e a extração.
        </div>
      `;
    }
    if (this.activeTab === 'notas') return this.renderNotasTab();
    if (this.activeTab === 'frequencia') return this.renderFrequenciaTab();
    return this.renderExtrairTab();
  }

  private renderNotasTab(): string {
    if (this.scraped?.kind === 'avaliacoes_nao_realizadas') {
      return this.renderNaoRealizadasSubView(this.scraped);
    }

    if (this.scraped?.kind !== 'lancar_notas') {
      return `
        <div class="ps-banner warn">
          Abra a tela <strong>Lançar Resultados</strong> (ou <strong>Verificar Avaliações não realizadas</strong>) de uma turma no SIGEduc para preencher notas.
          Você pode usar a aba <strong>Extrair</strong> no Portal Docente para listar suas turmas.
        </div>
      `;
    }

    const scr: ScrapedNotasScreen = this.scraped;
    const preview = this.buildNotasPreview();
    const openCount = scr.atividades.filter((a) => !a.disabled).length;
    const closedCount = scr.atividades.length - openCount;

    let mappingHtml = '';
    if (this.notasSheet) {
      const cols = this.notasSheet.headers;
      const colOpts = (selected: string, allowEmpty = false) =>
        (allowEmpty ? `<option value="">-- Não usar --</option>` : '') +
        cols
          .map((c) => `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(c)}</option>`)
          .join('');

      const mappedCount = Object.values(this.notasActivityMap).filter(Boolean).length;

      const activitySelectors = scr.atividades
        .map((av) => {
          const badge = av.disabled
            ? `<span class="ps-pill bad">Bloqueada</span>`
            : `<span class="ps-pill ok">Valor ${av.valorMax.toFixed(1)}</span>`;
          return `
            <div class="ps-field">
              <label class="ps-label">${escapeHtml(av.nome)} ${badge}</label>
              <select class="ps-select ps-notas-av-map" data-av-id="${escapeHtml(av.idAvaliacao)}">
                ${colOpts(this.notasActivityMap[av.idAvaliacao] ?? '', true)}
              </select>
            </div>
          `;
        })
        .join('');

      mappingHtml = `
        <details class="ps-card ps-compact-details" id="ps-notas-map-details" ${this.notasMappingOpen ? 'open' : ''}>
          <summary>2. Mapeamento (${mappedCount}/${scr.atividades.length} atividades • ${this.notasSheet.rows.length} linhas)</summary>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
            <div class="ps-grid-2">
              <div class="ps-field">
                <label class="ps-label" for="ps-notas-name-col">Coluna Nome</label>
                <select class="ps-select" id="ps-notas-name-col">${colOpts(this.notasNameCol)}</select>
              </div>
              <div class="ps-field">
                <label class="ps-label" for="ps-notas-mat-col">Matrícula (opcional)</label>
                <select class="ps-select" id="ps-notas-mat-col">${colOpts(this.notasMatCol, true)}</select>
              </div>
            </div>
            ${activitySelectors || '<div class="ps-banner warn">Esta unidade não possui atividades avaliativas cadastradas.</div>'}
          </div>
        </details>
      `;
    }

    let previewHtml = '';
    if (preview) {
      const m = preview.match;
      const issueDetails: string[] = [];
      if (m.notFoundInPage.length) {
        issueDetails.push(`<li><strong>Não encontrados no SIGEduc (${m.notFoundInPage.length}):</strong> ${escapeHtml(m.notFoundInPage.map((x) => x.sheetRow.rawName).join(', '))}</li>`);
      }
      if (m.duplicates.length) {
        issueDetails.push(`<li><strong>Homônimos bloqueados (${m.duplicates.length}):</strong> ${escapeHtml(m.duplicates.map((d) => d.normalizedName).join(', '))}</li>`);
      }
      const invalids = preview.items.filter((i) => i.status === 'invalid');
      if (invalids.length) {
        issueDetails.push(`<li><strong>Valores inválidos (${invalids.length}):</strong> ${escapeHtml(invalids.map((i) => `${i.studentName}: ${i.reason}`).join(' | '))}</li>`);
      }
      const recConflicts = preview.items.filter((i) => i.status === 'rec_conflict');
      if (recConflicts.length) {
        issueDetails.push(`<li><strong>Conflito com Rec. (${recConflicts.length}):</strong> ${escapeHtml(recConflicts.map((i) => i.studentName).join(', '))}</li>`);
      }
      if (preview.notRealizedCount > 0) {
        const nrPreviewNames = preview.items
          .filter((i) => i.status === 'not_realized')
          .slice(0, 6)
          .map((i) => `${i.studentName} (${i.atividadeNome})`);
        issueDetails.push(`<li><strong>Não Realizadas agendadas (${preview.notRealizedCount}):</strong> ${escapeHtml(nrPreviewNames.join(', '))}${preview.notRealizedCount > 6 ? '...' : ''}</li>`);
      }
      if (m.notInSheet.length) {
        issueDetails.push(`<li><strong>Na turma, ausentes na planilha (${m.notInSheet.length}):</strong> ${escapeHtml(m.notInSheet.map((x) => x.pageStudent.rawName).slice(0, 6).join(', '))}${m.notInSheet.length > 6 ? '...' : ''}</li>`);
      }

      const canRun = preview.readyCount > 0 || preview.notRealizedCount > 0;

      previewHtml = `
        <section class="ps-card">
          <h3 class="ps-card-title">3. Prévia & Conferência</h3>
          <div class="ps-stats">
            <div class="ps-stat ok" data-stat="matched"><strong>${m.matched.length}</strong><span>Alunos casados exatos</span></div>
            <div class="ps-stat ok" data-stat="ready"><strong>${preview.readyCount}</strong><span>Notas prontas (0 = zero)</span></div>
            <div class="ps-stat ${preview.notRealizedCount > 0 ? 'warn' : ''}" data-stat="not-realized"><strong>${preview.notRealizedCount}</strong><span>Não Realizadas (NF/vazio)</span></div>
            <div class="ps-stat ${m.notFoundInPage.length + m.duplicates.length + preview.invalidCount + preview.disabledCount + preview.recConflictCount > 0 ? 'bad' : ''}" data-stat="issues"><strong>${m.notFoundInPage.length + m.duplicates.length + preview.invalidCount + preview.disabledCount + preview.recConflictCount}</strong><span>Diverg. / Invál. / Bloq.</span></div>
          </div>
          ${
            issueDetails.length
              ? `<details class="ps-details" open><summary>Ver detalhes de divergências e avisos</summary><ul class="ps-list">${issueDetails.join('')}</ul></details>`
              : '<div class="ps-banner success">Todos os alunos da planilha casaram exatamente e não há divergências.</div>'
          }

          <label class="ps-check-row">
            <input type="checkbox" id="ps-notas-autosave" ${this.notasAutoSave ? 'checked' : ''} />
            <span>Auto-gravar na sessão (usa senha apenas em memória RAM)</span>
          </label>
          <div class="ps-field ${this.notasAutoSave ? '' : 'ps-hidden'}" id="ps-notas-pwd-wrap">
            <label class="ps-label" for="ps-notas-pwd">Senha do SIGEduc (apenas RAM, nunca salva)</label>
            <input class="ps-input" id="ps-notas-pwd" type="password" autocomplete="off" value="${escapeHtml(this.notasRamPassword)}" placeholder="Digite sua senha para auto-gravar" />
          </div>

          <div class="ps-progress-wrap ps-hidden" id="ps-notas-prog-wrap">
            <div class="ps-progress-bar" id="ps-notas-prog-bar"></div>
          </div>
          <div class="ps-muted ps-hidden" id="ps-notas-prog-text"></div>

          <div class="ps-row">
            <button class="ps-btn ps-btn-primary ps-btn-block" id="ps-notas-run" type="button" ${canRun ? '' : 'disabled'}>
              Preencher ${preview.readyCount} Nota(s)${preview.notRealizedCount > 0 ? ` + ${preview.notRealizedCount} NF` : ''}
            </button>
            <button class="ps-btn ps-btn-danger ps-btn-block ps-hidden" id="ps-notas-cancel" type="button">
              Cancelar Preenchimento
            </button>
          </div>
        </section>
      `;
    }

    let reportHtml = '';
    if (this.lastNotasReport) {
      const r = this.lastNotasReport;
      const reportNotes: string[] = [];
      if (r.notFoundInPage.length) {
        reportNotes.push(`<li><strong>Não encontrados (${r.notFoundInPage.length}):</strong> ${escapeHtml(r.notFoundInPage.join(', '))}</li>`);
      }
      if (r.invalidDetails.length) {
        reportNotes.push(`<li><strong>Notas inválidas (${r.invalidDetails.length}):</strong> ${escapeHtml(r.invalidDetails.map((d) => `${d.studentName} (${d.atividadeNome}: "${d.rawValue}" — ${d.reason})`).join('; '))}</li>`);
      }
      if (r.notRealizedCount > 0) {
        reportNotes.push(`<li><strong>Não Realizadas em fila (${r.notRealizedCount}):</strong> Ao confirmar a senha, o modal do SIGEduc será aceito automaticamente em "Sim" para marcar os checkboxes na tela seguinte.</li>`);
      }
      if (r.duplicates.length) {
        reportNotes.push(`<li><strong>Homônimos bloqueados (${r.duplicates.length}):</strong> ${escapeHtml(r.duplicates.join(', '))}</li>`);
      }
      reportHtml = `
        <section class="ps-card" id="ps-notas-report">
          <h3 class="ps-card-title">Relatório da Execução</h3>
          <div class="ps-banner ${r.errors.length || r.sessionExpired || r.invalidCount > 0 || r.notFoundInPage.length > 0 ? 'warn' : 'success'}">
            <strong>${r.filledCount}/${r.totalAttempted}</strong> campos preenchidos •
            <strong>${r.ajaxCompletedCount}</strong> confirmações AJAX
            ${r.notRealizedCount > 0 ? ` • <strong>${r.notRealizedCount}</strong> Não Realizada(s)` : ''}<br/>
            ${r.autoSaved ? '<strong>Gravado automaticamente</strong>' : '<strong>Modo Assistido:</strong> confira na tabela, digite sua senha e clique em Gravar.'}
          </div>
          ${reportNotes.length ? `<ul class="ps-list">${reportNotes.join('')}</ul>` : ''}
          <button class="ps-btn ps-btn-secondary ps-btn-block" id="ps-notas-dl-report" type="button">Baixar Relatório (.json)</button>
        </section>
      `;
    }

    const importInner = `
      <div class="ps-field">
        <label class="ps-file-btn" for="ps-notas-file">
          <span>Selecionar planilha (.xlsx, .xls, .csv)</span>
          <span class="ps-pill ok">${this.notasSheet ? escapeHtml(this.notasSheet.sourceName) : 'Arquivo'}</span>
        </label>
        <input class="ps-file-input-hidden" id="ps-notas-file" type="file" accept=".xlsx,.xls,.csv" />
      </div>
      <div class="ps-field">
        <label class="ps-label" for="ps-notas-paste">Ou cole células do Excel / Google Sheets (Ctrl+V)</label>
        <textarea class="ps-textarea" id="ps-notas-paste" placeholder="Cole aqui as linhas com Nome e Notas (0 = zero; NF/vazio = Não Fez)..."></textarea>
      </div>
      <button class="ps-btn ps-btn-secondary" id="ps-notas-parse-paste" type="button">Ler Texto Colado</button>
      <div class="ps-banner error ps-hidden" id="ps-notas-error"></div>
    `;

    const importHtml = this.notasSheet
      ? `<details class="ps-card ps-compact-details" id="ps-notas-import-details" ${this.notasImportOpen ? 'open' : ''}>
           <summary>1. Planilha: ${escapeHtml(this.notasSheet.sourceName)} (${this.notasSheet.rows.length} linhas)</summary>
           <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">${importInner}</div>
         </details>`
      : `<section class="ps-card">
           <h3 class="ps-card-title">1. Importar Planilha de Notas</h3>
           ${importInner}
         </section>`;

    return `
      <div class="ps-banner info">
        <strong>${escapeHtml(scr.turma || 'Turma')}</strong><br/>
        ${escapeHtml(scr.componente)} • <strong>${escapeHtml(scr.unidadeAtiva)}</strong> (${scr.alunos.length} alunos, ${openCount} ativ. abertas, ${closedCount} bloq.)
      </div>
      ${reportHtml}
      ${importHtml}
      ${mappingHtml}
      ${previewHtml}
    `;
  }

  private renderNaoRealizadasSubView(scr: ScrapedNaoRealizadasScreen): string {
    let reportHtml = '';
    if (this.lastNrReport) {
      const r = this.lastNrReport;
      reportHtml = `
        <section class="ps-card" id="ps-nr-report">
          <h3 class="ps-card-title">Checkboxes de Não Realização</h3>
          <div class="ps-banner ${r.errors.length || r.unavailableCount > 0 ? 'warn' : 'success'}">
            <strong>${r.appliedCount}</strong> marcado(s) automaticamente agora •
            <strong>${r.alreadyMarkedCount}</strong> já marcado(s)
            ${r.unavailableCount > 0 ? ` • <strong>${r.unavailableCount}</strong> já possuía(m) nota` : ''}<br/>
            ${r.autoSaved ? '<strong>Gravado automaticamente</strong>' : '<strong>Revise os checkboxes</strong> na tabela e clique em Gravar no SIGEduc.'}
          </div>
        </section>
      `;
    }

    let mappingHtml = '';
    let applyBtnHtml = '';
    if (this.notasSheet) {
      const cols = this.notasSheet.headers;
      const colOpts = (selected: string, allowEmpty = false) =>
        (allowEmpty ? `<option value="">-- Não usar --</option>` : '') +
        cols
          .map((c) => `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(c)}</option>`)
          .join('');
      const mappedCount = Object.values(this.notasActivityMap).filter(Boolean).length;

      mappingHtml = `
        <details class="ps-card ps-compact-details" id="ps-notas-map-details" ${this.notasMappingOpen ? 'open' : ''}>
          <summary>2. Mapeamento (${mappedCount}/${scr.atividades.length} atividades)</summary>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
            <div class="ps-grid-2">
              <div class="ps-field">
                <label class="ps-label" for="ps-notas-name-col">Coluna Nome</label>
                <select class="ps-select" id="ps-notas-name-col">${colOpts(this.notasNameCol)}</select>
              </div>
              <div class="ps-field">
                <label class="ps-label" for="ps-notas-mat-col">Matrícula (opcional)</label>
                <select class="ps-select" id="ps-notas-mat-col">${colOpts(this.notasMatCol, true)}</select>
              </div>
            </div>
            ${scr.atividades
              .map(
                (av) => `
              <div class="ps-field">
                <label class="ps-label">${escapeHtml(av.nome)}</label>
                <select class="ps-select ps-notas-av-map" data-av-id="${escapeHtml(av.idAvaliacao)}">
                  ${colOpts(this.notasActivityMap[av.idAvaliacao] ?? '', true)}
                </select>
              </div>`
              )
              .join('')}
          </div>
        </details>
      `;

      const mappings: ColumnGradeMapping[] = Object.entries(this.notasActivityMap)
        .filter(([, col]) => Boolean(col))
        .map(([atividadeId, sheetColumn]) => ({ atividadeId, sheetColumn }));
      const pendingFromSheet = extractNotRealizedFromSheet(
        this.notasSheet.rows,
        this.notasNameCol,
        this.notasMatCol || null,
        mappings,
        scr
      );

      applyBtnHtml = `
        <section class="ps-card">
          <h3 class="ps-card-title">3. Aplicar Checkboxes</h3>
          <div class="ps-banner info">
            <strong>${pendingFromSheet.length}</strong> marcação(ões) de Não Realizada detectada(s) (célula vazia, NF, Não Fez ou FV).
          </div>
          <button class="ps-btn ps-btn-primary ps-btn-block" id="ps-nr-apply" type="button" ${pendingFromSheet.length === 0 ? 'disabled' : ''}>
            Marcar ${pendingFromSheet.length} Não Realizada(s)
          </button>
        </section>
      `;
    }

    const importInner = `
      <div class="ps-field">
        <label class="ps-file-btn" for="ps-notas-file">
          <span>Selecionar planilha (.xlsx, .xls, .csv)</span>
          <span class="ps-pill ok">${this.notasSheet ? escapeHtml(this.notasSheet.sourceName) : 'Arquivo'}</span>
        </label>
        <input class="ps-file-input-hidden" id="ps-notas-file" type="file" accept=".xlsx,.xls,.csv" />
      </div>
      <div class="ps-field">
        <label class="ps-label" for="ps-notas-paste">Ou cole células (NF / Não Fez / vazio)</label>
        <textarea class="ps-textarea" id="ps-notas-paste" placeholder="Cole aqui Nome e colunas de atividades..."></textarea>
      </div>
      <button class="ps-btn ps-btn-secondary" id="ps-notas-parse-paste" type="button">Ler Texto Colado</button>
      <div class="ps-banner error ps-hidden" id="ps-notas-error"></div>
    `;

    const importHtml = this.notasSheet
      ? `<details class="ps-card ps-compact-details" id="ps-notas-import-details" ${this.notasImportOpen ? 'open' : ''}>
           <summary>1. Planilha: ${escapeHtml(this.notasSheet.sourceName)} (${this.notasSheet.rows.length} linhas)</summary>
           <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">${importInner}</div>
         </details>`
      : `<section class="ps-card">
           <h3 class="ps-card-title">1. Importar Planilha (Opcional)</h3>
           ${importInner}
         </section>`;

    return `
      <div class="ps-banner info">
        <strong>${escapeHtml(scr.turma || 'Avaliações Não Realizadas')}</strong><br/>
        ${escapeHtml(scr.componente)} • <strong>${escapeHtml(scr.unidadeAtiva)}</strong> (${scr.alunos.length} estudantes)
      </div>
      ${reportHtml}
      ${importHtml}
      ${mappingHtml}
      ${applyBtnHtml}
    `;
  }

  private renderFrequenciaTab(): string {
    if (this.scraped?.kind !== 'lancar_frequencia') {
      return `
        <div class="ps-banner warn">
          Abra a tela <strong>Informar Frequência</strong> de uma turma no SIGEduc para preencher faltas/presenças.
        </div>
      `;
    }

    const scr: ScrapedFrequenciaScreen = this.scraped;
    let mappingHtml = '';

    if (this.freqSheet) {
      const headers = this.freqSheet.headers;
      const colOpts = (selected: string, allowEmpty = false) =>
        (allowEmpty ? `<option value="">-- Não usar --</option>` : '') +
        headers
          .map((c) => `<option value="${escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${escapeHtml(c)}</option>`)
          .join('');

      const dateHeaders = headers.filter((h) => parseDateHeader(h) !== null);
      const preview = buildAttendancePreview(
        this.freqSheet.rows,
        this.freqNameCol,
        this.freqMatCol || null,
        Array.from(this.freqSelectedDates),
        scr
      );

      const dateChecks = dateHeaders
        .map((dh) => {
          const parsed = parseDateHeader(dh);
          const avail = parsed && (scr.datasDisponiveis.some((d) => d.display === parsed.display) || scr.dataAberta === parsed.display);
          const checked = this.freqSelectedDates.has(dh);
          return `
            <label class="ps-check-row">
              <input type="checkbox" class="ps-freq-date-cb" value="${escapeHtml(dh)}" ${checked ? 'checked' : ''} />
              <span>${escapeHtml(parsed?.display ?? dh)}</span>
              <span class="ps-pill ${avail ? 'ok' : 'warn'}">${avail ? 'No calendário' : 'Indisponível'}</span>
            </label>
          `;
        })
        .join('');

      mappingHtml = `
        <details class="ps-card ps-compact-details" id="ps-freq-map-details" ${this.freqMappingOpen ? 'open' : ''}>
          <summary>2. Colunas e Datas (${dateHeaders.length} datas • ${this.freqSheet.rows.length} alunos)</summary>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
            <div class="ps-grid-2">
              <div class="ps-field">
                <label class="ps-label" for="ps-freq-name-col">Coluna Nome</label>
                <select class="ps-select" id="ps-freq-name-col">${colOpts(this.freqNameCol)}</select>
              </div>
              <div class="ps-field">
                <label class="ps-label" for="ps-freq-mat-col">Matrícula (opcional)</label>
                <select class="ps-select" id="ps-freq-mat-col">${colOpts(this.freqMatCol, true)}</select>
              </div>
            </div>
            <div class="ps-field">
              <label class="ps-label" for="ps-freq-obs-col">Coluna Observação (opcional)</label>
              <select class="ps-select" id="ps-freq-obs-col">${colOpts(this.freqObsCol, true)}</select>
            </div>
            <label class="ps-check-row">
              <input type="checkbox" id="ps-freq-empty-present" ${this.freqEmptyMeansPresent ? 'checked' : ''} />
              <span>Célula vazia significa Presença (P)</span>
            </label>
          </div>
        </details>

        <section class="ps-card">
          <h3 class="ps-card-title">3. Datas a Processar & Prévia</h3>
          <div class="ps-stats">
            <div class="ps-stat ok"><strong>${preview.match.matched.length}</strong><span>Alunos casados exatos</span></div>
            <div class="ps-stat ${preview.match.notFoundInPage.length + preview.match.duplicates.length > 0 ? 'bad' : ''}"><strong>${preview.match.notFoundInPage.length + preview.match.duplicates.length}</strong><span>Não casados / Homônimos</span></div>
            <div class="ps-stat ${preview.match.notInSheet.length > 0 ? 'warn' : ''}"><strong>${preview.match.notInSheet.length}</strong><span>Na turma, fora da planilha</span></div>
            <div class="ps-stat ok"><strong>${this.freqSelectedDates.size}</strong><span>Datas selecionadas</span></div>
          </div>
          ${(() => {
            const freqIssues: string[] = [];
            if (preview.match.notFoundInPage.length) {
              freqIssues.push(`<li><strong>Não encontrados no SIGEduc (${preview.match.notFoundInPage.length}):</strong> ${escapeHtml(preview.match.notFoundInPage.map((x) => x.sheetRow.rawName).join(', '))}</li>`);
            }
            if (preview.match.duplicates.length) {
              freqIssues.push(`<li><strong>Homônimos bloqueados (${preview.match.duplicates.length}):</strong> ${escapeHtml(preview.match.duplicates.map((d) => d.normalizedName).join(', '))}</li>`);
            }
            if (preview.match.notInSheet.length) {
              freqIssues.push(`<li><strong>Na turma, ausentes na planilha (${preview.match.notInSheet.length} manterão presença padrão):</strong> ${escapeHtml(preview.match.notInSheet.map((x) => x.pageStudent.rawName).slice(0, 6).join(', '))}${preview.match.notInSheet.length > 6 ? '...' : ''}</li>`);
            }
            const unavail = preview.dateColumns.filter((d) => !d.availableInCalendar);
            if (unavail.length) {
              freqIssues.push(`<li><strong>Datas indisponíveis no calendário:</strong> ${escapeHtml(unavail.map((u) => u.parsedDate?.display ?? u.sheetColumn).join(', '))}</li>`);
            }
            return freqIssues.length
              ? `<details class="ps-details" open><summary>Ver detalhes de divergências e avisos</summary><ul class="ps-list">${freqIssues.join('')}</ul></details>`
              : '';
          })()}
          <div class="ps-muted">Regra do SIGEduc: na tabela do portal, marcar a caixa significa FALTA.</div>
          <div class="ps-field">
            ${dateChecks || '<div class="ps-banner warn">Nenhuma coluna de data (DD/MM/AAAA) encontrada na planilha.</div>'}
          </div>
          <label class="ps-check-row">
            <input type="checkbox" id="ps-freq-autosave" ${this.freqAutoSave ? 'checked' : ''} />
            <span>Auto-gravar lote na sessão (senha apenas em RAM)</span>
          </label>
          <div class="ps-field ${this.freqAutoSave ? '' : 'ps-hidden'}" id="ps-freq-pwd-wrap">
            <label class="ps-label" for="ps-freq-pwd">Senha do SIGEduc (apenas RAM, nunca salva)</label>
            <input class="ps-input" id="ps-freq-pwd" type="password" autocomplete="off" value="${escapeHtml(this.freqRamPassword)}" placeholder="Digite sua senha para auto-gravar" />
          </div>

          <div class="ps-progress-wrap ps-hidden" id="ps-freq-prog-wrap">
            <div class="ps-progress-bar" id="ps-freq-prog-bar"></div>
          </div>
          <div class="ps-muted ps-hidden" id="ps-freq-prog-text"></div>

          <div class="ps-banner info ps-hidden" id="ps-freq-step-box">
            <div id="ps-freq-step-msg"></div>
            <div class="ps-row" style="margin-top:8px;">
              <button class="ps-btn ps-btn-success" id="ps-freq-next-step" type="button">Próxima Data</button>
              <button class="ps-btn ps-btn-danger" id="ps-freq-cancel-step" type="button">Parar Lote</button>
            </div>
          </div>

          <div class="ps-row">
            <button class="ps-btn ps-btn-primary ps-btn-block" id="ps-freq-run" type="button" ${this.freqSelectedDates.size === 0 ? 'disabled' : ''}>
              Preencher Frequência (${this.freqSelectedDates.size} data(s))
            </button>
            <button class="ps-btn ps-btn-danger ps-btn-block ps-hidden" id="ps-freq-cancel" type="button">
              Cancelar
            </button>
          </div>
        </section>
      `;
    }

    let reportHtml = '';
    if (this.lastFreqReport) {
      const filledDates = this.lastFreqReport.datesProcessed.filter((d) => d.status === 'filled');
      const autoSavedAny = filledDates.some((d) => d.autoSaved);
      const allWarnings = this.lastFreqReport.datesProcessed.flatMap((d) => d.warnings);
      const allErrors = this.lastFreqReport.datesProcessed.flatMap((d) => d.errors);
      const notInSheetCount = filledDates[0]?.notInSheet.length ?? 0;

      const rows = this.lastFreqReport.datesProcessed
        .map((d: AttendanceDateResult) => {
          const pill = d.status === 'filled' ? 'ok' : d.status === 'date_unavailable' ? 'warn' : 'bad';
          const statusLabel = d.status === 'filled' ? 'Preenchida' : d.status === 'date_unavailable' ? 'Indisponível' : d.status;
          const summaryCell =
            d.status === 'filled'
              ? `${d.absentStudentsCount} ${d.absentStudentsCount === 1 ? 'falta' : 'faltas'} / ${d.presentStudentsCount} pres.`
              : '— (não processada)';
          return `<tr><td>${escapeHtml(d.dateDisplay)}</td><td><span class="ps-pill ${pill}">${escapeHtml(statusLabel)}</span></td><td>${summaryCell}</td></tr>`;
        })
        .join('');

      const notesList: string[] = [];
      if (notInSheetCount > 0) {
        notesList.push(`<li><strong>${notInSheetCount} estudantes da turma</strong> não constavam na planilha e mantiveram presença padrão.</li>`);
      }
      for (const w of allWarnings) {
        notesList.push(`<li>${escapeHtml(w)}</li>`);
      }
      for (const e of allErrors) {
        notesList.push(`<li><strong>Erro:</strong> ${escapeHtml(e)}</li>`);
      }

      reportHtml = `
        <section class="ps-card" id="ps-freq-report">
          <h3 class="ps-card-title">Relatório por Data</h3>
          <div class="ps-banner ${allErrors.length || allWarnings.length ? 'warn' : 'success'}">
            <strong>${filledDates.length}/${this.lastFreqReport.datesProcessed.length}</strong> data(s) preenchida(s) •
            ${autoSavedAny ? '<strong>Gravado automaticamente na sessão</strong>' : '<strong>Modo Assistido:</strong> revise na página e clique em Gravar Frequências.'}
          </div>
          <div class="ps-table-wrap">
            <table class="ps-table">
              <thead><tr><th>Data</th><th>Status</th><th>Resumo</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${notesList.length ? `<ul class="ps-list">${notesList.join('')}</ul>` : ''}
          <button class="ps-btn ps-btn-secondary ps-btn-block" id="ps-freq-dl-report" type="button">Baixar Relatório (.json)</button>
        </section>
      `;
    }

    const freqImportInner = `
      <div class="ps-field">
        <label class="ps-file-btn" for="ps-freq-file">
          <span>Selecionar planilha (.xlsx, .xls, .csv)</span>
          <span class="ps-pill ok">${this.freqSheet ? escapeHtml(this.freqSheet.sourceName) : 'Arquivo'}</span>
        </label>
        <input class="ps-file-input-hidden" id="ps-freq-file" type="file" accept=".xlsx,.xls,.csv" />
      </div>
      <div class="ps-field">
        <label class="ps-label" for="ps-freq-paste">Ou cole aqui (Ctrl+V liberado mesmo com bloqueio do SIGEduc)</label>
        <textarea class="ps-textarea" id="ps-freq-paste" placeholder="Cole aqui Nome e colunas de data (P/F)..."></textarea>
      </div>
      <button class="ps-btn ps-btn-secondary" id="ps-freq-parse-paste" type="button">Ler Texto Colado</button>
      <div class="ps-banner error ps-hidden" id="ps-freq-error"></div>
    `;

    const freqImportHtml = this.freqSheet
      ? `<details class="ps-card ps-compact-details" id="ps-freq-import-details" ${this.freqImportOpen ? 'open' : ''}>
           <summary>1. Planilha: ${escapeHtml(this.freqSheet.sourceName)} (${this.freqSheet.rows.length} linhas)</summary>
           <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">${freqImportInner}</div>
         </details>`
      : `<section class="ps-card">
           <h3 class="ps-card-title">1. Importar Planilha de Frequência</h3>
           ${freqImportInner}
         </section>`;

    return `
      <div class="ps-banner info">
        <strong>${escapeHtml(scr.turma || 'Turma')}</strong><br/>
        Horário: <strong>${escapeHtml(scr.horarios || '-')}</strong> • Dia aberto: <strong>${escapeHtml(scr.dataAberta ?? 'Nenhum selecionado')}</strong><br/>
        <span class="ps-muted">${scr.alunos.length} estudantes na lista • ${scr.datasDisponiveis.length} datas letivas no calendário</span>
      </div>
      ${reportHtml}
      ${freqImportHtml}
      ${mappingHtml}
    `;
  }

  private renderExtrairTab(): string {
    if (!this.scraped) {
      return `
        <div class="ps-banner warn">
          Navegue até uma das telas suportadas para extrair dados:<br/>
          • Portal Docente (Turmas)<br/>
          • Lançar Resultados (Notas & Alunos)<br/>
          • Informar Frequência (Alunos, Matrículas & Datas)<br/>
          • Gerenciar Avaliações (Atividades das Unidades)
        </div>
      `;
    }

    const bundle = buildExportBundle(this.scraped);
    const previewRows = bundle.rows.slice(0, 8);
    const ths = bundle.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const trs = previewRows
      .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c ?? ''))}</td>`).join('')}</tr>`)
      .join('');

    const isTemplate = this.scraped.kind === 'lancar_notas' || this.scraped.kind === 'lancar_frequencia';
    const xlsxLabel = isTemplate ? 'Baixar Modelo (.xlsx)' : 'Exportar .xlsx';

    return `
      <section class="ps-card">
        <h3 class="ps-card-title">Dados Detectados na Tela</h3>
        <div class="ps-banner success">
          <strong>${escapeHtml(this.detection.label)}</strong><br/>
          Total de registros extraídos: <strong>${bundle.rows.length}</strong>
        </div>
        <div class="ps-table-wrap">
          <table class="ps-table">
            <thead><tr>${ths}</tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>
        ${bundle.rows.length > 8 ? `<div class="ps-muted">Exibindo 8 de ${bundle.rows.length} registros. Exporte para ver todos.</div>` : ''}
        <div class="ps-row">
          <button class="ps-btn ps-btn-primary ps-btn-block" id="ps-exp-xlsx" type="button">${xlsxLabel}</button>
          <button class="ps-btn ps-btn-secondary" id="ps-exp-csv" type="button" style="flex:1">Exportar .csv</button>
          <button class="ps-btn ps-btn-secondary" id="ps-exp-json" type="button" style="flex:1">Exportar .json</button>
        </div>
        <button class="ps-btn ps-btn-secondary ps-btn-block" id="ps-exp-refresh" type="button">Atualizar Leitura da Tela</button>
      </section>
    `;
  }

  private bindEvents(): void {
    const q = <T extends HTMLElement>(id: string) => this.shadow.getElementById(id) as T | null;

    q<HTMLButtonElement>('ps-fab-btn')?.addEventListener('click', () => this.toggle());
    q<HTMLButtonElement>('ps-close-btn')?.addEventListener('click', () => this.close());
    q<HTMLDivElement>('ps-backdrop')?.addEventListener('click', () => this.close());

    q<HTMLButtonElement>('ps-font-btn')?.addEventListener('click', () => {
      const order: FontScale[] = ['100', '112', '125'];
      const next = order[(order.indexOf(this.fontScale) + 1) % order.length];
      this.fontScale = next;
      try {
        window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, next);
      } catch {
        // noop
      }
      this.render();
    });

    q<HTMLButtonElement>('ps-theme-btn')?.addEventListener('click', () => {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, this.theme);
      } catch {
        // noop
      }
      this.render();
    });

    q<HTMLDetailsElement>('ps-notas-import-details')?.addEventListener('toggle', (ev) => {
      this.notasImportOpen = (ev.target as HTMLDetailsElement).open;
    });
    q<HTMLDetailsElement>('ps-notas-map-details')?.addEventListener('toggle', (ev) => {
      this.notasMappingOpen = (ev.target as HTMLDetailsElement).open;
    });
    q<HTMLDetailsElement>('ps-freq-import-details')?.addEventListener('toggle', (ev) => {
      this.freqImportOpen = (ev.target as HTMLDetailsElement).open;
    });
    q<HTMLDetailsElement>('ps-freq-map-details')?.addEventListener('toggle', (ev) => {
      this.freqMappingOpen = (ev.target as HTMLDetailsElement).open;
    });

    for (const tabBtn of Array.from(this.shadow.querySelectorAll('.ps-tab'))) {
      tabBtn.addEventListener('click', () => {
        const key = (tabBtn as HTMLElement).dataset.tab as TabKey;
        this.activeTab = key;
        this.refreshContext();
        this.render();
      });
    }

    // --- NOTAS EVENTS ---
    const notasErr = q<HTMLDivElement>('ps-notas-error');
    const showNotasErr = (msg: string) => {
      if (!notasErr) return;
      notasErr.textContent = msg;
      notasErr.classList.remove('ps-hidden');
    };

    q<HTMLInputElement>('ps-notas-file')?.addEventListener('change', async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        this.notasSheet = parseSpreadsheetBuffer(buf, file.name);
        this.notasNameCol = '';
        this.notasMatCol = '';
        this.notasActivityMap = {};
        this.notasImportOpen = false;
        this.notasMappingOpen = true;
        this.lastNotasReport = null;
        this.lastNrReport = null;
        this.autoMapNotasColumns();
        this.render();
      } catch (err) {
        showNotasErr((err as Error).message);
      }
    });

    q<HTMLButtonElement>('ps-notas-parse-paste')?.addEventListener('click', () => {
      const txt = q<HTMLTextAreaElement>('ps-notas-paste')?.value ?? '';
      try {
        this.notasSheet = parsePastedTable(txt);
        this.notasNameCol = '';
        this.notasMatCol = '';
        this.notasActivityMap = {};
        this.notasImportOpen = false;
        this.notasMappingOpen = true;
        this.lastNotasReport = null;
        this.lastNrReport = null;
        this.autoMapNotasColumns();
        this.render();
      } catch (err) {
        showNotasErr((err as Error).message);
      }
    });

    q<HTMLSelectElement>('ps-notas-name-col')?.addEventListener('change', (ev) => {
      this.notasNameCol = (ev.target as HTMLSelectElement).value;
      this.render();
    });

    q<HTMLSelectElement>('ps-notas-mat-col')?.addEventListener('change', (ev) => {
      this.notasMatCol = (ev.target as HTMLSelectElement).value;
      this.render();
    });

    for (const sel of Array.from(this.shadow.querySelectorAll('.ps-notas-av-map'))) {
      sel.addEventListener('change', (ev) => {
        const el = ev.target as HTMLSelectElement;
        const avId = el.dataset.avId ?? '';
        if (el.value) this.notasActivityMap[avId] = el.value;
        else delete this.notasActivityMap[avId];
        this.render();
      });
    }

    q<HTMLInputElement>('ps-notas-autosave')?.addEventListener('change', (ev) => {
      this.notasAutoSave = (ev.target as HTMLInputElement).checked;
      if (!this.notasAutoSave) this.notasRamPassword = '';
      q('ps-notas-pwd-wrap')?.classList.toggle('ps-hidden', !this.notasAutoSave);
    });

    q<HTMLInputElement>('ps-notas-pwd')?.addEventListener('input', (ev) => {
      this.notasRamPassword = (ev.target as HTMLInputElement).value;
    });

    q<HTMLButtonElement>('ps-notas-run')?.addEventListener('click', async () => {
      const preview = this.buildNotasPreview();
      if (!preview || (preview.readyCount === 0 && preview.notRealizedCount === 0)) return;

      const pwd = this.notasAutoSave ? this.notasRamPassword : null;
      if (this.notasAutoSave && !pwd) {
        showNotasErr('Informe sua senha no campo de auto-gravação ou desmarque a opção.');
        return;
      }

      this.notasAbort = new AbortController();
      const runBtn = q<HTMLButtonElement>('ps-notas-run');
      const cancelBtn = q<HTMLButtonElement>('ps-notas-cancel');
      const progWrap = q<HTMLDivElement>('ps-notas-prog-wrap');
      const progBar = q<HTMLDivElement>('ps-notas-prog-bar');
      const progText = q<HTMLDivElement>('ps-notas-prog-text');

      if (runBtn) runBtn.disabled = true;
      cancelBtn?.classList.remove('ps-hidden');
      progWrap?.classList.remove('ps-hidden');
      progText?.classList.remove('ps-hidden');

      const report = await executeGradeFill({
        doc: this.doc,
        preview,
        autoSavePassword: pwd,
        signal: this.notasAbort.signal,
        onProgress: (done, total, currentStudent) => {
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          if (progBar) progBar.style.width = `${pct}%`;
          if (progText) progText.textContent = `Preenchendo ${done}/${total}: ${currentStudent}`;
        },
      });

      // Zerar senha da RAM imediatamente após execução
      this.notasRamPassword = '';
      this.lastNotasReport = report;
      this.refreshContext();
      this.render();
    });

    q<HTMLButtonElement>('ps-notas-cancel')?.addEventListener('click', () => {
      this.notasAbort?.abort();
    });

    q<HTMLButtonElement>('ps-notas-dl-report')?.addEventListener('click', () => {
      if (!this.lastNotasReport) return;
      downloadBlob(
        new Blob([exportToJson(this.lastNotasReport)], { type: 'application/json;charset=utf-8' }),
        'relatorio_notas_sigeduc.json'
      );
    });

    q<HTMLButtonElement>('ps-nr-apply')?.addEventListener('click', () => {
      if (!this.notasSheet || this.scraped?.kind !== 'avaliacoes_nao_realizadas') return;
      const mappings: ColumnGradeMapping[] = Object.entries(this.notasActivityMap)
        .filter(([, col]) => Boolean(col))
        .map(([atividadeId, sheetColumn]) => ({ atividadeId, sheetColumn }));
      const items = extractNotRealizedFromSheet(
        this.notasSheet.rows,
        this.notasNameCol,
        this.notasMatCol || null,
        mappings,
        this.scraped
      );
      this.lastNrReport = executeNotRealizedFill(this.doc, items, null);
      this.refreshContext();
      this.render();
    });

    // --- FREQUÊNCIA EVENTS ---
    const freqErr = q<HTMLDivElement>('ps-freq-error');
    const showFreqErr = (msg: string) => {
      if (!freqErr) return;
      freqErr.textContent = msg;
      freqErr.classList.remove('ps-hidden');
    };

    q<HTMLInputElement>('ps-freq-file')?.addEventListener('change', async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        this.freqSheet = parseSpreadsheetBuffer(buf, file.name);
        this.freqNameCol = '';
        this.freqMatCol = '';
        this.freqObsCol = '';
        this.freqImportOpen = false;
        this.freqMappingOpen = true;
        this.freqSelectedDates.clear();
        this.lastFreqReport = null;
        this.autoMapFreqColumns();
        this.render();
      } catch (err) {
        showFreqErr((err as Error).message);
      }
    });

    q<HTMLButtonElement>('ps-freq-parse-paste')?.addEventListener('click', () => {
      const txt = q<HTMLTextAreaElement>('ps-freq-paste')?.value ?? '';
      try {
        this.freqSheet = parsePastedTable(txt);
        this.freqNameCol = '';
        this.freqMatCol = '';
        this.freqObsCol = '';
        this.freqImportOpen = false;
        this.freqMappingOpen = true;
        this.freqSelectedDates.clear();
        this.lastFreqReport = null;
        this.autoMapFreqColumns();
        this.render();
      } catch (err) {
        showFreqErr((err as Error).message);
      }
    });

    q<HTMLSelectElement>('ps-freq-name-col')?.addEventListener('change', (ev) => {
      this.freqNameCol = (ev.target as HTMLSelectElement).value;
      this.render();
    });

    q<HTMLSelectElement>('ps-freq-mat-col')?.addEventListener('change', (ev) => {
      this.freqMatCol = (ev.target as HTMLSelectElement).value;
      this.render();
    });

    q<HTMLSelectElement>('ps-freq-obs-col')?.addEventListener('change', (ev) => {
      this.freqObsCol = (ev.target as HTMLSelectElement).value;
      this.render();
    });

    q<HTMLInputElement>('ps-freq-empty-present')?.addEventListener('change', (ev) => {
      this.freqEmptyMeansPresent = (ev.target as HTMLInputElement).checked;
    });

    for (const cb of Array.from(this.shadow.querySelectorAll('.ps-freq-date-cb'))) {
      cb.addEventListener('change', (ev) => {
        const el = ev.target as HTMLInputElement;
        if (el.checked) this.freqSelectedDates.add(el.value);
        else this.freqSelectedDates.delete(el.value);
        const runBtn = q<HTMLButtonElement>('ps-freq-run');
        if (runBtn) {
          runBtn.disabled = this.freqSelectedDates.size === 0;
          runBtn.textContent = `Preencher Frequência (${this.freqSelectedDates.size} data(s))`;
        }
      });
    }

    q<HTMLInputElement>('ps-freq-autosave')?.addEventListener('change', (ev) => {
      this.freqAutoSave = (ev.target as HTMLInputElement).checked;
      if (!this.freqAutoSave) this.freqRamPassword = '';
      q('ps-freq-pwd-wrap')?.classList.toggle('ps-hidden', !this.freqAutoSave);
    });

    q<HTMLInputElement>('ps-freq-pwd')?.addEventListener('input', (ev) => {
      this.freqRamPassword = (ev.target as HTMLInputElement).value;
    });

    q<HTMLButtonElement>('ps-freq-next-step')?.addEventListener('click', () => {
      this.pendingNextDateResolver?.('continue');
      this.pendingNextDateResolver = null;
      q('ps-freq-step-box')?.classList.add('ps-hidden');
    });

    q<HTMLButtonElement>('ps-freq-cancel-step')?.addEventListener('click', () => {
      this.pendingNextDateResolver?.('cancel');
      this.pendingNextDateResolver = null;
      q('ps-freq-step-box')?.classList.add('ps-hidden');
    });

    q<HTMLButtonElement>('ps-freq-run')?.addEventListener('click', async () => {
      if (!this.freqSheet || this.freqSelectedDates.size === 0) return;
      const pwd = this.freqAutoSave ? this.freqRamPassword : null;
      if (this.freqAutoSave && !pwd) {
        showFreqErr('Informe sua senha no campo de auto-gravação ou desmarque a opção.');
        return;
      }

      this.freqAbort = new AbortController();
      const runBtn = q<HTMLButtonElement>('ps-freq-run');
      const cancelBtn = q<HTMLButtonElement>('ps-freq-cancel');
      const progWrap = q<HTMLDivElement>('ps-freq-prog-wrap');
      const progBar = q<HTMLDivElement>('ps-freq-prog-bar');
      const progText = q<HTMLDivElement>('ps-freq-prog-text');

      if (runBtn) runBtn.disabled = true;
      cancelBtn?.classList.remove('ps-hidden');
      progWrap?.classList.remove('ps-hidden');
      progText?.classList.remove('ps-hidden');

      const report = await executeMultiDateAttendance({
        doc: this.doc,
        sheetRows: this.freqSheet.rows,
        nameColumn: this.freqNameCol,
        matriculaColumn: this.freqMatCol || null,
        observationColumn: this.freqObsCol || null,
        dateColumns: Array.from(this.freqSelectedDates),
        emptyMeansPresent: this.freqEmptyMeansPresent,
        assistedStepByStep: !this.freqAutoSave,
        autoSavePassword: pwd,
        signal: this.freqAbort.signal,
        onProgress: (done, total, currentDate) => {
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          if (progBar) progBar.style.width = `${pct}%`;
          if (progText) progText.textContent = `Processado ${done}/${total}: ${currentDate}`;
        },
        waitForNextStep: async (completed, nextDateLabel) => {
          const stepBox = q('ps-freq-step-box');
          const stepMsg = q('ps-freq-step-msg');
          if (stepMsg) {
            stepMsg.innerHTML = `<strong>${escapeHtml(completed.dateDisplay)}</strong> preenchida (${completed.absentStudentsCount} faltas). Confira, digite sua senha no SIGEduc, clique em Gravar Frequências e depois clique em <strong>Próxima Data (${escapeHtml(nextDateLabel)})</strong>.`;
          }
          stepBox?.classList.remove('ps-hidden');
          return new Promise((resolve) => {
            this.pendingNextDateResolver = resolve;
          });
        },
      });

      this.freqRamPassword = '';
      this.lastFreqReport = report;
      this.refreshContext();
      this.render();
    });

    q<HTMLButtonElement>('ps-freq-cancel')?.addEventListener('click', () => {
      this.freqAbort?.abort();
      this.pendingNextDateResolver?.('cancel');
    });

    q<HTMLButtonElement>('ps-freq-dl-report')?.addEventListener('click', () => {
      if (!this.lastFreqReport) return;
      downloadBlob(
        new Blob([exportToJson(this.lastFreqReport)], { type: 'application/json;charset=utf-8' }),
        'relatorio_frequencia_sigeduc.json'
      );
    });

    // --- EXTRAIR (SCRAPING) EVENTS ---
    q<HTMLButtonElement>('ps-exp-xlsx')?.addEventListener('click', () => {
      if (!this.scraped) return;
      const bundle = buildExportBundle(this.scraped);
      const buf = exportToXlsxBuffer(bundle.sheets);
      downloadBlob(
        new Blob([buf.slice().buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${bundle.baseFileName}.xlsx`
      );
    });

    q<HTMLButtonElement>('ps-exp-csv')?.addEventListener('click', () => {
      if (!this.scraped) return;
      const bundle = buildExportBundle(this.scraped);
      const csv = exportToCsv(bundle.headers, bundle.rows);
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${bundle.baseFileName}.csv`);
    });

    q<HTMLButtonElement>('ps-exp-json')?.addEventListener('click', () => {
      if (!this.scraped) return;
      const bundle = buildExportBundle(this.scraped);
      downloadBlob(
        new Blob([exportToJson(this.scraped)], { type: 'application/json;charset=utf-8' }),
        `${bundle.baseFileName}.json`
      );
    });

    q<HTMLButtonElement>('ps-exp-refresh')?.addEventListener('click', () => {
      this.refreshContext();
      this.render();
    });
  }
}
