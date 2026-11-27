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

## Lojas Oficiais e Links Rápidos de Download

A extensão já está **publicada e aprovada** nas lojas oficiais do Chrome e do Edge (com envio para análise na loja do Firefox):

| Plataforma / Navegador | Instalação Principal / Artefato | Link / URL Direta |
| :--- | :--- | :--- |
| **Google Chrome (PC)** | **Chrome Web Store (Oficial — 1 clique)** | [Instalar na Chrome Web Store](https://chromewebstore.google.com/detail/preenche-sigeduc/fafdmobaohddjlphkfkhfhahlpeffeji?hl=pt-br) |
| **Microsoft Edge (PC)** | **Edge Add-ons (Oficial — 1 clique)** | [Instalar no Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/gdcgkkoafnofbpalilnfnijlcfafnbfa) |
| **Edge Canary (Android)** | `preenche-sigeduc-edge-mobile.crx` ([`is.gd/sige_mobile`](https://is.gd/sige_mobile)) | `https://github.com/devmagary/preenchesigeduc/releases/latest/download/preenche-sigeduc-edge-mobile.crx` |
| **Chrome Manual / Mises / Lemur** | `preenche-sigeduc-chrome.zip` ([`is.gd/sige_navegador`](https://is.gd/sige_navegador)) | `https://github.com/devmagary/preenchesigeduc/releases/latest/download/preenche-sigeduc-chrome.zip` |
| **Firefox Desktop / Android** *(em análise na AMO)* | `preenche-sigeduc-firefox.zip` ([`is.gd/sige_firefox`](https://is.gd/sige_firefox)) | `https://github.com/devmagary/preenchesigeduc/releases/latest/download/preenche-sigeduc-firefox.zip` |

> **Portal Web de Download Direto (GitHub Pages):** https://is.gd/sigeduc → https://devmagary.github.io/preenchesigeduc/ (publicado a partir de [docs/index.html](docs/index.html)) com **detecção automática do navegador**, botões diretos para as lojas e passo a passo interativo.

## Instalação (PC e Android)

### Google Chrome / Microsoft Edge (PC — Recomendado via Loja Oficial)
1. Acesse a [Chrome Web Store](https://chromewebstore.google.com/detail/preenche-sigeduc/fafdmobaohddjlphkfkhfhahlpeffeji?hl=pt-br) (no Chrome) ou o [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/gdcgkkoafnofbpalilnfnijlcfafnbfa) (no Edge) e clique em **Usar no Chrome** / **Obter**.
2. *(Opcional — pacote manual `.zip`)* Caso prefira instalar manualmente, baixe e descompacte `preenche-sigeduc-chrome.zip` (ou gere via `npm run build && npm run package`), abra `chrome://extensions` ou `edge://extensions`, ative o **Modo do desenvolvedor** e clique em **Carregar sem compactação** selecionando a pasta extraída (ou `dist/chrome/`).

### Edge Canary (Android) via `.crx`
1. Baixe `preenche-sigeduc-edge-mobile.crx` diretamente no celular.
2. No **Edge Canary Android**, abra **Configurações → Sobre o Microsoft Edge** e toque 5 vezes no número da versão para habilitar as **Opções do desenvolvedor**.
3. Acesse **Opções do desenvolvedor → Instalar extensão por .crx** (*Extension install by crx*) e selecione o arquivo `preenche-sigeduc-edge-mobile.crx`.

### Mises / Lemur (Android)
1. Baixe `preenche-sigeduc-chrome.zip`.
2. Abra a página de **Extensões**, ative o modo desenvolvedor e importe diretamente o `.zip`.

### Firefox Desktop / Firefox Android *(AMO em análise)*
1. Enquanto a análise na Mozilla Add-ons (AMO) é concluída, baixe `preenche-sigeduc-firefox.zip`.
2. No Desktop, abra `about:debugging#/runtime/this-firefox` → **Carregar extensão temporária** selecionando `manifest.json` dentro da pasta extraída (ou `dist/firefox/manifest.json`), ou ative extensões personalizadas no Firefox Nightly/Beta Android.

## Desenvolvimento e Verificação

```bash
# Instalar dependências
npm install

# Gerar builds (dist/chrome e dist/firefox) e pacotes (.zip + .crx assinado)
npm run build && npm run package

# Executar verificação completa (typecheck, build, package, testes unitários, benchmark e E2E)
npm run harness
```

### Assinatura `.crx`, Releases Automáticos e Lojas Oficiais
- O comando `npm run package` gera automaticamente `dist/preenche-sigeduc-edge-mobile.crx` no formato **CRX3** usando a chave privada RSA em `.keys/preenche-sigeduc.pem` (criada localmente na primeira execução e ignorada pelo `.gitignore`, mantendo o ID `mdckmbhobjcoaamkcfloofpdmciidjjg` estável entre versões).
- Em pipelines de CI (`.github/workflows/release.yml`), alterações enviadas para `main` (ou tags `v*`) publicam automaticamente uma nova release no GitHub Releases com os 3 artefatos fixos (`preenche-sigeduc-chrome.zip`, `preenche-sigeduc-firefox.zip` e `preenche-sigeduc-edge-mobile.crx`), usando o secret **`CRX_PRIVATE_KEY_PEM`** para preservar o ID da extensão.
- Para publicação automática nas lojas oficiais a cada release (com fallback gracioso sem interromper a release se alguma loja não estiver configurada), configure os secrets opcionais no repositório GitHub:
  - **Chrome Web Store** (`scripts/cws-publish.mjs`): `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID`
  - **Microsoft Edge Add-ons** (`scripts/edge-publish.mjs`): `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`
  - **Firefox Add-ons (AMO)** (`scripts/amo-publish.mjs`): `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`, `AMO_ADDON_ID`
- Para disparar manualmente uma release local com bump de versão (`patch`, `minor`, `major` ou `X.Y.Z`), utilize:
  ```bash
  # Simular sem alterar arquivos
  npm run release -- patch --dry-run

  # Publicar nova versão (patch, minor, major ou X.Y.Z)
  npm run release -- patch
  ```

## Aviso Legal, Uso Gratuito e Isenção de Responsabilidade

- **Ferramenta independente e não oficial:** O **Preenche SIGEduc** é um projeto independente de código aberto, **sem qualquer vínculo, patrocínio, homologação ou endosso** da Secretaria da Educação do Estado da Bahia (SEC-BA) ou do Governo do Estado da Bahia. A menção ao nome SIGEduc tem caráter exclusivamente descritivo de compatibilidade; marcas e sistemas citados pertencem aos seus respectivos titulares.
- **Distribuição gratuita:** Esta extensão é disponibilizada **100% gratuitamente**, sem fins lucrativos e sem cobrança de licenças, assinaturas ou acesso.
- **Privacidade e LGPD (processamento 100% local):** Todo o processamento ocorre localmente no navegador do próprio usuário. A extensão não possui servidor próprio, não realiza telemetria e não coleta, armazena ou transmite dados de estudantes, notas, frequências ou credenciais/senhas para terceiros. Consulte também a [Política de Privacidade pública](https://devmagary.github.io/preenchesigeduc/privacidade.html).
- **Isenção de garantia e responsabilidade do usuário:** O software é fornecido **"no estado em que se encontra" (*as is*)**, sem garantias expressas ou implícitas quanto à disponibilidade contínua diante de alterações no portal oficial do SIGEduc. A ferramenta atua apenas como auxílio de preenchimento local; **a conferência integral das notas, frequências e registros antes da confirmação/gravação definitiva no diário de classe é de exclusiva responsabilidade do docente utilizador.**
