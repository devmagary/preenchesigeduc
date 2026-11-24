# Relatório de Métricas e SLA — Preenche SIGEduc

Gerado em: 2026-11-24T11:27:29.355Z

## 1. Parse de Planilha (500 linhas × 10 colunas, 20 execuções)

| Formato | Média (ms) | p99 (ms) | Máximo (ms) | Meta SLA | Status |
| :--- | ---: | ---: | ---: | :---: | :---: |
| **.xlsx** | 15.13 | 29.3 | 29.3 | < 250 ms | PASSOU |
| **.csv** | 0.32 | 0.56 | 0.56 | < 250 ms | PASSOU |

## 2. Preenchimento Sequencial AJAX & Matching (45 alunos × 4 atividades + 2 divergentes)

- **Tempo de abertura do painel Shadow DOM:** 17.68 ms (Meta: < 100 ms)
- **Eventos `onblur` AJAX esperados:** 180
- **Eventos `onblur` AJAX recebidos pelo servidor mock:** 180
- **Taxa de perda de eventos AJAX:** 0% (Meta: 0%)
- **Tempo total do lote sequencial (com latência mock 25ms/req):** 6155.11 ms
- **Precisão de matching:** 45/45 exatos, 0 falsos positivos (Meta: 100% exatos, 0 falsos positivos)

## 3. Tamanho Final dos Pacotes

| Artefato | Tamanho (KB) | Meta SLA | Status |
| :--- | ---: | :---: | :---: |
| `dist/chrome/` (descompactado) | 569.9 KB | < 1536 KB | PASSOU |
| `dist/firefox/` (descompactado) | 570.1 KB | < 1536 KB | PASSOU |
| `dist/preenche-sigeduc-chrome.zip` | 183.4 KB | < 512 KB | PASSOU |
| `dist/preenche-sigeduc-firefox.zip` | 183.4 KB | < 512 KB | PASSOU |
| `dist/preenche-sigeduc-edge-mobile.crx` | 183.9 KB | < 512 KB | PASSOU |
