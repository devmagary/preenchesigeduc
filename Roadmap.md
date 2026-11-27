# Roadmap — Preenche SIGEduc

Documento vivo de planejamento e evolução técnica do projeto **Preenche SIGEduc**.
As sugestões são organizadas sob a ótica de engenharia sênior, equilibrando **impacto para o usuário/operação**, **risco técnico** (considerando as invariantes do `AGENTS.md` e os requisitos do `SPEC.md`) e **dificuldade de implementação**. Toda feature implementada a partir deste roadmap deve manter o `SPEC.md` sincronizado.

## Critérios de Classificação

### Prioridade
- **P0 — Crítico:** Correções de bugs severos, segurança, privacidade ou quebra de fluxo principal no SIGEduc.
- **P1 — Alta:** Melhorias de alto impacto direto na produtividade do docente ou robustez da extensão.
- **P2 — Média:** Melhorias de experiência de uso (UX), automações secundárias e qualidade de vida.
- **P3 — Baixa / Futuro:** Ideias exploratórias, refinamentos visuais ou recursos de nicho.

### Dificuldade de Implementação
- **Baixa:** Alteração localizada (UI pontual, ajuste de parser, regra simples), baixo risco de regressão.
- **Média:** Envolve múltiplos módulos (`src/core/` + `src/sigeduc/` + `src/ui/`), novos testes unitários/E2E ou cuidados com estado JSF/AJAX.
- **Alta:** Mudança arquitetural, manipulação complexa de ciclo de vida RichFaces/JSF, compatibilidade cross-browser ou alto risco de regressão.

---

## P0 — Crítico

### 1. Respeitar Seletor de Unidade ao Puxar Matrículas — `[Concluído]`
- **Prioridade:** P0 — Crítico
- **Dificuldade:** Média
- **Status:** Concluído (`pickUnitFromScrapedList` em `src/sigeduc/scraper.ts` atualizado para que o modo `"Ativa / mais recente"` priorize a última unidade com atividades abertas — ou, se todas fechadas, a última com atividades/notas — sem travar na `1ª Unidade` selecionada por padrão no HTML inicial do SIGEduc, mantendo coleta de matrículas via Frequência e leitura atualizada da aba ativa no download individual; validado em testes unitários e E2E).
- **Contexto:** Ao marcar a opção para puxar matrículas, o sistema está coletando apenas os dados da 1ª unidade, ignorando o seletor de unidade escolhido pelo usuário.
- **Comportamento esperado:** Garantir que a extração/coleta de matrículas e notas obedeça exatamente a unidade selecionada no seletor da UI (ex.: 1ª, 2ª ou 3ª unidade) antes de ler a tabela.
- **Impacto técnico / Riscos:** Ajuste na máquina de estados/coleta em `src/sigeduc/batch-extract.ts` e `src/sigeduc/scraper.ts`, com cobertura de teste E2E.

### 2. Extração de Notas na Aba "Resultado Final" (`Res. Final`) — `[Concluído]`
- **Prioridade:** P0 — Crítico
- **Dificuldade:** Média
- **Status:** Concluído (`scrapeResultadoFinalPanel` e `scrapeLancarNotasAllUnits` em `src/sigeduc/scraper.ts` extraem as unidades regulares (`1ª Un.`, `2ª Un.`, `3ª Un.`) junto às colunas reais de `#formulario:resultadoFinal` (`Média Anual`, `Rec. Final`, `Média Final`, `Total de Faltas`, `%Frequência Componente`, `Res. Parcial Componente`), lendo tanto `<input>` quanto `<span>`/`<td>`; `src/core/cetep.ts` gera abas com sufixo `RF`, cabeçalhos limpos e fórmula `Nota Geral` baseada em `Média Final` com fallback para `Média Anual`; `src/sigeduc/batch-extract.ts` e `src/ui/panel.ts` adicionam a opção `Res. Final` mantendo `'active'` restrita às unidades regulares; validado em testes unitários e E2E).
- **Contexto:** Ao exportar ou coletar em lote a aba/unidade **Resultado Final** (`Res. Final`), a planilha sai apenas com `Avaliação 1 (10.0)` vazia (`Sem Nota`), sem capturar as notas reais da tela do SIGEduc.
- **Comportamento esperado:**
  - Extrair todas as colunas visíveis na aba **Resultado Final** do SIGEduc (ex.: 1ª/2ª/3ª Unidade, Média, Recuperação Final e Resultado Final), tanto na exportação individual quanto na extração em lote.
  - Garantir leitura correta seja em `<input>` editável ou em células de texto (`<td>`/`<span>`) da tabela JSF.
- **Impacto técnico / Riscos:** Ajuste em `src/sigeduc/scraper.ts`, `src/sigeduc/batch-extract.ts` e `src/core/cetep.ts`, além de cobertura no `mock-server.mjs` + testes E2E.

## P1 — Alta Prioridade

### 1. Registro de "Não Realização" de Atividades após Lançamento de Notas — `[Concluído]`
- **Prioridade:** P1 — Alta
- **Dificuldade:** Média
- **Status:** Concluído (parser `0`/`0,0` vs vazio/`NF`/`Não Fez`/`FV`/`NR`/`N/R`, fila em `sessionStorage`, auto-aceite em `#formulario:confirmationDialog` nos modos Assistido e Auto-gravação, detecção/scraping/marcação automática em `form_estudantes_realizacoes_avaliacoes_unidade.jsf`).
- **Contexto:** Ao salvar notas com campos vazios, o SIGEduc exibe o modal *"Verificar e registrar atividades não realizadas após o lançamento de notas"* (`Não` / `Sim`). Ao confirmar, abre uma matriz Estudante × Avaliação com checkboxes de não realização.
- **Comportamento esperado:**
  - Diferenciar explicitamente na planilha/parser (`src/core/grades.ts`):
    - `0` / `0,0` → Nota zero real (lança `0.0` no input de nota).
    - `Não Fez`, `NF`, `FV` ou célula em branco → Não realização (deixa nota vazia e marca o checkbox na etapa seguinte).
  - Detectar o modal pós-lançamento, acionar `Sim` automaticamente (ou sob confirmação do usuário) quando houver pendências de não realização, e marcar os checkboxes correspondentes na tabela do SIGEduc.
- **Impacto técnico / Riscos:** Requer extensão do parser de notas, novo fluxo no `filler-notas.ts` (aguardando DOM/AJAX do modal e da tabela de checkboxes) e cobertura no `mock-server.mjs` + testes E2E.

### 2. Manter Aba de Mapeamento de Colunas Aberta Durante Seleção/Inserção em Notas — `[Concluído]`
- **Prioridade:** P1 — Alta
- **Dificuldade:** Baixa
- **Status:** Concluído (estado persistente em memória para `<details>` de importação e mapeamento durante re-renderizações em Notas e Frequência).
- **Contexto:** Após importar a planilha e identificar as colunas, ao selecionar outra coluna e clicar para inserir/aplicar no preenchimento de notas, a aba/seção de mapeamento se recolhe sozinha, obrigando o usuário a reabri-la repetidamente.
- **Comportamento esperado:** Preservar o estado aberto da seção de mapeamento durante re-renderizações ou trocas de coluna, recolhendo apenas por ação explícita do usuário.
- **Impacto técnico / Riscos:** Ajuste localizado no controle de estado da UI em `src/ui/panel.ts`. Baixo risco de regressão.

### 3. Seleção de Aba e Suporte a Planilhas Consolidadas (Múltiplas Turmas) — `[Concluído]`
- **Prioridade:** P1 — Alta
- **Dificuldade:** Média
- **Status:** Concluído (parser multi-aba e multi-bloco em `src/core/spreadsheet.ts` ignorando resumos no topo e detectando cabeçalhos internos, seleção automática por maior número de alunos exatos casados com a turma aberta, opção `"Todos os blocos combinados"` e seletores de Aba/Bloco no topo de `2. Mapeamento` em Notas, Não Realizadas e Frequência).
- **Contexto:** Planilhas escolares reais frequentemente trazem múltiplas abas (uma por turma) em um único `.xlsx`/`.xls`, ou trazem um painel resumo no topo seguido de vários blocos de turmas na mesma aba. Atualmente o parser lê apenas a primeira aba e assume cabeçalho único no topo.
- **Comportamento esperado:**
  - Quando o arquivo possuir mais de uma aba (`workbook.SheetNames.length > 1`), exibir seletor de aba na UI para o docente escolher qual aba carregar.
  - Aprimorar a detecção de cabeçalho em `src/core/spreadsheet.ts` para pular linhas de resumo/título no topo e identificar corretamente a tabela de alunos (e, se houver múltiplos blocos `Nº / Nome do Aluno` na mesma aba, permitir selecionar o bloco/turma).
- **Impacto técnico / Riscos:** Alterações em `src/core/spreadsheet.ts`, `src/ui/panel.ts` e novos testes unitários em `tests/unit/spreadsheet.test.ts`.

### 4. Corrigir Quebra/Estouro de Texto nos Cards de Turma — `[Concluído]`
- **Prioridade:** P1 — Alta
- **Dificuldade:** Baixa
- **Status:** Concluído (`src/ui/styles.ts` e `src/ui/panel.ts` atualizados com `.ps-check-row` / `.ps-turma-card` com `flex-shrink: 0` e `height: auto`, `.ps-turma-list` com `max-height: 280px` rolável, `.ps-turma-head` com `flex-wrap: wrap` e `.ps-turma-meta` com `overflow-wrap: anywhere`; validado em E2E com 8 turmas de nomes longos sem sobreposição ou vazamento).
- **Contexto:** Na lista de turmas do painel, os nomes longos (ex.: curso, disciplina e quantidade de alunos) estão vazando para fora da borda inferior do card e sobrepondo o item seguinte.
- **Comportamento esperado:** Os cards devem se ajustar dinamicamente ao conteúdo (`height: auto`, espaçamento/padding adequado e quebra de linha limpa), sem cortar ou sobrepor textos.
- **Impacto técnico / Riscos:** Ajuste localizado de CSS em `src/ui/styles.ts`. Baixo risco de regressão.

### 4. Preenchimento em Lote de Conteúdo Ministrado (`Diário -> Informar Conteúdo Ministrado`)
- **Prioridade:** P1 — Alta
- **Dificuldade:** Média
- **Contexto:** A tela `/sigeduc/diario_classe/conteudo_ministrado/lista_topicos.jsf` (`form#formLista`) exibe checkboxes por unidade (`topSelecionada_1`, `topSelecionada_2`, `topSelecionada_3`) e `<textarea id="formLista:conteudo*">` por aula/data (com `disabled` nas unidades fechadas), além dos botões `Gravar` (`#formLista:btnGravarr`), `Gravar e Replicar` (`#formLista:btnReplicar`) e `Gerar Relatório` (`#formLista:btnRelatorior`).
- **Comportamento esperado:**
  - Importar planilha/CSV ou colagem `(Data, Conteúdo)` no painel, casar por data da aula dentro da unidade aberta (ignorando linhas `disabled`), marcar os checkboxes correspondentes e preencher os `<textarea>` em prévia antes de o professor gravar/replicar.
- **Impacto técnico / Riscos:** Requer extensão do detector (`form#formLista[action*="lista_topicos.jsf"]`), novo adaptador `src/sigeduc/filler-conteudo.ts` e fixture sanitizada para E2E.

### 5. Adaptação Mobile da Landing Page (`360×800` e `375×667`) — `[Concluído]`
- **Prioridade:** P1 — Alta
- **Dificuldade:** Baixa
- **Status:** Concluído (revisão CSS responsiva em `docs/index.html` com `@media (max-width: 720px)`, `@media (max-width: 640px)` e `@media (max-width: 420px)`: remoção do atraso de transição de fundo no tema escuro com alto contraste em `.pill-btn.ghost`, navbar fixa com gradiente superior sem fresta ou overflow, `h1` e CTAs ajustados para caber acima da dobra em `375×667`, alvos táteis `>= 44×44 px`, cabeçalho empilhável no painel demo com `Letra 112%/125%` e faixa `.mobile-scroll-hint` nas tabelas; validado por `trabalho/audit-landing.mjs` e aprovado em Modo Cego pelo Crítico Independente `0f44d827` com `0` grave e `0` médio).
- **Contexto:** Em telas de celular mais estreitas ou baixas (`360×800` e `375×667`), o espaçamento, a altura do hero/navbar, o simulador ao vivo (`#demo`), a prévia da planilha (`#planilha`) e os cards de download/guias ficam apertados.
- **Comportamento esperado:**
  - Revisão geral de CSS responsivo em `docs/index.html` para `@media (max-width: 420px)` (compactar paddings, ajustar tipografia do `h1`, garantir que a navbar, simulador, abas e botões caibam confortavelmente sem aperto ou scroll horizontal).
  - Validar visualmente no Playwright nas resoluções `360×800` e `375×667`.
- **Impacto técnico / Riscos:** Alteração isolada em `docs/index.html`, sem impacto nos pacotes `dist/` da extensão.

### 6. Automação de Publicação na Chrome Web Store e Firefox Add-ons (AMO)
- **Prioridade:** P1 — Alta
- **Dificuldade:** Média
- **Contexto:** A extensão foi aprovada na Chrome Web Store e está em análise no Firefox Add-ons (AMO). Automatizar o envio de atualizações para ambas as lojas a cada nova release.
- **Comportamento esperado:**
  - **Chrome Web Store:** Validar e ativar o fluxo existente (`scripts/cws-publish.mjs` + `.github/workflows/release.yml`) com os secrets `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` e `CWS_EXTENSION_ID`, atualizar o status público na landing page (`docs/index.html`) removendo o aviso de "em revisão" e adicionar botão direto para a loja oficial (`https://chromewebstore.google.com/detail/preenche-sigeduc/fafdmobaohddjlphkfkhfhahlpeffeji?hl=pt-br`).
  - **Firefox Add-ons (AMO):** Criar script de publicação automática (ex.: `scripts/amo-publish.mjs` via API AMO / `web-ext sign` com `AMO_JWT_ISSUER` e `AMO_JWT_SECRET`) e integrá-lo ao `.github/workflows/release.yml` para envio automático em novas tags `v*`.
- **Impacto técnico / Riscos:** Requer configuração de secrets no GitHub Actions, tratamento de erros/rate-limit das APIs das lojas e testes unitários de fluxo sem expor credenciais.

## P2 — Média Prioridade

### 1. Opção de Aumento do Tamanho do Texto (Acessibilidade) — `[Concluído]`
- **Prioridade:** P2 — Média
- **Dificuldade:** Baixa
- **Status:** Concluído (botão de ciclo `100%` / `112%` / `125%` no cabeçalho do painel usando `--ps-scale` no Shadow DOM, persistido em `localStorage`).
- **Contexto:** Docentes utilizando telas pequenas, mobile (`<=640px`) ou com necessidade de maior legibilidade se beneficiam de controle de escala tipográfica no painel.
- **Comportamento esperado:** Controle no painel (ex.: `A-` / `A+` ou seletor Normal / Grande / Extra Grande) aplicando escala via variáveis CSS dentro do Shadow DOM (`src/ui/styles.ts` e `src/ui/panel.ts`), com preferência salva localmente.
- **Impacto técnico / Riscos:** Isolado no Shadow DOM; atenção apenas para não quebrar layout responsivo em `<=640px`.

### 2. Visual Noturno (Dark Mode) — `[Concluído]`
- **Prioridade:** P2 — Média
- **Dificuldade:** Baixa
- **Status:** Concluído (botão de alternância Claro/Escuro no cabeçalho do painel com variáveis CSS no Shadow DOM, contraste WCAG AA e persistência em `localStorage` com fallback `prefers-color-scheme`).
- **Contexto:** Uso prolongado do painel à noite gera fadiga visual com tema claro.
- **Comportamento esperado:** Alternância entre tema claro e escuro via tokens CSS no Shadow DOM (`src/ui/styles.ts`), respeitando `prefers-color-scheme` como padrão opcional e salvando a escolha do usuário localmente.
- **Impacto técnico / Riscos:** Isolado no Shadow DOM (`#preenche-sigeduc-host`), sem interferir no CSS da página do SIGEduc.

### 3. Modelo de Planilha Consolidada (Padrão CETEP) na Exportação — `[Concluído]`
- **Prioridade:** P2 — Média
- **Dificuldade:** Média
- **Status:** Concluído (`src/core/cetep.ts`: parser de identidade Curso/Modalidade/Série/Turno, writer OOXML `.xlsx` nativo estilizado com bordas, zebra, células mescladas, formatação condicional e fórmulas reais do Excel `SUM`/`AVERAGE`/`IF`/`COUNTIF` com valores em cache, Painel Consolidado com colunas `Modalidade` e `Unidade` + subtotais por modalidade + `TOTAL GERAL` + abas com sufixo de unidade `1U`/`2U`/`3U` ou aba única consolidada e nota mínima configurável padrão `5.0`).
- **Contexto:** Padronizar os modelos de planilha exportados pela extensão com base no painel consolidado de notas (resumo geral por turma + blocos detalhados por aluno).
- **Comportamento esperado:**
  - Gerar `.xlsx` único com **Painel Consolidado no topo** (Turma, Total de Alunos, Média Geral, Aprovados `>= 5,0`, Recuperação `< 5,0`, Sem Nota, `% Aprovação`, `TOTAL GERAL`) + **uma aba por turma** (com opção de aba única consolidada).
  - Colunas por turma: `Nº`, `Nome do Aluno`, `Matrícula`, colunas das avaliações, `Nota Geral` (soma), `Situação` (`Aprovado` / `Recuperação` / `Sem Nota`), `Observações`, além da linha `MÉDIA DA TURMA`.
  - Critério/média mínima configurável (padrão `5,0`) e formatação condicional/visual quando suportada.
- **Impacto técnico / Riscos:** Evolução de `src/core/spreadsheet.ts`; atenção ao limite de tamanho do pacote (`< 1.5 MB`) caso seja usada biblioteca `.xlsx` com suporte a estilos.

### 4. Extração em Lote de Todas as Turmas (Portal do Docente) — `[Concluído]`
- **Prioridade:** P2 — Média
- **Dificuldade:** Alta
- **Status:** Concluído (`src/sigeduc/batch-extract.ts` e `src/ui/panel.ts`: máquina de estados em `sessionStorage`, seletores separados de unidade para Ensino Médio vs Técnico + sobrescrita individual por turma, checklist de turmas com Curso/Modalidade/Turno, opção de coleta real de Matrícula via Frequência, tratamento de sessão expirada e exportação automática agrupada no Modelo Padrão CETEP).
- **Contexto:** No `portal_docente`, permitir extrair automaticamente todas as turmas listadas sem precisar abrir manualmente uma por uma.
- **Comportamento esperado:**
  - Botão para iniciar varredura turma por turma: entrar na turma → acessar *Lançar Notas* → coletar `Nome`, `Matrícula` e notas/avaliações → retornar ao portal e avançar para a próxima turma.
  - Identificar e nomear cada turma com **Curso**, **Modalidade** (Ensino Médio ou Técnico) e **Turno**.
  - Consolidar tudo automaticamente no modelo de planilha `.xlsx` descrito no item 4.
- **Impacto técnico / Riscos:** Navegação JSF multi-página com `javax.faces.ViewState` exige máquina de estados persistida em `sessionStorage` para sobreviver aos recarregamentos de página, além de tratamento robusto de sessão expirada e fila sequencial.

### 5. Links Rápidos de Download e Empacotamento `.crx` para Edge Mobile — `[Concluído]`
- **Prioridade:** P2 — Média
- **Dificuldade:** Média
- **Status:** Concluído (`scripts/crx3.mjs` + `scripts/package.mjs` gerando `dist/preenche-sigeduc-edge-mobile.crx` assinado em CRX3 com chave `.keys/preenche-sigeduc.pem` ignorada pelo Git ou via `CRX_PRIVATE_KEY_PEM`; `.github/workflows/release.yml` publicando os 3 artefatos fixos em `/releases/latest/download/`; página estática `docs/index.html` e guia + URLs fixas documentadas em `README.md`, validados por testes unitários e pelo harness).
- **Contexto:** Facilitar o download das versões Chrome, Firefox e Edge Mobile (Edge Canary Android) com URLs curtas e memorizáveis apontadas via domínio próprio ou encurtador externo.
- **Comportamento esperado:**
  - Publicar artefatos com nomes fixos no **GitHub Releases** (`/releases/latest/download/preenche-sigeduc-chrome.zip`, `preenche-sigeduc-firefox.zip`, `preenche-sigeduc-edge-mobile.crx`) para que o domínio próprio / encurtador nunca precise ser atualizado a cada versão.
  - Estender `scripts/package.mjs` para gerar também o pacote `.crx` assinado localmente para Edge Mobile ao final das builds (mantendo a chave `.pem` fora do repositório, já coberta pelo `.gitignore`).
- **Impacto técnico / Riscos:** Ajuste em `scripts/package.mjs` (assinatura `.crx` MV3) e documentação das URLs fixas no `README.md`.

### 6. Hiperlinks de Navegação no Painel Consolidado CETEP — `[Concluído]`
- **Prioridade:** P2 — Média
- **Dificuldade:** Baixa
- **Status:** Concluído (`src/core/cetep.ts`: suporte nativo OOXML `<hyperlinks>` e estilos de link `#1D4ED8`/`#E0F2FE` em `SheetBuilder`; coluna `A` de `Painel Consolidado` aponta para `'Aba'!A1` no modo Multi-aba ou para `'Consolidado CETEP'!A<linha>` no modo Aba Única; retorno via `← Voltar ao Painel` na linha `A3` congelada [Multi-aba] e `↑ Voltar ao Painel` no banner de cada bloco [Aba Única], validado por testes unitários, E2E e Rodada 13 do Crítico Independente).
- **Contexto:** Na planilha consolidada gerada pela coleta em lote (`src/core/cetep.ts`), facilitar a navegação entre o Painel Consolidado e as abas/blocos individuais de cada turma.
- **Comportamento esperado:**
  - Cada linha de turma no **Painel Consolidado** deve ser um hiperlink interno clicável levando diretamente à aba correspondente (ex.: `#'Nome da Aba'!A1`, ou à célula inicial do bloco no modo aba única).
  - No topo de cada aba de turma, incluir um link **"← Voltar ao Painel"** apontando para o Painel Consolidado.
- **Impacto técnico / Riscos:** Ajuste localizado no gerador OOXML em `src/core/cetep.ts`, com atenção ao escape de nomes de abas e cobertura em testes unitários.

### 5. Scraping e Exportação de Grade de Horários e Calendário Escolar (`Ensino`)
- **Prioridade:** P2 — Média
- **Dificuldade:** Baixa
- **Contexto:** Os submenus `Ensino -> Meus Horários` (`table#horario`, `table#matriculas`) e `Ensino -> Calendário Escolar` (`/sigeduc/diario_classe/gerenciar/view.jsf`, `table.subFormulario` com prazos de Unidades, Semestres, RPP, Conselho e Diário) contêm dados estruturados úteis para o planejamento do professor.
- **Comportamento esperado:**
  - Detectar ambas as telas no `detector.ts` e permitir exportar a grade semanal (`Meus Horários`) e a tabela de prazos/unidades (`Calendário Escolar`) em `.xlsx`, `.csv` e `.json` na aba `Extrair`, além de usar os horários da grade para pré-configurar quantidades de horários por dia na Frequência.
- **Impacto técnico / Riscos:** Baixo risco (apenas leitura/scraping de DOM e exportação).

### 6. Scraping de Lista de Estudantes com Assinatura e Disciplinas Ministradas (`Relatórios` / `Ensino`)
- **Prioridade:** P2 — Média
- **Dificuldade:** Baixa
- **Contexto:** `Relatórios -> Relatório de Estudantes por Turma com Assinatura` (`table.tabelaRelatorio` com `N° | Matrícula | Nome | Situação | Assinatura`) e `Ensino -> Minhas Turmas` (`Listagem de Disciplinas Ministradas` com `Escola | Componente | Etapa | Ano/Série/Outros | Turma`) hoje só oferecem impressão/PDF via `form#toPdfForm` (`/sigeduc/pdf_templates/export.jsf`).
- **Comportamento esperado:**
  - Extrair essas tabelas diretamente para `.xlsx` / `.csv` / `.json`, preservando situação de matrícula (Ativo/Transferido/etc.) para conferência rápida e criação de listas de chamada personalizadas.
- **Impacto técnico / Riscos:** Baixo risco (somente leitura/scraping).

### 7. Assistente de Plano de Curso e Relatório de Atividades Não Presenciais (`Diário`)
- **Prioridade:** P2 — Média
- **Dificuldade:** Média
- **Contexto:** `Diário -> Visualizar Plano de Curso` (`/sigeduc/ensino/plano_trabalho/plano_trabalho_professor/form.jsf`) possui acordeões por unidade com 5 `<textarea>` (`competenciasHabilidades`, `conhecimentoConteudo`, `transversalidadeDialogos`, `formaeCriterio`, `resultadoObservado`) e botão `Gravar e Replicar`. `Diário -> Gerenciar Atividades Não Presenciais` (`/sigeduc/ensino/plano_trabalho/relatorio_parcial_professor/form.jsf`) possui `#form:dataInicio`, `#form:dataFim` e 5 `<textarea>` (`objetosDeConhecimento`, `atividadesDesenvolvidas`, `estrategiasInteracaoNaoPresencial`, `sugestoesPossibilidadesMelhorias`, `compatibilizacaoCH`).
- **Comportamento esperado:**
  - Permitir importar/colar um plano estruturado (planilha/JSON/texto delimitado) e preencher os 5 campos da unidade selecionada ou do relatório parcial com prévia antes do envio.
- **Impacto técnico / Riscos:** Atenção aos acordeões por unidade no `plano_trabalho_professor/form.jsf` e preservação de `ViewState`.

### 8. Seção "Sobre / Aviso Legal e Privacidade" na Interface da Extensão — `[Concluído]`
- **Prioridade:** P2 — Média
- **Dificuldade:** Baixa
- **Status:** Concluído (`src/core/about.ts` centraliza os 3 blocos de aviso, links e leitura dinâmica da versão via `runtime.getManifest()`; `src/ui/panel.ts` e `src/ui/styles.ts` adicionam botão `i` `#ps-about-btn` no cabeçalho com vista sobreposta `#ps-about-view` e retorno `#ps-about-back` acessível em desktop e mobile inclusive com sessão expirada; `src/popup/popup.html`, `src/popup/popup.css` e `src/popup/popup.ts` adicionam bloco expansível `<details>` com versão e links no rodapé do popup; validado por `tests/unit/about.test.ts` e cenário `[E2E] 5B` / `sobre_privacidade_mobile.png`).
- **Contexto:** Reforçar diretamente dentro do aplicativo (sem depender apenas do `README.md`) a transparência jurídica, de privacidade e de uso gratuito da ferramenta.
- **Comportamento esperado:**
  - Adicionar um botão/aba discreto **Sobre** no cabeçalho ou rodapé do painel Shadow DOM (`src/ui/panel.ts`) e no popup (`src/popup/popup.html`) exibindo: (1) aviso de ferramenta independente e gratuita, sem vínculo com a SEC-BA/Governo da Bahia; (2) garantia de processamento 100% local sem coleta de dados de alunos ou senhas; (3) lembrete de conferência pelo docente antes da gravação definitiva; e (4) versão atual da extensão + link para o repositório.
- **Impacto técnico / Riscos:** Baixo risco (alteração localizada de UI em `src/ui/panel.ts` e `src/popup/popup.html`).

### 9. Landing Page Oficial com Simulador ao Vivo e Amostra Real CETEP — `[Concluído]`
- **Prioridade:** P2 — Média
- **Dificuldade:** Média
- **Status:** Concluído (`docs/index.html` redesenhada em arquitetura híbrida inspirada em Sunstill [REA `ev_2b7e1e0587c6ce40235f64e9f0ce61147502eed751320a9e26bf1654d3b62329`] e Badgey [REA `ev_a8fb4a86032c50105b4604159458257c2c652c278b31f132df2d44f021537357`], 100% autocontida e sem CDNs/telemetria, com paleta oficial `#404E82` + `#10b981`, tema Claro/Escuro alternável, simulador interativo de 3 modos [Notas + Não Realização, Frequência invertida e Extrair CETEP] com controle de fonte `A+`, prévia navegável da planilha CETEP com hiperlinks internos e download real de `docs/amostra-cetep.xlsx` gerado por `scripts/generate-sample-cetep.mjs` com dados 100% fictícios, badge da Chrome Web Store em revisão, abas de instalação e FAQ em acordeão).
- **Contexto:** Transformar `docs/index.html` em uma landing page de apresentação completa que permita ao docente testar o painel ao vivo e inspecionar/baixar uma amostra real da planilha consolidada antes de instalar.
- **Comportamento esperado:** Página responsiva (desktop e mobile), zero requisições externas, simulador funcional dos 3 fluxos, amostra CETEP navegável + arquivo `.xlsx` real baixável, mantendo todos os links oficiais (`is.gd`, Releases e `privacidade.html`).
- **Impacto técnico / Riscos:** Alterações isoladas em `docs/index.html`, `docs/amostra-cetep.xlsx` e `scripts/generate-sample-cetep.mjs`, sem impacto nos pacotes `dist/` da extensão.

## P3 — Baixa Prioridade / Futuro

### 1. Assistente de Relatório Final para Estudante PCD e Consulta de Turmas Consolidadas (`Relatórios`)
- **Prioridade:** P3 — Baixa / Futuro
- **Dificuldade:** Média
- **Contexto:** `Relatórios -> Estudante PCD -> Relatório de resultado final` (`relatorio_atendimento_cuidador/lista.jsf` -> `plano_educacional_individualizado/relatorio.jsf`) possui subformulários semestrais (`<textarea>` com limite de 4000 caracteres). `Relatórios -> Turmas Consolidadas e Não Consolidadas` (`buscaRelatorioTurmaConsolidada.jsf`) lista o status de consolidação das turmas.
- **Comportamento esperado:**
  - No relatório PCD, oferecer importação/colagem com contador de 4000 caracteres e sanitização antes de preencher; na consulta de consolidadas, permitir exportar o painel de status em `.xlsx`/`.csv`.
- **Impacto técnico / Riscos:** Fluxo multi-página com paginação na lista de estudantes PCD.

### 2. Atalhos Rápidos e Download em Lote de PDFs via `Consulta de Turma` (`busca.jsf`)
- **Prioridade:** P3 — Baixa / Futuro
- **Dificuldade:** Alta
- **Contexto:** `Frequência -> Visualizar Mapa de Frequência` (`Emitir Mapa de Frequência` / `Mapa Sintético`) e `Diário -> Emitir Diário de Classe` (`Imprimir Diário`) disparam downloads diretos de PDF (`application/pdf`) via `jsfcljs` POST em `/sigeduc/ensino/turma/buscaPadrao/busca.jsf`.
- **Comportamento esperado:**
  - Na tela `busca.jsf`, oferecer fila sequencial para baixar os PDFs de múltiplas turmas selecionadas sem corromper o `javax.faces.ViewState` ou `DOUBLE_CHECK_TOKEN`.
- **Impacto técnico / Riscos:** Alto cuidado com downloads binários via POST JSF stateful e controle de fila para não invalidar o token da sessão.

---

## Auditoria Contínua de Achados "Menor" (Crítico Independente)

Para evitar que apontamentos `menor` do Crítico Cego se percam entre rodadas sem testes correspondentes:
- Todo achado `menor` é catalogado com ID sequencial (`CR-NNN`) em [`trabalho/critico_backlog.json`](trabalho/critico_backlog.json) e espelhado em [`trabalho/critico_backlog.md`](trabalho/critico_backlog.md).
- O [`trabalho/harness.mjs`](trabalho/harness.mjs) impõe teto máximo de `5` itens em `aberto`/`agendado` e valida que todo item `resolvido` possua um teste real verificado (`testFile` + `testPattern`).
- **Histórico Rodadas 1–15 (`CR-001` a `CR-014`):** `8` itens `resolvido`, `2` `aceito_design` e `4` `agendado` (dentro do teto `5`):
  - **`CR-011`:** Captura complementar opcional de `frequencia_dia_unico_desktop.png` com painel fechado/rolado para exibir visualmente os checkboxes marcados sob a gaveta de 440px.
  - **`CR-012`:** Exibir os hashes SHA-256 dos pacotes `.zip`/`.crx` também na tabela Markdown de `trabalho/relatorio_metricas.md` (já gravados e auditados em `trabalho/relatorio_metricas.json`).
  - **`CR-013`:** Habilitar `wrapText="1"` (ou largura dinâmica) nos estilos `xf[22]`/`xf[23]` da coluna `A` no `Painel Consolidado` CETEP para exibir rótulos longos de turma sem truncamento visual.
  - **`CR-014`:** Compactar levemente o espaçamento vertical de `.ps-about-panel` em mobile `390x844` na escala `125%` para que os links `Repositório GitHub` e `Portal de Downloads` também apareçam acima da dobra inicial em `sobre_privacidade_mobile.png`.
