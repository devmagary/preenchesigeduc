# Preenche SIGEduc

Extensão de navegador (**Manifest V3**) para automação local de preenchimento de **notas**, **frequências** e **extração de dados** no portal **SIGEduc-BA** (`https://sigeduc.educacao.ba.gov.br/sigeduc/*`).

Compatível com Chrome/Chromium Desktop e navegadores Android com suporte a extensões (Mises, Lemur, Edge Canary e Firefox Android).

## Funcionalidades

- **Lançamento de Notas:** Importação de planilhas (`.xlsx`, `.xls`, `.csv`, inclusive arquivos multi-aba e planilhas consolidadas com resumo no topo e múltiplos blocos de turmas) ou colagem tabular (`Ctrl+V`), seleção automática da aba/bloco correspondente à turma aberta, mapeamento persistente de colunas por avaliação, prévia de correspondência exata de estudantes, preenchimento sequencial via fila AJAX (`A4J.AJAX.Submit`) e automação pós-lançamento de **Avaliações Não Realizadas** (`NF`/`Não Fez`/`FV`/em branco vs nota real `0,0`).
- **Lançamento de Frequência:** Suporte a dia único ou lote de múltiplas datas, com conversão automática de presença/falta (`P`/`F`/`1`/`0`) respeitando a lógica invertida do SIGEduc (checkbox marcado = falta) e sanitização de observações.
- **Extração / Exportação e Padrão CETEP:** Exportação contextual das telas do SIGEduc (`.xlsx`, `.csv`, `.json`), geração de **Modelo Consolidado Padrão CETEP** (`.xlsx` estilizado com Painel Consolidado, fórmulas reais, formatação condicional e média mínima configurável) e **Extração em Lote no Portal Docente** percorrendo automaticamente as turmas selecionadas.
- **Acessibilidade e Tema:** Escala de fonte (`100%`, `112%`, `125%`) e Modo Escuro (Dark Mode) isolados no Shadow DOM, salvos localmente em `localStorage`.
- **Privacidade e Segurança:** Processamento 100% local no navegador, sem telemetria ou chamadas externas. Caso o modo opcional de auto-gravação seja utilizado, a senha permanece apenas em memória RAM durante a execução.

## Estrutura do Projeto

- `src/core/` — Lógica pura testável em Node/Vitest (normalização, planilhas, notas, frequência).
- `src/sigeduc/` — Adaptadores DOM para as telas do SIGEduc-BA (detector, scraper, fillers).
- `src/ui/` — Interface isolada em Shadow DOM (`#preenche-sigeduc-host`), responsiva para desktop e mobile.
- `src/popup/` — Popup da barra do navegador.
- `scripts/` — Scripts de build (`dist/chrome/`, `dist/firefox/`, `trabalho/dist-e2e/`) e empacotamento (`.zip`).
- `tests/unit/` — Testes unitários com Vitest.
- `tests/e2e/` — Testes E2E com Playwright contra servidor mock local (`trabalho/mock-server.mjs`).

## Desenvolvimento e Verificação

```bash
# Instalar dependências
npm install

# Executar verificação completa (typecheck, build, package, testes unitários, benchmark e E2E)
npm run harness
```

## Documentação Adicional

- [AGENTS.md](AGENTS.md) — Arquitetura, invariantes e regras de verificação.
- [SPEC.md](SPEC.md) — Especificação técnica detalhada.
- [Roadmap.md](Roadmap.md) — Planejamento de melhorias e prioridades.
- [HARNESS.md](HARNESS.md) — Guia da suíte de verificação automatizada.
