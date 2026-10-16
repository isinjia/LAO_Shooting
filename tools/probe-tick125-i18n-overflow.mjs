/**
 * Tick125 live probe: select / tutorial / pause i18n overflow across locales.
 * Reports scrollHeight>clientHeight / overlay clip only.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

function measureOverflow(selList) {
  const out = [];
  for (const sel of selList) {
    document.querySelectorAll(sel).forEach((el, i) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const sh = el.scrollHeight;
      const sw = el.scrollWidth;
      const ch = el.clientHeight;
      const cw = el.clientWidth;
      const ohY = sh > ch + 1;
      const ohX = sw > cw + 1;
      const parent = el.parentElement;
      let parentClip = false;
      if (parent) {
        const pr = parent.getBoundingClientRect();
        parentClip = r.bottom > pr.bottom + 1.5 || r.right > pr.right + 1.5;
      }
      const overlay = document.getElementById('overlay-content');
      let overlayClip = false;
      if (overlay) {
        const or = overlay.getBoundingClientRect();
        overlayClip = r.bottom > or.bottom + 1.5 || r.top < or.top - 1.5;
      }
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);
      if (ohY || ohX || parentClip || overlayClip) {
        out.push({
          sel: `${sel}[${i}]`,
          ohY,
          ohX,
          parentClip,
          overlayClip,
          sh,
          ch,
          sw,
          cw,
          h: Math.round(r.height),
          w: Math.round(r.width),
          overflowY: cs.overflowY,
          maxH: cs.maxHeight,
          lineHeight: cs.lineHeight,
          fontSize: cs.fontSize,
          text,
        });
      }
    });
  }
  const oc = document.getElementById('overlay-content');
  if (oc) {
    const sh = oc.scrollHeight;
    const ch = oc.clientHeight;
    if (sh > ch + 2) {
      out.push({
        sel: '#overlay-content',
        ohY: true,
        ohX: false,
        sh,
        ch,
        overflowY: getComputedStyle(oc).overflowY,
        text: `panel clip sh=${sh} ch=${ch}`,
      });
    }
  }
  return out;
}

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja'];
const SIZES = [
  { width: 800, height: 450 },
  { width: 960, height: 540 },
  { width: 720, height: 400 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];
const summary = { select: 0, tutorial: 0, pause: 0, runs: 0, errors: 0 };

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      summary.runs += 1;
      const page = await browser.newPage({ viewport: size });
      try {
        await page.addInitScript(({ loc }) => {
          localStorage.setItem(
            'lao_mini_settings_v1',
            JSON.stringify({
              lang: loc,
              muted: true,
              bgmVolume: 0,
              sfxVolume: 0,
              autoFire: true,
              padMode: 'fixed',
              fullscreen: false,
            }),
          );
          localStorage.removeItem('lao_mini_tutorial_seen');
        }, { loc });

        await page.goto(`${url}?cb=${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        // SELECT
        await page.click('#btn-start');
        await page.waitForSelector('#select-dossier-kit', { timeout: 180000 });
        const card = page.locator('.char-card[data-key="constantia"]');
        if (await card.count()) await card.click();
        else await page.locator('.char-card').first().click();
        await page.waitForTimeout(80);

        // Also capture kit metrics even without overflow (for wrap-only skip evidence)
        const kitMeta = await page.evaluate(() => {
          const el = document.getElementById('select-dossier-kit');
          if (!el) return null;
          const dossier = el.closest('.select-dossier');
          return {
            text: (el.textContent || '').trim(),
            sh: el.scrollHeight,
            ch: el.clientHeight,
            sw: el.scrollWidth,
            cw: el.clientWidth,
            dossierSh: dossier?.scrollHeight,
            dossierCh: dossier?.clientHeight,
          };
        });

        let hits = await page.evaluate(measureOverflow, [
          '#select-dossier-kit',
          '.select-dossier-hint',
          '.select-dossier-name',
          '.select-dossier',
          '.select-blurb',
        ]);
        if (!hits.length && kitMeta) {
          // record wrap-only note when tall wrap but no OH
          if (kitMeta.sh >= 40) {
            findings.push({
              screen: 'select-wrap',
              loc,
              w: size.width,
              h: size.height,
              sel: '#select-dossier-kit',
              note: 'wrap-only',
              ...kitMeta,
            });
          }
        }
        for (const h of hits) {
          findings.push({ screen: 'select', loc, w: size.width, h: size.height, ...h });
          summary.select += 1;
        }

        // TUTORIAL
        await page.evaluate(() => localStorage.removeItem('lao_mini_tutorial_seen'));
        await page.click('#btn-go');
        await page.waitForTimeout(300);
        const tutVisible = await page.evaluate(() => {
          const oc = document.getElementById('overlay-content');
          return !!(oc && oc.classList.contains('screen-tutorial'));
        });
        if (tutVisible) {
          const tutMeta = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('.tut-row')].map((el) => ({
              sh: el.scrollHeight,
              ch: el.clientHeight,
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
            }));
            const note = document.querySelector('.tutorial-note');
            const oc = document.getElementById('overlay-content');
            return {
              rows,
              note: note
                ? { sh: note.scrollHeight, ch: note.clientHeight, text: (note.textContent || '').trim().slice(0, 90) }
                : null,
              panel: oc
                ? {
                    sh: oc.scrollHeight,
                    ch: oc.clientHeight,
                    overflowY: getComputedStyle(oc).overflowY,
                    maxH: getComputedStyle(oc).maxHeight,
                  }
                : null,
            };
          });
          hits = await page.evaluate(measureOverflow, [
            '.tut-row',
            '.tut-row > span:last-child',
            '.tutorial-note',
            '.tutorial-grid',
            '.opt-head h2',
            '.pause-actions',
          ]);
          for (const h of hits) {
            findings.push({ screen: 'tutorial', loc, w: size.width, h: size.height, ...h });
            summary.tutorial += 1;
          }
          if (!hits.length) {
            findings.push({
              screen: 'tutorial-ok',
              loc,
              w: size.width,
              h: size.height,
              panel: tutMeta.panel,
              tallestRow: tutMeta.rows.reduce((a, b) => (b.sh > a.sh ? b : a), { sh: 0 }),
              note: tutMeta.note,
            });
          }

          // Skip tutorial into game for pause probe (only at 800x450 for speed)
          if (size.width === 800 && (loc === 'es' || loc === 'ru' || loc === 'pt' || loc === 'en')) {
            const skip = page.locator('#btn-tut-skip');
            if (await skip.count()) await skip.click();
            else await page.locator('#btn-tut-go').click();
            try {
              await page.waitForFunction(
                () => document.getElementById('overlay')?.classList.contains('hidden'),
                null,
                { timeout: 120000 },
              );
              await page.keyboard.press('Escape');
              await page.waitForTimeout(120);
              const paused = await page.evaluate(() => {
                const oc = document.getElementById('overlay-content');
                return !!(oc && oc.classList.contains('screen-pause'));
              });
              if (paused) {
                hits = await page.evaluate(measureOverflow, [
                  '.pause-blurb',
                  '.pause-stamp h2',
                  '.pause-actions .btn',
                  '.pause-actions',
                ]);
                for (const h of hits) {
                  findings.push({ screen: 'pause', loc, w: size.width, h: size.height, ...h });
                  summary.pause += 1;
                }
                if (!hits.length) {
                  findings.push({ screen: 'pause-ok', loc, w: size.width, h: size.height });
                }
              }
            } catch (err) {
              findings.push({
                screen: 'pause-error',
                loc,
                w: size.width,
                h: size.height,
                text: String(err.message || err).slice(0, 120),
              });
            }
          }
        } else {
          findings.push({
            screen: 'tutorial-miss',
            loc,
            w: size.width,
            h: size.height,
            text: 'tutorial not shown',
          });
        }
      } catch (err) {
        summary.errors += 1;
        findings.push({
          screen: 'error',
          loc,
          w: size.width,
          h: size.height,
          text: String(err.message || err).slice(0, 160),
        });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const muddy = findings.filter((f) =>
  ['select', 'tutorial', 'pause', 'error', 'pause-error', 'tutorial-miss'].includes(f.screen),
);
console.log(JSON.stringify({ summary, muddyCount: muddy.length, muddy, all: findings }, null, 2));
