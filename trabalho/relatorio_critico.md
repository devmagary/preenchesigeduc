# Relatório do Crítico Independente (Auditoria Caixa-Preta)

Auditoria realizada por subagentes independentes (`research`) sem acesso ao código-fonte, avaliando exclusivamente as evidências geradas em `trabalho/evidencias/` (capturas PNG desktop `1280x720` e mobile `390x844`, planilhas `.xlsx`/`.csv`/`.json` e relatórios de execução JSON) contra a rubrica de qualidade de `SPEC.md` e `HARNESS.md`.

## Histórico de Rodadas

### Rodada 1 (`ae936bde`)
- **Achados:** 1 `grave` (corte/ausência de barra de rolagem visível no painel mobile em `notas_previa_mobile.png`), 3 `médio` (prévia/relatórios ocultos abaixo da dobra sem colapsar etapas anteriores; falta de `invalidDetails` no JSON de notas e `invalidCount`/`errors` no JSON de frequência; barras de rolagem externas no mobile `390x844`), 1 `menor`.
- **Correções aplicadas:**
  - Travamento do viewport móvel (`inset: 0; width: 100%; height: 100dvh` e `overflow: hidden` no documento ao abrir em `<= 640px`), barra de rolagem explícita em `.ps-body` e upload estilizado de `44px`.
  - Acordeões colapsáveis para etapas concluídas (Importação e Mapeamento) e exibição do Relatório de Execução no topo após finalizar.
  - Inclusão de `invalidDetails`, `disabledDetails` e `recConflictDetails` em `GradeFillReport`, e `invalidCount`, `invalidDetails` e `errors` em `AttendanceDateResult`.

### Rodada 2 (`27e9534a`)
- **Achados:** **0 `grave`**, 2 `médio` (omissão de `notInSheet`/status de gravação na UI de Frequência; data `Indisponível` pré-marcada na prévia e exibida como `0 faltas / 0 pres.` no relatório) e 5 `menor` (contraste WCAG de dígitos KPI verde/âmbar, microtexto `(marcado = FALTA)` próximo à seleção de datas, contagem de grupos vs ocorrências em divergências, concordância nominal `1 faltas` e acentuação de aba `Modelo Frequencia`).
- **Correções aplicadas:**
  - Pré-seleção automática apenas das datas disponíveis no calendário do SIGEduc, mantendo datas indisponíveis desmarcadas por padrão e exibindo `— (não processada)` no relatório.
  - Exibição explícita de `notInSheet`, datas indisponíveis, avisos e status de gravação na prévia e no relatório de Frequência.
  - Ajuste de cores KPI para contraste WCAG AA (`#047857`, `#b45309`, `#b91c1c`), correção de concordância nominal (`1 falta`), microtexto e acentuação `Modelo Frequência`.

### Rodada 3 — Parecer Final (`79b6d4e2`)
- **Veredito:** **APROVADO — Zero defeitos de severidade `grave` ou `médio`.**
- **Critérios verificados sem defeitos:**
  1. **Legibilidade e contraste (WCAG AA/AAA):** Todas as combinações medidas atingiram `>= 4.5:1` (`4.80:1` a `11.87:1`).
  2. **Responsividade mobile (`390x844`):** Sem cortes laterais, sem overflow horizontal, sem barras externas sobrando, sem sobreposição e alvos de toque `>= 44px`.
  3. **Clareza de divergências e progresso:** Separação explícita de casamentos exatos, não encontrados sem fuzzy matching (`ANA CLARA FERREIRO`), inválidos (`BRUNO HENRIQUE SOUZA`, `"2,5" > 2.0`), ausentes na planilha (`42`) e datas indisponíveis (`25/08/2026`).
  4. **Integridade dos arquivos e privacidade:** `manifest.json` 100% consistente em bytes e SHA-256 com os 16 artefatos; `.xlsx`, `.csv` (UTF-8 BOM, `;`) e `.json` íntegros, com sanitização PUA e sem vazamento de senhas.
- **Observações residuais (`menor`, não bloqueantes):**
  1. `frequencia_dia_unico_desktop.png` captura a prévia multi-datas antes da execução em `05/08/2026`.
  2. Coluna `Resumo` de `RELATÓRIO POR DATA` contabiliza os alunos da planilha (com nota explicativa logo abaixo para os 42 ausentes).
  3. Painel lateral direito em `1280x720` encobre parcialmente a direita da tabela subjacente enquanto aberto.
  4. Normalização de rótulos entre página e exportações (`PROF.` removido em `docente` no JSON e `Série/Módulo` no CSV/XLSX).

### Rodada 4 — Roadmap P1.1, P1.2, P2.1 e P2.2 (`ff29b74c`)
- **Veredito:** **APROVADO — `0` defeitos `grave`, `0` `médio`, `0` `menor`.**
- **Escopo inspecionado:** `manifest.json` (18 artefatos, hash SHA-256), `relatorio_metricas.md` / `.json`, JSONs de execução e todas as 10 capturas PNG (`scraping_turmas_desktop.png`, `notas_previa_desktop.png`, `notas_relatorio_desktop.png`, `nao_realizadas_desktop.png`, `notas_previa_mobile.png`, `notas_dark_mode_mobile.png`, `frequencia_dia_unico_desktop.png`, `frequencia_multiplas_datas_desktop.png`, `frequencia_mobile.png`, `scraping_notas_mobile.png`).
- **Critérios verificados:**
  1. **P1.1 (Avaliações Não Realizadas):** Em `nao_realizadas_desktop.png`, o handoff abriu `Verificar Avaliações Não Realizadas` exibindo `3 marcado(s) automaticamente agora • 0 já marcado(s)`; os alunos com nota `0,0` e `1,5` permaneceram desmarcados e os 3 alunos com `NF`, `Não Fez` e célula vazia foram marcados na coluna `Participação`.
  2. **P1.2 (Mapeamento Persistente):** Em `notas_previa_desktop.png`, a seção `2. Mapeamento (4/4 atividades • 47 linhas)` permaneceu aberta com todos os seletores legíveis e bem alinhados.
  3. **P2.1 & P2.2 (Escala `125%` e Dark Mode no cabeçalho Mobile `390x844`):** Em `notas_dark_mode_mobile.png`, `[A 125%]` e `[☀️]` estão alinhados no cabeçalho sem sobreposição; alto contraste no tema escuro, zero texto cortado e zero barra de rolagem horizontal externa.
  4. **SLAs e Pacotes:** `.xlsx` p99 `33.12 ms` / `.csv` p99 `0.46 ms` (< `250 ms`), abertura do painel `14.01 ms` (< `100 ms`), `180/180` confirmações AJAX (`0%` perda), `45/45` exatos com `0` falsos positivos, `dist/chrome/` `511.6 KB` e `dist/firefox/` `511.8 KB` (< `1536 KB`).

### Rodada 5 — Roadmap P1.3: Seleção de Aba e Planilhas Consolidadas (`db4f20a5`)
- **Veredito:** **APROVADO — `0` defeitos `grave`, `0` `médio`, `0` `menor`.**
- **Escopo inspecionado:** `manifest.json` (19 artefatos), `relatorio_metricas.md` / `.json`, JSONs de execução e todas as 11 capturas PNG (incluindo `notas_multi_aba_desktop.png`).
- **Critérios verificados:**
  1. **P1.3 (Multi-aba e Múltiplos Blocos Consolidadas):** Em `notas_multi_aba_desktop.png`, os seletores `Aba da Planilha (3 disponíveis)` (`Consolidado`) e `Bloco / Turma na Aba (2 blocos)` (`TURMA-ANUAL-1A (5 linhas)`) apareceram no topo da seção `2. Mapeamento (4/4 atividades • 5 linhas)` com banner automático indicando `5 aluno(s) casado(s) com a turma aberta`, ignorando corretamente o painel resumo superior e o bloco `TURMA OUTRA`.
  2. **Regressão & SLAs:** Todos os fluxos de Notas (P1.1/P1.2), Frequência, Scraping, Escala `125%` + Dark Mode (`notas_dark_mode_mobile.png`) e SLAs aprovados (`19.4 ms` abertura, `29.98 ms` p99 `.xlsx`, `0%` perda AJAX em `180/180`, `45/45` exatos com `0` falsos positivos, `dist/chrome/` `521.8 KB`, `dist/firefox/` `522 KB`).

### Rodada 6 — Roadmap P2.4 (Modelo Consolidado CETEP) & P2.5 (Extração em Lote) (`cb17ecc5`)
- **Sub-rodada 6.1:** 1 defeito `médio` (em `extracao_lote_cetep_desktop.png`, o card superior `Dados Detectados na Tela` empurrava os botões `Baixar Planilha CETEP (.xlsx)` e `Nova Extração` abaixo da dobra de `720 px`) e ressalva `menor` de truncamento no `<select>` `Layout da Planilha CETEP`.
- **Correções aplicadas:** Priorização do card `#ps-batch-card` no topo da aba `Extrair` quando houver extração em lote ativa/concluída (recolhendo `Dados Detectados na Tela` em `<details>`) e grade `1.7fr / 1fr` para `Layout CETEP` e `Nota mínima`.
- **Sub-rodada 6.2 — Parecer Final:** **APROVADO — `0` defeitos `grave`, `0` `médio`, `3` observações `menor` não bloqueantes.**
  - `manifest.json`: `21/21` artefatos íntegros, incluindo `extracao_lote_cetep_desktop.png` (`51.302` B) e `consolidado_cetep_lote.xlsx` (`73.467` B).
  - `extracao_lote_cetep_desktop.png`: card completo acima da dobra exibindo `Lote concluído (2/2 turmas)`, `90 estudantes • 60 aprovados • 20 recuperação • 10 sem nota`, `Layout CETEP` (`Multi-aba (Painel + turmas)` sem truncamento), `Nota mínima` e botões `Baixar Planilha CETEP (.xlsx)` + `Nova Extração` alinhados.
  - SLAs: parse `.xlsx` média `13.82 ms` / p99 `29.36 ms`, `.csv` `0.28 ms` / p99 `0.47 ms` (`< 250 ms`), abertura do painel `15.75 ms` (`< 100 ms`), `180/180` AJAX (`0%` perda), `45/45` exatos com `0` falsos positivos, `dist/chrome/` `564.0 KB` e `dist/firefox/` `564.2 KB` (`< 1536 KB`).

### Rodada 7 — Unidades Mistas Médio vs Técnico e Correção das 3 Menores (`a67eb8ac`)
- **Veredito Final:** **APROVADO — `0` defeitos `grave`, `0` `médio`, `1` nota informativa `menor` não bloqueante.**
- **Correções das 3 menores verificadas:**
  1. `Nota mínima` exibe literalmente `5.0` e `Layout CETEP` exibe `Multi-aba (Painel + turmas)` completo em `extracao_lote_cetep_desktop.png`.
  2. Card `MODELO CONSOLIDADO PADRÃO CETEP` 100% visível acima da dobra em `scraping_notas_mobile.png` (`390x844`).
  3. `relatorio_nao_realizadas.json` (`832` B) comprova as 5 entradas (`0,0`, `1,5`, `NF`, `Não Fez`, `""`) alinhadas aos checkboxes de `nao_realizadas_desktop.png`.
- **Unidades mistas Médio vs Técnico (P2.4 & P2.5):**
  - `extracao_lote_cetep_desktop.png` confirma `90 estudantes • 65 aprovados • 15 recuperação • 10 sem nota` e detalhamento `Ensino Médio: 1ª Unidade • Técnico: 2ª Unidade`.
  - `manifest.json`: `22/22` artefatos íntegros (`consolidado_cetep_lote.xlsx` com `73.710` B).
  - SLAs: `.xlsx` p99 `28.73 ms`, `.csv` p99 `0.62 ms` (`< 250 ms`), painel `15.46 ms` (`< 100 ms`), `180/180` AJAX (`0%` perda), `45/45` exatos com `0` falsos positivos, `dist/chrome/` `568.8 KB` e `dist/firefox/` `569.0 KB` (`< 1536 KB`).
