import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

export function startMockServer({ ajaxDelayMs = 25 } = {}) {
  const metrics = {
    notasAjaxCount: 0,
    notasEvents: [],
    freqCalendarCount: 0,
    freqCalendarDates: [],
  };

  function readBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }

  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = urlObj.pathname;

    if (pathname === '/__metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metrics));
      return;
    }

    if (pathname === '/__reset') {
      metrics.notasAjaxCount = 0;
      metrics.notasEvents = [];
      metrics.freqCalendarCount = 0;
      metrics.freqCalendarDates = [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && pathname.includes('lancar_notas')) {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const inputId = params.get('inputId') || '';
      const unitInputId = params.get('unitInputId') || '';
      const unitTotal = params.get('unitTotal') || '';
      metrics.notasAjaxCount++;
      metrics.notasEvents.push({ inputId, unitInputId, unitTotal });

      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, inputId, unitInputId, unitTotal }));
      }, ajaxDelayMs);
      return;
    }

    if (req.method === 'POST' && pathname.includes('frequencia_aluno')) {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const dia = Number(params.get('dia'));
      const mes = Number(params.get('mes'));
      const ano = Number(params.get('ano'));
      const dateDisplay = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`;
      const slots = dia === 12 ? 2 : 1; // 12/08/2026 simula aula dupla (2 horários)
      metrics.freqCalendarCount++;
      metrics.freqCalendarDates.push(dateDisplay);

      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, dateDisplay, slots }));
      }, ajaxDelayMs);
      return;
    }

    if (pathname.endsWith('docente.jsf')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(fixturesDir, 'docente.html'), 'utf8'));
      return;
    }

    if (pathname.includes('form_estudantes_realizacoes_avaliacoes')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(fixturesDir, 'avaliacoes_nao_realizadas.html'), 'utf8'));
      return;
    }

    if (pathname.includes('lancar_notas')) {
      const tipo = urlObj.searchParams.get('tipo');
      const file = tipo === 'semestral' ? 'lancar_notas_semestral.html' : 'lancar_notas_anual.html';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(fixturesDir, file), 'utf8'));
      return;
    }

    if (pathname.includes('frequencia_aluno')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(fixturesDir, 'lancar_frequencia.html'), 'utf8'));
      return;
    }

    if (pathname.includes('grupo_avaliacao_unidade')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(fixturesDir, 'gerenciar_avaliacoes.html'), 'utf8'));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        port: addr.port,
        baseUrl: `http://127.0.0.1:${addr.port}`,
        metrics,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const srv = await startMockServer();
  console.log(`Mock server listening at ${srv.baseUrl}`);
}
