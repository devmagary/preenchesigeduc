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
- `scripts/` — Scripts de build (`dist/chrome/`, `dist/firefox/`, `trabalho/dist-e2e/`) e empacotamento (`.zip` e `.crx` CRX3).
- `docs/` — Página estática de download direto e guia rápido para GitHub Pages ([docs/index.html](docs/index.html)).
- `tests/unit/` — Testes unitários com Vitest.
- `tests/e2e/` — Testes E2E com Playwright contra servidor mock local (`trabalho/mock-server.mjs`).

## Links Rápidos de Download (URLs Fixas)

Os lançamentos publicados em **GitHub Releases** mantêm nomes de arquivos constantes para permitir redirecionamento direto via domínio próprio ou encurtador externo sem precisar atualizar o link a cada versão:

| Plataforma / Navegador | Artefato | URL Direta (`latest`) |
| :--- | :--- | :--- |
| **Edge Canary (Android)** | `preenche-sigeduc-edge-mobile.crx` | `https://github.com/devmagary/preenchesigeduc/releases/latest/download/preenche-sigeduc-edge-mobile.crx` |
| **Chrome Desktop / Mises / Lemur** | `preenche-sigeduc-chrome.zip` | `https://github.com/devmagary/preenchesigeduc/releases/latest/download/preenche-sigeduc-chrome.zip` |
| **Firefox Desktop / Android** | `preenche-sigeduc-firefox.zip` | `https://github.com/devmagary/preenchesigeduc/releases/latest/download/preenche-sigeduc-firefox.zip` |

> **Portal Web de Download Direto (GitHub Pages):** https://devmagary.github.io/preenchesigeduc/ (publicado a partir de [docs/index.html](docs/index.html)) com os botões e passo a passo para cada navegador.

## Instalação (PC e Android)

### Google Chrome / Chromium (PC)
1. Baixe e descompacte `preenche-sigeduc-chrome.zip` (ou gere localmente via `npm run build && npm run package`).
2. Acesse `chrome://extensions`, ative o **Modo do desenvolvedor** e clique em **Carregar sem compactação**, selecionando a pasta extraída (ou `dist/chrome/`).

### Edge Canary (Android) via `.crx`
1. Baixe `preenche-sigeduc-edge-mobile.crx` diretamente no celular.
2. No **Edge Canary Android**, abra **Configurações → Sobre o Microsoft Edge** e toque 5 vezes no número da versão para habilitar as **Opções do desenvolvedor**.
3. Acesse **Opções do desenvolvedor → Instalar extensão por .crx** (*Extension install by crx*) e selecione o arquivo `preenche-sigeduc-edge-mobile.crx`.

### Mises / Lemur (Android)
1. Baixe `preenche-sigeduc-chrome.zip`.
2. Abra a página de **Extensões**, ative o modo desenvolvedor e importe diretamente o `.zip`.

### Firefox Desktop / Firefox Android
1. Baixe `preenche-sigeduc-firefox.zip`.
2. No Desktop, abra `about:debugging#/runtime/this-firefox` → **Carregar extensão temporária** selecionando o `.zip` ou `dist/firefox/manifest.json` (ou instale via arquivo assinado/coleção no Firefox Android).

## Desenvolvimento e Verificação

```bash
# Instalar dependências
npm install

# Gerar builds (dist/chrome e dist/firefox) e pacotes (.zip + .crx assinado)
npm run build && npm run package

# Executar verificação completa (typecheck, build, package, testes unitários, benchmark e E2E)
npm run harness
```

### Assinatura `.crx` e GitHub Releases
- O comando `npm run package` gera automaticamente `dist/preenche-sigeduc-edge-mobile.crx` no formato **CRX3** usando a chave privada RSA em `.keys/preenche-sigeduc.pem` (criada localmente na primeira execução e ignorada pelo `.gitignore`, mantendo o ID `mdckmbhobjcoaamkcfloofpdmciidjjg` estável entre versões).
- Em pipelines de CI (`.github/workflows/release.yml`), o secret **`CRX_PRIVATE_KEY_PEM`** já deve conter o conteúdo da chave `.pem` para manter o mesmo Extension ID nas releases publicadas por tag (`v*`) ou disparo manual (`gh workflow run`).
- Para publicar uma nova versão com segurança (rodando `npm run harness`, atualizando `package.json` + `manifest.json`, criando tag `vX.Y.Z` e enviando ao GitHub), utilize:
  ```bash
  # Simular sem alterar arquivos
  npm run release -- patch --dry-run

  # Publicar nova versão (patch, minor, major ou X.Y.Z)
  npm run release -- patch
  ```

## Documentação Adicional

- [AGENTS.md](AGENTS.md) — Arquitetura, invariantes e regras de verificação.
- [SPEC.md](SPEC.md) — Especificação técnica detalhada.
- [Roadmap.md](Roadmap.md) — Planejamento de melhorias e prioridades.
- [HARNESS.md](HARNESS.md) — Guia da suíte de verificação automatizada.
