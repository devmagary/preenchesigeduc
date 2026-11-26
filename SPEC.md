Construa uma extensão de navegador Manifest V3 (chamada **Preenche SIGEduc**), que rode no Google Chrome de desktop (Windows/macOS/Linux) e em navegadores Android com suporte a extensões (Mises, Lemur, Edge Canary e Firefox Android via WebExtension MV3): uma ferramenta local injetada nas páginas do portal SIGEduc-BA (`https://sigeduc.educacao.ba.gov.br/sigeduc/*`) para importar planilhas de notas e frequências e preencher automaticamente os formulários JSF/RichFaces do diário de classe, além de extrair (scraping contextual) turmas, alunos e atividades diretamente das telas abertas. Ela precisa atingir confiabilidade de nível produção para dados escolares reais (zero erro de atribuição entre alunos) e permitir que o professor importe suas planilhas (`.xlsx`, `.xls`, `.csv` ou colagem direta), confira o pareamento e preencha notas e presenças no SIGEduc em segundos, tanto no PC quanto no celular.

## PRIORIDADES (nesta ordem, quando entrarem em conflito)

1. Precisão e segurança: zero nota ou falta atribuída ao aluno errado; correspondência estritamente exata após normalização; nenhuma gravação silenciosa sem consentimento explícito; nenhum dado de aluno ou senha sai do dispositivo.

2. Usabilidade Desktop + Mobile (Android): interface responsiva e amigável a toque dentro de Shadow DOM isolado na própria página do SIGEduc, com fluxo claro em telas pequenas (`390x844`) e desktop (`1280x720+`).

3. Velocidade e estabilidade no SIGEduc: preenchimento fluido que respeite integralmente a fila sequencial de requisições AJAX do RichFaces (`A4J.AJAX.Submit`), o `javax.faces.ViewState` e o `DOUBLE_CHECK_TOKEN`, sem perder eventos `onblur` ou corromper a sessão.

4. Simplicidade e leveza: arquitetura modular em TypeScript sem frameworks pesados, bundle enxuto e manutenção direta.

## RESTRIÇÕES

Tecnologia e dependências: TypeScript + Vite (build multi-target MV3 para Chrome/Chromium e Firefox) + SheetJS (`xlsx`) empacotado localmente para leitura/escrita de `.xlsx`/`.xls`/`.csv`. UI leve e modular em HTML/CSS/TS puro dentro de Shadow DOM (sem React/Angular/Vue pesados). Proibido carregar scripts, fontes ou estilos via CDN em tempo de execução.

Origem de dados e recursos: 100% local e offline no navegador. Nenhum backend, nenhuma telemetria, nenhuma chamada de rede externa além das interações normais da página do próprio SIGEduc (`https://sigeduc.educacao.ba.gov.br/*`).

Formato de entrega: Pastas prontas para carregar no navegador `dist/chrome/` e `dist/firefox/` (ambas Manifest V3 válidas) + pacotes compactados `dist/preenche-sigeduc-chrome.zip`, `dist/preenche-sigeduc-firefox.zip` e `dist/preenche-sigeduc-edge-mobile.crx` (CRX3 assinado localmente com chave `.pem` fora do repositório) + workflow `.github/workflows/release.yml` para GitHub Releases com nomes fixos + página estática `docs/index.html` + scripts `npm` (`dev`, `build`, `test`, `package`) + guia de instalação no PC e no Android (`README.md`). Informe no relatório final o tamanho total descompactado (em KB) de `dist/chrome/` e `dist/firefox/` e o tamanho dos `.zip` e `.crx`.

Engenharia e runtime:
- Todo o painel injetado deve usar Shadow DOM (`mode: 'open'` ou isolado) para não sofrer nem causar conflito de CSS com o SIGEduc (Bootstrap/RichFaces/PrimeFaces).
- A extensão deve isolar eventos `paste` e `keydown` dentro do seu próprio Shadow DOM (`stopPropagation`) para que a colagem direta (`Ctrl+V`) de planilhas funcione mesmo na tela de Frequência do SIGEduc, que bloqueia `paste` no `document`.
- No modo opcional de auto-gravação na sessão, a senha digitada pelo professor deve existir exclusivamente em memória RAM da aba/sessão ativa — estritamente proibido persistir senha em `chrome.storage`, `localStorage`, `sessionStorage`, cookies ou logs. Ao encerrar o lote ou fechar o painel, a variável de senha em memória deve ser zerada.
- Nunca abrir múltiplas abas paralelas contra a mesma sessão JSF do SIGEduc (evita corrupção de `javax.faces.ViewState`).

Originalidade e referências: Usar apenas a estrutura DOM real do SIGEduc-BA mapeada via REA e inspeção somente leitura (incluindo `docente.jsf` com seus 5 menus `JSCookMenu` [`Ensino`, `Frequência`, `Diário`, `Notas`, `Relatórios`] e 17 submenus, `buscaPadrao/busca.jsf`, `form_estudantes_notas_avaliacoes_unidade.jsf`, `form_estudantes_realizacoes_avaliacoes_unidade.jsf`, `frequencia_aluno/form.jsf`, `grupo_avaliacao_unidade/lista.jsf` e `form.jsf`, `conteudo_ministrado/lista_topicos.jsf`, `plano_trabalho_professor/form.jsf`, `relatorio_parcial_professor/form.jsf`, `plano_educacional_individualizado/relatorio.jsf`, `diario_classe/gerenciar/view.jsf`, `buscaRelatorioTurmaConsolidada.jsf` e relatórios HTML/PDF `#toPdfForm`). Como muitas rotas do SIGEduc usam *forward* JSF no servidor (mantendo `window.location.href` em `docente.jsf` ou `busca.jsf`), a detecção deve sempre priorizar `form[action*="..."]` e marcadores DOM. Fixtures de teste devem ser versões HTML sanitizadas com nomes e matrículas 100% fictícios, mantidas exclusivamente em `trabalho/` e nunca incluídas no bundle `dist/`.

## ALVO

Ambiente alvo:
- Desktop: Google Chrome (MV3) em Windows/macOS/Linux (`1280x720` e superiores).
- Mobile (Android): Navegadores Android com suporte a extensões MV3/WebExtension (Mises, Lemur, Edge Canary e Firefox Android) em viewport móvel (`390x844`, interação touch com alvos >= 44×44 px).
- Host alvo: `https://sigeduc.educacao.ba.gov.br/sigeduc/*`.

Metas mensuráveis (SLA):
- Parse de planilha de até 500 linhas (`.xlsx` ou `.csv`): tempo < 250 ms (média e p99).
- Abertura/renderização do painel flutuante injetado: < 100 ms.
- Preenchimento de notas de 1 turma completa (45 alunos × 4 atividades = 180 lançamentos): 100% dos campos preenchidos em fila sequencial aguardando a conclusão de cada `A4J.AJAX.Submit` (`onblur`), com taxa de perda de evento = 0% e barra de progresso atualizada por aluno.
- Preenchimento de frequência de 1 dia (45 alunos): 100% das faltas e observações marcadas corretamente respeitando a lógica invertida (checkbox marcado = FALTA) em < 500 ms após o dia estar carregado; em lote de múltiplas datas, aguardar o carregamento AJAX de cada data clicada no calendário antes de preencher.
- Tamanho do bundle final descompactado: < 1.5 MB por target (`dist/chrome/` e `dist/firefox/`).

## ESPECIFICAÇÃO

Núcleo funcional:
1. **Detector de contexto de tela do SIGEduc:** Identifica automaticamente em qual tela o professor está:
   - Portal Docente (`docente.jsf` — tabela `turmasProfessorTable` com `idTurmaComponente`, ano, escola, oferta, série/módulo, periodicidade, componente e qtd. de estudantes).
   - Lançar Resultados (`form_estudantes_notas_avaliacoes_unidade.jsf` — abas de `1ª`, `2ª`, `3ª Unidade` [Anual] ou `1ª`, `2ª Unidade` [Semestral] + `Res. Final`, colunas de atividades `av__<idAvaliacao>`, valor máximo da coluna, `nuREC__<unidade>`, `nu__<unidade>` e status habilitado/desabilitado).
   - Verificar Avaliações não realizadas (`form_estudantes_realizacoes_avaliacoes_unidade.jsf` — matriz Estudante × Avaliação com checkboxes `av__<idAvaliacao>` para registrar não realização).
   - Informar Frequência (`frequencia_aluno/form.jsf` — calendário anual `formCalendarios` com dias clicáveis `A4J.AJAX.Submit`, tabela `formFrequencia` com `#`, `Matrícula`, `Nome`, `Observação` e checkboxes de horários onde marcado = FALTA).
   - Gerenciar Avaliações das Unidades (`grupo_avaliacao_unidade/lista.jsf` e `form.jsf` — unidades e suas atividades com Descrição, Data, Tipo, Categoria, Ordem e Valor).
2. **Módulo de Scraping Contextual e Exportação:**
   - Extrai os dados estruturados da tela aberta atual:
     - Em *Portal Docente*: lista de turmas (`idTurmaComponente`, turma, ano, escola, oferta, série/módulo, periodicidade, componente, qtd. estudantes).
     - Em *Lançar Resultados* e *Verificar Avaliações não realizadas*: turma, unidade selecionada, lista de estudantes, atividades cadastradas (nome + valor máximo) e notas/marcações atuais.
     - Em *Informar Frequência*: turma, horários, lista de estudantes com `Matrícula` e `Nome`, e lista de datas letivas clicáveis no calendário.
     - Em *Gerenciar Avaliações*: turma, unidades e tabela detalhada de atividades.
   - Exporta os dados extraídos em `.xlsx` (já formatado como **planilha-modelo pronta para preencher** notas ou frequências), `.csv` e `.json`.
   - **Modelo Consolidado Padrão CETEP (P2.4):** Disponível na aba `Extrair` em *Lançar Resultados* (turma atual, incluindo a aba **Res. Final**) e como saída da *Extração em Lote* no *Portal Docente*. Gera `.xlsx` OOXML estilizado (cabeçalhos coloridos, bordas, zebra, células mescladas, cores condicionais por situação e largura automática) com fórmulas reais do Excel (`SUM`, `AVERAGE`, `IF`, `COUNT`, `COUNTA`, `COUNTIF`, `IFERROR`), hiperlinks internos bidirecionais (`Painel Consolidado` → abas/blocos individuais e `← Voltar ao Painel` / `↑ Voltar ao Painel`) e valores cacheados: **Painel Consolidado** (`Turma` com Curso/Série/Código/Turno, `Modalidade`, `Unidade`, `Total de Alunos`, `Média Geral`, `Aprovados`, `Recuperação`, `Sem Nota`, `% Aprovação`, subtotais por modalidade quando houver mais de uma e `TOTAL GERAL`) + abas individuais por turma (com sufixo `1U`/`2U`/`3U`/`RF` da unidade, modo `Multi-aba`) ou blocos empilhados em **Aba Única** (compatível com o parser multi-bloco P1.3), incluindo `Nº`, `Nome do Aluno`, `Matrícula`, atividades (ou unidades + colunas de `#formulario:resultadoFinal` na aba `Res. Final`, usando `Média Final` com fallback para `Média Anual` em `Nota Geral` sem somar colunas), `Nota Geral`, `Situação`, `Observações` e linha `MÉDIA DA TURMA`, com nota mínima configurável (padrão `5.0` ou `#configMediaNatural`).
   - **Extração em Lote de Todas as Turmas no Portal Docente (P2.5):** Permite marcar quais turmas extrair em cards responsivos com `height: auto` e quebra de linha limpa (`.ps-turma-card`), configurar unidades distintas por modalidade (**Ensino Médio Anual** `Ativa/1ª/2ª/3ª/Res. Final` e **Técnico Semestral** `Ativa/1ª/2ª/Res. Final`) bem como sobrescrita individual por turma na lista (no modo `Ativa / mais recente`, prioriza a última unidade regular com atividades abertas — ou a última regular com atividades/notas — sem travar na 1ª aba selecionada inicialmente no SIGEduc nem cair por engano em `Res. Final`), e opcionalmente coletar a `Matrícula` real acessando *Lançar Frequência* (`Incluir Matrícula via tela de Frequência`). Utiliza máquina de estados persistida em `sessionStorage` (`preenche_sigeduc_batch_extract_v1`, zero senhas), barra de progresso, botão **Cancelar**, tratamento de sessão expirada preservando dados já coletados e consolidação automática no `.xlsx` Padrão CETEP agrupado por modalidade ao retornar ao Portal Docente.
3. **Módulo de Importação de Planilhas:**
   - Aceita upload de `.xlsx`, `.xls` e `.csv`, além de área de colagem direta (`Ctrl+V` de células copiadas do Excel/Google Sheets/LibreOffice, separadas por TAB/ponto-e-vírgula/vírgula).
   - **Seleção de Aba e Planilhas Consolidadas (P1.3):** Suporta arquivos `.xlsx`/`.xls` com múltiplas abas e abas/colagens consolidadas com painel resumo no topo seguido de vários blocos de turmas (múltiplos cabeçalhos `Nº / Nome do Aluno`). Ao importar em Notas, Avaliações Não Realizadas ou Frequência, pré-seleciona automaticamente a aba/bloco com mais alunos exatos da turma aberta no SIGEduc (fallback: primeira tabela válida), exibindo seletores de Aba e Bloco (`bloco N` ou `"Todos os blocos combinados"`) no topo da seção `2. Mapeamento` apenas quando houver mais de 1 aba ou mais de 1 bloco.
   - Detecta automaticamente cabeçalhos e permite ao usuário mapear a coluna de `Nome` (e `Matrícula`, se houver) e as colunas de `Atividades` (para notas) ou `Datas` (`DD/MM/AAAA`, para frequência), com pré-visualização antes de aplicar.
4. **Módulo de Preenchimento de Notas e Não Realização:**
   - Realiza correspondência **estritamente exata após normalização** (uppercase, remoção de diacríticos/acentos NFD, remoção de espaços duplicados/pontas). Qualquer nome sem correspondência exata é ignorado e listado no relatório de divergências.
   - Diferencia explicitamente na planilha: `0` / `0,0` / `0.0` → nota zero real (`0.0` preenchida no campo); já célula vazia, `NF`, `Não Fez`, `FV`, `NR`, `N/R` ou `-` → **Não Realizada** (deixa ou limpa o campo de nota para que fique vazio e registra pendência).
   - Valida formato numérico (aceita vírgula ou ponto decimal, normalizando para o formato esperado pelo SIGEduc, ex.: `3.5`) e valida contra o valor máximo da atividade exibido no cabeçalho da coluna (`Valor: X.X`); notas acima do máximo ou inválidas são bloqueadas e reportadas.
   - Ignora campos `disabled` (unidades fechadas pelo calendário escolar), informando claramente no relatório.
   - Se o aluno possuir nota em `Rec. da Unidade` preenchida e o usuário tentar alterar atividade regular, alerta sobre a regra do SIGEduc (é necessário limpar a recuperação primeiro).
   - Dispara preenchimento em **fila sequencial** (`define valor` → `input`/`change` → `blur` → aguarda conclusão da requisição RichFaces `A4J.AJAX.Submit` ou atualização de `nu__<unidade>` antes do próximo campo), exibindo barra de progresso e botão **Cancelar/Pausar**.
   - **Registro de Não Realização (`form_estudantes_realizacoes_avaliacoes_unidade.jsf`):** ao concluir o preenchimento com itens de Não Realização, salva a fila pendente (aluno + atividade, sem senha) em `sessionStorage` (`preenche_sigeduc_pending_nr`) e arma um observador no `#formulario:confirmationDialog`. Quando esse modal aparecer (tanto no Modo Assistido após o professor digitar a senha e gravar quanto no Modo Auto-gravação), aciona automaticamente o botão **Sim** e, ao carregar a tela de checkboxes, marca automaticamente todas as pendências de Não Realização (além de suportar importação direta de planilha nessa tela).
   - **Persistência da seção de Mapeamento:** a seção de mapeamento de colunas na aba `Notas` (e `Frequência`) permanece aberta durante re-renderizações e trocas de coluna, fechando apenas por clique explícito do usuário.
   - **Modo Assistido (padrão):** preenche os campos e exibe relatório final (preenchidos, não realizadas, ignorados/desabilitados, não encontrados na página, não presentes na planilha), deixando o professor revisar, digitar a senha no modal `confirmacaoSenhaDialog` e clicar em Gravar.
   - **Modo Auto-gravação na sessão (opcional, desligado por padrão):** mediante opt-in explícito e senha informada em campo temporário em memória na sessão atual, abre o modal de confirmação, preenche `formulario:senha` e submete `formulario:confirmarGravacaoNotas` somente após confirmação explícita do resumo prévio.
5. **Módulo de Preenchimento de Frequência:**
   - Interpreta valores de presença/falta na planilha de forma configurável e intuitiva:
     - Presença: `P`, `PRESENTE`, `C`, `1`, `OK`, `SIM`, célula vazia (quando configurado).
     - Falta: `F`, `FALTA`, `A`, `AUSENTE`, `0`, `NÃO`, `NAO`, ou número inteiro > 0 indicando quantidade de horários faltados (quando houver múltiplos horários no dia).
   - Converte corretamente para a **lógica invertida do SIGEduc** (checkbox **marcado** = estudante **FALTOU**; checkbox **desmarcado** = presente).
   - Suporta preenchimento da **data atualmente aberta** OU **lote de múltiplas datas** presentes na planilha: para cada data selecionada, localiza o link correspondente no calendário `formCalendarios` (validando `dia`, `mes` [0-indexed no SIGEduc] e `ano`), clica para disparar o AJAX, aguarda a tabela `Lista de Frequência - DD/MM/AAAA` carregar, marca as faltas (e observações opcionais, respeitando limite de 500 chars e sem quebras de linha `\n`) e:
     - No Modo Assistido (padrão): pausa ao final de cada dia para o professor revisar, digitar a senha em `formFrequencia:senha` e clicar em `Gravar Frequências`, com botão "Próxima data".
     - No Modo Auto-gravação na sessão (opcional): preenche `formFrequencia:senha` (da RAM) e aciona `formFrequencia:botaoGravarFreq` (tratando confirmação) dia a dia, com log detalhado por data.

Comportamento e regras:
- Normalização de nomes: `str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()`. Nenhuma heurística fuzzy automática é permitida para preencher campos.
- Idempotência e segurança: antes de qualquer escrita, exibir prévia quantitativa (`X alunos casados`, `Y não encontrados`, `Z campos bloqueados/inválidos`). Nunca sobrescrever silenciosamente sem mostrar o que será alterado.
- Respeito ao DOM do SIGEduc: suportar tanto turmas Anuais (3 unidades) quanto Semestrais (2 unidades), e tanto dias com `1° horário` quanto dias com múltiplos horários (`1° horário`, `2° horário`, etc.).

Qualidade e acabamento:
- Botão flutuante discreto e arrastável/ancorável no canto da tela do SIGEduc (com badge indicando a tela detectada: Notas, Não Realiz., Frequência, Turmas, Avaliações).
- Gaveta lateral (desktop) / tela cheia deslizante (mobile `<= 640px`), tipografia legível, alto contraste, feedback visual de status por cor e ícone (sucesso, aviso, erro, bloqueado).
- Controles de acessibilidade e conforto visual diretamente no cabeçalho do painel (`min-width: 44px; min-height: 44px`):
  - **Botão Sobre (`i`) / Aviso Legal e Privacidade (P2.8):** abre vista sobreposta dentro do painel (acessível mesmo na tela de login/sessão expirada) exibindo aviso de ferramenta independente e gratuita sem vínculo com a SEC-BA/Governo da Bahia, garantia LGPD 100% local (sem coleta de dados ou senhas), termo de conferência exclusiva pelo docente (*as is*), versão dinâmica do `manifest.json` e links para o repositório GitHub e portal `is.gd/sigeduc`.
  - **Tamanho do texto (P2.1):** alternância entre `100%` (Normal), `112%` (Grande) e `125%` (Extra Grande) via CSS variables isoladas no Shadow DOM, persistida em `localStorage` (`preenche_sigeduc_font_scale`).
  - **Visual Noturno / Dark Mode (P2.2):** alternância entre tema claro e escuro via tokens CSS no Shadow DOM (respeitando `prefers-color-scheme` como fallback inicial e garantindo contraste WCAG AA `>= 4.5:1`), persistida em `localStorage` (`preenche_sigeduc_theme`).
- Popup da extensão (`action.default_popup`) minimalista com status da aba ativa, botão "Abrir/Fechar Painel no SIGEduc", link rápido para o portal e bloco expansível (`<details>`) **Sobre / Aviso Legal e Privacidade** com versão e links.

Robustez e casos de borda:
- Planilha vazia, cabeçalho deslocado, arquivo corrompido, colunas duplicadas, separador `;` vs `,` em CSV brasileiro, BOM UTF-8 e ISO-8859-1.
- Nomes duplicados na planilha ou na turma: bloquear preenchimento desses homônimos e exigir intervenção manual (nunca chutar).
- Sessão expirada do SIGEduc (redirecionamento para `verTelaLogin.do` ou erro no retorno AJAX): pausar imediatamente a fila e alertar o professor para fazer login novamente.
- Data da planilha que não existe ou não é clicável no calendário do SIGEduc (feriado, fim de semana ou dia sem aula da turma): registrar no relatório como "Data indisponível no calendário" e seguir para a próxima data selecionada.
- Alunos com ícone PCD ou texto extra na célula do nome no SIGEduc (ex.: caracteres de ícone de fonte): limpar caracteres não textuais/ícones antes da normalização do nome.

Limites do escopo (v1 atual — futuras expansões mapeadas no `Roadmap.md`):
- Não automatizar criação/remoção de atividades avaliativas no SIGEduc na v1 (apenas scraping delas para referência/modelo).
- Não automatizar preenchimento de Conteúdo Ministrado (`lista_topicos.jsf`), Plano de Curso (`plano_trabalho_professor/form.jsf`), Atividades Não Presenciais (`relatorio_parcial_professor/form.jsf`), Estudante PCD (`plano_educacional_individualizado/relatorio.jsf`) ou download em lote de PDFs na v1 (telas já mapeadas para evolução no `Roadmap.md`).
- Não integrar com Google Sheets/Drive via OAuth na v1.
- Nunca executar testes automatizados de escrita contra o ambiente real de produção `sigeduc.educacao.ba.gov.br`.

## INTERFACES E INTERAÇÃO

- **Botão flutuante injetado na página do SIGEduc:** Abre/fecha o painel principal sem sair da aba.
- **Painel Principal (Shadow DOM) com 3 abas:**
  1. `Notas`: upload/colagem da planilha → mapeamento de colunas (Aluno + Atividades) → prévia de correspondência exata e validações → opção de Modo Assistido / Auto-gravação na sessão → botão `Preencher Notas` + barra de progresso + botão `Cancelar` + relatório exportável de conferência.
  2. `Frequência`: upload/colagem da planilha → seleção de coluna de Aluno e datas a processar (dia atual ou múltiplas datas) → configuração de legenda P/F → prévia de correspondência → botão `Preencher Frequência` + controle passo a passo (`Próxima data`) ou lote sequencial + relatório por data.
  3. `Extrair (Scraping)`: exibe automaticamente o que foi detectado na tela atual (turmas, alunos, matrículas, atividades ou datas) em tabela resumida + botões `Baixar Modelo (.xlsx)`, `Exportar .csv` e `Exportar .json`.
- **Popup da extensão (`action`):** Exibe se a aba atual está no SIGEduc, qual tela foi detectada e botão para abrir/fechar o painel.
- **Scripts de linha de comando (`package.json`):**
  - `npm run build` → gera `dist/chrome/` e `dist/firefox/`.
  - `npm run package` → gera `dist/preenche-sigeduc-chrome.zip` e `dist/preenche-sigeduc-firefox.zip`.
  - `npm run test` → executa testes unitários + benchmarks + testes E2E em fixtures locais.

## VERIFICAÇÃO

## Crítico independente: um subagente separado, novo a cada rodada, que vê SÓ os artefatos de saída gerados (capturas de tela em desktop `1280x720` e mobile `390x844` da extensão aberta sobre as fixtures do SIGEduc nos fluxos de Notas, Frequência e Scraping, arquivos exportados `.xlsx`/`.csv`/`.json` e relatórios de preenchimento/divergências) e a rubrica de qualidade abaixo, nunca o seu código nem o seu raciocínio. Ele recebe a lista de arquivos e a escala de severidade abaixo, e mais nada: nenhuma explicação sua sobre o que é de propósito. Entregue a ele o pacote em `trabalho/evidencias/` contendo: (1) capturas desktop e mobile de cada aba (Notas prévia/preenchido/relatório, Frequência dia único e múltiplas datas, Scraping), (2) planilhas `.xlsx`/`.csv`/`.json` geradas pelo scraping, e (3) log/relatório JSON de uma execução com nomes exatos, divergentes, notas fora do limite e campos bloqueados. Ele compara contra a rubrica (legibilidade, responsividade mobile sem cortes/overflow, clareza do relatório de divergências, integridade estrutural das planilhas exportadas) e devolve defeitos concretos, em ordem de prioridade. Escala: "grave" é erro de atribuição de nota/falta, UI inutilizável/cortada no mobile, vazamento de dados/senha ou planilha exportada inválida; "médio" é ambiguidade visual no mapeamento/relatório, alvo de toque pequeno no mobile ou inconsistência de feedback de progresso; "menor" é polimento estético, espaçamento ou microtexto. Itere até ele não apontar nada acima de "menor".

## Desempenho e métricas: Executar script automatizado em `trabalho/benchmark.mjs` medindo: (a) parse de planilhas `.xlsx` e `.csv` com 500 linhas × 10 colunas (20 execuções), (b) preenchimento sequencial de 45 alunos × 4 atividades contra servidor mock RichFaces (simulando latência AJAX de 20–50 ms), (c) abertura do painel Shadow DOM, e (d) tamanho em KB de `dist/chrome/`, `dist/firefox/` e dos arquivos `.zip`. Informe em `trabalho/relatorio_metricas.md`: média, p99 e máximo de parse (ms), taxa de perda de eventos AJAX (deve ser 0%), precisão de matching (100% exatos, 0% falsos positivos em nomes divergentes), tempo de abertura do painel (ms) e tamanhos finais dos builds.

Testes funcionais:
- **Unitários (Vitest):** normalização de nomes (acentos, espaços, caracteres de ícones PCD), matching estrito exato (incluindo bloqueio de homônimos e rejeição de nomes parecidos), parser `.xlsx`/`.xls`/`.csv`/colagem TAB, validação de nota máxima e conversão da lógica invertida de frequência (`P`/`F`/`1`/`0`/múltiplos horários).
- **E2E (Playwright com Chromium carregando `dist/chrome/`):** contra servidor HTTP mock local servindo fixtures HTML sanitizadas fiéis às 4 telas do SIGEduc (`docente.jsf`, `form_estudantes_notas_avaliacoes_unidade.jsf` Anual e Semestral, `frequencia_aluno/form.jsf` com bloqueio de `paste` e calendário AJAX, `grupo_avaliacao_unidade/lista.jsf`) em viewports `1280x720` e `390x844`. Deve aprovar: (1) scraping + exportação válida nas 4 telas, (2) preenchimento de notas em fila sequencial com 100% dos `onblur` AJAX recebidos pelo mock + campos `disabled` preservados + divergentes listados sem escrita, (3) colagem `Ctrl+V` funcionando dentro do painel mesmo na tela de Frequência com `paste` bloqueado, (4) preenchimento de frequência em data única e em 3 datas seguidas via clique no calendário AJAX com lógica invertida correta, (5) confirmação de que nenhuma senha é gravada em `storage`/`localStorage`/`sessionStorage`.

PRONTO QUANDO: as três verificações passarem (Crítico independente sem defeitos acima de `menor`, métricas dentro dos SLAs e 100% dos testes unitários e E2E verdes). Entregue:
- Código-fonte organizado em `src/` + `package.json` + `README.md` (com guia de instalação PC e Android).
- Builds prontos `dist/chrome/` e `dist/firefox/` + pacotes `dist/preenche-sigeduc-chrome.zip` e `dist/preenche-sigeduc-firefox.zip`.
- Relatórios de métricas, evidências e resultados de teste em `trabalho/`.

AMBIENTE

Windows com Node.js `v24.19.0`, npm `12.1.0`, Python `3.14.7` e Google Chrome instalado em `C:\Program Files\Google\Chrome\Application\chrome.exe`. Workspace do projeto em `c:\Users\devma\Downloads\Preenche`. Guarde scripts auxiliares, fixtures HTML sanitizadas, planilhas de teste, evidências e pacotes do crítico em `trabalho/`, dentro desta pasta (excluída do build final `dist/`).
