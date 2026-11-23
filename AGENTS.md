# AGENTS.md — Preenche SIGEduc

Instruções de arquitetura, invariantes e verificação para agentes trabalhando neste repositório.

## Visão Geral e Arquitetura

**Preenche SIGEduc** é uma extensão de navegador **Manifest V3** (compatível com Chrome/Chromium Desktop e navegadores Android com suporte a extensões como Mises, Lemur, Edge Canary e Firefox Android) para automação local de preenchimento de notas, frequências e extração de dados no portal **SIGEduc-BA** (`https://sigeduc.educacao.ba.gov.br/sigeduc/*`).

### Fluxo Técnico (SIGEduc JSF / RichFaces / PrimeFaces)
1. O SIGEduc não expõe API REST pública; utiliza páginas JSF stateful (`javax.faces.ViewState`, `DOUBLE_CHECK_TOKEN`, cookie `JSESSIONID`) e submissões parciais RichFaces 3.3.3 (`A4J.AJAX.Submit`).
2. **Menu Principal do Diário de Classe Digital (`JSCookMenu` / `ThemeOffice`):**
   - O cabeçalho de `docente.jsf` renderiza um `JSCookMenu` (`<form id="menu:...">` com `#jscook_action` no formato `A]#{mbean.metodo}`, `javax.faces.ViewState` e `DOUBLE_CHECK_TOKEN`) com **5 menus** e **17 submenus**:
     - **Ensino:** `Minhas Turmas` (`portalDocente.gerarRelatorioTurmaDocente`), `Meus Horários` (`relatorioGradeHorarioDocenteMBean.iniciarProf`), `Calendário Escolar` (`gerenciarCalendarioEscolarMBean.visualizarCalendarioPortal`), `Cronograma de Matrícula` (`gerenciarCalendarioMatriculaMBean.getViewPage`), `Atualizar Minhas Formações` (`servidor.iniciarEditarFicha`), `Acompanhamento de estágio de docência` (`buscaAcompanhamentoEstagioDocenciaMBean.entrarAcompanhamentoEstagioDocencia`).
     - **Frequência:** `Informar Frequência` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaInformarFrequencia`), `Visualizar Mapa de Frequência` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaExibirMapaFrequencia`).
     - **Diário:** `Informar Conteúdo Ministrado` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaConteudoMinistrado`), `Gerenciar Avaliações das Unidades` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaGerenciarAvaliacoesUnidade`), `Emitir Diário de Classe` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaEmitirDiario`), `Visualizar Plano de Curso do Componente Curricular/Disciplina` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaPlanoTrabalhoProfessor`), `Gerenciar Atividades Não Presenciais` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaRelatorioParcialDeAtividadesNaoPresenciaisProfessor`).
     - **Notas:** `Lançar Resultados` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaInformarNotasAvaliacoesUnidade`), `Verificar Avaliações não realizadas` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaInformarAvaliacoesNaoRealizadas`).
     - **Relatórios:** `Relatório de Estudantes por Turma com Assinatura` (`buscaTurmaComponenteMBean.iniciarBuscaTurmaRelatorioEstudantesAssinatura`), `Relatório de Turmas Consolidadas e Não Consolidadas por Professor` (`relatorioTurmaConsolidadaMBean.iniciar`), `Relatório de Turmas de RPP Híbrido` (`relatorioTurmasRppMBean.iniciarRelatorio`), `Minhas Turmas de RPP` (`relatorioDocenteTurmasRppMBean.iniciar`), `Estudante PCD -> Relatório de resultado final` (`buscaEstudanteNEEMBean.iniciarModuloPortalProfessor`).
3. **JSF Server-Side Forward e Roteador `buscaPadrao/busca.jsf`:**
   - Muitas telas no SIGEduc são servidas via *forward* JSF: `window.location.href` permanece na URL anterior (`docente.jsf` ou `/sigeduc/ensino/turma/buscaPadrao/busca.jsf`), enquanto `<form action="...">` e os headings/elementos DOM revelam a view real. Por isso, `src/sigeduc/detector.ts` **nunca deve depender apenas da URL**, priorizando `form[action*="..."]` e marcadores DOM.
   - As 9 operações de `buscaTurmaComponenteMBean.iniciarBuscaTurma*` abrem primeiro a tela compartilhada `Consulta de Turma` (`form#formAjustesTurma` em `busca.jsf`, botão `#formAjustesTurma:btConfirmarAjustes`), onde cada linha de `table.listagem` dispara `jsfcljs` com `idTurmaComponente` / `idTurmaComp` para a tela final ou para download direto de PDF (`Emitir Mapa de Frequência`, `Emitir Mapa de Frequência Sintético`, `Imprimir Diário`).
   - Relatórios HTML imprimíveis (`Minhas Turmas`, `Meus Horários`, `Relação de Estudantes na Turma com Assinatura`) usam `form#toPdfForm` (`action="/sigeduc/pdf_templates/export.jsf"`).
4. **Telas secundárias mapeadas (para futuras expansões):**
   - *Conteúdo Ministrado:* `form#formLista[action*="conteudo_ministrado/lista_topicos.jsf"]` (checkboxes `topSelecionada_1/2/3`, `#formLista:conteudo*`, `btnGravarr`, `btnReplicar`, `btnRelatorior`).
   - *Plano de Curso:* `form#form[action*="plano_trabalho_professor/form.jsf"]` (`table.visualizacao`, acordeões por unidade com 5 `<textarea>`: `competenciasHabilidades`, `conhecimentoConteudo`, `transversalidadeDialogos`, `formaeCriterio`, `resultadoObservado`, botões `Gravar` e `Gravar e Replicar`).
   - *Atividades Não Presenciais:* `form#form[action*="relatorio_parcial_professor/form.jsf"]` (`#form:dataInicio`, `#form:dataFim`, 5 `<textarea>`).
   - *Estudante PCD:* lista `relatorio_atendimento_cuidador/lista.jsf` -> formulário `plano_educacional_individualizado/relatorio.jsf` (subformulários semestrais com `<textarea>` de até 4000 caracteres).
   - *Calendário Escolar:* `form[action*="diario_classe/gerenciar/view.jsf"]` (somente leitura com prazos de unidades, frequência, conselho e RPP).
   - *Turmas Consolidadas:* `form#formulario[action*="buscaRelatorioTurmaConsolidada.jsf"]`.
5. `src/content.ts` injeta:
   - `src/page-bridge.ts` (no *main world* da página via `web_accessible_resources`) para interceptar eventos `XMLHttpRequest` (`preenche-sigeduc:xhr-start` / `preenche-sigeduc:xhr-end`) e gerenciar `window.confirm` apenas quando explicitamente armado em modo auto-gravação.
   - `src/ui/panel.ts` dentro de um **Shadow DOM** isolado (`#preenche-sigeduc-host`), com barreira de eventos (`stopPropagation` em `paste`, `copy`, `cut`, `keydown`, `keyup`, `keypress`) para permitir colagem `Ctrl+V` mesmo na tela de Frequência do SIGEduc (que bloqueia `paste` no `document`).

## Mapa de Diretórios

- `src/core/`: Lógica pura testável em Node/Vitest (sem acesso ao DOM):
  - `normalize.ts`: limpeza de caracteres PUA/PCD, normalização NFD e `matchStudentsExact`.
  - `spreadsheet.ts`: leitura multi-aba e multi-bloco de `.xlsx`/`.xls`/`.csv` (UTF-8 BOM, Windows-1252, separadores `;`, `,`, `\t`), colagem tabular consolidada, auto-seleção de aba/bloco por correspondência exata com a turma aberta e exportação `.xlsx`, `.csv` e `.json`.
  - `cetep.ts`: identificação de Curso/Modalidade/Turno e gerador OOXML `.xlsx` estilizado no Modelo Consolidado Padrão CETEP (Painel Consolidado, fórmulas reais em inglês com cache, formatação condicional e modo multi-aba ou aba única).
  - `grades.ts`: parse, validação contra nota máxima da atividade e formatação (`toFixed(1)`).
  - `attendance.ts`: parser de `P`/`F`/`1`/`0`/múltiplos horários, inversão booleana para o SIGEduc, parse de datas (`DD/MM/AAAA`, ISO, serial Excel -> mês `0-indexed`) e sanitização de observações (sem `\n`, máx. 500 chars).
- `src/sigeduc/`: Adaptadores DOM específicos das telas do SIGEduc-BA:
  - `detector.ts`: detecta `portal_docente`, `lancar_notas`, `avaliacoes_nao_realizadas`, `lancar_frequencia`, `gerenciar_avaliacoes`, `conteudo_ministrado` e sessão expirada (`login`).
  - `scraper.ts`: extração contextual das telas, leitura de todas as unidades em Notas e montagem de modelos exportáveis.
  - `batch-extract.ts`: máquina de estados persistida em `sessionStorage` (`preenche_sigeduc_batch_extract_v1`) para varredura sequencial JSF das turmas no Portal Docente (coleta de notas e matrícula opcional via Frequência).
  - `filler-notas.ts`: prévia, fila sequencial AJAX aguardando `xhr-start`/`xhr-end` por campo, persistência da fila de Não Realização em `sessionStorage` (`preenche_sigeduc_pending_nr`), observador automático do modal `#formulario:confirmationDialog` e marcação de checkboxes na tela `avaliacoes_nao_realizadas`.
  - `filler-frequencia.ts`: preenchimento de dia único ou lote de múltiplas datas clicando em `#formCalendarios` e aguardando atualização de `Lista de Frequência - DD/MM/AAAA`.
- `src/ui/`: `styles.ts` e `panel.ts` (Shadow DOM responsivo desktop `>640px` e mobile `<=640px`).
- `src/popup/`: popup minimalista da barra do navegador.
- `scripts/`: `generate-icons.mjs`, `build.mjs` (`dist/chrome/`, `dist/firefox/`, `trabalho/dist-e2e/`) e `package.mjs` (`.zip`).
- `tests/unit/`: suíte Vitest para `src/core/`.
- `tests/e2e/`: suíte Playwright contra servidor HTTP mock local (`trabalho/mock-server.mjs`).
- `trabalho/`: artefatos auxiliares excluídos de `dist/` (`fixtures/`, `mock-server.mjs`, `benchmark.mjs`, `harness.mjs`, `evidencias/`, relatórios).

## Invariantes Inegociáveis

1. **Correspondência estritamente exata:** Nunca introduzir fuzzy matching automático. Nomes são comparados apenas após `normalizeName()`. Homônimos na turma ou na planilha devem permanecer bloqueados (`duplicates`), salvo desambiguação explícita por matrícula única idêntica.
2. **Lógica invertida de frequência:** No SIGEduc, `<input type="checkbox">` **marcado (`true`) significa FALTA**, e desmarcado (`false`) significa PRESENTE.
3. **Fila sequencial AJAX em Notas:** Nunca disparar múltiplas submissões `A4J.AJAX.Submit` em paralelo nem deixar `input` focado causando `blur` duplicado. Aguardar `preenche-sigeduc:xhr-end` do XHR recém-aberto antes do próximo campo.
4. **Privacidade absoluta de senha e dados:** Se o modo opcional de auto-gravação for usado, a senha deve permanecer **exclusivamente em memória RAM** da instância do painel e ser zerada ao terminar ou fechar. Proibido persistir senha em `chrome.storage`, `localStorage`, `sessionStorage`, cookies ou logs. Zero telemetria ou chamadas externas.
5. **Segurança do ambiente real:** Nunca executar testes automatizados de escrita contra `https://sigeduc.educacao.ba.gov.br`. Todo teste E2E deve rodar contra `trabalho/mock-server.mjs` carregando `trabalho/dist-e2e/` (no Chrome M137+, usar `--enable-unsafe-extension-debugging` + CDP `Extensions.loadUnpacked`).
6. **Empacotamento limpo:** Nunca incluir `trabalho/`, fixtures ou `http://127.0.0.1/*` nos builds de produção `dist/chrome/` e `dist/firefox/`. Manter tamanho descompactado `< 1.5 MB` (`1536 KB`).
7. **Versionamento contínuo (Git):** Toda alteração e implementação concluída e verificada deve ser registrada com `git commit` (mensagem clara, descritiva e **em português PT-BR**) e enviada (`git push`) para o repositório remoto `https://github.com/devmagary/preenchesigeduc.git`.

## Verificação Obrigatória

Antes de concluir qualquer alteração neste projeto, execute:

```bash
npm run harness
```

O harness executa `tsc --noEmit`, `build`, `package`, `test:unit`, `benchmark`, `test:e2e`, valida os SLAs e gera o manifesto em `trabalho/evidencias/manifest.json` para inspeção pelo Crítico Independente.
