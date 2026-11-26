import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const outDir = path.join(rootDir, 'trabalho', 'evidencias-landing');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.json': 'application/json; charset=utf-8',
};

function startDocsServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqPath = (req.url || '/').split('?')[0];
      const safeRel = path.normalize(reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, ''));
      const fullPath = path.join(docsDir, safeRel);
      if (!fullPath.startsWith(docsDir) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

async function collectLayoutMetrics(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sw = document.documentElement.scrollWidth;
    const bw = document.body.scrollWidth;
    const theme = document.documentElement.getAttribute('data-theme') || 'default';

    const hasHorizontalScrollAncestor = (el) => {
      let cur = el.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const st = getComputedStyle(cur);
        if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && cur.scrollWidth > cur.clientWidth + 1) {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    const overflowingElements = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1.5 || r.left < -1.5) {
        if (hasHorizontalScrollAncestor(el)) continue;
        overflowingElements.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
          left: Number(r.left.toFixed(1)),
          right: Number(r.right.toFixed(1)),
          width: Number(r.width.toFixed(1)),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        });
        if (overflowingElements.length >= 20) break;
      }
    }

    const navEl = document.querySelector('.nav');
    const navRect = navEl ? navEl.getBoundingClientRect() : null;
    const navChildren = navEl
      ? Array.from(navEl.querySelectorAll('a, button')).filter((el) => {
          const st = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return st.display !== 'none' && r.width > 0 && r.height > 0;
        })
      : [];
    const navRects = navChildren.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.id || '',
        cls: typeof el.className === 'string' ? el.className : '',
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28),
        left: Number(r.left.toFixed(1)),
        right: Number(r.right.toFixed(1)),
        top: Number(r.top.toFixed(1)),
        bottom: Number(r.bottom.toFixed(1)),
        width: Number(r.width.toFixed(1)),
        height: Number(r.height.toFixed(1)),
      };
    });
    let navOverlapCount = 0;
    for (let i = 0; i < navRects.length; i++) {
      for (let j = i + 1; j < navRects.length; j++) {
        const a = navRects[i];
        const b = navRects[j];
        const hOverlap = a.left < b.right - 1 && a.right > b.left + 1;
        const vOverlap = a.top < b.bottom - 1 && a.bottom > b.top + 1;
        if (hOverlap && vOverlap) navOverlapCount++;
      }
    }

    const smallTouchTargets = [];
    if (vw <= 640) {
      for (const el of Array.from(document.querySelectorAll('a, button, summary, [role="tab"]'))) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const isInlineText =
          el.tagName.toLowerCase() === 'a' &&
          !el.className &&
          el.closest('p, li, footer, small, .faq-ans');
        if (isInlineText) continue;
        if (r.width < 43.5 || r.height < 43.5) {
          smallTouchTargets.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            cls: typeof el.className === 'string' ? el.className : '',
            w: Number(r.width.toFixed(1)),
            h: Number(r.height.toFixed(1)),
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 35),
          });
        }
      }
    }

    return {
      viewport: { width: vw, height: vh },
      theme,
      scrollWidth: sw,
      bodyScrollWidth: bw,
      hasHorizontalOverflow: sw > vw + 1 || bw > vw + 1,
      overflowingElements,
      navbar: {
        height: navRect ? Number(navRect.height.toFixed(1)) : null,
        rightOverflow: navRect ? navRect.right > vw + 1 : false,
        overlapCount: navOverlapCount,
        items: navRects,
      },
      smallTouchTargetsCount: smallTouchTargets.length,
      smallTouchTargets: smallTouchTargets.slice(0, 30),
    };
  });
}

async function scrollIntoSection(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 76);
    window.scrollTo({ top, behavior: 'instant' });
  }, selector);
  await page.waitForTimeout(180);
}

async function main() {
  const srv = await startDocsServer();
  let browser;
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--headless=new', '--no-sandbox'],
    });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`);
    });
    const httpErrors = [];
    page.on('response', (res) => {
      if (res.status() >= 400) {
        httpErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    const reports = {};

    // 1. Mobile 390x844 Light
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${srv.baseUrl}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    reports.mobile_390_light = await collectLayoutMetrics(page);
    await page.screenshot({ path: path.join(outDir, 'mobile_390_light_hero.png') });

    await scrollIntoSection(page, '#demo');
    await page.screenshot({ path: path.join(outDir, 'mobile_390_light_demo.png') });

    await scrollIntoSection(page, '#planilha');
    await page.screenshot({ path: path.join(outDir, 'mobile_390_light_planilha.png') });

    await scrollIntoSection(page, '#download');
    await page.screenshot({ path: path.join(outDir, 'mobile_390_light_downloads.png') });

    await scrollIntoSection(page, '#duvidas');
    await page.screenshot({ path: path.join(outDir, 'mobile_390_light_duvidas.png') });

    // Interações em mobile 390x844
    const interactionChecks = {};
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.click('#theme-toggle');
    interactionChecks.themeToggledDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

    // 2. Mobile 390x844 Dark
    reports.mobile_390_dark = await collectLayoutMetrics(page);
    await page.screenshot({ path: path.join(outDir, 'mobile_390_dark_hero.png') });
    await scrollIntoSection(page, '#demo');
    await page.screenshot({ path: path.join(outDir, 'mobile_390_dark_demo.png') });

    // Testar interatividade das abas e botões no mobile
    await page.click('[data-demo-tab="frequencia"]');
    await page.waitForTimeout(120);
    interactionChecks.demoFreqBadge = await page.textContent('#mock-context-badge');
    await page.click('[data-demo-tab="extrair"]');
    await page.waitForTimeout(120);
    interactionChecks.demoExtractBadge = await page.textContent('#mock-context-badge');
    await page.click('[data-demo-tab="notas"]');
    await page.waitForTimeout(120);

    await page.click('#demo-run-btn');
    await page.waitForTimeout(550);
    interactionChecks.demoProgressAfterRun = await page.textContent('#dp-progress-pct');

    await page.click('[data-sheet-tab="adm"]');
    await page.waitForTimeout(120);
    interactionChecks.sheetTabAdmActive = await page.getAttribute('[data-sheet-tab="adm"]', 'aria-selected');

    await page.click('[data-guide-tab="edge-android"]');
    await page.waitForTimeout(120);
    interactionChecks.guideEdgeActive = await page.evaluate(() =>
      document.getElementById('guide-edge-android')?.classList.contains('active')
    );

    const faqExpanded = await page.evaluate(() => {
      const det = document.querySelector('#duvidas details');
      if (!det) return false;
      det.querySelector('summary')?.click();
      return det.open;
    });
    interactionChecks.faqExpanded = faqExpanded;

    // 3. Mobile 360x800 Light & Dark
    await page.click('#theme-toggle'); // back to light
    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(200);
    reports.mobile_360_light = await collectLayoutMetrics(page);
    await page.screenshot({ path: path.join(outDir, 'mobile_360_light_hero.png') });
    await scrollIntoSection(page, '#download');
    await page.screenshot({ path: path.join(outDir, 'mobile_360_light_downloads.png') });

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.click('#theme-toggle');
    await page.waitForTimeout(150);
    reports.mobile_360_dark = await collectLayoutMetrics(page);

    // 4. Desktop 1280x720 Light
    await page.click('#theme-toggle'); // light
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(200);
    reports.desktop_1280_light = await collectLayoutMetrics(page);
    await page.screenshot({ path: path.join(outDir, 'desktop_1280_light_hero.png') });
    await scrollIntoSection(page, '#demo');
    await page.screenshot({ path: path.join(outDir, 'desktop_1280_light_demo.png') });

    // 5. privacidade.html at 360x800
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${srv.baseUrl}/privacidade.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    reports.mobile_360_privacidade = await collectLayoutMetrics(page);
    await page.screenshot({ path: path.join(outDir, 'mobile_360_privacidade.png') });

    const finalReport = {
      generatedAt: new Date().toISOString(),
      consoleErrors,
      pageErrors,
      failedRequests,
      httpErrors,
      interactionChecks,
      reports,
      screenshots: fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort(),
    };
    fs.writeFileSync(
      path.join(outDir, 'landing_audit_report.json'),
      JSON.stringify(finalReport, null, 2),
      'utf8'
    );
    console.log(
      JSON.stringify(
        {
          summary: Object.fromEntries(
            Object.entries(reports).map(([k, v]) => [
              k,
              {
                hasHorizontalOverflow: v.hasHorizontalOverflow,
                scrollWidth: v.scrollWidth,
                viewportWidth: v.viewport.width,
                overflowingCount: v.overflowingElements.length,
                navOverlapCount: v.navbar.overlapCount,
                navRightOverflow: v.navbar.rightOverflow,
                smallTouchTargetsCount: v.smallTouchTargetsCount,
              },
            ])
          ),
          consoleErrorsCount: consoleErrors.length,
          pageErrorsCount: pageErrors.length,
          screenshotsCount: finalReport.screenshots.length,
        },
        null,
        2
      )
    );
  } finally {
    if (browser) await browser.close();
    await srv.close();
  }
}

await main();
