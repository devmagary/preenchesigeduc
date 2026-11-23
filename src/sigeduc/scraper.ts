import { cleanDisplayName } from '../core/normalize';
import type { ExportSheetSpec } from '../core/spreadsheet';

export interface ScrapedTurma {
  idTurmaComponente: string;
  turma: string;
  ano: string;
  escola: string;
  ofertaEnsino: string;
  serie: string;
  periodicidade: string;
  componente: string;
  qtdEstudantes: number;
}

export interface ScrapedAtividadeNota {
  idAvaliacao: string;
  nome: string;
  valorMax: number;
  disabled: boolean;
  colIndex: number;
}

export interface ScrapedAlunoNota {
  index: number;
  nome: string;
  notasAtividades: Record<string, string>; // idAvaliacao -> valor atual
  inputIds: Record<string, string>; // idAvaliacao -> DOM input id
  disabledMap: Record<string, boolean>;
  recUnidade: string;
  recInputId: string | null;
  recDisabled: boolean;
  notaUnidade: string;
}

export interface ScrapedNotasScreen {
  kind: 'lancar_notas';
  escola: string;
  turma: string;
  componente: string;
  totalAulas: string;
  unidadeAtiva: string;
  unidadesDisponiveis: string[];
  atividades: ScrapedAtividadeNota[];
  alunos: ScrapedAlunoNota[];
}

export interface ScrapedCalendarDate {
  linkId: string;
  day: number;
  monthZeroBased: number;
  year: number;
  diaSemana: number;
  display: string; // DD/MM/AAAA
  status: string;
}

export interface ScrapedAlunoFrequencia {
  index: number;
  matricula: string;
  nome: string;
  observacao: string;
  observacaoInputId: string | null;
  faltasPorHorario: boolean[];
  checkboxIds: string[];
}

export interface ScrapedFrequenciaScreen {
  kind: 'lancar_frequencia';
  escola: string;
  turma: string;
  componente: string;
  horarios: string;
  dataAberta: string | null;
  slotHeaders: string[];
  datasDisponiveis: ScrapedCalendarDate[];
  alunos: ScrapedAlunoFrequencia[];
}

export interface ScrapedAvaliacaoDetalhe {
  unidade: string;
  descricao: string;
  data: string;
  tipo: string;
  categoria: string;
  ordem: string;
  valor: string;
}

export interface ScrapedAvaliacoesScreen {
  kind: 'gerenciar_avaliacoes';
  tituloTurma: string;
  avaliacoes: ScrapedAvaliacaoDetalhe[];
}

export interface ScrapedPortalScreen {
  kind: 'portal_docente';
  docente: string;
  escola: string;
  turmas: ScrapedTurma[];
}

export interface ScrapedAlunoNaoRealizada {
  index: number;
  nome: string;
  checkboxIds: Record<string, string>; // idAvaliacao -> DOM checkbox id
  checkedMap: Record<string, boolean>;
}

export interface ScrapedNaoRealizadasScreen {
  kind: 'avaliacoes_nao_realizadas';
  escola: string;
  turma: string;
  componente: string;
  unidadeAtiva: string;
  unidadesDisponiveis: string[];
  atividades: ScrapedAtividadeNota[];
  alunos: ScrapedAlunoNaoRealizada[];
}

export type ScrapedScreenData =
  | ScrapedPortalScreen
  | ScrapedNotasScreen
  | ScrapedNaoRealizadasScreen
  | ScrapedFrequenciaScreen
  | ScrapedAvaliacoesScreen;

function textOf(el: Element | null | undefined): string {
  return cleanDisplayName(el?.textContent ?? '');
}

function parseTableKeyValues(table: Element | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!table) return map;
  for (const row of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('th, td'));
    if (cells.length >= 2) {
      const k = textOf(cells[0]).replace(/:$/, '').trim();
      const v = textOf(cells[1]).trim();
      if (k) map[k] = v;
    }
  }
  return map;
}

function findTableByCaption(doc: Document, captionSubstring: string): HTMLTableElement | null {
  for (const tbl of Array.from(doc.querySelectorAll('table'))) {
    const cap = tbl.querySelector('caption');
    if (cap && textOf(cap).toLowerCase().includes(captionSubstring.toLowerCase())) {
      return tbl as HTMLTableElement;
    }
  }
  return null;
}

export function scrapePortalDocente(doc: Document): ScrapedPortalScreen {
  const docenteEl = doc.querySelector('.info-docente, #perfil-docente p');
  const table = doc.querySelector('table[id$="turmasProfessorTable"]') ?? findTableByCaption(doc, 'Turmas Regulares');
  const turmas: ScrapedTurma[] = [];

  if (table) {
    const rows = Array.from(table.querySelectorAll('tbody tr.linhaPar, tbody tr.linhaImpar'));
    for (const row of rows) {
      const tds = Array.from(row.querySelectorAll('td'));
      if (tds.length < 8) continue;
      const link = row.querySelector('a[onclick*="idTurmaComponente"]');
      const onclick = link?.getAttribute('onclick') ?? '';
      const idMatch = onclick.match(/'idTurmaComponente':'(\d+)'/);
      turmas.push({
        idTurmaComponente: idMatch?.[1] ?? '',
        turma: textOf(tds[0]),
        ano: textOf(tds[1]),
        escola: textOf(tds[2]),
        ofertaEnsino: textOf(tds[3]),
        serie: textOf(tds[4]),
        periodicidade: textOf(tds[5]),
        componente: textOf(tds[6]),
        qtdEstudantes: Number.parseInt(textOf(tds[7]), 10) || 0,
      });
    }
  }

  return {
    kind: 'portal_docente',
    docente: cleanDisplayName(docenteEl?.textContent ?? '').replace(/^PROF\.\s*/i, ''),
    escola: turmas[0]?.escola ?? '',
    turmas,
  };
}

function getActiveTabPanel(doc: Document): { activeLabel: string; allLabels: string[]; panel: Element | null } {
  const navItems = Array.from(doc.querySelectorAll('#formulario\\:tabViewId .ui-tabs-nav li'));
  const allLabels = navItems.map((li) => textOf(li)).filter(Boolean);
  let activeLabel = allLabels[0] ?? '1ª Unidade';
  let activeHref = '';

  for (const li of navItems) {
    const cls = li.className || '';
    if (cls.includes('ui-tabs-selected') || cls.includes('ui-state-active')) {
      activeLabel = textOf(li);
      const a = li.querySelector('a');
      activeHref = a?.getAttribute('href') ?? '';
      break;
    }
  }

  const panels = Array.from(doc.querySelectorAll('#formulario\\:tabViewId .ui-tabs-panel'));
  let panel: Element | null = null;
  if (activeHref && activeHref.startsWith('#')) {
    const targetId = activeHref.slice(1);
    panel = panels.find((p) => p.id === targetId) ?? null;
  }
  if (!panel) {
    panel =
      panels.find((p) => {
        const cls = p.className || '';
        const style = (p as HTMLElement).style;
        return !cls.includes('ui-tabs-hide') && !cls.includes('ui-helper-hidden') && style?.display !== 'none';
      }) ?? panels[0] ?? null;
  }

  return { activeLabel, allLabels, panel };
}

function scrapeNotasPanel(
  panel: Element | null,
  unitLabel: string,
  allLabels: string[],
  meta: Record<string, string>
): ScrapedNotasScreen {
  const atividades: ScrapedAtividadeNota[] = [];
  const alunos: ScrapedAlunoNota[] = [];

  if (panel) {
    const table = panel.querySelector('table');
    if (table) {
      const headerCells = Array.from(table.querySelectorAll('thead th, thead tr:first-child th'));
      const dataRows = Array.from(table.querySelectorAll('tbody tr'));
      const firstRow = dataRows[0];

      if (firstRow) {
        const avInputs = Array.from(firstRow.querySelectorAll('input[id*=":av__"]')) as HTMLInputElement[];
        const ths = headerCells.length > 0 ? headerCells : Array.from(table.querySelectorAll('tr:first-child th'));
        const activityHeaders = ths.filter((th) => {
          const txt = textOf(th);
          return !/^Estudante$/i.test(txt) && !/Rec\.\s*da\s*Unidade/i.test(txt) && !/Nota\s*da\s*Unidade/i.test(txt);
        });

        avInputs.forEach((inp, idx) => {
          const idMatch = inp.id.match(/:av__(\d+)/);
          const idAvaliacao = idMatch?.[1] ?? `av_${idx}`;
          const thText = textOf(activityHeaders[idx]);
          const valMatch = thText.match(/Valor:\s*([0-9]+[.,]?[0-9]*)/i);
          const valorMax = valMatch ? Number(valMatch[1].replace(',', '.')) : 10;
          const nomeLimpo = thText
            .replace(/Valor:\s*[0-9]+[.,]?[0-9]*/i, '')
            .replace(/Lançamento de notas não permitido.*$/i, '')
            .trim();
          atividades.push({
            idAvaliacao,
            nome: nomeLimpo || `Atividade ${idx + 1}`,
            valorMax,
            disabled: inp.disabled,
            colIndex: idx,
          });
        });
      }

      dataRows.forEach((row, idx) => {
        const tds = Array.from(row.querySelectorAll('td'));
        if (tds.length === 0) return;
        const nome = textOf(tds[0]);
        if (!nome) return;

        const notasAtividades: Record<string, string> = {};
        const inputIds: Record<string, string> = {};
        const disabledMap: Record<string, boolean> = {};

        const avInputs = Array.from(row.querySelectorAll('input[id*=":av__"]')) as HTMLInputElement[];
        for (const inp of avInputs) {
          const idMatch = inp.id.match(/:av__(\d+)/);
          const idAv = idMatch?.[1];
          if (!idAv) continue;
          notasAtividades[idAv] = inp.value ?? '';
          inputIds[idAv] = inp.id;
          disabledMap[idAv] = inp.disabled;
        }

        const recInput = row.querySelector('input[id*=":nuREC__"]') as HTMLInputElement | null;
        const nuInput = row.querySelector('input[id*=":nu__"]') as HTMLInputElement | null;

        alunos.push({
          index: idx,
          nome,
          notasAtividades,
          inputIds,
          disabledMap,
          recUnidade: recInput?.value ?? '',
          recInputId: recInput?.id ?? null,
          recDisabled: recInput ? recInput.disabled : true,
          notaUnidade: nuInput?.value ?? '',
        });
      });
    }
  }

  return {
    kind: 'lancar_notas',
    escola: meta['Escola'] ?? '',
    turma: meta['Turma'] ?? '',
    componente: meta['Componente'] ?? '',
    totalAulas: meta['Total Aulas'] ?? '',
    unidadeAtiva: unitLabel,
    unidadesDisponiveis: allLabels,
    atividades,
    alunos,
  };
}

export function scrapeLancarNotas(doc: Document): ScrapedNotasScreen {
  const metaTable = findTableByCaption(doc, 'Lançar Notas');
  const meta = parseTableKeyValues(metaTable);
  const { activeLabel, allLabels, panel } = getActiveTabPanel(doc);
  return scrapeNotasPanel(panel, activeLabel, allLabels, meta);
}

export function scrapeLancarNotasAllUnits(doc: Document): ScrapedNotasScreen[] {
  const metaTable = findTableByCaption(doc, 'Lançar Notas');
  const meta = parseTableKeyValues(metaTable);
  const navItems = Array.from(doc.querySelectorAll('#formulario\\:tabViewId .ui-tabs-nav li'));
  const allLabels = navItems.map((li) => textOf(li)).filter(Boolean);
  const panels = Array.from(doc.querySelectorAll('#formulario\\:tabViewId .ui-tabs-panel'));

  const unitScreens: ScrapedNotasScreen[] = [];
  for (const li of navItems) {
    const label = textOf(li);
    if (!label || /res\.\s*final/i.test(label)) continue;
    const href = li.querySelector('a')?.getAttribute('href') ?? '';
    const targetId = href.startsWith('#') ? href.slice(1) : '';
    const panel = targetId ? panels.find((p) => p.id === targetId) ?? null : null;
    if (!panel) continue;
    unitScreens.push(scrapeNotasPanel(panel, label, allLabels, meta));
  }

  return unitScreens.length > 0 ? unitScreens : [scrapeLancarNotas(doc)];
}

export function pickUnitFromScrapedList(
  units: ScrapedNotasScreen[],
  preferred: 'active' | '1' | '2' | '3',
  activeLabel: string
): ScrapedNotasScreen | null {
  if (units.length === 0) return null;

  const activeUnit = units.find((u) => u.unidadeAtiva === activeLabel) ?? units[0];
  if (preferred === 'active') {
    if (activeUnit.atividades.length > 0) return activeUnit;
    const withActivities = units.filter((u) => u.atividades.length > 0);
    return withActivities.length > 0 ? withActivities[withActivities.length - 1] : activeUnit;
  }

  const byPrefix = units.find((u) => new RegExp(`^${preferred}[ªa]?\\b`, 'i').test(u.unidadeAtiva));
  if (byPrefix) return byPrefix;
  const idx = Number(preferred) - 1;
  if (idx >= 0 && idx < units.length) return units[idx];
  return activeUnit;
}

export function scrapeAvaliacoesNaoRealizadas(doc: Document): ScrapedNaoRealizadasScreen {
  const metaTable = findTableByCaption(doc, 'Verificar Avaliações não realizadas');
  const meta = parseTableKeyValues(metaTable);
  const { activeLabel, allLabels, panel } = getActiveTabPanel(doc);

  const atividades: ScrapedAtividadeNota[] = [];
  const alunos: ScrapedAlunoNaoRealizada[] = [];

  if (panel) {
    const table = panel.querySelector('table');
    if (table) {
      const ths = Array.from(table.querySelectorAll('thead th, thead tr:first-child th'));
      const activityHeaders = ths.filter((th) => !/^Estudante$/i.test(textOf(th)));

      // Descobrir os IDs únicos de avaliação presentes nas colunas de checkbox
      const dataRows = Array.from(table.querySelectorAll('tbody tr'));
      const colIds = new Map<number, string>();

      for (const row of dataRows) {
        const tds = Array.from(row.querySelectorAll('td'));
        tds.slice(1).forEach((td, idx) => {
          if (colIds.has(idx)) return;
          const cb = td.querySelector('input[type="checkbox"][id*=":av__"]') as HTMLInputElement | null;
          const m = cb?.id.match(/:av__(\d+)/);
          if (m?.[1]) colIds.set(idx, m[1]);
        });
      }

      activityHeaders.forEach((th, idx) => {
        const thText = textOf(th);
        if (/^Avalia[cç][oõ]es$/i.test(thText)) return;
        const valMatch = thText.match(/Valor:\s*([0-9]+[.,]?[0-9]*)/i);
        const valorMax = valMatch ? Number(valMatch[1].replace(',', '.')) : 10;
        const nomeEl = th.querySelector('.nome-avaliacao');
        const nomeLimpo = nomeEl
          ? textOf(nomeEl)
          : thText.replace(/Valor:\s*[0-9]+[.,]?[0-9]*/i, '').trim();
        atividades.push({
          idAvaliacao: colIds.get(idx) ?? `av_${idx}`,
          nome: nomeLimpo || `Atividade ${idx + 1}`,
          valorMax,
          disabled: false,
          colIndex: idx,
        });
      });

      dataRows.forEach((row, idx) => {
        const tds = Array.from(row.querySelectorAll('td'));
        if (tds.length === 0) return;
        const nome = textOf(tds[0]);
        if (!nome) return;

        const checkboxIds: Record<string, string> = {};
        const checkedMap: Record<string, boolean> = {};
        const cbs = Array.from(row.querySelectorAll('input[type="checkbox"][id*=":av__"]')) as HTMLInputElement[];
        for (const cb of cbs) {
          const m = cb.id.match(/:av__(\d+)/);
          if (!m?.[1]) continue;
          checkboxIds[m[1]] = cb.id;
          checkedMap[m[1]] = cb.checked;
        }

        alunos.push({
          index: idx,
          nome,
          checkboxIds,
          checkedMap,
        });
      });
    }
  }

  return {
    kind: 'avaliacoes_nao_realizadas',
    escola: meta['Escola'] ?? '',
    turma: meta['Turma'] ?? '',
    componente: meta['Componente'] ?? '',
    unidadeAtiva: activeLabel,
    unidadesDisponiveis: allLabels,
    atividades,
    alunos,
  };
}

export function scrapeLancarFrequencia(doc: Document): ScrapedFrequenciaScreen {
  const metaTable = findTableByCaption(doc, 'Dados da Turma');
  const meta = parseTableKeyValues(metaTable);

  const datasDisponiveis: ScrapedCalendarDate[] = [];
  const calForm = doc.querySelector('#formCalendarios');
  if (calForm) {
    const links = Array.from(calForm.querySelectorAll('a[onclick]'));
    for (const a of links) {
      const onclick = a.getAttribute('onclick') ?? '';
      const diaM = onclick.match(/'dia'\s*:\s*(\d+)/);
      const mesM = onclick.match(/'mes'\s*:\s*(\d+)/);
      const anoM = onclick.match(/'ano'\s*:\s*(\d+)/);
      const semM = onclick.match(/'diaSemana'\s*:\s*(\d+)/);
      if (diaM && mesM && anoM) {
        const day = Number(diaM[1]);
        const monthZeroBased = Number(mesM[1]);
        const year = Number(anoM[1]);
        const display = `${String(day).padStart(2, '0')}/${String(monthZeroBased + 1).padStart(2, '0')}/${year}`;
        const cls = (a.closest('td')?.className || a.className || '').trim();
        datasDisponiveis.push({
          linkId: a.id,
          day,
          monthZeroBased,
          year,
          diaSemana: semM ? Number(semM[1]) : 0,
          display,
          status: cls || 'letivo',
        });
      }
    }
  }

  const freqTable = findTableByCaption(doc, 'Lista de Frequência');
  let dataAberta: string | null = null;
  const slotHeaders: string[] = [];
  const alunos: ScrapedAlunoFrequencia[] = [];

  if (freqTable) {
    const capText = textOf(freqTable.querySelector('caption'));
    const dtMatch = capText.match(/(\d{2}\/\d{2}\/\d{4})/);
    dataAberta = dtMatch?.[1] ?? null;

    const ths = Array.from(freqTable.querySelectorAll('thead th'));
    for (const th of ths) {
      const txt = textOf(th);
      if (/hor[aá]rio/i.test(txt)) {
        slotHeaders.push(txt.replace(/Marcar significa.*$/i, '').trim());
      }
    }

    const rows = Array.from(freqTable.querySelectorAll('tbody tr'));
    rows.forEach((row, idx) => {
      const tds = Array.from(row.children).filter((el) => el.tagName === 'TD');
      if (tds.length < 5) return;
      const matricula = textOf(tds[1]);
      const nome = textOf(tds[2]);
      if (!nome) return;
      const textarea = tds[3].querySelector('textarea') as HTMLTextAreaElement | null;
      const checkboxes: HTMLInputElement[] = [];
      for (let c = 4; c < tds.length; c++) {
        const cb = tds[c].querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        if (cb) checkboxes.push(cb);
      }

      alunos.push({
        index: idx,
        matricula,
        nome,
        observacao: textarea?.value ?? '',
        observacaoInputId: textarea?.id ?? null,
        faltasPorHorario: checkboxes.map((cb) => cb.checked),
        checkboxIds: checkboxes.map((cb) => cb.id),
      });
    });
  }

  return {
    kind: 'lancar_frequencia',
    escola: meta['Escola'] ?? '',
    turma: meta['Turma'] ?? '',
    componente: meta['Componente'] ?? '',
    horarios: meta['Horário(s)'] ?? '',
    dataAberta,
    slotHeaders,
    datasDisponiveis,
    alunos,
  };
}

export function scrapeGerenciarAvaliacoes(doc: Document): ScrapedAvaliacoesScreen {
  const mainTable = findTableByCaption(doc, 'Lista de Unidades da Turma');
  const tituloTurma = mainTable ? textOf(mainTable.querySelector('caption')).replace(/^Lista de Unidades da Turma\s*/i, '') : '';
  const avaliacoes: ScrapedAvaliacaoDetalhe[] = [];

  if (mainTable) {
    const outerRows = Array.from(mainTable.querySelectorAll(':scope > tbody > tr'));
    let currentUnit = '';
    for (const tr of outerRows) {
      const subTable = tr.querySelector('table');
      if (!subTable) {
        const firstTd = tr.querySelector('td');
        const txt = textOf(firstTd);
        if (/Unidade/i.test(txt)) {
          currentUnit = txt;
        }
      } else {
        const subRows = Array.from(subTable.querySelectorAll('tr'));
        for (const sr of subRows) {
          const cells = Array.from(sr.querySelectorAll('td'));
          if (cells.length >= 6) {
            const desc = textOf(cells[0]);
            if (desc === 'Descrição') continue;
            avaliacoes.push({
              unidade: currentUnit,
              descricao: desc,
              data: textOf(cells[1]),
              tipo: textOf(cells[2]),
              categoria: textOf(cells[3]),
              ordem: textOf(cells[4]),
              valor: textOf(cells[5]),
            });
          }
        }
      }
    }
  }

  return {
    kind: 'gerenciar_avaliacoes',
    tituloTurma,
    avaliacoes,
  };
}

export function buildExportBundle(data: ScrapedScreenData): {
  baseFileName: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  sheets: ExportSheetSpec[];
} {
  if (data.kind === 'portal_docente') {
    const headers = [
      'idTurmaComponente',
      'Turma',
      'Ano',
      'Escola',
      'Oferta de Ensino',
      'Série/Módulo',
      'Periodicidade',
      'Componente',
      'Qtd. Estudantes',
    ];
    const rows = data.turmas.map((t) => [
      t.idTurmaComponente,
      t.turma,
      t.ano,
      t.escola,
      t.ofertaEnsino,
      t.serie,
      t.periodicidade,
      t.componente,
      t.qtdEstudantes,
    ]);
    return {
      baseFileName: 'sigeduc_turmas',
      headers,
      rows,
      sheets: [{ name: 'Turmas', headers, rows }],
    };
  }

  if (data.kind === 'lancar_notas') {
    const avHeaders = data.atividades.map((a) => `${a.nome} (Valor ${a.valorMax.toFixed(1)})`);
    const headers = ['Nome', ...avHeaders, 'Rec. da Unidade', 'Nota da Unidade'];
    const rows = data.alunos.map((st) => [
      st.nome,
      ...data.atividades.map((a) => st.notasAtividades[a.idAvaliacao] ?? ''),
      st.recUnidade,
      st.notaUnidade,
    ]);

    const modeloHeaders = ['Nome', ...data.atividades.map((a) => a.nome)];
    const modeloRows = data.alunos.map((st) => [
      st.nome,
      ...data.atividades.map((a) => st.notasAtividades[a.idAvaliacao] ?? ''),
    ]);

    return {
      baseFileName: `modelo_notas_${data.unidadeAtiva.replace(/\s+/g, '_')}`.toLowerCase(),
      headers,
      rows,
      sheets: [
        { name: 'Modelo Notas', headers: modeloHeaders, rows: modeloRows },
        {
          name: 'Atividades',
          headers: ['ID Avaliação', 'Nome', 'Valor Máximo', 'Status'],
          rows: data.atividades.map((a) => [
            a.idAvaliacao,
            a.nome,
            a.valorMax,
            a.disabled ? 'Bloqueada' : 'Aberta',
          ]),
        },
      ],
    };
  }

  if (data.kind === 'avaliacoes_nao_realizadas') {
    const headers = ['Nome', ...data.atividades.map((a) => a.nome)];
    const rows = data.alunos.map((st) => [
      st.nome,
      ...data.atividades.map((a) => {
        if (!st.checkboxIds[a.idAvaliacao]) return 'Com nota';
        return st.checkedMap[a.idAvaliacao] ? 'NF' : '';
      }),
    ]);
    return {
      baseFileName: `nao_realizadas_${data.unidadeAtiva.replace(/\s+/g, '_')}`.toLowerCase(),
      headers,
      rows,
      sheets: [{ name: 'Não Realizadas', headers, rows }],
    };
  }

  if (data.kind === 'lancar_frequencia') {
    const recentDates = data.datasDisponiveis.slice(-5).map((d) => d.display);
    const dateCols = recentDates.length > 0 ? recentDates : [data.dataAberta ?? 'DD/MM/AAAA'];
    const headers = ['Matrícula', 'Nome', ...dateCols, 'Observação'];
    const rows = data.alunos.map((st) => [
      st.matricula,
      st.nome,
      ...dateCols.map((dt) => {
        if (dt === data.dataAberta) {
          const faltas = st.faltasPorHorario.filter(Boolean).length;
          return faltas > 0 ? 'F' : 'P';
        }
        return 'P';
      }),
      st.observacao,
    ]);

    return {
      baseFileName: 'modelo_frequencia_sigeduc',
      headers,
      rows,
      sheets: [
        { name: 'Modelo Frequência', headers, rows },
        {
          name: 'Datas Letivas',
          headers: ['Data', 'Dia', 'Mês (0-idx)', 'Ano', 'Status'],
          rows: data.datasDisponiveis.map((d) => [d.display, d.day, d.monthZeroBased, d.year, d.status]),
        },
      ],
    };
  }

  // gerenciar_avaliacoes
  const headers = ['Unidade', 'Descrição', 'Data da Avaliação', 'Tipo', 'Categoria', 'Ordem', 'Valor'];
  const rows = data.avaliacoes.map((a) => [
    a.unidade,
    a.descricao,
    a.data,
    a.tipo,
    a.categoria,
    a.ordem,
    a.valor,
  ]);
  return {
    baseFileName: 'sigeduc_avaliacoes',
    headers,
    rows,
    sheets: [{ name: 'Avaliacoes', headers, rows }],
  };
}
